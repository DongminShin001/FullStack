/**
 * binance-producer
 *
 * 1. Connects to Binance public WebSocket streams (no API key needed)
 * 2. Subscribes to: aggTrade, kline_1m, miniTicker for BTC and ETH
 * 3. Normalizes each message
 * 4. Publishes to ActiveMQ  /topic/market.data
 *
 * TOPIC vs QUEUE:
 *   We use /topic/ so every service that subscribes (graph-consumer,
 *   a future analytics service, an alerting service) ALL receive
 *   every message independently. A queue would only deliver each
 *   message to ONE consumer.
 */

const WebSocket = require('ws');
const stompit   = require('stompit');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const TOPIC         = '/topic/market.data';   // <-- topic, not queue

// Binance combined stream — multiple streams over one connection
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

let stompClient = null;
let publishCount = 0;

function connectActiveMQ(onReady) {
  console.log(`[producer] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  stompit.connect(
    {
      host: ACTIVEMQ_HOST,
      port: ACTIVEMQ_PORT,
      connectHeaders: { host: '/', login: 'admin', passcode: 'admin', 'heart-beat': '5000,5000' },
    },
    (err, client) => {
      if (err) {
        console.error('[producer] ActiveMQ connect failed:', err.message, '— retry in 3s');
        setTimeout(() => connectActiveMQ(onReady), 3000);
        return;
      }
      console.log('[producer] ActiveMQ connected');
      stompClient = client;
      client.on('error', (e) => {
        console.error('[producer] ActiveMQ error:', e.message, '— reconnecting');
        stompClient = null;
        setTimeout(() => connectActiveMQ(() => {}), 3000);
      });
      onReady();
    }
  );
}

function publish(type, symbol, payload) {
  if (!stompClient) return;
  try {
    const frame = stompClient.send({
      destination: TOPIC,
      'content-type': 'application/json',
    });
    frame.write(JSON.stringify({ type, symbol, payload, ts: Date.now() }));
    frame.end();
    publishCount++;
    if (publishCount % 200 === 0) {
      console.log(`[producer] ${publishCount} messages published to ${TOPIC}`);
    }
  } catch (e) {
    console.error('[producer] publish error:', e.message);
  }
}

// ── Binance WebSocket ─────────────────────────────────────────────────────────

function connectBinance() {
  console.log('[producer] connecting to Binance WebSocket…');
  const ws = new WebSocket(BINANCE_URL);

  ws.on('open', () => {
    console.log('[producer] Binance WebSocket connected');
  });

  ws.on('message', (raw) => {
    let envelope;
    try { envelope = JSON.parse(raw); } catch { return; }

    // Combined stream wraps payload: { stream: "btcusdt@aggTrade", data: {...} }
    const streamName = envelope.stream || '';
    const data       = envelope.data   || envelope;

    if (streamName.includes('@aggTrade')) {
      // Normalize trade message
      publish('trade', data.s, {
        tradeId:      data.a,
        price:        parseFloat(data.p),
        quantity:     parseFloat(data.q),
        isBuyerMaker: data.m,   // true = seller initiated (red), false = buyer (green)
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
        closed:    k.x,   // true = candle is finalized
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

  // Binance requires pong response to their ping frames
  ws.on('ping', (data) => {
    ws.pong(data);
  });

  ws.on('close', () => {
    console.log('[producer] Binance WebSocket closed — reconnecting in 5s');
    setTimeout(connectBinance, 5000);
  });

  ws.on('error', (err) => {
    console.error('[producer] Binance WebSocket error:', err.message);
  });
}

// ── Start: ActiveMQ first, then Binance ──────────────────────────────────────

connectActiveMQ(connectBinance);
