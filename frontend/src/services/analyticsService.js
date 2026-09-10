import api from "./api";

export const getPeakHours = (params = {}) => api.get("/analytics/peak-hours", { params });
export const getAnalyticsOverview = (params = {}) => api.get("/analytics/overview", { params });
export const getOrdersByHour = (params = {}) => api.get("/analytics/orders-by-hour", { params });
export const getPopularItems = (params = {}) => api.get("/analytics/popular-items", { params });
export const getRevenue = (params = {}) => api.get("/analytics/revenue", { params });
