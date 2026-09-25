# Two Pairs of Eyes — Health & Safety 3D Interactive Simulation

**Module / Project**: CET257 Enterprise Project  
**Repository**: [https://github.com/Rachana-paudel11/two-pairs-of-eyes](https://github.com/Rachana-paudel11/two-pairs-of-eyes)  
**Branch**: `develop` / `main`  
**Technology Stack**: Three.js, JavaScript (ES Modules), HTML5/CSS3, Node.js, Express, IndexedDB, Vite

---

## 1. Project Overview

**Two Pairs of Eyes** is a browser-based, high-fidelity 3D workplace safety training simulation. Built for TechNova Logistics, it trains newly inducted warehouse operatives (playing as *Alex*, mentored by senior supervisor *Dave*) to identify, assess, and address occupational hazards in real-time across five critical warehouse zones.

### Key Capabilities & Features
- **Deterministic 3D Warehouse Environment**: Realistic warehouse hazards rendered with Three.js (receiving dock spill, pedestrian crossing with moving forklift, blocked emergency exit, battery charging station, chemical storage).
- **Behavioral Supervisor AI**: Dynamic mentor responses reflecting realistic workplace workplace dynamics (dismissive, uncertain, and supportive modes).
- **Finite State Machine Architecture**: Rigid progression control (`ENTER_AREA` → `ASSESS` → `CHOOSE_ACTION` → `EVALUATE` → `CONSEQUENCE` → `FEEDBACK` → `SCORE_UPDATE` → `NEXT_STOP` → `SESSION_COMPLETE`).
- **Session Checkpoint Persistence**: Trainees can refresh or reload the browser at any point and resume seamlessly at their exact zone, character position, accumulated score, and timer without being redirected to login.
- **Offline-First Resilience**: Full IndexedDB local persistence fallback when backend REST endpoints are unreachable.
- **Comprehensive Debrief & Analytics**: Detailed performance report, scoring breakdown (Optimal, Partial, Hazard Ignored), time tracking, and deferred incident reviews.
- **Robust Automated Test Suite**: 40 unit and integration tests verifying state transitions, scoring mathematics, schema validation, and persistence.

---

## 2. System Requirements

- **Node.js**: `v18.0.0` or higher (LTS recommended)
- **Package Manager**: `npm` (v9 or higher)
- **Modern Web Browser**: Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari with WebGL enabled.

---

## 3. Quick Start & Installation

### Step 1: Install Dependencies
Open a terminal in the project root directory and run:
```bash
npm install
```

### Step 2: Start the Development Server
Launch the interactive 3D simulation:
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000/
```
*(You can click "Guest Patrol / Instant Demo" to start immediately without configuring a database).*

### Step 3 (Optional): Start the Backend Server
To enable MongoDB trainee synchronization and cloud report storage:
```bash
npm run server
```
*(Runs on `http://localhost:5000/`. If offline, the client automatically switches to secure local IndexedDB storage).*

---

## 4. Running Automated Tests

To run the comprehensive test suite (40 passing tests):
```bash
npm test
```

To create an optimized production build:
```bash
npm run build
```

---

## 5. Project Directory Structure

```text
two-pairs-of-eyes/
├── index.html                   # Simulation viewport and HTML UI overlays
├── package.json                 # Project dependencies and script configurations
├── vite.config.js               # Vite bundler configuration (port 3000)
├── README.md                    # Installation, setup, and architecture documentation
├── public/                      # Static assets, fonts, and icons
├── server/                      # Express.js REST API & authentication
│   ├── config/                  # Database connectivity (MongoDB / Mongoose)
│   ├── models/                  # Trainee and Inspection schemas
│   ├── routes/                  # Auth and inspection report endpoints
│   └── server.js                # Server entry point
├── src/
│   ├── data/                    # Authoring schemas and scenario definitions (stops.json)
│   ├── engine/                  # Core simulation engine
│   │   ├── scenarioEngine.js    # Simulation coordinator & state lifecycle
│   │   ├── stateMachine.js      # Strict state transition matrix
│   │   ├── scoring.js           # Score evaluation & tier accumulation
│   │   ├── consequences.js      # Deferred incident detection
│   │   ├── eventBus.js          # Decoupled publish/subscribe bus
│   │   └── stopsValidator.js    # Ajv JSON-schema verification
│   ├── interactions/            # Decision resolution modules for all 5 zones
│   ├── renderer/                # 3D Graphics Engine (Three.js)
│   │   ├── WarehouseScene.js    # Warehouse layout, racking, lighting, props
│   │   ├── CharacterRenderer.js # Alex and Dave procedural avatars
│   │   ├── CameraRig.js         # Smooth third-person / dynamic inspection camera
│   │   └── StopTransition.js    # Waypoint walking & camera tweening
│   ├── ui/                      # HUD, Debrief, Minimap, Login, Dialogues
│   └── utils/
│       ├── api.js               # REST & IndexedDB synchronization wrapper
│       └── sessionStore.js      # Browser checkpoint persistence on reload
└── tests/                       # Automated test suites (engine, state, schemas, API)
```

---

## 6. Academic & Submission Note
Developed for the **CET257 Enterprise Project**. All client-side code, state machines, 3D procedural scenes, and integration logic are authored according to modern web standards and responsive UX principles.
