// Secures a hazard immediately (pre-placed markers, not manual placement).
export const name = 'cordonOff';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    flags: actionDef.flags ?? [],
    consequence: actionDef.consequence,
    feedback: actionDef.feedback,
    alexAction: actionDef.alexAction ?? 'cordon_area'
  };
}

export default resolve;
