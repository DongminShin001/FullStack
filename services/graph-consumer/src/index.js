/**
 * graph-consumer
 *
 * 1. Subscribes to /queue/satellite.data on ActiveMQ via STOMP
 * 2. Maintains a WebSocket server for browser clients
 * 3. Broadcasts every message it dequeues to all connected WS clients
 * 4. Accepts control commands from clients (rate filtering, stream toggles)
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, OPEN } = require('ws');
const stompit = require('stompit');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const PORT          = parseInt(process.env.PORT || '3002', 10);
const QUEUE         = '/queue/satellite.data';

// ── WebSocket server ──────────────────────────────────────────────────────────

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok', queue: QUEUE }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Track per-client filter state so clients can control what they receive
const clients = new Map(); // ws → { psdEnabled, cafEnabled }

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  clients.set(ws, { psdEnabled: true, cafEnabled: true });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const state = clients.get(ws);
    switch (msg.type) {
      case 'set_streams':
        if (typeof msg.psd === 'boolean') state.psdEnabled = msg.psd;
        if (typeof msg.caf === 'boolean') state.cafEnabled = msg.caf;
        ws.send(JSON.stringify({ type: 'ack', command: 'set_streams', ...state }));
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
  for (const [ws, state] of clients) {
    if (ws.readyState !== OPEN) continue;
    if (msg.type === 'psd' && !state.psdEnabled) continue;
    if (msg.type === 'caf' && !state.cafEnabled) continue;
    ws.send(JSON.stringify(msg));
  }
}

// ── ActiveMQ consumer ─────────────────────────────────────────────────────────

const connectOptions = {
  host: ACTIVEMQ_HOST,
  port: ACTIVEMQ_PORT,
  connectHeaders: {
    host: '/',
    login: 'admin',
    passcode: 'admin',
    'heart-beat': '5000,5000',
  },
};

let msgCount = 0;

function startConsumer() {
  console.log(`[consumer] connecting to ActiveMQ at ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);

  stompit.connect(connectOptions, (err, client) => {
    if (err) {
      console.error(`[consumer] connection failed: ${err.message} — retrying in 3s`);
      setTimeout(startConsumer, 3000);
      return;
    }

    console.log(`[consumer] connected — subscribing to ${QUEUE}`);

    client.subscribe(
      { destination: QUEUE, ack: 'client-individual' },
      (err, message) => {
        if (err) {
          console.error('[consumer] subscribe error:', err.message);
          return;
        }

        message.readString('utf-8', (err, body) => {
          if (err) return;
          try {
            const msg = JSON.parse(body);
            broadcast(msg);
            client.ack(message);

            msgCount++;
            if (msgCount % 100 === 0) {
              console.log(`[consumer] ${msgCount} messages consumed, ${clients.size} WS clients`);
            }
          } catch (e) {
            console.error('[consumer] parse error:', e.message);
            client.nack(message);
          }
        });
      }
    );

    client.on('error', (err) => {
      console.error('[consumer] connection error:', err.message);
      setTimeout(startConsumer, 3000);
    });
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[consumer] WebSocket server listening on port ${PORT}`);
  startConsumer();
});
