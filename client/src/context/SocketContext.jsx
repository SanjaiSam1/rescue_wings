/**
 * Socket Context - Real-time event handling
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);
  const notifiedMessageIdsRef = useRef(new Set());

  const addNotification = (notif) => {
    if (!notif) return;

    const id = String(notif._id || notif.id || (Date.now() + Math.floor(Math.random() * 1000)));
    const fullNotif = {
      ...notif,
      id,
      _id: notif._id || id,
      read: Boolean(notif.read || notif.isRead),
      isRead: Boolean(notif.read || notif.isRead),
      createdAt: notif.createdAt || new Date().toISOString(),
    };

    setNotifications((prev) => {
      const exists = prev.find((n) => String(n._id || n.id) === String(fullNotif._id || fullNotif.id));
      if (exists) {
        return prev.map((n) => (String(n._id || n.id) === String(fullNotif._id || fullNotif.id) ? { ...n, ...fullNotif } : n));
      }
      if (!(fullNotif.read || fullNotif.isRead)) {
        setUnreadCount((count) => count + 1);
      }
      return [fullNotif, ...prev.slice(0, 149)];
    });
    setToasts(prev => [fullNotif, ...prev.slice(0, 2)]);
  };

  const hydrateNotifications = async () => {
    try {
      const [listRes, unreadRes] = await Promise.all([
        notificationAPI.list({ limit: 100 }),
        notificationAPI.unreadCount(),
      ]);

      const mapped = (listRes.data?.notifications || []).map((item) => ({
        ...item,
        id: String(item._id),
        read: Boolean(item.isRead),
      }));
      setNotifications(mapped);
      setUnreadCount(Number(unreadRes.data?.unreadCount) || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      setConnected(false);
      return;
    }

    const socket = connectSocket(token);
    if (!socket) return;

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_role_room', { role: user.role, userId: user._id });
      socket.emit('join_user_room', { userId: user._id });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) onConnect();
    hydrateNotifications().catch(() => {});

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.emit('leave_role_room', { role: user.role, userId: user._id });
      socket.emit('leave_user_room', { userId: user._id });
    };
  }, [token, user?._id, user?.role]);

  useEffect(() => {
    if (!user || !token) return;
    const socket = getSocket();
    if (!socket) return;

    const onEmergencyAlert = (alert) => {
      setAlerts(prev => [alert, ...prev]);
    };

    const onNewRescueRequest = () => {};

    const onYourRequestUpdated = () => {};

    const onRequestStatusNotification = () => {};

    const onNewMessage = (message) => {
      const senderId = String(message?.senderId?._id || message?.senderId || '');
      const receiverId = String(message?.receiverId?._id || message?.receiverId || '');
      const currentUserId = String(user?._id || '');

      // Bell notifications should only appear for actual receivers, not senders.
      if (!currentUserId || receiverId !== currentUserId || senderId === currentUserId) {
        return;
      }

      const messageKey = String(message?._id || `${senderId}:${receiverId}:${message?.timestamp || ''}:${message?.message || ''}`);
      if (notifiedMessageIdsRef.current.has(messageKey)) {
        return;
      }
      notifiedMessageIdsRef.current.add(messageKey);

      // Chat bell notifications are persisted and emitted via `notification:new`.
    };

    const onServerNotification = (notification) => {
      addNotification(notification);
    };

    socket.on('emergency_alert', onEmergencyAlert);
    socket.on('new_rescue_request', onNewRescueRequest);
    socket.on('your_request_updated', onYourRequestUpdated);
    socket.on('new_message', onNewMessage);
    socket.on('chat_message', onNewMessage);
    socket.on('request_status_notification', onRequestStatusNotification);
    socket.on('notification:new', onServerNotification);

    return () => {
      socket.off('emergency_alert', onEmergencyAlert);
      socket.off('new_rescue_request', onNewRescueRequest);
      socket.off('your_request_updated', onYourRequestUpdated);
      socket.off('new_message', onNewMessage);
      socket.off('chat_message', onNewMessage);
      socket.off('request_status_notification', onRequestStatusNotification);
      socket.off('notification:new', onServerNotification);
    };
  }, [user?._id, user?.role, token]);

  const markRead = async (id) => {
    const target = String(id);
    const existing = notifications.find((n) => String(n._id || n.id) === target);
    const shouldDecrease = Boolean(existing && !(existing.read || existing.isRead));

    setNotifications((prev) => prev.map((n) => (
      String(n._id || n.id) === target ? { ...n, read: true, isRead: true } : n
    )));

    if (shouldDecrease) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    try {
      await notificationAPI.markRead(target);
    } catch {
      // Ignore API failures; optimistic state keeps UX responsive.
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationAPI.markAllRead();
    } catch {
      // Ignore API failures; optimistic state keeps UX responsive.
    }
  };

  const dismissToast = (id) => {
    const target = String(id);
    setToasts(prev => prev.filter((t) => String(t.id || t._id) !== target));
  };

  const clearAlerts = () => setAlerts([]);

  return (
    <SocketContext.Provider value={{
      alerts,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      toasts,
      dismissToast,
      clearAlerts,
      connected,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
