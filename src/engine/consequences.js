export function createConsequenceState() {
  return { flags: new Set() };
}

export function applyFlags(state, flagsToAdd = []) {
  const flags = new Set(state.flags);
  for (const flag of flagsToAdd) {
    flags.add(flag);
  }
  return { flags };
}

// Returns every end-of-session rule whose requiresFlags are all present.
export function evaluateEndOfSession(state, rules = []) {
  return rules.filter((rule) => rule.requiresFlags.every((flag) => state.flags.has(flag)));
}
