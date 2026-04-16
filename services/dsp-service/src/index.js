/**
 * dsp-service
 *
 * Sits between ActiveMQ and the frontend.
 * Subscribes to raw PSD/CAF data, does all heavy processing,
 * sends pre-computed Float32 binary frames to WebSocket clients.
 *
 * Frontend receives a Buffer → new Float32Array(buffer) → render directly.
 * No JSON parsing, no math, no coordinate mapping in the browser.
 */

const http  = require('http');
const { WebSocketServer, OPEN } = require('ws');
const StompClient = require('./stomp');
const { processPSD, processCAF } = require('./processor');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const PORT          = parseInt(process.env.PORT || '3004', 10);
const TOPIC         = '/topic/satellite.data';

// ── WebSocket server ──────────────────────────────────────────────────────────

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'ok' }));
});

const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[dsp] client connected (total: ${clients.size})`);
  ws.on('close', () => { clients.delete(ws); });
});

function broadcast(buffer) {
  for (const ws of clients) {
    if (ws.readyState === OPEN) ws.send(buffer);  // sends raw binary Buffer
  }
}

// ── ActiveMQ consumer + processing ───────────────────────────────────────────

let frameCount = 0;

async function startConsumer() {
  console.log(`[dsp] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  const stomp = new StompClient(ACTIVEMQ_HOST, ACTIVEMQ_PORT, 'admin', 'admin');

  stomp.on('error', (err) => {
    console.error('[dsp] error:', err.message, '— retry in 3s');
    setTimeout(startConsumer, 3000);
  });
  stomp.on('close', () => {
    console.log('[dsp] connection closed — retry in 3s');
    setTimeout(startConsumer, 3000);
  });

  try {
    await stomp.connect();
    console.log(`[dsp] connected — subscribing to ${TOPIC}`);

    stomp.subscribe(TOPIC, (body) => {
      let msg;
      try { msg = JSON.parse(body); } catch { return; }

      if (msg.type === 'psd' && msg.payload?.length) {
        // processPSD returns two binary Buffers
        const [psdFrame, waterfallFrame] = processPSD(msg.payload);
        broadcast(psdFrame);
        broadcast(waterfallFrame);
      }

      if (msg.type === 'caf' && msg.payload?.length) {
        broadcast(processCAF(msg.payload));
      }

      frameCount++;
      if (frameCount % 100 === 0) {
        console.log(`[dsp] ${frameCount} frames processed, ${clients.size} clients connected`);
      }
    });

  } catch (err) {
    console.error('[dsp] connect failed:', err.message, '— retry in 3s');
    setTimeout(startConsumer, 3000);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[dsp] WebSocket server on port ${PORT}`);
  startConsumer();
});
