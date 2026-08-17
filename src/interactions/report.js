// Flags something to be dealt with later, without resolving it in the moment.
export const name = 'report';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    consequence: actionDef.consequence,
    feedback: actionDef.feedback
  };
}
