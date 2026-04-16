import { useEffect, useRef, useCallback, useState } from 'react';

const DSP_URL = import.meta.env.VITE_DSP_URL || 'ws://localhost:3004';

// Must match processor.js constants
const FRAME_TYPE   = { PSD_LINE: 0x01, WATERFALL: 0x02, CAF: 0x03 };
const DISPLAY_COLS = 256;

export function useDspSocket({ onPsdLine, onWaterfall, onCaf }) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(DSP_URL);
    ws.binaryType = 'arraybuffer'; // receive as ArrayBuffer, not Blob

    ws.onopen  = () => { setStatus('connected'); };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
      // event.data is ArrayBuffer — no JSON.parse, no string allocation
      const buf  = event.data;
      const view = new DataView(buf);
      const type = view.getUint32(0, true); // little-endian

      if (type === FRAME_TYPE.PSD_LINE && onPsdLine) {
        // Skip 4-byte header, rest is Float32Array
        const floats = new Float32Array(buf, 4, DISPLAY_COLS);
        onPsdLine(floats);
      }

      else if (type === FRAME_TYPE.WATERFALL && onWaterfall) {
        const rows   = view.getUint32(4, true);
        const cols   = view.getUint32(8, true);
        const floats = new Float32Array(buf, 12, rows * cols);
        onWaterfall(floats, rows, cols);
      }

      else if (type === FRAME_TYPE.CAF && onCaf) {
        const count  = view.getUint32(4, true);
        const floats = new Float32Array(buf, 8, count);
        onCaf(floats);
      }
    };

    wsRef.current = ws;
  }, [onPsdLine, onWaterfall, onCaf]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status };
}
