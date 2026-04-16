import React, { useEffect, useState } from 'react';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3003';

export default function LargeTradeAlerts() {
  const [alerts, setAlerts]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [error, setError]     = useState(null);

  useEffect(() => {
    // Poll the trade-worker REST API every 2 seconds.
    // This is intentionally different from WebSocket —
    // showing that queued/processed data can be fetched via HTTP.
    function poll() {
      fetch(`${WORKER_URL}/alerts`)
        .then(r => r.json())
        .then(data => {
          setAlerts(data.alerts.slice(0, 20));
          setTotal(data.totalProcessed);
          setError(null);
        })
        .catch(() => setError('worker offline'));
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#f7d84a', fontSize: 12, letterSpacing: 1 }}>
          LARGE TRADE ALERTS  <span style={{ color: '#4a6080', fontSize: 10 }}>(queue → worker)</span>
        </div>
        <div style={{ color: '#4a6080', fontSize: 10 }}>
          {error
            ? <span style={{ color: '#f74a4a' }}>{error}</span>
            : `${total} processed`}
        </div>
      </div>

      {alerts.length === 0 && !error && (
        <div style={{ color: '#4a6080', fontSize: 11, padding: '8px 0' }}>
          Waiting for large trades (BTC ≥ 0.5, ETH ≥ 5)…
        </div>
      )}

      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {alerts.map((a, i) => {
          const buy = a.side === 'BUY';
          return (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr 80px 80px',
              gap: 4,
              fontSize: 11,
              padding: '4px 0',
              borderBottom: '1px solid #0f1b2d',
              alignItems: 'center',
            }}>
              <span style={{
                color: buy ? '#4af7a0' : '#f74a4a',
                fontWeight: 'bold',
                fontSize: 10,
              }}>
                {a.symbol?.replace('USDT', '')} {a.side}
              </span>
              <span style={{ color: '#e0e6f0' }}>
                ${a.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ color: '#a0b4c8', textAlign: 'right' }}>
                {a.quantity?.toFixed(3)}
              </span>
              <span style={{ color: '#f7d84a', textAlign: 'right' }}>
                ${(a.usdValue / 1000).toFixed(1)}k
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
