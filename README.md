# Two Pairs of Eyes — Health & Safety 3D Interactive Simulation

> **Module / Project**: CET257 Enterprise Project  
> **Repository**: [https://github.com/Rachana-paudel11/two-pairs-of-eyes](https://github.com/Rachana-paudel11/two-pairs-of-eyes)  
> **Team**: TechNova  
> **Technology Stack**: Three.js, JavaScript (ES Modules), HTML5/CSS3, Node.js, Express, MongoDB, IndexedDB, Vite

---

## 1. Project Overview

**Two Pairs of Eyes** is a browser-based, high-fidelity 3D workplace safety training simulation. Built for TechNova Logistics, it trains newly inducted warehouse operatives (playing as *Alex*, mentored by senior supervisor *Dave*) to identify, assess, and address occupational hazards in real-time across five critical warehouse zones.

### Key Capabilities & Features
- **Deterministic 3D Warehouse Environment**: Realistic warehouse hazards rendered with Three.js (receiving dock spill, pedestrian crossing with moving forklift, damaged high-bay racking, battery charging station fault, clear emergency hub).
- **Behavioral Supervisor AI**: Dynamic mentor responses reflecting realistic workplace dynamics (dismissive, uncertain, and supportive modes).
- **Finite State Machine Architecture**: Rigid progression control (`ENTER_AREA` → `ASSESS` → `ACTION_SELECTED` → `EVALUATE` → `CONSEQUENCE` → `FEEDBACK` → `SCORE_UPDATE` → `NEXT_STOP` → `SESSION_COMPLETE`).
- **Session Checkpoint Persistence**: Trainees can refresh or reload the browser at any point and resume seamlessly at their exact zone, character position, accumulated score, and timer.
- **Offline-First Resilience**: Full IndexedDB local persistence fallback when backend REST endpoints are unreachable.
- **Comprehensive Debrief & Analytics**: Detailed performance report, scoring breakdown (Optimal, Partial, Hazard Ignored), time tracking, and deferred incident reviews.
- **Robust Automated Test Suite**: 50 unit and integration tests verifying state transitions, scoring mathematics, schema validation, persistence, and administrative controls.

---

## 2. System Administrator Module

### Purpose
Allows authorised administrators to maintain, validate, and publish the training scenario content used by the Two Pairs of Eyes simulation without destabilising existing trainee sessions or 3D world anchors.

### Functions
- **Authenticate**: Secure server-side credential verification with bcrypt password hashing and token-based session management.
- **View Scenarios**: Inspect all authored safety stops, supervisor modes, dialogue lines, hazard severities, and action choices.
- **View One Scenario**: Deep-dive inspection of an individual stop and its scoring outcomes.
- **Create Scenario**: Add new schema-compliant safety inspection stops.
- **Edit Scenario**: Update existing stop metadata, supervisor behaviour, dialogue, coordinates, and decision trees.
- **Validate Scenario**: Real-time AJV schema and cross-referential validation against simulation rules.
- **Delete Scenario**: Safe deletion requiring confirmation and referential integrity verification.
- **Save/Publish Scenario**: Synchronize and broadcast validated scenario updates directly to the simulation engine.
- **Logout**: Invalidate administrator sessions.

### Architecture Flow

```text
System Admin
      ↓
Admin UI (SPA /admin/login, /admin/dashboard, /admin/scenarios, /admin/scenarios/:id)
      ↓
Protected Admin API (/api/admin/* with Bearer Auth)
      ↓
Scenario Service & Repository (ScenarioService / ScenarioRepository)
      ↓
Schema Validation (AJV stops.schema.json & Referential Cross-Checks)
      ↓
Scenario Data (MongoDB Persistence & In-Memory Resilient Sync)
      ↓
Scenario Engine (Headless State Machine, EventBus & Scoring)
```

### Administrator Security & Authentication
- **Protected Routes**: All administrative endpoints under `/api/admin/*` require a valid bearer session token. Requests lacking credentials or presenting expired tokens are rejected with HTTP 401 Unauthorized.
- **Server-Side Password Hashing**: Administrator credentials use `bcryptjs` with salt rounds (10), ensuring no plaintext passwords are stored or transmitted.
- **Token Invalidation on Logout**: Session tokens are cryptographically signed with HMAC and tracked in the active session store; logouts immediately revoke the token.
- **Secret Isolation**: Configuration and secrets are loaded from `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `MONGODB_URI`). `.env` is ignored by Git and never committed to source control.
- **Default Prototype Credentials**: On first run with an empty database, a default administrator account (`admin` / `adminPassword123!`) is automatically initialized.

### Scenario Management & Referential Integrity
1. **Unified Schema**: Both the simulation and the administrative module share the identical stop data structure (`src/data/stops.schema.json`).
2. **AJV Validation**: Additions and edits are compiled and validated with AJV before persistence.
3. **Delete Safety & Referential Integrity**:
   - Single-click deletion is prevented with an explicit confirmation dialog.
   - Deletion safely checks if any `endOfSessionRules` depend on failure flags provided by that stop (e.g. `escalated_incident` depends on `ignored_ground_hazard`). Deletions causing referential violations are safely rejected.

---

## 3. Administrative Routes & API Endpoints

### Frontend Routes
| Route | View / Function |
|---|---|
| `/admin/login` | Administrator authentication portal |
| `/admin/dashboard` | Main admin console: quick stats, scenario overview, publish trigger |
| `/admin/scenarios` | Full tabular scenario list with edit & delete actions |
| `/admin/scenarios/:id` | Detailed scenario editor with live AJV validation preview |
| `/admin/scenarios/new` | Authoring interface for new safety stops |

### Backend API Endpoints
- `POST /api/admin/login` — Authenticate admin and receive session token.
- `POST /api/admin/logout` — Invalidate admin session token.
- `GET /api/admin/me` — Retrieve active admin session profile (Protected).
- `GET /api/admin/scenarios` — Retrieve all authored scenarios and rules (Protected).
- `GET /api/admin/scenarios/:id` — Retrieve a single scenario by ID (Protected).
- `POST /api/admin/scenarios` — Create a new scenario stop (Protected).
- `PUT /api/admin/scenarios/:id` — Update an existing scenario stop (Protected).
- `DELETE /api/admin/scenarios/:id` — Delete scenario with referential safety checks (Protected).
- `POST /api/admin/scenarios/validate` — Validate scenario stop against AJV schema (Protected).
- `POST /api/admin/scenarios/publish` — Save and publish active scenarios to the simulation (Protected).
- `GET /api/scenarios` — Fetch published scenario dataset for simulation bootstrap.

---

## 4. System Requirements

- **Node.js**: `v18.0.0` or higher (LTS recommended)
- **Package Manager**: `npm` (v9 or higher)
- **Modern Web Browser**: Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari with WebGL enabled.
- **MongoDB**: `mongodb://127.0.0.1:27017/two_pairs_of_eyes` (optional; system falls back to resilient offline storage).

---

## 5. Quick Start & Installation

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Development Server
```bash
npm run dev
```
Open browser at `http://localhost:3000/`.

### Step 3 (Optional): Start Backend Server
```bash
npm run server
```
Runs on `http://localhost:5000/`.

---

## 6. Running Automated Tests

Run the full automated test suite (50 passing tests):
```bash
npm test
```

Create production build:
```bash
npm run build
```

---

## 7. Academic & Submission Note
Developed for the **CET257 Enterprise Project**. All client-side code, state machines, 3D procedural scenes, administrative CRUD features, and integration logic are authored according to modern web standards and responsive UX principles.
