# 🏭 Warehouse Environment & 3D Simulation Setup — COMPLETE

> **Status:** ✅ **100% Fully Implemented, Memory-Optimized & Verified**

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

## 1. 3D Warehouse Environment Architecture

### Geometry & Spatial Alignment
* **Warehouse 3D Mesh:** `public/assets/models/environment/warehouse.glb` loaded via asynchronous streaming.
* **Floor Plane:** Sage green epoxy concrete floor (`#4a6b5d`, roughness: 0.35) with high-visibility safety yellow aisle markings (`#facc15`).
* **Boundary Clamping:** `warehouse-bounds-clamp` A-Frame component restricts camera movement within warehouse walls (bounds: $X \in [-2.8, 4.8]$, $Z \in [-30.0, -0.5]$, $Y = 0$).
* **Lighting System:** 
  * Ambient light (`#fff8e7`, intensity: 1.2) for balanced fill.
  * Directional sun/skylight (`#fef3c7`, intensity: 0.8) at $(0, 12, 2)$.
  * 4 overhead point bay lights (`#fde047`) spaced every 8 meters along the central aisle.

---

## 2. Interactive Characters (NPCs) & Animation

### Supervisor Dave (`#dave`)
* **Model:** `public/assets/models/characters/dave.glb` with safety hardhat and high-visibility vest.
* **Animations:** Embedded Mixamo skeletal animations (Idle, Walk cycle, Talk gesture).
* **Behavior:** Represents the supervisor who normalizes risks and encourages shortcuts.

### Co-Worker Alex (`#alex`)
* **Model:** `public/assets/models/characters/alex.glb` with safety vest.
* **Animations:** Embedded walking animation + procedural head and arm gesture blending (`setupAlexAnimations()`).
* **Behavior:** Represents peer guidance that reinforces official H&S standards.

---

## 3. The 5 Hazard Inspection Stops

| Stop # | Hazard Description | 3D Visual Representation | Psychological Factor |
| :---: | :--- | :--- | :--- |
| **01** | **Ground-Level Fluid Spill** | Shimmering blue liquid puddle + PSX wet floor sign | Slip/fall risk; "Someone will clean it later" |
| **02** | **Blind-Corner Vehicle Junction** | Delivery truck parked at 90° + stacked boxes | Forklift collision; blind spot rush |
| **03** | **Structural Racking Damage** | Heavy pallet rack + bent lower strut + collapsed pallet | Catastrophic collapse; 50% capacity loss |
| **04** | **Charging Bay Warning Light** | Wall charger unit + pulsing amber warning light + combustibles | Fire/battery hazard; ignored warning lights |
| **05** | **Clear Aisle Audit (Safe Zone)** | Clean aisle marking + green pulsing beacon | Verification of compliant workplace standards |

---

## 4. UI & Audio Systems

* **Light Theme Design System:** Built using official corporate tokens (`Dark Green #0A3323`, `Moss Green #839958`, `Beige #FAF8ED`).
* **Transparent Top HUD:** `backdrop-filter: blur(12px)` featuring live digital timer (`00:00`) and compliance score (`0 / 25 PTS`).
* **Comms Dialogue:** Features 2 player decision buttons (`[1] Agree & Bypass`, `[2] Challenge Protocol (+5 pts)`).
* **Sound FX Synthesizer:** Zero-latency Web Audio API sound generator for radio beeps, UI clicks, and success chimes.
* **Debrief Report:** End-of-patrol assessment scorecard triggered at Stop 5.
