import React from 'react';

function SignalBar({ dbm }) {
  // -40 = strong, -110 = nothing. map to 0-100%
  const pct = Math.max(0, Math.min(100, ((dbm + 110) / 70) * 100));
  const color = pct > 60 ? '#4af7a0' : pct > 30 ? '#f7d84a' : '#f74a4a';
  return (
    <div style={{ width: '100%', height: 4, background: '#1a2744', borderRadius: 2 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.15s' }} />
    </div>
  );
}

export default function CAFPanel({ channels }) {
  if (!channels?.length) {
    return <div style={{ color: '#4a6080', padding: 16 }}>Waiting for CAF data…</div>;
  }

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#7eb8f7', fontSize: 13, marginBottom: 12, letterSpacing: 1 }}>
        CHANNEL ACTIVITY FEED
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {channels.map((ch) => (
          <div
            key={ch.id}
            style={{
              background: ch.active ? '#0a1e35' : '#0c1020',
              border: `1px solid ${ch.active ? '#1e5a8f' : '#141d30'}`,
              borderRadius: 6,
              padding: '8px 10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#7eb8f7', fontWeight: 'bold' }}>{ch.label}</span>
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: ch.active ? '#4af7a0' : '#2a3548',
                  boxShadow: ch.active ? '0 0 6px #4af7a0' : 'none',
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: '#4a6080', marginBottom: 2 }}>{ch.freqMHz} MHz</div>
            <SignalBar dbm={ch.signalDbm} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#4a6080' }}>{ch.signalDbm} dBm</span>
              <span style={{ fontSize: 9, color: '#4a6080' }}>SNR {ch.snrDb} dB</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
