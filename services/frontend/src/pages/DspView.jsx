/**
 * DspView — separate page showing the dsp-service pipeline.
 *
 * This demonstrates the pattern from the user's previous project:
 * heavy data processing moved to backend, frontend is just a Canvas renderer.
 *
 * Data flow:
 *   satellite-producer → /topic/satellite.data → dsp-service
 *     (normalize, downsample, build waterfall) → binary Float32 WebSocket → here
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDspSocket } from '../hooks/useDspSocket';
import WaterfallCanvas from '../components/WaterfallCanvas';
import CAFBars from '../components/CAFBars';

const STATUS_COLOR = { connected: '#4af7a0', disconnected: '#f7d84a', error: '#f74a4a' };

export default function DspView() {
  const waterfallRef = useRef({ floats: null, rows: 0, cols: 0 });
  const [waterfallTick, setWaterfallTick] = useState(0);
  const [cafFloats, setCafFloats]         = useState(null);
  const [frameCount, setFrameCount]       = useState(0);

  const onWaterfall = useCallback((floats, rows, cols) => {
    // Store ref (no re-render on every frame — too expensive)
    // Only trigger render every ~5 frames
    waterfallRef.current = { floats, rows, cols };
    setFrameCount(n => {
      if (n % 5 === 0) setWaterfallTick(t => t + 1);
      return n + 1;
    });
  }, []);

  const onCaf = useCallback((floats) => {
    setCafFloats(floats);
  }, []);

  const { status } = useDspSocket({ onWaterfall, onCaf });

  const { floats, rows, cols } = waterfallRef.current;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: 16, fontFamily: "'Courier New', monospace" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7eb8f7', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
            DSP PIPELINE
          </div>
          <div style={{ color: '#4a6080', fontSize: 11, marginTop: 2 }}>
            satellite-producer → ActiveMQ → dsp-service (normalize+downsample) → binary Float32 → Canvas
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#4a6080', fontSize: 11 }}>frames: {frameCount}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#7eb8f7' }}>{status.toUpperCase()}</span>
        </div>
      </div>

      {/* What the backend sent vs what frontend does */}
      <div style={{
        background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: 8,
        padding: '10px 14px', marginBottom: 12, fontSize: 11,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16
      }}>
        <div>
          <div style={{ color: '#f74a4a', marginBottom: 4 }}>OLD WAY (your previous project)</div>
          <div style={{ color: '#4a6080', lineHeight: 1.8 }}>
            Frontend receives raw 512+ bins<br/>
            Frontend calculates dBm → linear<br/>
            Frontend normalizes 0–1<br/>
            Frontend downsamples to display size<br/>
            Frontend builds color map<br/>
            → UI thread blocked, slow
          </div>
        </div>
        <div>
          <div style={{ color: '#4af7a0', marginBottom: 4 }}>NEW WAY (dsp-service)</div>
          <div style={{ color: '#4a6080', lineHeight: 1.8 }}>
            Backend receives raw bins<br/>
            Backend does ALL calculations<br/>
            Backend sends Float32Array binary<br/>
            Frontend: new Float32Array(buffer)<br/>
            Frontend: ctx.putImageData()<br/>
            → UI thread free, instant render
          </div>
        </div>
      </div>

      {/* Waterfall canvas */}
      <div style={{ marginBottom: 12 }}>
        <WaterfallCanvas
          key={waterfallTick}
          floats={floats}
          rows={rows}
          cols={cols}
          width="100%"
        />
      </div>

      {/* CAF bars */}
      <CAFBars floats={cafFloats} />
    </div>
  );
}
