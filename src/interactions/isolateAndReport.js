// Isolates equipment and files a maintenance report.
export const name = 'isolateAndReport';
export const terminal = true;

export function resolve(actionDef) {
  return {
    outcome: actionDef.outcome,
    points: actionDef.points,
    flags: actionDef.flags ?? [],
    consequence: actionDef.consequence,
    feedback: actionDef.feedback,
    alexAction: actionDef.alexAction ?? 'isolate_equipment'
  };
}

export default resolve;
