// ── Characters & Waypoint Data Module ────────────────────────────────────────
// Defines supervisor and co-worker states, inspection stops, and dialogue lines.

export const waypoints = [
  {
    index: 0,
    name: 'Stop 01 — Fluid Spill Zone',
    position: '1.4 0 -3.2',
    rotation: '0 -45 0',
    daveDialogue: "People have been walking around it all morning. Someone will clean it later.",
    alexDialogue: "That fluid spill looks slippery. Dave wants to ignore it, but we should cordon it off!"
  },
  {
    index: 1,
    name: 'Stop 02 — Blind-Corner Forklift Junction',
    position: '-1.2 0 -9.5',
    rotation: '0 -120 0',
    daveDialogue: "I can't tell if the driver sees us, but let's quickly step through.",
    alexDialogue: "Wait! The driver has zero visibility around this blind corner. We must hold position!"
  },
  {
    index: 2,
    name: 'Stop 03 — Structural Racking Section',
    position: '2.4 0 -16.5',
    rotation: '0 60 0',
    daveDialogue: "That shelf upright has been bent for weeks. It's sturdy enough, don't worry about it.",
    alexDialogue: "A bent upright reduces load capacity by 50%! We need to report this immediately."
  },
  {
    index: 3,
    name: 'Stop 04 — Battery Bay & Flammables',
    position: '-1.6 0 -23.0',
    rotation: '0 -80 0',
    daveDialogue: "Just a flashing amber diagnostic light. Nothing to worry about.",
    alexDialogue: "Amber warning with cardboard combustibles stacked nearby is a serious fire risk!"
  },
  {
    index: 4,
    name: 'Stop 05 — Main Corridor Exit',
    position: '0.9 0 -28.0',
    rotation: '0 0 0',
    daveDialogue: "Walkway is clear here. Good job finishing the safety round.",
    alexDialogue: "Clean aisle with no obstructions! This is what proper standard looks like."
  }
];

export function getWaypoint(index) {
  return waypoints[index] || waypoints[0];
}

export function getTotalWaypoints() {
  return waypoints.length;
}

export function createNpc(supervisorData) {
  const { name, behaviour, dialogue } = supervisorData;
  return {
    name,
    behaviour,
    dialogue,
    isDismissive: behaviour === 'dismissive',
    isCorrect: behaviour === 'correct',
    isUncertain: behaviour === 'uncertain'
  };
}
