import React, { useRef, useEffect, useCallback } from 'react';

/**
 * Renders a waterfall heatmap from a Float32Array.
 * Frontend does ONE thing: map float values to RGBA pixels via Canvas.
 * No math, no parsing — backend already did everything.
 *
 * Color map: 0.0 = dark blue (noise), 0.5 = cyan/green, 1.0 = red (peak)
 */

function valueToRGBA(v) {
  // Spectrum color map: dark blue → cyan → green → yellow → red
  let r = 0, g = 0, b = 0;
  if (v < 0.25) {
    const t = v / 0.25;
    r = 0; g = Math.round(t * 80); b = Math.round(80 + t * 175);
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    r = 0; g = Math.round(80 + t * 175); b = Math.round(255 - t * 255);
  } else if (v < 0.75) {
    const t = (v - 0.5) / 0.25;
    r = Math.round(t * 255); g = 255; b = 0;
  } else {
    const t = (v - 0.75) / 0.25;
    r = 255; g = Math.round(255 - t * 255); b = 0;
  }
  return [r, g, b];
}

export default function WaterfallCanvas({ floats, rows, cols, width = '100%' }) {
  const canvasRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floats || !rows || !cols) return;

    // Set canvas resolution to match data
    canvas.width  = cols;
    canvas.height = rows;

    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cols, rows);

    // This is the entire frontend job: Float32 → RGBA pixels
    for (let i = 0; i < rows * cols; i++) {
      const [r, g, b] = valueToRGBA(floats[i]);
      img.data[i * 4 + 0] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);  // ← one call, done
  }, [floats, rows, cols]);

  useEffect(() => { render(); }, [render]);

  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 8px 8px' }}>
      <div style={{ color: '#7eb8f7', fontSize: 13, marginBottom: 8, paddingLeft: 4, letterSpacing: 1 }}>
        PSD WATERFALL  <span style={{ color: '#4a6080', fontSize: 10 }}>
          (binary Float32 — backend normalized, frontend renders)
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width, display: 'block', imageRendering: 'pixelated', borderRadius: 4 }}
      />
      {(!floats || !rows) && (
        <div style={{ color: '#4a6080', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
          Waiting for DSP data…
        </div>
      )}
    </div>
  );
}
