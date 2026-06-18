import { io, Socket } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      auth: () => ({ token: localStorage.getItem('accessToken') }),
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function joinExecution(executionId: string) {
  getSocket().emit('join:execution', executionId)
}

export function leaveExecution(executionId: string) {
  getSocket().emit('leave:execution', executionId)
}
