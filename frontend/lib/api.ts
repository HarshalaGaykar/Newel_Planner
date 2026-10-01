import axios from 'axios';
import { useAuthStore } from './store/auth';
import { API_BASE_URL } from './api-url';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Crucial for sending cookies
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, {
          withCredentials: true
        });
        return api(originalRequest);
      } catch (err) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 403) {
      const url = originalRequest?.url ?? 'unknown';
      const method = (originalRequest?.method ?? 'GET').toUpperCase();
      console.warn(`[403 Forbidden] ${method} ${url} — check role permissions or re-login to refresh token`);
    }

    return Promise.reject(error);
  }
);

export default api;
