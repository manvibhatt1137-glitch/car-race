/**
 * Event Producer 1: Computer Keyboard (WASD / Arrow Keys / Spacebar)
 */
export class KeyboardProducer {
  constructor(eventQueue) {
    this.eventQueue = eventQueue;
    this.keys = new Set();
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);
      this._emitState();
    });

    window.addEventListener('keyup', (e) => {
      if (!this.keys.has(e.code)) return;
      this.keys.delete(e.code);
      this._emitState();
    });
  }

  _emitState() {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const brake = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const drift = this.keys.has('Space');

    const steer = (right ? 1 : 0) - (left ? 1 : 0);

    this.eventQueue.publish('INPUT_STEER', { value: steer }, 'KeyboardProducer');
    this.eventQueue.publish('INPUT_THROTTLE', { active: throttle }, 'KeyboardProducer');
    this.eventQueue.publish('INPUT_BRAKE', { active: brake }, 'KeyboardProducer');
    this.eventQueue.publish('INPUT_DRIFT', { active: drift }, 'KeyboardProducer');
  }
}

/**
 * Event Producer 2: ESP32 / Wokwi Controller via Web Serial API
 * Expects newline-delimited JSON: {"steer": -1..1, "throttle": 0|1, "brake": 0|1, "drift": 0|1}
 */
export class SerialESP32Producer {
  constructor(eventQueue) {
    this.eventQueue = eventQueue;
    this.port = null;
    this.isReading = false;
  }

  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API is not supported in this browser. Use Chrome or Edge.');
    }

    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });

    this.eventQueue.publish(
      'ESP32_CONNECTED',
      { portInfo: 'ESP32 Serial @ 115200 baud' },
      'SerialESP32Producer'
    );

    this._readLoop();
  }

  async _readLoop() {
    this.isReading = true;
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    let buffer = '';
    try {
      while (this.isReading) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('{')) continue;
          try {
            const data = JSON.parse(trimmed);
            if (typeof data.steer === 'number') {
              this.eventQueue.publish('INPUT_STEER', { value: Math.max(-1, Math.min(1, data.steer)) }, 'SerialESP32Producer');
            }
            if (data.throttle !== undefined) {
              this.eventQueue.publish('INPUT_THROTTLE', { active: Boolean(data.throttle) }, 'SerialESP32Producer');
            }
            if (data.brake !== undefined) {
              this.eventQueue.publish('INPUT_BRAKE', { active: Boolean(data.brake) }, 'SerialESP32Producer');
            }
            if (data.drift !== undefined) {
              this.eventQueue.publish('INPUT_DRIFT', { active: Boolean(data.drift) }, 'SerialESP32Producer');
            }
          } catch {
            // Ignore partial/malformed serial frames
          }
        }
      }
    } catch (err) {
      console.warn('Serial read terminated:', err);
    }
  }
}
