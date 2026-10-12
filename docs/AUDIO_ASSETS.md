# Audio Assets & Procedural Synthesis Documentation

**Project**: Two Pairs of Eyes — *Fresh Eyes. Safer Choices.*  
**Module**: CET257 Enterprise Project — TechNova  
**Audio Architecture**: Centralized `AudioManager` (`src/utils/audio.js`)  
**Licensing Status**: 100% Project-Owned / Procedural Web Audio API Code (Zero External Copyright Dependencies)

---

## 1. Overview & Architectural Philosophy

*Two Pairs of Eyes* utilizes a browser-native Web Audio API procedural synthesis engine. Rather than relying on external, heavy `.mp3`/`.wav` media assets that require server downloads, risk 404 network failures, or carry ambiguous third-party licensing encumbrances, all sound cues in the game are synthesized in real time with mathematical precision.

### Key Advantages:
- **Zero Autoplay Errors**: Suspended until first explicit user action (`START PATROL` / Login).
- **Zero Asset Latency**: Guaranteed instant response with zero buffer loading delays.
- **Offline & Zero Budget Resilience**: Operates entirely offline in static deployments.
- **Strictly Non-Intrusive**: Engineered for professional workplace safety training—restrained, authentic acoustics without arcade or game-show noises.

---

## 2. Audio Categories & Volume Hierarchy

Sound levels are categorized and mixed into dedicated GainNode stages:

| Category | Node Target | Default Volume | Priority / Mixing Rule |
|---|---|---|---|
| **MASTER** | Output stage (`ctx.destination`) | `0.85` | Global attenuation and single-point mute control. |
| **AMBIENCE** | Routed to `MASTER` | `0.025` | Low industrial background drone; automatically ducked when Dave speaks. |
| **UI** | Routed to `MASTER` | `0.14` | Subdued acoustic pops and tactile clicks for buttons and choices. |
| **SFX** | Routed to `MASTER` | `0.35` | Clear, physically grounded impact, slip, alert, and hazard audio. |
| **DIALOGUE** | Routed to `MASTER` | `0.85` | Radio dispatch beep and speech prioritization. |

---

## 3. Registered Sound Cues & Licensing Manifest

All sound cues below are generated using custom procedural synthesis functions written specifically for this project:

| Cue Identifier | Category | Synthesis Method / Oscillators | License | In-Game Purpose |
|---|---|---|---|---|
| `start-patrol` | UI | Sine harmonic chords (440Hz, 659.25Hz) with quick exponential envelope | TechNova Project Code / CC0 | Confirmation cue when pressing "START PATROL". |
| `ui-click` / `continue` | UI | Sine oscillator transient (800Hz → 380Hz, 45ms) | TechNova Project Code / CC0 | Soft click when advancing dialog or clicking Continue. |
| `action-select` | UI | Triangle tactile wave (520Hz → 260Hz, 60ms) | TechNova Project Code / CC0 | Auditory confirmation when selecting an action (keys [1]-[3]). |
| `decision-safe` / `success` | SFX | Ascending major arpeggio (C5, E5, G5, C6 sine tones) | TechNova Project Code / CC0 | Feedback for optimal hazard remediation actions. |
| `hazard-report` | SFX | Dual triangle interval (587Hz, 880Hz) | TechNova Project Code / CC0 | Positive confirmation when reporting an issue. |
| `decision-unsafe` / `warning` | SFX | Sawtooth low buzz (180Hz → 140Hz, 220ms) | TechNova Project Code / CC0 | Subtle alert when an unsafe action or ignore choice is taken. |
| `flag-alert` | SFX | Sub bass thud (165Hz → 38Hz) + dual square klaxon (466Hz, 392Hz) | TechNova Project Code / CC0 | Warning indicator when safety flags are logged. |
| `session-complete` | SFX | Triad resolution fanfare (C4, E4, G4, C5) | TechNova Project Code / CC0 | End-of-patrol debrief completion cue. |
| `radio-beep` | DIALOGUE | Triangle burst (1200Hz → 900Hz, 80ms) | TechNova Project Code / CC0 | Two-way walkie-talkie dispatch tone for Dave's communication. |
| `forklift-warning` | SFX | Pulsing square wave (740Hz bandpass filter, 420ms loop interval) | TechNova Project Code / CC0 | Reverse/motion safety alarm as forklift approaches the blind junction. |
| `forklift-impact` | SFX | Sub thud (140Hz → 32Hz) + triangle clatter (280Hz) + noise scrape | TechNova Project Code / CC0 | Synchronized physical collision impact at bumper contact. |
| `slip` | SFX | Sawtooth sweep (420Hz → 860Hz → 320Hz, bandpass filtered) | TechNova Project Code / CC0 | Rubber footwear skid on chemical fluid puddle. |
| `fall` | SFX | Sub-bass sine drop (110Hz → 28Hz, 380ms) | TechNova Project Code / CC0 | Human body contact with concrete warehouse flooring. |
| `carton-fall` | SFX | Low triangle pitch modulation (95Hz → 45Hz, 480ms) | TechNova Project Code / CC0 | Racking creak & load destabilization. |
| `carton-impact` | SFX | Dual sine thud (160Hz → 42Hz, 350ms) | TechNova Project Code / CC0 | Cardboard packaging striking ground. |
| `electric-arc` | SFX | Sawtooth transient snap (880Hz → 120Hz, 180ms) | TechNova Project Code / CC0 | Battery charger electrical short / arc flash. |
| `trip` | SFX | Friction slip skid transient | TechNova Project Code / CC0 | Foot catching obstacle. |
| `accident-alert` | SFX | Facility alert sirens (680Hz / 480Hz modulated sequence) | TechNova Project Code / CC0 | Facility evacuation / emergency siren upon accident escalation. |
| `ambience` | AMBIENCE | Procedural continuous pink noise buffer + 110Hz lowpass filter | TechNova Project Code / CC0 | Continuous industrial ventilation and low warehouse room drone. |

---

## 4. Audio Lifecycle Integration

1. **Unlock Flow**: `initAudioOnUserGesture()` resumes the audio context upon explicit user click on "START PATROL".
2. **Ambience Flow**: Pink noise room tone starts on patrol launch; stops on debrief or restart.
3. **Dialogue Ducking**: Ambient volume drops smoothly by 65% when Dave delivers dialogue and restores upon dismissal.
4. **Collision Synchronization**: Visual animations call `playSfx` at the precise frame of physical contact (e.g. `hitT >= 0.8` for slip fall, forklift bumper contact).
5. **Session Reset**: `resetAudio()` cancels active forklift intervals and stops ambience loops cleanly.
