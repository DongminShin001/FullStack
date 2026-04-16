const express    = require('express');
const http       = require('http');
const { WebSocketServer, OPEN } = require('ws');
const StompClient = require('./stomp');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const PORT          = parseInt(process.env.PORT || '3002', 10);
const TOPIC         = '/topic/market.data';

// ── WebSocket server ──────────────────────────────────────────────────────────

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok', topic: TOPIC }));

const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// Per-client filter: which symbols/types to forward
function defaultFilter() {
  return { symbols: null, types: null }; // null = everything
}

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  clients.set(ws, defaultFilter());

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const state = clients.get(ws);
    switch (msg.type) {
      case 'subscribe':
        if (Array.isArray(msg.symbols))     state.symbols = msg.symbols.map(s => s.toUpperCase());
        if (Array.isArray(msg.streamTypes)) state.types   = msg.streamTypes;
        ws.send(JSON.stringify({ type: 'ack', command: 'subscribe', filter: state }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: `unknown type: ${msg.type}` }));
    }
  });

  ws.on('close', () => { clients.delete(ws); console.log('[ws] client disconnected'); });
});

function broadcast(msg) {
  for (const [ws, filter] of clients) {
    if (ws.readyState !== OPEN) continue;
    if (filter.symbols && !filter.symbols.includes(msg.symbol)) continue;
    if (filter.types   && !filter.types.includes(msg.type))     continue;
    ws.send(JSON.stringify(msg));
  }
}

// ── ActiveMQ consumer ─────────────────────────────────────────────────────────

let msgCount = 0;

async function startConsumer() {
  console.log(`[consumer] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  const stomp = new StompClient(ACTIVEMQ_HOST, ACTIVEMQ_PORT, 'admin', 'admin');

  stomp.on('error', (err) => {
    console.error('[consumer] ActiveMQ error:', err.message, '— retry in 3s');
    setTimeout(startConsumer, 3000);
  });

  stomp.on('close', () => {
    console.log('[consumer] ActiveMQ connection closed — retry in 3s');
    setTimeout(startConsumer, 3000);
  });

  try {
    await stomp.connect();
    console.log(`[consumer] connected — subscribing to ${TOPIC}`);

    stomp.subscribe(TOPIC, (body) => {
      try {
        const msg = JSON.parse(body);
        broadcast(msg);
        msgCount++;
        if (msgCount % 500 === 0) {
          console.log(`[consumer] ${msgCount} messages consumed, ${clients.size} WS clients`);
        }
      } catch (e) {
        console.error('[consumer] parse error:', e.message);
      }
    });
  } catch (err) {
    console.error('[consumer] connect failed:', err.message, '— retry in 3s');
    setTimeout(startConsumer, 3000);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[consumer] WebSocket server on port ${PORT}`);
  startConsumer();
});
