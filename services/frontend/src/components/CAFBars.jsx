import React, { useRef, useEffect } from 'react';

/**
 * Renders CAF channel bars from a Float32Array.
 * Values are already normalized 0.0–1.0 by the backend.
 * Frontend just draws rectangles.
 */
export default function CAFBars({ floats }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floats?.length) return;

    const count  = floats.length;
    const W      = canvas.clientWidth  || 600;
    const H      = 80;
    canvas.width  = W;
    canvas.height = H;

    const ctx    = canvas.getContext('2d');
    const barW   = Math.floor(W / count) - 2;
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < count; i++) {
      const val    = floats[i];
      const barH   = Math.round(val * H);
      const x      = i * (barW + 2);
      const y      = H - barH;

      // Color: green if active (>0.3), dim blue if noise
      const active = val > 0.3;
      ctx.fillStyle = active
        ? `rgba(74, 247, 160, ${0.4 + val * 0.6})`
        : 'rgba(30, 58, 95, 0.8)';

      ctx.fillRect(x, y, barW, barH);

      // Channel label
      ctx.fillStyle = '#4a6080';
      ctx.font = '8px monospace';
      ctx.fillText(String(i + 1).padStart(2, '0'), x, H - 2);
    }
  }, [floats]);

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 8px 8px' }}>
      <div style={{ color: '#7eb8f7', fontSize: 13, marginBottom: 8, paddingLeft: 4, letterSpacing: 1 }}>
        CAF CHANNELS  <span style={{ color: '#4a6080', fontSize: 10 }}>(Float32 normalized)</span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 80, display: 'block' }} />
    </div>
  );
}
