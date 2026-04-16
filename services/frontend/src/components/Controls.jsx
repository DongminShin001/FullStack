import React, { useState } from 'react';

const RATES = [
  { label: '50ms', value: 50 },
  { label: '200ms', value: 200 },
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
];

export default function Controls({ status, send }) {
  const [activeRate, setActiveRate] = useState(200);
  const [psdOn, setPsdOn] = useState(true);
  const [cafOn, setCafOn] = useState(true);

  function setRate(ms) {
    setActiveRate(ms);
    send({ type: 'set_rate', intervalMs: ms });
  }

  function toggleStream(stream, current, setter) {
    const next = !current;
    setter(next);
    send({ type: 'set_streams', [stream]: next });
  }

  const dot = status === 'connected' ? '#4af7a0' : status === 'error' ? '#f74a4a' : '#f7d84a';

  return (
    <div style={{
      background: '#0d1424',
      border: '1px solid #1e3a5f',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      flexWrap: 'wrap',
    }}>
      {/* connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 6px ${dot}` }} />
        <span style={{ fontSize: 11, color: '#7eb8f7', textTransform: 'uppercase', letterSpacing: 1 }}>{status}</span>
      </div>

      {/* update rate buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#4a6080', marginRight: 4 }}>RATE</span>
        {RATES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRate(r.value)}
            style={{
              background: activeRate === r.value ? '#1e4a8f' : '#0a0e1a',
              border: `1px solid ${activeRate === r.value ? '#3a8adf' : '#1e3a5f'}`,
              color: activeRate === r.value ? '#7eb8f7' : '#4a6080',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* stream toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: '#4a6080' }}>STREAMS</span>
        {[{ key: 'psd', label: 'PSD', val: psdOn, set: setPsdOn }, { key: 'caf', label: 'CAF', val: cafOn, set: setCafOn }].map(({ key, label, val, set }) => (
          <button
            key={key}
            onClick={() => toggleStream(key, val, set)}
            style={{
              background: val ? '#0f2a1a' : '#1a0a0a',
              border: `1px solid ${val ? '#4af7a0' : '#5f2020'}`,
              color: val ? '#4af7a0' : '#f74a4a',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {label} {val ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>
    </div>
  );
}
