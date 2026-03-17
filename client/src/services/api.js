/**
 * Axios API Service - Centralized HTTP client
 */
import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('rw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || '');
    const isAuthRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/verify-otp')
      || requestUrl.includes('/auth/forgot-password')
      || requestUrl.includes('/auth/reset-password');

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem('rw_token');
      localStorage.removeItem('rw_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    if (isFormData) {
      return API.post('/auth/register', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return API.post('/auth/register', data);
  },
  login: (data) => API.post('/auth/login', data),
  verifyOtp: (data) => API.post('/auth/verify-otp', data),
  forgotPassword: (data) => API.post('/auth/forgot-password', data),
  resetPassword: (data) => API.post('/auth/reset-password', data),
  logout: () => API.post('/auth/logout'),
  refreshToken: (data) => API.post('/auth/refresh', data),
  getProfile: () => API.get('/auth/profile'),
  updateProfile: (data) => API.put('/auth/profile', data),
  getUsersSummary: () => API.get('/auth/users-summary'),
};

export const setupAPI = {
  getStatus: () => API.get('/setup/status'),
  getConfig: () => API.get('/setup/config'),
  saveConfig: (data) => API.put('/setup/config', data),
};

// Rescue
export const rescueAPI = {
  create: (data) => API.post('/rescue/create', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: (params) => API.get('/rescue/all', { params }),
  getHistory: () => API.get('/rescue/history/me'),
  getById: (id) => API.get(`/rescue/${id}`),
  update: (id, data) => API.put(`/rescue/update/${id}`, data),
  assignVolunteer: (id, data) => API.put(`/rescue/assign/${id}`, data),
  reject: (id, data) => API.put(`/rescue/reject/${id}`, data),
  cancel: (id, data = {}) => API.put(`/rescue/cancel/${id}`, data),
  rateVolunteer: (id, data) => API.put(`/rescue/rate/${id}`, data),
  delete: (id) => API.delete(`/rescue/${id}`),
  getNearby: (params) => API.get('/rescue/nearby', { params }),
};

// Volunteer
export const volunteerAPI = {
  apply: (data) => API.post('/volunteer/apply', data),
  getList: (params) => API.get('/volunteer/list', { params }),
  getMe: () => API.get('/volunteer/me'),
  updateProfile: (data) => API.put('/volunteer/profile', data),
  getHistory: () => API.get('/volunteer/history'),
  getStats: () => API.get('/volunteer/stats'),
  approve: (id, action) => API.put(`/volunteer/approve/${id}`, { action }),
  updateAvailability: (availability) => API.put('/volunteer/availability', { availability }),
};

// Alerts
export const alertAPI = {
  create: (data) => API.post('/alerts/create', data),
  getAll: (params) => API.get('/alerts/all', { params }),
  deactivate: (id) => API.put(`/alerts/${id}/deactivate`),
};

export const adminAPI = {
  getAnalytics: (params) => API.get('/admin/analytics', { params }),
  getVolunteerPerformance: () => API.get('/admin/volunteer-performance'),
  getAvailableVolunteers: () => API.get('/admin/available-volunteers'),
  getHeatmap: () => API.get('/admin/heatmap'),
  getEscalations: () => API.get('/admin/escalations'),
  getPendingVolunteers: () => API.get('/admin/pending-volunteers'),
  getActivityLog: (params) => API.get('/admin/activity-log', { params }),
  exportReport: (format) => API.get('/admin/export', { params: { format }, responseType: 'blob' }),
};

export const notificationAPI = {
  list: (params) => API.get('/notifications', { params }),
  unreadCount: () => API.get('/notifications/unread-count'),
  markRead: (id) => API.patch(`/notifications/${id}/read`),
  markAllRead: () => API.patch('/notifications/read-all'),
};

// Chat
export const chatAPI = {
  send: (data) => API.post('/chat/send', data),
  getMessages: (userId) => API.get(`/chat/messages/${userId}`),
  getConversations: () => API.get('/chat/conversations'),
  getContacts: () => API.get('/chat/contacts'),
};

export default API;
