import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const MAX_CANDLES = 60;

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#7eb8f7', marginBottom: 4 }}>{fmt(d.closeTime)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
        <span style={{ color: '#4a6080' }}>O</span><span style={{ color: '#e0e6f0' }}>{d.open.toFixed(2)}</span>
        <span style={{ color: '#4a6080' }}>H</span><span style={{ color: '#4af7a0' }}>{d.high.toFixed(2)}</span>
        <span style={{ color: '#4a6080' }}>L</span><span style={{ color: '#f74a4a' }}>{d.low.toFixed(2)}</span>
        <span style={{ color: '#4a6080' }}>C</span><span style={{ color: '#e0e6f0' }}>{d.close.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function PriceChart({ candles, symbol }) {
  const data = useMemo(() => candles.slice(-MAX_CANDLES), [candles]);
  if (!data.length) return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: 24, color: '#4a6080', fontSize: 13 }}>
      Waiting for {symbol} kline data…
    </div>
  );

  const domain = useMemo(() => {
    const prices = data.flatMap(d => [d.low, d.high]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.1;
    return [min - pad, max + pad];
  }, [data]);

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: '16px 8px 8px' }}>
      <div style={{ color: '#7eb8f7', fontSize: 13, marginBottom: 8, paddingLeft: 8, letterSpacing: 1 }}>
        {symbol} — 1m CANDLES (last {data.length})
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00c8ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00c8ff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
          <XAxis dataKey="closeTime" tickFormatter={fmt} tick={{ fill: '#4a6080', fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis domain={domain} tick={{ fill: '#4a6080', fontSize: 10 }} tickFormatter={v => v.toFixed(0)} width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="close" stroke="#00c8ff" strokeWidth={1.5}
            fill="url(#priceGrad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
