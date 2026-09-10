import { io } from "socket.io-client";

let socket;
const connectionHandlers = new Set();

const notifyStatus = (status) => {
  connectionHandlers.forEach((handler) => {
    try {
      handler(status);
    } catch {
      // ignore handler error
    }
  });
};

const socketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  return apiUrl ? apiUrl.replace(/\/api\/?$/, "") : window.location.origin;
};

const attachSocketListeners = (sock) => {
  sock.on("connect", () => notifyStatus("live"));
  sock.on("disconnect", () => notifyStatus("offline"));
  sock.io.on("reconnect_attempt", () => notifyStatus("reconnecting"));
  sock.io.on("reconnect", () => notifyStatus("live"));
};

export function connectSocket(token) {
  if (!token) return null;
  if (socket?.connected) {
    notifyStatus("live");
    return socket;
  }
  if (!socket) {
    socket = io(socketUrl(), {
      auth: { token },
      autoConnect: false,
      reconnection: true,
    });
    attachSocketListeners(socket);
  } else {
    socket.auth = { token };
  }
  socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  notifyStatus("offline");
}

export function getSocket() {
  return socket;
}

export function joinOrderRoom(orderId, acknowledge) {
  socket?.emit("JOIN_ORDER", orderId, acknowledge);
}

export function subscribeSocket(event, handler) {
  socket?.on(event, handler);
  return () => socket?.off(event, handler);
}

export function subscribeConnectionStatus(handler) {
  connectionHandlers.add(handler);
  handler(socket?.connected ? "live" : "offline");
  return () => connectionHandlers.delete(handler);
}
