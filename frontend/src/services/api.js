import axios from "axios";

export const TOKEN_KEY = "queueless_token";

const DEV_API_URL = "http://localhost:5000";
const PROD_API_URL = "https://smart-canteen-api-l6s0.onrender.com";

const normalizeApiUrl = (url) => {
  if (!url) return "";
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const isProd = import.meta.env.PROD || import.meta.env.MODE === "production";

  if (isProd) {
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return normalizeApiUrl(envUrl);
    }
    return normalizeApiUrl(PROD_API_URL);
  }

  return normalizeApiUrl(envUrl || DEV_API_URL);
};

const api = axios.create({
  baseURL: resolveBaseUrl(),
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
