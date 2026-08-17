// Secures a hazard immediately (pre-placed markers, not manual placement).
export const name = 'cordonOff';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    consequence: actionDef.consequence,
    feedback: actionDef.feedback
  };
}
