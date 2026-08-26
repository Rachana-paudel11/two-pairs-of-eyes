// The "two pairs of eyes" case: wait and verify jointly before proceeding.
export const name = 'holdPosition';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    flags: actionDef.flags ?? [],
    consequence: actionDef.consequence,
    feedback: actionDef.feedback,
    alexAction: actionDef.alexAction ?? 'hold_position'
  };
}

export default resolve;
