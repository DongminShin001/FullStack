const WebSocket  = require('ws');
const StompClient = require('./stomp');
const { generatePSD, generateCAF } = require('./dataGenerator');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const TOPIC         = '/topic/market.data';

const STREAMS = [
  'btcusdt@aggTrade',
  'btcusdt@kline_1m',
  'ethusdt@aggTrade',
  'ethusdt@kline_1m',
  'btcusdt@miniTicker',
  'ethusdt@miniTicker',
].join('/');

const BINANCE_URL = `wss://stream.binance.com:9443/stream?streams=${STREAMS}`;

// ── ActiveMQ connection ───────────────────────────────────────────────────────

let stomp = null;
let publishCount = 0;

function publish(type, symbol, payload) {
  if (!stomp) return;
  try {
    stomp.publish(TOPIC, JSON.stringify({ type, symbol, payload, ts: Date.now() }));
    publishCount++;
    if (publishCount % 200 === 0) {
      console.log(`[producer] ${publishCount} messages published to ${TOPIC}`);
    }
  } catch (e) {
    console.error('[producer] publish error:', e.message);
    stomp = null;
  }
}

async function connectActiveMQ() {
  console.log(`[producer] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  const client = new StompClient(ACTIVEMQ_HOST, ACTIVEMQ_PORT, 'admin', 'admin');

  client.on('error', (err) => {
    console.error('[producer] ActiveMQ error:', err.message, '— reconnecting in 3s');
    stomp = null;
    setTimeout(connectActiveMQ, 3000);
  });

  client.on('close', () => {
    if (stomp) {
      console.log('[producer] ActiveMQ connection closed — reconnecting in 3s');
      stomp = null;
      setTimeout(connectActiveMQ, 3000);
    }
  });

  try {
    await client.connect();
    console.log('[producer] ActiveMQ connected');
    stomp = client;
  } catch (err) {
    console.error('[producer] ActiveMQ connect failed:', err.message, '— retry in 3s');
    setTimeout(connectActiveMQ, 3000);
  }
}

// ── Binance WebSocket ─────────────────────────────────────────────────────────

function connectBinance() {
  console.log('[producer] connecting to Binance WebSocket…');
  const ws = new WebSocket(BINANCE_URL);

  ws.on('open', () => console.log('[producer] Binance WebSocket connected'));

  ws.on('message', (raw) => {
    let envelope;
    try { envelope = JSON.parse(raw); } catch { return; }

    const streamName = envelope.stream || '';
    const data       = envelope.data   || envelope;

    if (streamName.includes('@aggTrade')) {
      publish('trade', data.s, {
        tradeId:      data.a,
        price:        parseFloat(data.p),
        quantity:     parseFloat(data.q),
        isBuyerMaker: data.m,
        tradeTime:    data.T,
      });
    } else if (streamName.includes('@kline')) {
      const k = data.k;
      publish('kline', data.s, {
        openTime:  k.t,
        closeTime: k.T,
        open:      parseFloat(k.o),
        high:      parseFloat(k.h),
        low:       parseFloat(k.l),
        close:     parseFloat(k.c),
        volume:    parseFloat(k.v),
        trades:    k.n,
        closed:    k.x,
        interval:  k.i,
      });
    } else if (streamName.includes('@miniTicker')) {
      publish('ticker', data.s, {
        close:       parseFloat(data.c),
        open:        parseFloat(data.o),
        high:        parseFloat(data.h),
        low:         parseFloat(data.l),
        baseVolume:  parseFloat(data.v),
        quoteVolume: parseFloat(data.q),
      });
    }
  });

  ws.on('ping', (data) => ws.pong(data));

  ws.on('close', () => {
    console.log('[producer] Binance WebSocket closed — reconnecting in 5s');
    setTimeout(connectBinance, 5000);
  });

  ws.on('error', (err) => console.error('[producer] Binance error:', err.message));
}

// ── Start ─────────────────────────────────────────────────────────────────────

connectActiveMQ().then(connectBinance);
