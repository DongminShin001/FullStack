const StompClient = require('./stomp');
const { generatePSD, generateCAF } = require('./dataGenerator');

const ACTIVEMQ_HOST   = process.env.ACTIVEMQ_HOST   || 'localhost';
const ACTIVEMQ_PORT   = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const INTERVAL_MS     = parseInt(process.env.PUBLISH_INTERVAL_MS || '200', 10);
const TOPIC           = '/topic/satellite.data';

let publishCount = 0;

async function startProducer() {
  console.log(`[producer] connecting to ActiveMQ ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);
  const stomp = new StompClient(ACTIVEMQ_HOST, ACTIVEMQ_PORT, 'admin', 'admin');

  stomp.on('error', (err) => {
    console.error('[producer] error:', err.message, '— retry in 3s');
    setTimeout(startProducer, 3000);
  });

  stomp.on('close', () => {
    console.log('[producer] connection closed — retry in 3s');
    setTimeout(startProducer, 3000);
  });

  try {
    await stomp.connect();
    console.log(`[producer] connected — publishing every ${INTERVAL_MS}ms to ${TOPIC}`);

    setInterval(() => {
      stomp.publish(TOPIC, JSON.stringify({ type: 'psd', payload: generatePSD(), ts: Date.now() }));
      stomp.publish(TOPIC, JSON.stringify({ type: 'caf', payload: generateCAF(), ts: Date.now() }));
      publishCount += 2;
      if (publishCount % 50 === 0) console.log(`[producer] ${publishCount} messages published`);
    }, INTERVAL_MS);

  } catch (err) {
    console.error('[producer] connect failed:', err.message, '— retry in 3s');
    setTimeout(startProducer, 3000);
  }
}

startProducer();
