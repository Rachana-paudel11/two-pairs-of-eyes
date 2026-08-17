// Agrees with a correct "all clear" read and moves on without escalating.
// Added beyond the brief's five named modules to give hazard.present: false
// stops a terminal action distinct from report's over-reporting path.
export const name = 'continueOn';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    consequence: actionDef.consequence,
    feedback: actionDef.feedback
  };
}
