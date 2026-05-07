import axios from 'axios';

// In production (Amplify), leave BASE_URL empty so requests go to the same
// HTTPS origin (e.g. https://main.d2zv26r39f0427.amplifyapp.com/api/...).
// Next.js rewrites will proxy them server-side to the EB backend — no Mixed Content.
// In local dev, fall back to the local backend.
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Routes that require CSRF (including login to mitigate Login CSRF)
const CSRF_ROUTES = ['/api/v1/admin', '/api/v1/final', '/api/v1/login'];

apiClient.interceptors.request.use(async (config) => {
  // Attach JWT from localStorage as Bearer token
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Only fetch CSRF for routes that need it (login endpoints)
  const needsCsrf = config.method !== 'get' &&
    CSRF_ROUTES.some(route => config.url?.startsWith(route));

  if (needsCsrf && !config.headers['x-csrf-token']) {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/v1/csrf-token`, { withCredentials: true });
      config.headers['x-csrf-token'] = data.token;
    } catch (error) {
      console.error('Failed to fetch CSRF token', error);
    }
  }

  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If it's a 401 during an exam, we don't want to violently redirect.
    // Instead we emit a custom event that the exam portal can listen to, or we retry.
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt silent refresh
        const { data } = await axios.get(`${BASE_URL}/api/v1/refresh`, { withCredentials: true });
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          originalRequest.headers['Authorization'] = `Bearer ${data.token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed. If we are in the exam portal, let it handle the "Reconnecting..." state
        if (window.location.pathname.includes('/exam/portal')) {
          // Dispatch event so UI can show "Reconnecting / Connection Lost" gracefully
          window.dispatchEvent(new CustomEvent('exam_token_expired'));
        } else {
          // Standard logout
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
