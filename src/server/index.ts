import Fastify from 'fastify';
import { Server } from 'socket.io';
import { PacketManager } from './transport/packet-manager';
import { ReadingStreamHandler } from './socket/reading-stream';

const fastify = Fastify({
  logger: true,
});

const server = require('http').createServer(fastify);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const packetManager = new PacketManager();
const readingStream = new ReadingStreamHandler(io, packetManager);

// Socket.io connection handler
io.on('connection', (socket) => {
  fastify.log.info(`Client connected: ${socket.id}`);
  readingStream.handleConnection(socket);
});

// Basic health check route
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Backend server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
