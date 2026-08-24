// ── Characters & Waypoint Data Module ────────────────────────────────────────
// Defines supervisor and co-worker states, inspection stops, and dialogue lines.

export const waypoints = [
  {
    index: 0,
    name: 'ZONE 01 // Transit Line — Overturned Drum & Fluid Spill',
    position: '0.8 0 -4.5',
    rotation: '0 -45 0',
    cameraPosition: '0 0 -2.5',
    daveDialogue: "People have been stepping around that spilled drum all morning. Someone will clean it later.",
    alexDialogue: "That overturned barrel has chemical fluid spreading right across the walkway! We must cordon it off!"
  },
  {
    index: 1,
    name: 'ZONE 02 // Blind Junction — Forklift with Blocked Sightline',
    position: '0.2 0 -9.5',
    rotation: '0 40 0',
    cameraPosition: '-0.4 0 -7.5',
    daveDialogue: "I can't tell if the forklift driver sees us past that high cargo stack, but let's quickly step through.",
    alexDialogue: "Wait! That forklift load is stacked high above the mast, creating a total blind spot. Hold position!"
  },
  {
    index: 2,
    name: 'ZONE 03 // Storage Aisle — Pallet Racking Structural Integrity',
    position: '0.2 0 -14.5',
    rotation: '0 30 0',
    cameraPosition: '-0.3 0 -12.5',
    daveDialogue: "That rack upright has had a small dent for weeks. It's solid steel, don't worry about it.",
    alexDialogue: "A bent rack upright severely weakens multi-tier load capacity! We need to tag this bay out immediately."
  },
  {
    index: 3,
    name: 'ZONE 04 // Battery Charging Bay — Electrical & Combustible Risk',
    position: '-0.8 0 -18.5',
    rotation: '0 -60 0',
    cameraPosition: '0 0 -16.5',
    daveDialogue: "The amber fault light is just routine diagnostic telemetry. Stacking stock here saves floor space.",
    alexDialogue: "Combustible cardboard boxes stacked directly against a high-voltage charger is a major fire hazard!"
  },
  {
    index: 4,
    name: 'ZONE 05 // Main Egress Corridor — Safety Standard Compliance Audit',
    position: '0.2 0 -22.5',
    rotation: '0 0 0',
    cameraPosition: '0.0 0 -20.5',
    daveDialogue: "Walkway is clear and unobstructed here. Excellent job completing the safety round.",
    alexDialogue: "Clean aisle with proper clearances and no trip hazards — this is the benchmark standard!"
  }
];

export function getWaypoint(index) {
  return waypoints[index] || waypoints[0];
}

export function getTotalWaypoints() {
  return waypoints.length;
}

// Any supervisor is data: a name, a behaviour mode, and a line of dialogue.
export function createNpc(supervisorData = {}) {
  const { name = 'Dave', behaviour = 'dismissive', dialogue = '' } = supervisorData;
  return {
    name,
    behaviour,
    dialogue,
    isDismissive: behaviour === 'dismissive',
    isCorrect: behaviour === 'correct',
    isUncertain: behaviour === 'uncertain'
  };
}
