/**
 * exchange-producer (formerly binance-producer)
 *
 * Uses Kraken WebSocket v2 — globally accessible, no API key needed.
 * Binance returns 451 (geo-blocked) in South Korea and some other regions.
 *
 * Kraken WebSocket v2: wss://ws.kraken.com/v2
 * Docs: https://docs.kraken.com/api/docs/websocket-v2/
 *
 * Publishes same normalized message format as before so graph-consumer
 * and the rest of the pipeline need zero changes.
 */

const WebSocket   = require('ws');
const StompClient = require('./stomp');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const TOPIC         = '/topic/market.data';
const QUEUE         = '/queue/large.trades';

const LARGE_TRADE_THRESHOLDS = { 'BTC/USD': 0.5, 'ETH/USD': 5 };

// Kraken uses "BTC/USD" format — normalize to "BTCUSDT" to match existing frontend
function toSymbol(krakenSymbol) {
  return krakenSymbol.replace('/', '').replace('USD', 'USDT');
}

const KRAKEN_URL = 'wss://ws.kraken.com/v2';

// ── ActiveMQ connection ───────────────────────────────────────────────────────

let stomp = null;
let publishCount = 0;

function publish(type, symbol, payload) {
  if (!stomp) return;
  try {
    stomp.publish(TOPIC, JSON.stringify({ type, symbol, payload, ts: Date.now() }));
    publishCount++;
    if (publishCount % 200 === 0) {
      console.log(`[producer] ${publishCount} messages published`);
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
    console.error('[producer] ActiveMQ error:', err.message);
    stomp = null;
    setTimeout(connectActiveMQ, 3000);
  });
  client.on('close', () => {
    if (stomp) { stomp = null; setTimeout(connectActiveMQ, 3000); }
  });

  try {
    await client.connect();
    console.log('[producer] ActiveMQ connected');
    stomp = client;
  } catch (err) {
    console.error('[producer] ActiveMQ failed:', err.message, '— retry in 3s');
    setTimeout(connectActiveMQ, 3000);
  }
}

// ── Kraken WebSocket ──────────────────────────────────────────────────────────

// Rolling OHLC candles built from trade stream (Kraken OHLC has a delay)
const candles = {}; // symbol → current open candle

function getCurrentMinute() {
  return Math.floor(Date.now() / 60000) * 60000;
}

function updateCandle(symbol, price, quantity) {
  const openTime = getCurrentMinute();
  if (!candles[symbol] || candles[symbol].openTime !== openTime) {
    candles[symbol] = { openTime, closeTime: openTime + 59999, open: price, high: price, low: price, close: price, volume: 0, trades: 0, interval: '1m', closed: false };
  }
  const c = candles[symbol];
  if (price > c.high) c.high = price;
  if (price < c.low)  c.low  = price;
  c.close   = price;
  c.volume += quantity;
  c.trades++;
  return { ...c };
}

function connectKraken() {
  console.log('[producer] connecting to Kraken WebSocket…');
  const ws = new WebSocket(KRAKEN_URL);

  ws.on('open', () => {
    console.log('[producer] Kraken WebSocket connected');

    // Subscribe to trades and tickers for BTC and ETH
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { channel: 'trade',  symbol: ['BTC/USD', 'ETH/USD'] },
    }));
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: ['BTC/USD', 'ETH/USD'] },
    }));
  });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Ignore heartbeats and subscription confirmations
    if (msg.method || msg.channel === 'status') return;

    const channel = msg.channel;
    const data    = msg.data;
    if (!Array.isArray(data)) return;

    // ── Trade stream ──────────────────────────────────────────────────────
    if (channel === 'trade') {
      for (const t of data) {
        const symbol   = toSymbol(t.symbol);
        const price    = parseFloat(t.price);
        const quantity = parseFloat(t.qty);

        // Publish trade to topic (all consumers get it)
        publish('trade', symbol, {
          tradeId:      t.trade_id,
          price,
          quantity,
          isBuyerMaker: t.side === 'sell',
          tradeTime:    new Date(t.timestamp).getTime(),
        });

        // Publish to kline from accumulated candle data
        const candle = updateCandle(symbol, price, quantity);
        publish('kline', symbol, candle);

        // Publish to queue if large trade
        const krakenSym   = t.symbol;
        const threshold   = LARGE_TRADE_THRESHOLDS[krakenSym];
        if (stomp && threshold && quantity >= threshold) {
          stomp.publish(QUEUE, JSON.stringify({
            symbol,
            price,
            quantity,
            side:      t.side.toUpperCase(),
            tradeTime: new Date(t.timestamp).getTime(),
            usdValue:  parseFloat((price * quantity).toFixed(2)),
          }));
          console.log(`[producer] large trade → queue: ${symbol} qty:${quantity}`);
        }
      }
    }

    // ── Ticker stream ─────────────────────────────────────────────────────
    if (channel === 'ticker') {
      for (const t of data) {
        const symbol = toSymbol(t.symbol);
        publish('ticker', symbol, {
          close:       parseFloat(t.last),
          open:        parseFloat(t.open?.h24 ?? t.last),
          high:        parseFloat(t.high?.h24 ?? t.last),
          low:         parseFloat(t.low?.h24 ?? t.last),
          baseVolume:  parseFloat(t.volume?.h24 ?? 0),
          quoteVolume: parseFloat(t.vwap?.h24 ? t.vwap.h24 * (t.volume?.h24 ?? 0) : 0),
        });
      }
    }
  });

  ws.on('ping', (data) => ws.pong(data));

  ws.on('close', () => {
    console.log('[producer] Kraken WebSocket closed — reconnecting in 5s');
    setTimeout(connectKraken, 5000);
  });

  ws.on('error', (err) => console.error('[producer] Kraken error:', err.message));
}

// ── Start ─────────────────────────────────────────────────────────────────────

connectActiveMQ().then(connectKraken);
