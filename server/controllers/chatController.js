/**
 * Chat Controller
 */
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');
const RescueRequest = require('../models/RescueRequest');
const { createNotification } = require('../utils/notificationService');

const isAllowedPair = (roleA, roleB) => {
  const pair = [roleA, roleB].sort().join(':');
  return pair === 'citizen:volunteer' || pair === 'admin:volunteer';
};

const ensureAllowedChat = (senderRole, receiverRole) => {
  return isAllowedPair(senderRole, receiverRole);
};

const getChatRoomId = (userA, userB) => `chat_${[String(userA), String(userB)].sort().join('_')}`;

const isClosedMissionStatus = (status) => ['rescued', 'cancelled', 'failed'].includes(status);

const validateMissionChatOpen = async (sender, receiver) => {
  const roles = [sender.role, receiver.role].sort().join(':');
  if (roles !== 'citizen:volunteer') return { allowed: true };

  const citizenId = sender.role === 'citizen' ? sender._id : receiver._id;
  const volunteerId = sender.role === 'volunteer' ? sender._id : receiver._id;

  const latestMission = await RescueRequest.findOne({
    userId: citizenId,
    assignedVolunteer: volunteerId,
  }).sort({ createdAt: -1 }).select('status _id');

  if (!latestMission) {
    return { allowed: false, error: 'Chat opens only after a volunteer is assigned to your mission.' };
  }

  if (isClosedMissionStatus(latestMission.status)) {
    return { allowed: false, error: 'Chat is disabled because this mission is closed.' };
  }

  return { allowed: true, requestId: latestMission._id };
};

// POST /api/chat/send
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message, rescueRequestId, messageType } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const normalizedMessage = String(message || '').trim();

    if (!normalizedMessage && !imagePath) {
      return res.status(400).json({ error: 'Message text or image is required.' });
    }

    const receiver = await User.findById(receiverId).select('role isActive');
    if (!receiver || !receiver.isActive) {
      return res.status(404).json({ error: 'Receiver not available' });
    }

    if (!ensureAllowedChat(req.user.role, receiver.role)) {
      return res.status(403).json({ error: 'Chat is only allowed between Citizen-Volunteer and Volunteer-Admin' });
    }

    const missionGate = await validateMissionChatOpen(req.user, receiver);
    if (!missionGate.allowed) {
      return res.status(403).json({ error: missionGate.error });
    }

    const resolvedRequestId = rescueRequestId || missionGate.requestId;

    if (resolvedRequestId) {
      const mission = await RescueRequest.findById(resolvedRequestId).select('status');
      if (mission && isClosedMissionStatus(mission.status)) {
        return res.status(403).json({ error: 'Chat is disabled because this mission is closed.' });
      }
    }

    const io = req.app.get('io');
    const receiverOnline = (io.sockets.adapter.rooms.get(`user_${receiverId}`)?.size || 0) > 0;

    const chatMessage = await ChatMessage.create({
      senderId: req.user._id,
      receiverId,
      message: imagePath || normalizedMessage,
      rescueRequestId: resolvedRequestId,
      messageType: imagePath ? 'image' : (messageType || 'text'),
      deliveryStatus: receiverOnline ? 'delivered' : 'sent',
      deliveredAt: receiverOnline ? new Date() : undefined,
    });

    await chatMessage.populate('senderId', 'name avatar role');
    await chatMessage.populate('receiverId', 'name avatar role');

    // Emit real-time message to pair room and receiver room.
    const chatRoomId = getChatRoomId(req.user._id, receiverId);
    io.to(chatRoomId).emit('chat_message', chatMessage);
    io.to(`user_${receiverId}`).emit('new_message', chatMessage);

    io.to(`user_${req.user._id}`).emit('message_status_updated', {
      messageId: chatMessage._id,
      deliveryStatus: chatMessage.deliveryStatus,
      deliveredAt: chatMessage.deliveredAt,
      readAt: chatMessage.readAt,
    });

    await createNotification(io, {
      userId: receiverId,
      role: receiver.role,
      type: 'chat',
      message: `New message from ${req.user.name || 'User'}`,
      linkedId: chatMessage._id,
      data: {
        chatWithUserId: String(req.user._id),
        chatWithName: req.user.name || 'User',
        messageId: String(chatMessage._id),
      },
    });

    res.status(201).json({ message: 'Message sent', chatMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/chat/messages/:userId
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user._id;

    const partner = await User.findById(userId).select('role isActive');
    if (!partner || !partner.isActive) {
      return res.status(404).json({ error: 'Conversation partner not available' });
    }

    if (!ensureAllowedChat(req.user.role, partner.role)) {
      return res.status(403).json({ error: 'Chat is only allowed between Citizen-Volunteer and Volunteer-Admin' });
    }

    const messages = await ChatMessage.find({
      $or: [
        { senderId: currentUser, receiverId: userId },
        { senderId: userId, receiverId: currentUser },
      ],
    })
      .populate('senderId', 'name avatar role')
      .populate('receiverId', 'name avatar role')
      .sort({ timestamp: 1 })
      .limit(100);

    // Mark messages as read
    const readAt = new Date();
    await ChatMessage.updateMany(
      { senderId: userId, receiverId: currentUser, isRead: false },
      { isRead: true, deliveryStatus: 'read', readAt, deliveredAt: readAt }
    );

    const io = req.app.get('io');
    io.to(`user_${userId}`).emit('message_read_batch', {
      byUserId: String(currentUser),
      readAt,
    });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await ChatMessage.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate('senderId', 'name avatar role isOnline lastSeen')
      .populate('receiverId', 'name avatar role isOnline lastSeen')
      .sort({ timestamp: -1 });

    // Group by conversation partner
    const conversations = {};
    messages.forEach(msg => {
      const partnerId = msg.senderId._id.toString() === userId.toString()
        ? msg.receiverId._id.toString()
        : msg.senderId._id.toString();

      const partnerRole = msg.senderId._id.toString() === userId.toString()
        ? msg.receiverId.role
        : msg.senderId.role;

      if (!isAllowedPair(req.user.role, partnerRole)) {
        return;
      }

      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner: msg.senderId._id.toString() === userId.toString() ? msg.receiverId : msg.senderId,
          lastMessage: msg,
          unreadCount: 0,
        };
      }
      if (!msg.isRead && msg.receiverId._id.toString() === userId.toString()) {
        conversations[partnerId].unreadCount++;
      }
    });

    res.json({ conversations: Object.values(conversations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/chat/contacts
exports.getContacts = async (req, res) => {
  try {
    let contacts = [];

    if (req.user.role === 'citizen') {
      const approvedVolunteers = await Volunteer.find({ verificationStatus: 'approved' })
        .populate('userId', 'name email role isActive isOnline lastSeen')
        .sort({ verifiedAt: -1 })
        .limit(50);

      contacts = approvedVolunteers
        .map(v => v.userId)
        .filter(Boolean)
        .filter(u => u.isActive)
        .map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, isOnline: Boolean(u.isOnline), lastSeen: u.lastSeen || null }));
    }

    if (req.user.role === 'volunteer') {
      const admins = await User.find({ role: 'admin', isActive: true }).select('name email role isOnline lastSeen').limit(20);
      const assignedRequests = await RescueRequest.find({ assignedVolunteer: req.user._id })
        .populate('userId', 'name email role isActive isOnline lastSeen')
        .sort({ createdAt: -1 })
        .limit(100);

      const citizens = [];
      const seenCitizenIds = new Set();
      assignedRequests.forEach((reqItem) => {
        const citizen = reqItem.userId;
        if (!citizen || !citizen.isActive) return;
        const id = citizen._id.toString();
        if (seenCitizenIds.has(id)) return;
        seenCitizenIds.add(id);
        citizens.push({ _id: citizen._id, name: citizen.name, email: citizen.email, role: citizen.role, isOnline: Boolean(citizen.isOnline), lastSeen: citizen.lastSeen || null });
      });

      contacts = [
        ...admins.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, isOnline: Boolean(u.isOnline), lastSeen: u.lastSeen || null })),
        ...citizens,
      ];
    }

    if (req.user.role === 'admin') {
      const approvedVolunteers = await Volunteer.find({ verificationStatus: 'approved' })
        .populate('userId', 'name email role isActive isOnline lastSeen')
        .sort({ verifiedAt: -1 })
        .limit(100);

      contacts = approvedVolunteers
        .map(v => v.userId)
        .filter(Boolean)
        .filter(u => u.isActive)
        .map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, isOnline: Boolean(u.isOnline), lastSeen: u.lastSeen || null }));
    }

    res.json({ contacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
