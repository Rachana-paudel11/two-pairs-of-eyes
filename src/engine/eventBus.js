export function createEventBus() {
  const listeners = new Map();

  function on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    listeners.get(event)?.delete(handler);
  }

  function emit(event, payload) {
    for (const handler of listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  const subscribe = on;
  const unsubscribe = off;

  return { on, off, subscribe, unsubscribe, emit };
}
