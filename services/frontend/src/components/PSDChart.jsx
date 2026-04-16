import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Downsample to reduce render load — show every Nth bin
const DISPLAY_BINS = 256;

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', padding: '6px 10px', fontSize: 12 }}>
      <div style={{ color: '#7eb8f7' }}>{d.freq} MHz</div>
      <div style={{ color: '#4af7a0' }}>{d.power} dBm</div>
    </div>
  );
}

export default function PSDChart({ data }) {
  const displayData = useMemo(() => {
    if (!data?.length) return [];
    const step = Math.max(1, Math.floor(data.length / DISPLAY_BINS));
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: '16px 8px 8px' }}>
      <div style={{ color: '#7eb8f7', fontSize: 13, marginBottom: 8, paddingLeft: 8, letterSpacing: 1 }}>
        POWER SPECTRAL DENSITY
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={displayData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="psdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00c8ff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#00c8ff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
          <XAxis
            dataKey="freq"
            tick={{ fill: '#4a6080', fontSize: 10 }}
            tickFormatter={(v) => `${v}`}
            label={{ value: 'MHz', position: 'insideBottomRight', fill: '#4a6080', fontSize: 10 }}
          />
          <YAxis
            domain={[-115, -30]}
            tick={{ fill: '#4a6080', fontSize: 10 }}
            tickFormatter={(v) => `${v}`}
            label={{ value: 'dBm', angle: -90, position: 'insideLeft', fill: '#4a6080', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={-105} stroke="#ff4040" strokeDasharray="4 4" label={{ value: 'noise floor', fill: '#ff4040', fontSize: 9 }} />
          <Area
            type="monotone"
            dataKey="power"
            stroke="#00c8ff"
            strokeWidth={1.5}
            fill="url(#psdGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
