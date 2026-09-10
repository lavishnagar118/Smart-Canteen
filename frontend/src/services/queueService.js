import api from "./api";

export const getQueue = (params = {}) => api.get("/queue", { params });
export const getPublicQueueSummary = (canteenId) =>
  api.get(`/queue/public/${canteenId}`);
export const updateQueueOrder = (orderId, action) =>
  api.patch(`/queue/${orderId}/${action}`);
