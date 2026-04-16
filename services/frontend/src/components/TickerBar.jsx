import React from 'react';

function Ticker({ symbol, data }) {
  if (!data) return null;
  const change = data.close - data.open;
  const changePct = ((change / data.open) * 100).toFixed(2);
  const up = change >= 0;

  return (
    <div style={{
      background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8,
      padding: '12px 16px', flex: 1,
    }}>
      <div style={{ color: '#7eb8f7', fontSize: 12, letterSpacing: 1, marginBottom: 6 }}>{symbol}</div>
      <div style={{ color: up ? '#4af7a0' : '#f74a4a', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
        ${data.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
        <span style={{ color: up ? '#4af7a0' : '#f74a4a' }}>
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({up ? '+' : ''}{changePct}%)
        </span>
        <span style={{ color: '#4a6080' }}>H: {data.high.toFixed(2)}</span>
        <span style={{ color: '#4a6080' }}>L: {data.low.toFixed(2)}</span>
      </div>
      <div style={{ color: '#4a6080', fontSize: 10, marginTop: 4 }}>
        Vol: {parseFloat(data.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
      </div>
    </div>
  );
}

export default function TickerBar({ tickers }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Ticker symbol="BTC/USDT" data={tickers['BTCUSDT']} />
      <Ticker symbol="ETH/USDT" data={tickers['ETHUSDT']} />
    </div>
  );
}
