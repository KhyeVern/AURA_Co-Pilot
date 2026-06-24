# AURA Co-Pilot

> **Adaptive Understanding & Responsive AI** — An intelligent driver readiness dashboard that fuses real-time computer vision, biometric telemetry, and environmental data to compute a live Driver Readiness Index (DRI) and trigger proactive cabin adaptations.

---

## What AURA Stands For

| Letter | Meaning |
|--------|---------|
| **A** | **Adaptive** — Learns and adapts to every journey |
| **U** | **Understanding** — Interprets driver emotions, behavior, and context |
| **R** | **Responsive** — Responds instantly with meaningful assistance |
| **A** | **AI** — Powers intelligent, human-centered interactions |

---

## System Overview

AURA Co-Pilot is a **full-stack prototype** consisting of:

1. **`index.html` + `style.css`** — Premium dark-mode web dashboard (Driver Readiness Dashboard)
2. **`app.js`** — Core DRI algorithm, risk calculations, emergency system, and UI logic
3. **`face_tracker.js`** — In-browser MediaPipe FaceLandmarker integration (webcam feed + wireframe overlay)
4. **`aura_camera_tracker.py`** — Python computer vision backend (OpenCV + MediaPipe) with a local HTTP server that streams live facial metrics to the dashboard

---

## 4-Tier Architecture

### 1. 👁️ Perceive
Multi-modal data ingestion layer with two sub-components:

- **Behavioural Tracking (Camera)**
  - Live webcam feed via `getUserMedia` + MediaPipe FaceLandmarker (in-browser)
  - Python backend (`aura_camera_tracker.py`) using OpenCV + MediaPipe Face Mesh
  - Measures: **Eye Aspect Ratio (EAR)**, **PERCLOS** (% eye closure over 1 min), **Blink Rate** (blinks/min), **Mouth Aspect Ratio (MAR)**, **Yawn Frequency** (per 10 min)

- **Biometric / Telemetry Simulation**
  - Interactive sliders for: Heart Rate (BPM), HRV (RMSSD in ms), Sleep Duration (hours)
  - Environmental toggles: Weather / Visibility, Traffic Conditions
  - Quick Preset States: Calm, Tired, Sleepy, Stressed, Critical Fatigue

### 2. 🧠 Understand
State aggregation layer that collects all sensor inputs and assembles a structured, time-stamped driver-environment profile fed into the DRI engine.

### 3. ⚖️ Decide
Core analytics engine — the **Driver Readiness Index (DRI)**:

| Input Signal | Weight |
|---|---|
| PERCLOS (eye closure %) | **25%** |
| HRV — RMSSD (ms) | **20%** |
| Heart Rate (BPM) | **15%** |
| Blink Frequency (blinks/min) | **15%** |
| Sleep Duration (hours) | **10%** |
| Yawn Frequency (per 10 min) | **5%** |
| Weather / Visibility | **5%** |
| Traffic Conditions | **5%** |

**DRI Formula:**
```
Total Risk = Σ (weight_i × R_i)       // each R_i ∈ {0.1, 0.3, 0.5, 0.7, 0.9}
DRI Score  = (1 − Total Risk) × 100
```

**DRI Readiness Bands:**
| DRI Range | Status | Meaning |
|---|---|---|
| 81 – 100 | 🟢 **OPTIMAL** | Driver is fully alert |
| 61 – 80 | 🟩 **ACCEPTABLE** | Mild fatigue signals |
| 41 – 60 | 🟡 **REDUCED** | Moderate impairment |
| 21 – 40 | 🟠 **IMPAIRED** | High risk — interventions active |
| 0 – 20 | 🔴 **CRITICAL** | Emergency system triggered |

### 4. ⚡ Act
Execution layer — real-time cabin adaptations dispatched based on DRI state:

| Adaptation | Calm (Optimal) | Stressed | Fatigued/Impaired | Critical |
|---|---|---|---|---|
| **Ambient Music** | Driver Preference | Calm Music Activated | Upbeat Alertness Mode | Alert Tone |
| **Massage & Lighting** | — | Massage + Violet Ambient Light | Gentle Seat Pulse | Fatigue Vibration Alert |
| **Climate Control** | 22°C Nominal | 20°C Cooling | 20°C Alertness Mode | 18°C Alert Mode |
| **Collision Warning** | Standard | Enhanced +1s Early | High Alert +2s Early | MAXIMUM — Pre-Brake Active |
| **Lane Keep Assist** | Active | Enhanced Correction | Aggressive Correction | AUTO STEER — Pull Over Mode |
| **Alert Aggressiveness** | Normal | Medium — Audio Only | High — Haptic + Audio | MAX — Continuous SOS |

---

## Emergency System

When `DRI ≤ 20` or a critical biometric event is detected (HR = 0, HRV = 0, PERCLOS > 95%), the **Critical Event Overlay** is triggered:

- 🚨 Hazard Lights Activated
- 🛑 Emergency Brake Assist Armed
- 📡 SOS Signal Broadcasting
- Acoustic vibraphone chime alert (physical model with A4 + E5 perfect fifth chord)

---

## Computer Vision Pipeline (`aura_camera_tracker.py`)

A unified Python CV pipeline that runs as a local HTTP server at `http://127.0.0.1:5050/metrics`:

| Module | Description |
|---|---|
| **Live Webcam Feed** | OpenCV capture @ 30 fps |
| **Landmark Overlay** | MediaPipe Face Mesh — eye + mouth contour polylines |
| **Oculomotor Metrics** | PERCLOS (1-min rolling), Blink Hz (1-min), Yawn (10-min) |
| **Fusion Math Engine** | Weighted Rᵢ → Total Risk → DRI % |
| **Real-Time HUD** | Semi-transparent cv2.putText overlay on the video window |
| **Safe Mock Fallback** | Animated synthetic face skeleton if no camera is found |

The Python backend supports two MediaPipe APIs:
- **Tasks API (≥ v0.10)** — auto-downloads `face_landmarker.task` model
- **Legacy Solutions API (v0.9.x)** — fallback

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Structure** | HTML5 (Semantic) |
| **Frontend Styling** | Vanilla CSS (dark-mode, glassmorphism, CSS animations) |
| **Frontend Logic** | Vanilla JavaScript (ES6+, Web Audio API) |
| **In-Browser CV** | MediaPipe Tasks Vision (`@mediapipe/tasks-vision@0.10.14`) |
| **Python Backend** | Python 3.10+ |
| **Computer Vision** | OpenCV (`opencv-python`), MediaPipe (`mediapipe`) |
| **Numerical** | NumPy |
| **Fonts** | Google Fonts — Inter + Orbitron |

---

## Getting Started

### Prerequisites

```bash
# Python dependencies
pip install opencv-python mediapipe numpy
```

### Running the Python Camera Tracker

```bash
python aura_camera_tracker.py
```

- Opens an OpenCV window showing the live webcam feed with the AURA HUD overlay
- Starts a local HTTP server at `http://127.0.0.1:5050/metrics`
- Press **`Q`** to quit
- Falls back to an animated mock stream if no webcam is found

### Running the Web Dashboard

Simply open `index.html` in your browser (Chrome / Edge recommended for full WebRTC support).

The dashboard will:
1. Request webcam access for the in-browser face tracker
2. Auto-connect to the Python metrics server at `localhost:5050` (polls every 500 ms)
3. Live camera metrics feed the DRI calculation in real-time

> **Note:** Both the browser webcam feed and the Python OpenCV window can run simultaneously — the browser handles the interactive overlay while Python provides the precision oculomotor metrics.

---

## Scenario Examples

| Driver State | Inputs Detected | AURA Response |
|:---|:---|:---|
| **Fatigue / Micro-sleep** | PERCLOS > 30%, EAR drops repeatedly, Yawn > 5/10min | Collision warning enhanced, Upbeat music, Gentle seat pulse |
| **High Stress / Agitation** | HR > 100 BPM, HRV < 25 ms, Heavy traffic | Calm music + Violet ambient light, Massage seat, Cooling to 20°C |
| **Critical Health Emergency** | HR = 0 or HRV = 0, PERCLOS > 95% | Emergency overlay, Autonomous braking, SOS broadcast, Hazard lights |

---

## Project Structure

```
AURA_Co-Pilot/
├── index.html              # Main web dashboard
├── style.css               # Premium dark-mode UI styles
├── app.js                  # DRI engine, risk logic, UI interactions
├── face_tracker.js         # In-browser MediaPipe face tracking
├── aura_camera_tracker.py  # Python CV backend + HTTP metrics server
└── aura_star_logo.png      # AURA brand asset
```

---

## Benefits

### 🛡️ Enhanced Safety
- Early fatigue & micro-sleep detection
- Reduced driver distraction
- Predictive risk awareness with proactive cabin interventions

### 🎯 Personalized Experience
- Context-aware adaptations (calm vs stressed vs fatigued states)
- Multi-modal sensor fusion — not just one signal but all of them together
- Quick preset states for demo and testing

### 🤝 Stronger Human-Vehicle Connection
- AI that observes, understands, and acts — without the driver lifting a finger
- Escalating response system — gentle nudges before hard interventions

---

## Vision

> To redefine the relationship between humans and vehicles by creating an AI system that is:
> - **Proactive** rather than reactive
> - **Adaptive** rather than static
> - **Collaborative** rather than merely assistive
> - **Human-centered** rather than technology-centered

---

*AURA © 2026 — Intelligent Adaptive Driver Safety System | v2.1.0 | Sensor Fusion Engine*
