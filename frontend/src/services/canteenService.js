import api from "./api";

export const getCanteens = () => api.get("/canteens");
export const getCanteen = (id) => api.get(`/canteens/${id}`);
export const getCanteenMenu = (id, params = {}) => api.get(`/canteens/${id}/menu`, { params });
export const createCanteen = (payload) => api.post("/canteens", payload);
export const updateCanteen = (id, payload) => api.put(`/canteens/${id}`, payload);
export const updateCanteenStatus = (id, isActive) => api.patch(`/canteens/${id}/status`, { isActive });
export const archiveCanteen = (id) => api.delete(`/canteens/${id}`);
