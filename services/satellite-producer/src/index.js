const stompit = require('stompit');
const { generatePSD, generateCAF } = require('./dataGenerator');

const ACTIVEMQ_HOST = process.env.ACTIVEMQ_HOST || 'localhost';
const ACTIVEMQ_PORT = parseInt(process.env.ACTIVEMQ_PORT || '61613', 10);
const INTERVAL_MS   = parseInt(process.env.PUBLISH_INTERVAL_MS || '200', 10);
const QUEUE         = '/queue/satellite.data';

const connectOptions = {
  host: ACTIVEMQ_HOST,
  port: ACTIVEMQ_PORT,
  connectHeaders: {
    host: '/',
    login: 'admin',
    passcode: 'admin',
    'heart-beat': '5000,5000',
  },
};

function publish(client, type, payload) {
  const frame = client.send({
    destination: QUEUE,
    'content-type': 'application/json',
  });
  frame.write(JSON.stringify({ type, payload, ts: Date.now() }));
  frame.end();
}

let publishCount = 0;

function startProducer() {
  console.log(`[producer] connecting to ActiveMQ at ${ACTIVEMQ_HOST}:${ACTIVEMQ_PORT}…`);

  stompit.connect(connectOptions, (err, client) => {
    if (err) {
      console.error(`[producer] connection failed: ${err.message} — retrying in 3s`);
      setTimeout(startProducer, 3000);
      return;
    }

    console.log(`[producer] connected — publishing every ${INTERVAL_MS}ms to ${QUEUE}`);

    const timer = setInterval(() => {
      try {
        publish(client, 'psd', generatePSD());
        publish(client, 'caf', generateCAF());
        publishCount += 2;
        if (publishCount % 50 === 0) {
          console.log(`[producer] ${publishCount} messages published`);
        }
      } catch (e) {
        console.error('[producer] publish error:', e.message);
      }
    }, INTERVAL_MS);

    client.on('error', (err) => {
      console.error('[producer] connection error:', err.message);
      clearInterval(timer);
      setTimeout(startProducer, 3000);
    });
  });
}

startProducer();
