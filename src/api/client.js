import axios from 'axios';

// Strip trailing slash to prevent double-slash URLs
const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const BASE_URL = API_ROOT ? `${API_ROOT}/api` : '/api';

const client = axios.create({
  baseURL: BASE_URL,
});

// Request interceptor to attach JWT token
client.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Use interceptor to handle unauthorized errors (clear token, redirect)
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// We need a separate client for /auth endpoints if we want to stick to the same base url convention or just use absolute path.
export const authClient = axios.create({
  baseURL: API_ROOT ? `${API_ROOT}/auth` : '/auth',
});

export default client;
