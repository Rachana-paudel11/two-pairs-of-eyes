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

  function once(event, handler) {
    const unsub = on(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  function emit(event, payload) {
    for (const handler of listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  const subscribe = on;
  const unsubscribe = off;

  return { on, off, once, subscribe, unsubscribe, emit };
}
