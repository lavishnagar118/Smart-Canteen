import api from "./api";

export const createOrder = (items, canteenId) =>
  api.post("/orders", {
    ...(canteenId ? { canteenId } : {}),
    items: items.map(({ menuItem, quantity }) => ({ menuItem, quantity })),
  });

export const getOrders = (params = {}) => api.get("/orders", { params });
export const getOrder = (orderId) => api.get(`/orders/${orderId}`);
export const cancelOrder = (orderId) => api.patch(`/orders/${orderId}/cancel`);
