/**
 * graph-consumer
 *
 * 1. Subscribes to /topic/market.data on ActiveMQ via STOMP
 *    TOPIC (not queue): every subscriber gets every message independently.
 *    If you add a second consumer service (analytics, alerts), it also
 *    gets all messages — they don't compete with this consumer.
 *
 * 2. Maintains a WebSocket server for browser clients
 * 3. Broadcasts every message to all connected WS clients
 * 4. Clients can filter by symbol or stream type
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, OPEN } = require('ws');
const stompit = require('stompit');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const PORT          = parseInt(process.env.PORT || '3002', 10);
const TOPIC         = '/topic/market.data';   // topic, not /queue/

// ── WebSocket server ──────────────────────────────────────────────────────────

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok', topic: TOPIC }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Per-client filter: which symbols and types the client wants
function defaultFilter() {
  return { symbols: null, types: null }; // null = receive everything
}

const clients = new Map(); // ws → filter state

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  clients.set(ws, defaultFilter());

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const state = clients.get(ws);
    switch (msg.type) {
      // Client sends: { type: 'subscribe', symbols: ['BTCUSDT'], streamTypes: ['trade', 'kline'] }
      case 'subscribe':
        if (Array.isArray(msg.symbols))    state.symbols = msg.symbols.map(s => s.toUpperCase());
        if (Array.isArray(msg.streamTypes)) state.types  = msg.streamTypes;
        ws.send(JSON.stringify({ type: 'ack', command: 'subscribe', filter: state }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: `unknown type: ${msg.type}` }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[ws] client disconnected');
  });
});

function broadcast(msg) {
  for (const [ws, filter] of clients) {
    if (ws.readyState !== OPEN) continue;
    // Apply symbol filter
    if (filter.symbols && !filter.symbols.includes(msg.symbol)) continue;
    // Apply type filter
    if (filter.types && !filter.types.includes(msg.type)) continue;
    ws.send(JSON.stringify(msg));
  }
}

// ── ActiveMQ consumer ─────────────────────────────────────────────────────────

let msgCount = 0;

function startConsumer() {
  console.log(`[consumer] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);

  stompit.connect(
    {
      host: ACTIVEMQ_HOST,
      port: ACTIVEMQ_PORT,
      connectHeaders: { host: '/', login: 'admin', passcode: 'admin', 'heart-beat': '5000,5000' },
    },
    (err, client) => {
      if (err) {
        console.error(`[consumer] connect failed: ${err.message} — retry in 3s`);
        setTimeout(startConsumer, 3000);
        return;
      }

      console.log(`[consumer] connected — subscribing to ${TOPIC}`);

      // For topics, ack mode is 'auto' — broker doesn't wait for ack,
      // messages are delivered to all subscribers immediately.
      client.subscribe({ destination: TOPIC, ack: 'auto' }, (err, message) => {
        if (err) { console.error('[consumer] subscribe error:', err.message); return; }

        message.readString('utf-8', (err, body) => {
          if (err) return;
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
      });

      client.on('error', (err) => {
        console.error('[consumer] connection error:', err.message);
        setTimeout(startConsumer, 3000);
      });
    }
  );
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[consumer] WebSocket server on port ${PORT}`);
  startConsumer();
});
