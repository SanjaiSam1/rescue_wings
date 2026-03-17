/**
 * Chat Page - Real-time messaging
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { chatAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

const QUICK_MESSAGES = {
  citizen: [
    'I need immediate assistance!',
    'Please send a volunteer to my location.',
    'I am safe, no further help needed.',
    'Can someone check on me?',
    'I require medical attention.',
  ],
  volunteer: [
    'I am on the way to your location now.',
    'Please keep your phone reachable.',
    'Share a nearby landmark for faster arrival.',
    'I have reached your area and I am looking for you.',
    'Mission completed. Stay safe.',
  ],
  admin: [
    'Your volunteer account has been approved.',
    'Your volunteer application was not approved at this time.',
    'Please update your profile details and reapply.',
    'A new mission has been assigned to you.',
    'Contact support if you need help with your account.',
  ],
};

const formatLastSeen = (dateValue) => {
  if (!dateValue) return 'Offline';
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return 'Offline';

  const now = Date.now();
  const diffMs = Math.max(0, now - dt.getTime());
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;

  return `Last seen ${dt.toLocaleString()}`;
};

export default function ChatPage() {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(paramUserId || null);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatDisabledReason, setChatDisabledReason] = useState('');
  const [presenceByUser, setPresenceByUser] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    Promise.all([chatAPI.getConversations(), chatAPI.getContacts()])
      .then(([convRes, contactsRes]) => {
        const conversationList = convRes.data.conversations || [];
        const contactList = contactsRes.data.contacts || [];

        setConversations(conversationList);
        setContacts(contactList);

        const initialPresence = {};
        conversationList.forEach((conv) => {
          const partner = conv?.partner;
          if (!partner?._id) return;
          initialPresence[String(partner._id)] = {
            isOnline: Boolean(partner.isOnline),
            lastSeen: partner.lastSeen || null,
          };
        });
        contactList.forEach((contact) => {
          if (!contact?._id) return;
          initialPresence[String(contact._id)] = {
            isOnline: Boolean(contact.isOnline),
            lastSeen: contact.lastSeen || null,
          };
        });
        setPresenceByUser(initialPresence);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    setLoading(true);
    chatAPI.getMessages(activeChat).then(({ data }) => {
      setMessages(data.messages);
      setConversations((prev) => prev.map((c) => (
        c.partner?._id === activeChat ? { ...c, unreadCount: 0 } : c
      )));
    }).finally(() => setLoading(false));

    const socket = getSocket();
    if (socket && user?._id) {
      socket.emit('join_chat_room', { userA: user._id, userB: activeChat });
    }

    return () => {
      if (socket && user?._id) {
        socket.emit('leave_chat_room', { userA: user._id, userB: activeChat });
      }
    };
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onIncomingMessage = (msg) => {
      if (msg.senderId._id === activeChat || msg.receiverId === activeChat) {
        setMessages(prev => [...prev, msg]);
      }

      const senderId = msg.senderId?._id || msg.senderId;
      const receiverId = msg.receiverId?._id || msg.receiverId;
      const partnerId = senderId === user?._id ? receiverId : senderId;
      const partner = msg.senderId?._id === user?._id ? msg.receiverId : msg.senderId;

      setConversations(prev => {
        const list = [...prev];
        const idx = list.findIndex(c => c.partner?._id === partnerId);
        const newItem = {
          partner: typeof partner === 'string' ? { _id: partnerId } : partner,
          lastMessage: msg,
          unreadCount: receiverId === user?._id ? 1 : 0,
        };

        if (idx === -1) return [newItem, ...list];

        const existing = list[idx];
        const updated = {
          ...existing,
          partner: existing.partner?.name ? existing.partner : newItem.partner,
          lastMessage: msg,
          unreadCount: receiverId === user?._id && activeChat !== partnerId
            ? (existing.unreadCount || 0) + 1
            : existing.unreadCount,
        };
        list.splice(idx, 1);
        return [updated, ...list];
      });
    };

    const onUserTyping = ({ userId }) => {
      if (userId === activeChat) setIsTyping(true);
    };

    const onUserStopTyping = ({ userId }) => {
      if (userId === activeChat) setIsTyping(false);
    };

    const onPresenceUpdate = ({ userId, isOnline, lastSeen }) => {
      if (!userId) return;
      const key = String(userId);
      setPresenceByUser((prev) => ({
        ...prev,
        [key]: {
          isOnline: Boolean(isOnline),
          lastSeen: lastSeen || prev[key]?.lastSeen || null,
        },
      }));

      setConversations((prev) => prev.map((item) => {
        if (String(item?.partner?._id) !== key) return item;
        return {
          ...item,
          partner: {
            ...item.partner,
            isOnline: Boolean(isOnline),
            lastSeen: lastSeen || item.partner?.lastSeen || null,
          },
        };
      }));

      setContacts((prev) => prev.map((contact) => {
        if (String(contact?._id) !== key) return contact;
        return {
          ...contact,
          isOnline: Boolean(isOnline),
          lastSeen: lastSeen || contact.lastSeen || null,
        };
      }));
    };

    const onMessageStatusUpdated = ({ messageId, deliveryStatus, deliveredAt, readAt }) => {
      setMessages((prev) => prev.map((m) => (
        m._id === messageId
          ? { ...m, deliveryStatus, deliveredAt: deliveredAt || m.deliveredAt, readAt: readAt || m.readAt, isRead: deliveryStatus === 'read' ? true : m.isRead }
          : m
      )));
    };

    const onMessageReadBatch = ({ byUserId, readAt }) => {
      if (String(byUserId) !== String(activeChat)) return;
      setMessages((prev) => prev.map((m) => {
        const senderId = m.senderId?._id || m.senderId;
        const receiverId = m.receiverId?._id || m.receiverId;
        const isMyMessage = String(senderId) === String(user?._id) && String(receiverId) === String(activeChat);
        if (!isMyMessage) return m;
        return { ...m, deliveryStatus: 'read', isRead: true, readAt: readAt || m.readAt };
      }));
    };

    socket.on('new_message', onIncomingMessage);
    socket.on('chat_message', onIncomingMessage);
    socket.on('user_typing', onUserTyping);
    socket.on('user_stop_typing', onUserStopTyping);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('message_status_updated', onMessageStatusUpdated);
    socket.on('message_read_batch', onMessageReadBatch);

    return () => {
      socket.off('new_message', onIncomingMessage);
      socket.off('chat_message', onIncomingMessage);
      socket.off('user_typing', onUserTyping);
      socket.off('user_stop_typing', onUserStopTyping);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('message_status_updated', onMessageStatusUpdated);
      socket.off('message_read_batch', onMessageReadBatch);
    };
  }, [activeChat, user?._id]);

  useEffect(() => {
    setChatDisabledReason('');
  }, [activeChat]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !activeChat || chatDisabledReason) return;
    setSending(true);
    try {
      let payload;
      if (imageFile) {
        payload = new FormData();
        payload.append('receiverId', activeChat);
        if (newMessage.trim()) payload.append('message', newMessage.trim());
        payload.append('image', imageFile);
        payload.append('messageType', 'image');
      } else {
        payload = { receiverId: activeChat, message: newMessage.trim() };
      }

      const { data } = await chatAPI.send(payload);
      setMessages(prev => [...prev, data.chatMessage]);
      setNewMessage('');
      setImageFile(null);
      const socket = getSocket();
      if (socket) socket.emit('stop_typing', { receiverId: activeChat, userA: user?._id, userB: activeChat });
    } catch (err) {
      const message = err.response?.data?.error || 'Send failed';
      if (message.toLowerCase().includes('chat is disabled')) {
        setChatDisabledReason(message);
      }
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    const socket = getSocket();
    if (socket && activeChat) {
      socket.emit('typing', { receiverId: activeChat, userA: user?._id, userB: activeChat });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => socket.emit('stop_typing', { receiverId: activeChat, userA: user?._id, userB: activeChat }), 1500);
    }
  };

  const activePartner = conversations.find(c => c.partner?._id === activeChat)?.partner
    || contacts.find(c => c._id === activeChat);
  const activePresence = presenceByUser[String(activeChat)] || {};
  const isPartnerOnline = Boolean(
    typeof activePresence.isOnline === 'boolean' ? activePresence.isOnline : activePartner?.isOnline
  );
  const partnerLastSeen = activePresence.lastSeen || activePartner?.lastSeen || null;

  const availableContacts = contacts.filter(c => !conversations.some(conv => conv.partner?._id === c._id));
  const quickMessages = QUICK_MESSAGES[user?.role] || [];

  const renderReceipt = (msg) => {
    const state = msg.deliveryStatus || (msg.isRead ? 'read' : 'sent');
    if (state === 'read') {
      return <span className="text-[11px] text-blue-200">✓✓</span>;
    }
    if (state === 'delivered') {
      return <span className="text-[11px] text-red-200">✓✓</span>;
    }
    return <span className="text-[11px] text-red-200">✓</span>;
  };

  return (
    <DashboardLayout title="Messages">
      <div className="flex h-[calc(100vh-160px)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-100 flex flex-col">
          <div className="p-4 border-b font-bold text-gray-900">Conversations</div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No conversations yet</div>
            ) : conversations.map(conv => (
              <button key={conv.partner?._id} onClick={() => setActiveChat(conv.partner?._id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${activeChat === conv.partner?._id ? 'bg-red-50 border-r-2 border-primary' : ''}`}>
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {conv.partner?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{conv.partner?.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{conv.partner?.role}</div>
                  <div className="text-xs text-gray-500 truncate">{conv.lastMessage?.message}</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${presenceByUser[String(conv.partner?._id)]?.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                {conv.unreadCount > 0 && (
                  <span className="bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}

            {availableContacts.length > 0 && (
              <div className="p-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Start New Chat</div>
                <div className="space-y-2">
                  {availableContacts.map(contact => (
                    <button
                      key={contact._id}
                      onClick={() => setActiveChat(contact._id)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 border border-gray-100"
                    >
                      <div className="font-semibold text-sm text-gray-900 truncate">{contact.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{contact.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="p-4 border-b flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                {activePartner?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{activePartner?.name || 'Unknown'}</div>
                <div className={`text-xs ${isTyping ? 'text-green-500' : isPartnerOnline ? 'text-green-500' : 'text-gray-500'}`}>
                  {isTyping ? 'Typing...' : isPartnerOnline ? 'Online' : formatLastSeen(partnerLastSeen)}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"/></div>
              ) : messages.map(msg => {
                const isMe = msg.senderId?._id === user?._id || msg.senderId === user?._id;
                return (
                  <div key={msg._id || msg.timestamp} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      isMe ? 'bg-primary text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'
                    }`}>
                      {msg.messageType === 'image' ? (
                        <a href={msg.message} target="_blank" rel="noreferrer" className="block">
                          <img src={msg.message} alt="chat attachment" className="rounded-lg max-h-56 object-cover" />
                        </a>
                      ) : (
                        <p>{msg.message}</p>
                      )}
                      <div className={`text-xs mt-1 flex items-center gap-1 justify-end ${isMe ? 'text-red-200' : 'text-gray-400'}`}>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        {isMe && renderReceipt(msg)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-none">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.1}s`}}/>)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t flex gap-3">
              <div className="flex-1 space-y-2">
                {quickMessages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quickMessages.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={Boolean(chatDisabledReason)}
                        onClick={() => setNewMessage(preset)}
                        className="text-xs px-2.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
                {chatDisabledReason && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {chatDisabledReason}
                  </div>
                )}
                <input
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleTyping}
                  disabled={Boolean(chatDisabledReason)}
                />
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      disabled={Boolean(chatDisabledReason)}
                    />
                    Attach image
                  </label>
                  {imageFile && <span className="text-xs text-gray-500 truncate max-w-[180px]">{imageFile.name}</span>}
                </div>
              </div>
              <button type="submit" disabled={(!newMessage.trim() && !imageFile) || sending || Boolean(chatDisabledReason)}
                className="bg-primary text-white px-5 py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold text-sm">
                {sending ? '...' : 'Send'}
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
