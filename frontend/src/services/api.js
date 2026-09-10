import axios from "axios";

export const TOKEN_KEY = "queueless_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      status === 401
        ? "Your session has expired. Please sign in again."
        : status === 403
          ? "You do not have permission to do that."
          : status === 404
            ? "We could not find what you requested."
            : status >= 500
              ? "The service is temporarily unavailable."
              : error.response?.data?.message || "Something went wrong.";

    const normalizedError = new Error(message);
    normalizedError.status = status;
    normalizedError.response = error.response;
    return Promise.reject(normalizedError);
  }
);

export default api;
