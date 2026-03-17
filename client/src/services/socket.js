/**
 * Socket.io Client Service
 */
import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

const resolveSocketUrl = () => {
  const configured = String(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '').trim();
  if (!configured) return window.location.origin;

  // If API URL includes /api, strip it for socket origin.
  return configured.replace(/\/?api\/?$/, '');
};

export const connectSocket = (token) => {
  if (!token) return null;

  // Reuse an existing healthy socket for the same token.
  if (socket && currentToken === token && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(resolveSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
};

// Backward compatibility for older imports.
export const initSocket = connectSocket;

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
};
