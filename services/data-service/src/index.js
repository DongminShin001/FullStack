const express = require('express');
const http = require('http');
const { WebSocketServer, OPEN } = require('ws');
const { generatePSD, generateCAF } = require('./dataGenerator');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Per-client state — clients can set their own update rate and filters
function defaultClientState() {
  return {
    intervalMs: 200,   // how often we push data
    psdEnabled: true,
    cafEnabled: true,
    timer: null,
  };
}

function startStreaming(ws, state) {
  if (state.timer) clearInterval(state.timer);

  state.timer = setInterval(() => {
    if (ws.readyState !== OPEN) return;

    if (state.psdEnabled) {
      ws.send(JSON.stringify({ type: 'psd', payload: generatePSD(), ts: Date.now() }));
    }
    if (state.cafEnabled) {
      ws.send(JSON.stringify({ type: 'caf', payload: generateCAF(), ts: Date.now() }));
    }
  }, state.intervalMs);
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] client connected from ${clientIp}`);

  const state = defaultClientState();
  startStreaming(ws, state);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' }));
      return;
    }

    console.log(`[WS] received from client:`, msg);

    switch (msg.type) {
      case 'set_rate': {
        // client wants to change push frequency
        const ms = Math.max(50, Math.min(5000, Number(msg.intervalMs)));
        state.intervalMs = ms;
        startStreaming(ws, state);
        ws.send(JSON.stringify({ type: 'ack', command: 'set_rate', intervalMs: ms }));
        break;
      }
      case 'set_streams': {
        // client can toggle psd/caf independently
        if (typeof msg.psd === 'boolean') state.psdEnabled = msg.psd;
        if (typeof msg.caf === 'boolean') state.cafEnabled = msg.caf;
        ws.send(JSON.stringify({ type: 'ack', command: 'set_streams', psdEnabled: state.psdEnabled, cafEnabled: state.cafEnabled }));
        break;
      }
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        break;
      }
      default:
        ws.send(JSON.stringify({ type: 'error', message: `unknown type: ${msg.type}` }));
    }
  });

  ws.on('close', () => {
    clearInterval(state.timer);
    console.log(`[WS] client disconnected`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] error:`, err.message);
    clearInterval(state.timer);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`data-service listening on port ${PORT}`);
});
