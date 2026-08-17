// Takes no protective action despite a hazard or an unresolved uncertainty.
export const name = 'ignore';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    consequence: actionDef.consequence,
    feedback: actionDef.feedback
  };
}
