/**
 * Central Local FIFO Event Queue
 * Decouples Event Producers from Event Handlers.
 */
export class EventQueue {
  constructor() {
    this.queue = [];
    this.subscribers = new Map();
    this.history = [];
    this.processedCount = 0;
    this.onLogUpdated = null;
  }

  /**
   * Register an event handler callback for a specific event type.
   */
  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(handler);
  }

  /**
   * Event Producers call publish() to enqueue a new event.
   */
  publish(type, payload = {}, producer = 'Unknown') {
    const event = {
      id: ++this.processedCount,
      type,
      payload,
      producer,
      timestamp: performance.now()
    };
    this.queue.push(event);
  }

  /**
   * Drains all queued events in strict FIFO order and invokes registered handlers.
   */
  drain() {
    while (this.queue.length > 0) {
      const event = this.queue.shift();

      // Store non-spammy events in visual history for the Event Inspector
      if (!event.type.startsWith('INPUT_STEER') || Math.abs(event.payload.value) > 0.05) {
        this.history.unshift(event);
        if (this.history.length > 35) this.history.pop();
        if (this.onLogUpdated) this.onLogUpdated(event);
      }

      const handlers = this.subscribers.get(event.type) || [];
      for (const handler of handlers) {
        handler(event.payload, event);
      }
    }
  }

  clearHistory() {
    this.history = [];
    this.processedCount = 0;
  }
}
