/**
 * Minimal STOMP 1.2 client over raw TCP.
 * No external dependencies — uses Node's built-in net module.
 *
 * STOMP is a simple text protocol:
 *   COMMAND\n
 *   header:value\n
 *   \n
 *   BODY\0
 */

const net = require('net');
const { EventEmitter } = require('events');

class StompClient extends EventEmitter {
  constructor(host, port, login = 'guest', passcode = 'guest') {
    super();
    this.host     = host;
    this.port     = port;
    this.login    = login;
    this.passcode = passcode;
    this.socket   = null;
    this._buf     = '';
    this._subSeq  = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port });

      this.socket.once('connect', () => {
        this._sendFrame('CONNECT', {
          'accept-version': '1.2',
          host: '/',
          login: this.login,
          passcode: this.passcode,
          'heart-beat': '0,0',
        });
      });

      this.socket.on('data',  (chunk) => this._onData(chunk));
      this.socket.on('error', (err)   => this.emit('error', err));
      this.socket.on('close', ()      => this.emit('close'));

      this.once('connected', resolve);
      this.once('error',     reject);
    });
  }

  // Publish a message to a destination (queue or topic)
  publish(destination, body) {
    this._sendFrame('SEND', {
      destination,
      'content-type': 'application/json',
    }, body);
  }

  // Subscribe to a destination. callback(body: string) called per message.
  subscribe(destination, callback) {
    const id = `sub-${++this._subSeq}`;
    this._sendFrame('SUBSCRIBE', { destination, id, ack: 'auto' });
    this.on('_message', (frame) => {
      if (frame.headers.subscription === id) callback(frame.body);
    });
    return id;
  }

  disconnect() {
    this.socket?.destroy();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _sendFrame(command, headers = {}, body = '') {
    let frame = command + '\n';
    for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`;
    if (body) frame += `content-length:${Buffer.byteLength(body)}\n`;
    frame += '\n' + body + '\0';
    this.socket.write(frame);
  }

  _onData(chunk) {
    this._buf += chunk.toString('utf8');
    // STOMP frames are separated by NULL byte
    let idx;
    while ((idx = this._buf.indexOf('\0')) !== -1) {
      const raw = this._buf.slice(0, idx);
      this._buf = this._buf.slice(idx + 1).replace(/^[\n\r]+/, '');
      if (raw.trim()) this._dispatchFrame(raw);
    }
  }

  _dispatchFrame(raw) {
    const lines   = raw.split('\n');
    const command = lines[0].trim();
    const headers = {};
    let i = 1;
    while (i < lines.length && lines[i].trim() !== '') {
      const colon = lines[i].indexOf(':');
      if (colon !== -1) headers[lines[i].slice(0, colon).trim()] = lines[i].slice(colon + 1).trim();
      i++;
    }
    const body = lines.slice(i + 1).join('\n').trim();

    if      (command === 'CONNECTED') this.emit('connected', headers);
    else if (command === 'MESSAGE')   this.emit('_message', { headers, body });
    else if (command === 'ERROR')     this.emit('error', new Error(headers.message || body));
    else if (command === 'RECEIPT')   this.emit('receipt', headers['receipt-id']);
  }
}

module.exports = StompClient;
