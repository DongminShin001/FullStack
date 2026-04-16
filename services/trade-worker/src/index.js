/**
 * trade-worker
 *
 * Reads from /queue/large.trades  (QUEUE — not topic)
 *
 * KEY DIFFERENCE from graph-consumer:
 *   graph-consumer uses /topic/  → every subscriber gets every message
 *   trade-worker uses /queue/    → only ONE worker gets each message
 *
 * If you run 3 copies of this worker, each large trade is processed
 * by exactly one of them — they share the load automatically.
 * ActiveMQ decides who gets the next message (round-robin).
 *
 * This worker:
 *  1. Dequeues large trades
 *  2. Stores them in memory (last 100)
 *  3. Exposes GET /alerts so frontend can poll
 */

const express    = require('express');
const StompClient = require('./stomp');

const ACTIVEMQ_HOST    = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT    = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const PORT             = parseInt(process.env.PORT || '3003', 10);
const QUEUE            = '/queue/large.trades';   // ← QUEUE not topic
const MAX_STORED       = 100;

// In-memory store of processed large trades
const alerts = [];
let processedCount = 0;

// ── REST API ──────────────────────────────────────────────────────────────────

const app = express();

// Allow frontend to call this directly
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Frontend polls this endpoint
app.get('/alerts', (_req, res) => {
  res.json({
    count: alerts.length,
    totalProcessed: processedCount,
    alerts: alerts.slice().reverse(), // newest first
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', queue: QUEUE }));

// ── Queue worker ──────────────────────────────────────────────────────────────

async function startWorker() {
  console.log(`[worker] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  const stomp = new StompClient(ACTIVEMQ_HOST, ACTIVEMQ_PORT, 'admin', 'admin');

  stomp.on('error', (err) => {
    console.error('[worker] ActiveMQ error:', err.message, '— retry in 3s');
    setTimeout(startWorker, 3000);
  });

  stomp.on('close', () => {
    console.log('[worker] connection closed — retry in 3s');
    setTimeout(startWorker, 3000);
  });

  try {
    await stomp.connect();
    console.log(`[worker] connected — consuming from ${QUEUE}`);

    stomp.subscribe(QUEUE, (body) => {
      let trade;
      try { trade = JSON.parse(body); } catch { return; }

      // Process the trade — in a real system this might:
      //   - save to Postgres
      //   - trigger an email alert
      //   - update a leaderboard
      // Here we just store it in memory.

      processedCount++;
      alerts.push({
        ...trade,
        processedAt: Date.now(),
        workerId: process.pid,   // shows WHICH worker handled it (useful if you scale to 3 workers)
      });

      // keep last 100 only
      if (alerts.length > MAX_STORED) alerts.shift();

      console.log(
        `[worker] processed trade #${processedCount} | ` +
        `${trade.symbol} $${trade.price?.toFixed(2)} qty:${trade.quantity?.toFixed(4)}`
      );
    });

  } catch (err) {
    console.error('[worker] connect failed:', err.message, '— retry in 3s');
    setTimeout(startWorker, 3000);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[worker] REST API on port ${PORT}  GET /alerts`);
  startWorker();
});
