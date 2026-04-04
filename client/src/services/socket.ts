import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Always use Vite proxy — required because browser is on HTTPS (self-signed SSL)
// and cannot connect to plain HTTP backend directly (mixed content blocked)
function getBackendUrl(): string {
  return '/';
}

export function connectSocket(token: string): Socket {
  // If already connected with same token, reuse
  if (socket?.connected) return socket;

  // If socket exists but disconnected, update token and reconnect
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  const url = getBackendUrl();
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 50,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

/** Update socket auth token (e.g., after token refresh) */
export function updateSocketToken(newToken: string) {
  if (socket) {
    socket.auth = { token: newToken };
    // If disconnected due to invalid token, reconnect with new one
    if (!socket.connected) {
      socket.connect();
    }
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
