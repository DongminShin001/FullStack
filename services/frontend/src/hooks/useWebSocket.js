import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

export function useWebSocket({ onTrade, onKline, onTicker }) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Subscribe to BTC and ETH, all stream types
      ws.send(JSON.stringify({
        type: 'subscribe',
        symbols: ['BTCUSDT', 'ETHUSDT'],
        streamTypes: ['trade', 'kline', 'ticker'],
      }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'trade'  && onTrade)  onTrade(msg);
      if (msg.type === 'kline'  && onKline)  onKline(msg);
      if (msg.type === 'ticker' && onTicker) onTicker(msg);
    };

    ws.onerror = () => setStatus('error');

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 2000);
    };
  }, [onTrade, onKline, onTicker]);

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
