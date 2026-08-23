# 🏭 Warehouse Environment & Scene Setup

This document explains the steps taken to configure the 3D warehouse environment in A-Frame and outlines the upcoming process for adding interactive characters (NPCs) based on our safety training data.

## 1. Environment Setup

### Loading the 3D Model
The core environment is a 3D warehouse model (`warehouse.glb`). To ensure the model loads efficiently before the scene renders, it is preloaded in the `<a-assets>` tag:
```html
<a-assets timeout="30000">
  <a-asset-item id="warehouse-model" src="public/assets/models/environment/warehouse.glb"></a-asset-item>
</a-assets>

<!-- Displaying the model -->
<a-gltf-model src="#warehouse-model" position="0 0 0"></a-gltf-model>

```

### Finding the Correct Dimensions and Spawning
Every `.glb` file exported from 3D software (like Sketchfab or Blender) has its own unique scale, origin point, and orientation. 
We wrote a temporary `log-bounds` script to calculate the bounding box of the warehouse mesh using `THREE.Box3`. 
This told us:
*   **Floor level (Y):** Exactly `0`
*   **Center point:** `X = 0.9`, `Z = -3.2`

Using this, we placed the player's starting camera perfectly at the entrance (`X = 0.9, Z = 2`) and set the camera rig to an adjusted height so the 1.6m eye-level wouldn't hit the slightly scaled-down doorframe.

### Lighting & Navigation
*   **Ambient & Directional Lights:** Added soft white ambient lighting and a warm directional light to simulate warehouse ceiling strips.
*   **Movement Controls:** We are using standard `wasd-controls` with `fly: false`. This ensures the player stays on the horizontal ground plane even when looking up or down.

### Hazard Stop Hotspots
Based on `src/data/stops.json`, we mapped out 5 interactive locations using flat colored `<a-circle>` discs on the floor (`rotation="-90 0 0"`) with a glowing animation to draw the user's eye.

---

## 2. Next Steps: Adding Characters (NPCs)

Now that the environment is set up, the next phase is rendering the Supervisor character (e.g., "Dave") at the hazard stops.

### How Characters Will Work
Our engine logic already creates the supervisor data via `src/characters/npc.js` based on the JSON file. We need to render them visually.

**Step 1: Get a Character Model**
We need a humanoid `.glb` model (e.g., from Mixamo or ReadyPlayerMe) and place it in `public/assets/models/characters/supervisor.glb`.

**Step 2: Add to the Scene**
At each stop, we will place the character model alongside the hazard:
```html
<!-- Example: Dave at Stop 1 -->
<a-entity id="npc-dave-01" position="1.5 0 -4.5" rotation="0 -45 0">
  <a-gltf-model src="#supervisor-model"></a-gltf-model>
</a-entity>
```

**Step 3: Animations (Optional but Recommended)**
If the character model has animations (like Idle, Pointing, or Talking), we can use the `aframe-extras` animation-mixer to play them depending on Dave's behaviour ("dismissive", "uncertain", etc.):
```html
<a-gltf-model src="#supervisor-model" animation-mixer="clip: Idle; loop: repeat"></a-gltf-model>
```

**Step 4: Dialogue UI**
When the user approaches a stop, the `scenarioEngine` will emit a `dialogue:line` event. We will hook this event into an HTML overlay (`#dialoguePanel`) to display what Dave is saying!
