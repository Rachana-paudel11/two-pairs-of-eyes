// The one non-terminal interaction: it reveals detail but never advances the
// stop past ASSESS. Available whenever a stop defines inspect_reveals.
export const name = 'inspect';
export const terminal = false;

export function resolve(stop) {
  if (!stop.inspect_reveals) {
    throw new Error(`Stop "${stop.id}" has no inspect_reveals to resolve`);
  }
  return { revealed: stop.inspect_reveals };
}
