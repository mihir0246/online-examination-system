import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Routes that require CSRF
const CSRF_ROUTES = ['/api/v1/login', '/api/v1/admin', '/api/v1/final'];

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

export default apiClient;
