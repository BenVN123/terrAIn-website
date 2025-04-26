import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Set up listeners for events we care about
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    const events = ['mqtt_message', 'sensors_temperature', 'sensors_distance', 'sensors_gnss'];

    events.forEach(event => {
      this.socket?.on(event, (data: any) => {
        let parsedData: any;
        try {
          parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (e) {
          parsedData = data;
        }

        console.log(`Received ${event} data:`, parsedData);

        // Notify all listeners for this event
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => listener(parsedData));
        }
      });
    });

    // Add connection event listeners for debugging
    this.socket.on('connect', () => {
      console.log('Socket.IO connected successfully!');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    this.socket.on('connect_timeout', () => {
      console.error('Socket.IO connection timeout');
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)?.add(callback);

    // Make sure we're connected
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }
}

export const socketService = new SocketService();
export default socketService;