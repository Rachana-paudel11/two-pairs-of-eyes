export const OUTCOME_TIERS = Object.freeze(['optimal', 'partial', 'neutral', 'failure']);

export function createScore() {
  return {
    total: 0,
    tierCounts: { optimal: 0, partial: 0, neutral: 0, failure: 0 },
    log: []
  };
}

export function applyOutcome(score, { stopId, actionKey, points, outcome }) {
  if (!OUTCOME_TIERS.includes(outcome)) {
    throw new Error(`Unknown outcome tier: ${outcome}`);
  }
  return {
    total: score.total + points,
    tierCounts: {
      ...score.tierCounts,
      [outcome]: score.tierCounts[outcome] + 1
    },
    log: [...score.log, { stopId, actionKey, points, outcome }]
  };
}
