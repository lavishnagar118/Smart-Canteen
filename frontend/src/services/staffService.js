import api from "./api";

export const getStaffMembers = (params = {}) => api.get("/staff", { params });

export const createStaffMember = (payload) => api.post("/staff", payload);

export const getStaffMemberById = (id) => api.get(`/staff/${id}`);

export const updateStaffMember = (id, payload) =>
  api.put(`/staff/${id}`, payload);

export const updateStaffStatus = (id, status) =>
  api.patch(`/staff/${id}/status`, { status });

export const resetStaffPassword = (id, password, confirmPassword) =>
  api.patch(`/staff/${id}/password`, { password, confirmPassword });
