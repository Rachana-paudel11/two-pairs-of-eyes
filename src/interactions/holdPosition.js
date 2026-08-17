// The "two pairs of eyes" case: wait and verify jointly before proceeding.
export const name = 'holdPosition';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    consequence: actionDef.consequence,
    feedback: actionDef.feedback
  };
}
