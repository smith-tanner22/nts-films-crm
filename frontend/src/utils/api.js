import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/password', data),
};

// Leads API
export const leadsApi = {
  getAll: (params) => api.get('/leads', { params }),
  getOne: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  convert: (id, data) => api.post(`/leads/${id}/convert`, data),
};

// Clients API
export const clientsApi = {
  getAll: (params) => api.get('/clients', { params }),
  getOne: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

// Projects API
export const projectsApi = {
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  updateTask: (projectId, taskId, data) => api.put(`/projects/${projectId}/tasks/${taskId}`, data),
  createTask: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
};

// Questionnaires API
export const questionnairesApi = {
  getAll: () => api.get('/questionnaires'),
  getOne: (id) => api.get(`/questionnaires/${id}`),
  create: (data) => api.post('/questionnaires', data),
  update: (id, data) => api.put(`/questionnaires/${id}`, data),
  delete: (id) => api.delete(`/questionnaires/${id}`),
  generateLink: (id, data) => api.post(`/questionnaires/${id}/link`, data),
  getResponses: (id) => api.get(`/questionnaires/${id}/responses`),
  getResponse: (id) => api.get(`/questionnaires/responses/${id}`),
};

// Invoices API
export const invoicesApi = {
  getAll: (params) => api.get('/invoices', { params }),
  getOne: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  send: (id) => api.post(`/invoices/${id}/send`),
};

// Calendar API
export const calendarApi = {
  getAll: (params) => api.get('/calendar', { params }),
  getOne: (id) => api.get(`/calendar/${id}`),
  create: (data) => api.post('/calendar', data),
  update: (id, data) => api.put(`/calendar/${id}`, data),
  delete: (id) => api.delete(`/calendar/${id}`),
  getAvailableSlots: (params) => api.get('/calendar/available-slots', { params }),
  bookSlot: (slotId, data) => api.post(`/calendar/book/${slotId}`, data),
  generateSlots: (data) => api.post('/calendar/generate-slots', data),
};

// Insights API
export const insightsApi = {
  getOverview: () => api.get('/insights/overview'),
  getLeadAnalytics: (params) => api.get('/insights/leads', { params }),
  getRevenueAnalytics: (params) => api.get('/insights/revenue', { params }),
  getProjectAnalytics: (params) => api.get('/insights/projects', { params }),
  getActivity: (params) => api.get('/insights/activity', { params }),
};

// Uploads API
export const uploadsApi = {
  getAll: (params) => api.get('/uploads', { params }),
  upload: (formData) => api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadMultiple: (formData) => api.post('/uploads/multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/uploads/${id}`),
};

// Public API (no auth required)
export const publicApi = {
  submitInquiry: (data) => axios.post(`${API_URL}/public/inquiry`, data),
  getQuestionnaire: (token) => axios.get(`${API_URL}/public/questionnaire/${token}`),
  submitQuestionnaire: (token, data) => axios.post(`${API_URL}/public/questionnaire/${token}`, data),
  getServices: () => axios.get(`${API_URL}/public/services`),
};

export default api;
