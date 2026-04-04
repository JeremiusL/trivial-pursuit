import { io } from 'socket.io-client';

// In production, connect to the same host serving the page.
// In dev, connect to the local backend.
const URL = import.meta.env.PROD ? '' : 'http://localhost:3001';
const socket = io(URL);

export default socket;
