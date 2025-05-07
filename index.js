import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

const fastify = Fastify({ logger: true });
const httpServer = createServer();

fastify.get('/', async (request, reply) => {
  reply.status(200).send({ message: `Shits working`})
});

await fastify.listen({ server: httpServer, port: process.env.PORT, host: process.env.HOST });

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' }
});

let [call, botNode, webNode] = [false, false, false]

const updateCall = (evt, role, socket) => {
  if (role === 'bot' && evt === 'connect') {
    fastify.log.info(`🤖 Bot conectado: ${socket.id}`);
    botNode = true;
  }

  if (role === 'bot' && evt === 'disconnect') {
    fastify.log.info(`🤖 Bot desconectado: ${socket.id}`);
    botNode = false;
  }

  if (role === 'web' && evt === 'connect') {
    fastify.log.info(`🌐 Web conectado: ${socket.id}`);
    webNode = true;
  }

  if (role === 'web' && evt === 'disconnect') {
    fastify.log.info(`🤖 Web desconectado: ${socket.id}`);
    webNode = false;
  }
  
  if(botNode && webNode) {
    fastify.log.info('Llamada iniciada')
    io.of('/bot').emit('start-call');
    io.of('/web').emit('start-call');
    call = true
  }
  else if (botNode || webNode) {
    call = false
    fastify.log.info('Llamada suspendida')
    if (botNode) io.of('/bot').emit('hold-call');
    if (webNode) io.of('/web').emit('hold-call');
  } else {
    fastify.log.info('Llamada terminada. chupalo')
  }
}

const botNamespace = io.of('/bot');
const webNamespace = io.of('/web');

botNamespace.on('connection', socket => {
  updateCall('connect', 'bot', socket)

  socket.on('disconnect', () => {
    updateCall('disconnect', 'bot', socket)
  });

  // Events for bot host
  socket.on('data', (data) => {
    fastify.log.info({ data }, 'data');
  });

  socket.on('question', (data) => {
    fastify.log.info({ data }, 'question');
  });
});

webNamespace.on('connection', socket => {
  updateCall('connect', 'web', socket)

  socket.on('disconnect', () => {
    updateCall('disconnect', 'web', socket)
  });

  // Events for web
  socket.on('order', (data) => {
    fastify.log.info({ data }, 'order');
  });
});