import api from './client';

// Auth
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Grants
export const grantsAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/grants', { params }),
  getById: (id: string) => api.get(`/grants/${id}`),
  create: (data: unknown) => api.post('/grants', data),
  update: (id: string, data: unknown) => api.put(`/grants/${id}`, data),
  delete: (id: string) => api.delete(`/grants/${id}`),
  getStats: () => api.get('/grants/stats'),
};

// Applications
export const applicationsAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/applications', { params }),
  getById: (id: string) => api.get(`/applications/${id}`),
  submit: (data: unknown) => api.post('/applications', data),
  review: (id: string, data: { status: string; reviewNotes?: string }) =>
    api.patch(`/applications/${id}/review`, data),
  withdraw: (id: string) => api.delete(`/applications/${id}`),
};

// Users
export const usersAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  updateRole: (id: string, role: string) =>
    api.put(`/users/${id}/role`, { role }),
  toggleActive: (id: string) => api.patch(`/users/${id}/toggle-active`),
  updateProfile: (data: { name?: string; avatar?: string }) =>
    api.put('/users/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/password', data),
};

// Notifications
export const notificationsAPI = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};
