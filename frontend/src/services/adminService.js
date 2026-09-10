import api from "./api";

export const getOperationalOrders = (params = {}) => api.get("/orders", { params });
export const getMenuForManagement = (params = {}) => api.get("/menu", { params });
export const createMenuItem = (payload) => api.post("/menu", payload);
export const updateMenuItem = (id, payload) => api.put(`/menu/${id}`, payload);
export const updateMenuAvailability = (id, isAvailable) =>
  api.patch(`/menu/${id}/availability`, { isAvailable });
export const archiveMenuItem = (id) => api.delete(`/menu/${id}`);
