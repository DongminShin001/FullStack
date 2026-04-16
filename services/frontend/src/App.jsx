import React, { useState, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import PSDChart from './components/PSDChart';
import CAFPanel from './components/CAFPanel';
import Controls from './components/Controls';

export default function App() {
  const [psdData, setPsdData] = useState([]);
  const [cafData, setCafData] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const lastPsdTs = useRef(0);

  const onPSD = useCallback((payload) => {
    setPsdData(payload);
    setFrameCount((n) => n + 1);
  }, []);

  const onCAF = useCallback((payload) => {
    setCafData(payload);
  }, []);

  const { status, send } = useWebSocket({ onPSD, onCAF });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7eb8f7', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
            SATELLITE SIGNAL MONITOR
          </div>
          <div style={{ color: '#4a6080', fontSize: 11, marginTop: 2 }}>
            400–500 MHz  ·  realtime spectrum & channel analysis
          </div>
        </div>
        <div style={{ color: '#4a6080', fontSize: 11 }}>
          FRAMES: <span style={{ color: '#7eb8f7' }}>{frameCount}</span>
        </div>
      </div>

      {/* controls bar — sends commands back to backend */}
      <div style={{ marginBottom: 12 }}>
        <Controls status={status} send={send} />
      </div>

      {/* PSD spectrum chart */}
      <div style={{ marginBottom: 12 }}>
        <PSDChart data={psdData} />
      </div>

      {/* CAF channel grid */}
      <CAFPanel channels={cafData} />
    </div>
  );
}
