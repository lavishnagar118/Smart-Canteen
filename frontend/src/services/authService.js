import api from "./api";

export const registerRequest = (payload) => api.post("/auth/register", payload);
export const loginRequest = (payload) => api.post("/auth/login", payload);
export const currentUserRequest = () => api.get("/auth/me");
export const firebaseLoginRequest = (idToken) =>
  api.post("/auth/firebase", { idToken });
export const logoutRequest = () => api.post("/auth/logout");
