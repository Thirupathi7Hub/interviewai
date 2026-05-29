import axios from 'axios';

// In production (Render), VITE_API_URL = https://your-backend.onrender.com
// In dev, falls back to /api which is proxied by Vite to localhost:5001
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

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
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/auth`
    : '/auth',
});

export default client;
