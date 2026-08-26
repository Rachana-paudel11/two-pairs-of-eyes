// Flags something to be dealt with later, without resolving it in the moment.
export const name = 'report';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    flags: actionDef.flags ?? [],
    consequence: actionDef.consequence,
    feedback: actionDef.feedback,
    alexAction: actionDef.alexAction ?? 'move_to_safety'
  };
}

export default resolve;
