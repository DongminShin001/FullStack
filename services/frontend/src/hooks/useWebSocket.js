import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket({ onPSD, onCAF }) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected'); // connected | disconnected | error
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      console.log('[WS] connected');
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'psd' && onPSD) onPSD(msg.payload, msg.ts);
      if (msg.type === 'caf' && onCAF) onCAF(msg.payload, msg.ts);
    };

    ws.onerror = () => setStatus('error');

    ws.onclose = () => {
      setStatus('disconnected');
      console.log('[WS] disconnected — reconnecting in 2s');
      reconnectTimer.current = setTimeout(connect, 2000);
    };
  }, [onPSD, onCAF]);

  // Send a command to the backend
  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, send };
}
