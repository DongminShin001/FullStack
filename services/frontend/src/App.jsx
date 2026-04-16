import React, { useState, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import PriceChart from './components/PriceChart';
import TickerBar from './components/TickerBar';
import TradeFeed from './components/TradeFeed';

const MAX_TRADES  = 200;
const MAX_CANDLES = 120;

const STATUS_COLOR = { connected: '#4af7a0', disconnected: '#f7d84a', error: '#f74a4a' };

export default function App() {
  const [tickers, setTickers]       = useState({});                   // { BTCUSDT: {...}, ETHUSDT: {...} }
  const [btcCandles, setBtcCandles] = useState([]);
  const [ethCandles, setEthCandles] = useState([]);
  const [trades, setTrades]         = useState([]);
  const [activeSymbol, setActiveSymbol] = useState('BTCUSDT');

  const onTicker = useCallback((msg) => {
    setTickers(prev => ({ ...prev, [msg.symbol]: msg.payload }));
  }, []);

  const onKline = useCallback((msg) => {
    const setter = msg.symbol === 'BTCUSDT' ? setBtcCandles : setEthCandles;
    setter(prev => {
      const next = [...prev];
      // Replace last candle if same interval is still open, else append
      if (next.length && next[next.length - 1].openTime === msg.payload.openTime) {
        next[next.length - 1] = msg.payload;
      } else {
        next.push(msg.payload);
      }
      return next.slice(-MAX_CANDLES);
    });
  }, []);

  const onTrade = useCallback((msg) => {
    setTrades(prev => [...prev.slice(-(MAX_TRADES - 1)), msg]);
  }, []);

  const { status } = useWebSocket({ onTrade, onKline, onTicker });

  const candles = activeSymbol === 'BTCUSDT' ? btcCandles : ethCandles;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: 16, fontFamily: "'Courier New', monospace" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7eb8f7', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
            MARKET MONITOR
          </div>
          <div style={{ color: '#4a6080', fontSize: 11, marginTop: 2 }}>
            live data via Binance WebSocket → ActiveMQ topic → WebSocket
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', boxShadow: `0 0 6px ${STATUS_COLOR[status]}` }} />
          <span style={{ fontSize: 11, color: '#7eb8f7', letterSpacing: 1 }}>{status.toUpperCase()}</span>
        </div>
      </div>

      {/* Ticker prices */}
      <div style={{ marginBottom: 12 }}>
        <TickerBar tickers={tickers} />
      </div>

      {/* Symbol tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['BTCUSDT', 'ETHUSDT'].map(sym => (
          <button
            key={sym}
            onClick={() => setActiveSymbol(sym)}
            style={{
              background: activeSymbol === sym ? '#1e4a8f' : '#0a0e1a',
              border: `1px solid ${activeSymbol === sym ? '#3a8adf' : '#1e3a5f'}`,
              color: activeSymbol === sym ? '#7eb8f7' : '#4a6080',
              borderRadius: 4, padding: '4px 16px', cursor: 'pointer', fontSize: 12,
            }}
          >
            {sym.replace('USDT', '/USDT')}
          </button>
        ))}
      </div>

      {/* Chart + trade feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
        <PriceChart candles={candles} symbol={activeSymbol} />
        <TradeFeed trades={trades} symbol={activeSymbol} />
      </div>
    </div>
  );
}
