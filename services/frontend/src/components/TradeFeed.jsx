import React from 'react';

const MAX_TRADES = 30;

export default function TradeFeed({ trades, symbol }) {
  const filtered = trades.filter(t => t.symbol === symbol).slice(-MAX_TRADES).reverse();

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
      <div style={{ color: '#7eb8f7', fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>
        {symbol} LIVE TRADES
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, fontSize: 11, color: '#4a6080', marginBottom: 4 }}>
        <span>PRICE</span><span style={{ textAlign: 'right' }}>QTY</span><span style={{ textAlign: 'right' }}>TIME</span>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filtered.map((t, i) => {
          const buy = !t.payload.isBuyerMaker;
          return (
            <div key={t.payload.tradeId ?? i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: 2, fontSize: 11, padding: '2px 0',
              borderBottom: '1px solid #0f1b2d',
            }}>
              <span style={{ color: buy ? '#4af7a0' : '#f74a4a' }}>
                {t.payload.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ textAlign: 'right', color: '#a0b4c8' }}>
                {t.payload.quantity.toFixed(4)}
              </span>
              <span style={{ textAlign: 'right', color: '#4a6080' }}>
                {new Date(t.payload.tradeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
