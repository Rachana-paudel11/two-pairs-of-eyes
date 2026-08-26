// ── Characters & Waypoint Data Module ────────────────────────────────────────
// Defines supervisor and co-worker states, inspection stops, and dialogue lines.

export const SUPERVISOR_START = {
  position: '0.8 0 -4.5',
  rotation: '0 -45 0'
};

export const PLAYER_START = {
  position: '-0.6 0 -4.5',
  rotation: '0 30 0'
};

export const waypoints = [
  {
    index: 0,
    name: 'ZONE 01 | Transit Line | Overturned Drum & Fluid Spill',
    position: '0.8 0 -4.5',
    rotation: '0 -45 0',
    cameraPosition: '0.9 0 -2.5',
    daveDialogue: "People have been stepping around that spilled drum all morning. Someone will clean it later.",
    alexDialogue: "That overturned barrel has chemical fluid spreading right across the walkway! We must cordon it off!"
  },
  {
    index: 1,
    name: 'ZONE 02 | Blind Junction | Forklift Blocked Sightline',
    position: '-2.5 0 -14.0',
    rotation: '0 40 0',
    cameraPosition: '0.9 0 -12.0',
    daveDialogue: "I can't tell if the forklift driver sees us past that high cargo stack, but let's quickly step through.",
    alexDialogue: "Wait! That forklift load is stacked high above the mast, creating a total blind spot. Hold position!"
  },
  {
    index: 2,
    name: 'ZONE 03 | Storage Aisle | Pallet Racking Structural Risk',
    position: '2.2 0 -24.0',
    rotation: '0 30 0',
    cameraPosition: '0.9 0 -22.0',
    daveDialogue: "That rack upright has had a small dent for weeks. It's solid steel, don't worry about it.",
    alexDialogue: "A bent rack upright severely weakens multi-tier load capacity! We need to tag this bay out immediately."
  },
  {
    index: 3,
    name: 'ZONE 04 | Battery Charging Bay | Electrical & Combustible Risk',
    position: '-2.0 0 -34.0',
    rotation: '0 -60 0',
    cameraPosition: '0.9 0 -32.0',
    daveDialogue: "The amber fault light is just routine diagnostic telemetry. Stacking stock here saves floor space.",
    alexDialogue: "Combustible cardboard boxes stacked directly against a high-voltage charger is a major fire hazard!"
  },
  {
    index: 4,
    name: 'ZONE 05 | Main Egress Corridor | Safety Compliance Audit Complete',
    position: '0.0 0 -44.0',
    rotation: '0 0 0',
    cameraPosition: '0.9 0 -42.0',
    daveDialogue: "Walkway is clear and unobstructed here. Excellent job completing the safety round.",
    alexDialogue: "Clean aisle with proper clearances and no trip hazards — this is the benchmark standard!"
  }
];

export function createNpc(data) {
  return {
    id: (data.name || 'npc').toLowerCase(),
    name: data.name || 'NPC',
    behaviour: data.behaviour || 'neutral',
    dialogue: data.dialogue || ''
  };
}

export function getWaypoint(index) {
  return waypoints[index] || waypoints[0];
}

export function getTotalWaypoints() {
  return waypoints.length;
}
