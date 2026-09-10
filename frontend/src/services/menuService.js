import api from "./api";

export const getMenu = (params = {}) => api.get("/menu", { params });
export const getMenuItem = (id) => api.get(`/menu/${id}`);
export const getCanteenMenu = (canteenId, params = {}) =>
  api.get(`/canteens/${canteenId}/menu`, { params });
