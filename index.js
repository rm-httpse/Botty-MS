import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const corsConfig = {
  origin: process.env.CORS_ORIGIN_LIST?.split(',') || [],
  methods: process.env.CORS_METHOD_LIST?.split(',') || [],
  credentials: true
}

await fastify.register(cors, corsConfig);

fastify.get('/', async (request, reply) => {
  reply.status(200).send({ message: `Shits working`})
});

const httpServer = createServer(fastify.server);

await fastify.listen({ server: httpServer, port: process.env.PORT || 3000, host: process.env.HOST || 'localhost' });

const io = new SocketIOServer(fastify.server, {
  cors: corsConfig,
  path: '/web/socket.io/'
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
  socket.on('bot-data', (data) => {
    fastify.log.info({ data }, 'data');
    io.of('/web').emit('bot-data');
  });

  socket.on('bot-question', (data) => {
    fastify.log.info({ data }, 'question');
    io.of('/web').emit('bot-question');
  });
});

webNamespace.on('connection', socket => {
  updateCall('connect', 'web', socket)

  socket.on('disconnect', () => {
    updateCall('disconnect', 'web', socket)
  });

  // Events for web
  socket.on('usr-order', (data) => {
    fastify.log.info({ data }, 'order');
    io.of('/bot').emit('usr-order');
  });
});

/* 
{
  "type": "bot_update",
  "payload": {
    "screenshot": "data:image/jpeg;base64,...",  // comprimido en JPEG
    "state": {
      "status": "idle",
      "current_action": null
    },
    "timestamp": 1715178391234
  }
}

{
  "type": "bot_command",
  "payload": {
    "command": "start_action",
    "data": {
      "action_id": "walk_to_bank"
    }
  }
}
*/