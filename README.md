# Mercedes AURA Co-Pilot

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow.svg)](app.js)
[![OpenCV & MediaPipe](https://img.shields.io/badge/Vision-OpenCV%20%2B%20MediaPipe-green.svg)](aura_camera_tracker.py)
[![Build Status](https://github.com/KhyeVern/AURA_Co-Pilot/actions/workflows/ci.yml/badge.svg)](https://github.com/KhyeVern/AURA_Co-Pilot/actions/workflows/ci.yml)

> **Adaptive Understanding & Responsive AI** — An intelligent driver readiness dashboard that fuses real-time computer vision, biometric telemetry, and environmental data to compute a live **Driver Readiness Index (DRI)** and trigger proactive cabin adaptations.

---

## 🌟 Overview

**AURA Co-Pilot** is a full-stack automotive safety system prototype designed for next-generation intelligent vehicles. By combining high-frequency facial tracking with biometric metrics (heart rate, heart rate variability RMSSD, sleep quality score), AURA continuously evaluates driver fatigue, drowsiness, and cognitive stress to ensure optimal cabin intervention and emergency safety response.

![AURA Logo](AURA%20Logo.png)

---

## 📐 What AURA Stands For

| Letter | Meaning | Core Function |
| :---: | :--- | :--- |
| **A** | **Adaptive** | Dynamically adapts cabin parameters to driver cognitive state |
| **U** | **Understanding** | Interprets facial landmarks, eye closures, and biometric telemetry |
| **R** | **Responsive** | Instantly executes ambient, thermal, and emergency safety interventions |
| **A** | **AI** | Powers real-time oculomotor calculation & Driver Readiness Index (DRI) |

---

## 🏗️ 4-Tier Architecture

```
                                  AURA SYSTEM PIPELINE
 ┌─────────────────┐     ┌─────────────────────┐     ┌────────────────────┐     ┌───────────────────┐
 │   1. PERCEIVE   │ ──> │    2. UNDERSTAND    │ ──> │     3. DECIDE      │ ──> │      4. ACT       │
 └─────────────────┘     └─────────────────────┘     └────────────────────┘     └───────────────────┘
   • Oculomotor CV         • Sensor Aggregation        • Weighted DRI Math        • Cabin Climate
   • Biometrics (HR/HRV)   • Temporal Smoothing        • Risk Classification      • Ambient Lighting
   • Sleep Quality Score   • Context Fusion            • Readiness Bands          • Safety Escalation
   • Weather & Traffic                                 • Emergency Triggers       • Emergency Overlay
```

### 1. 👁️ Perceive (Multi-Modal Data Ingestion)
- **Computer Vision Pipeline (`aura_camera_tracker.py` & `face_tracker.js`):**
  - Live webcam feed via MediaPipe 468-point Face Mesh landmark tracking.
  - Oculomotor tracking: **Eye Aspect Ratio (EAR)**, **PERCLOS** (% eye closure over 1 min), **Blink Frequency** (blinks/min), **Mouth Aspect Ratio (MAR)**, **Yawn Frequency** (per 10 min).
- **Biometric & Environmental Simulation:**
  - Interactive telemetry sliders: Heart Rate (BPM), HRV RMSSD (ms), Sleep Quality (Apple Watch 0–100 score).
  - Environmental controls: Weather visibility, Traffic density.
  - Preset quick-states: *Calm*, *Tired*, *Sleepy*, *Stressed*, *Critical Fatigue*.

### 2. 🧠 Understand (State Aggregation & Context Fusion)
- Aggregates multi-modal telemetry into a time-stamped driver state matrix.
- Applies sliding-window temporal smoothing across PERCLOS and blink metrics to eliminate sensor noise.

### 3. ⚖️ Decide (Driver Readiness Index Engine)
The **Driver Readiness Index (DRI)** maps multi-source risk inputs (\(R_i \in \{0.1, 0.3, 0.5, 0.7, 0.9\}\)) to a total risk score via weighted summation:

$$\text{Total Risk} = \sum (w_i \times R_i)$$
$$\text{DRI Score} = (1 - \text{Total Risk}) \times 100$$

#### Signal Weight Allocation Matrix

| Signal Input | Weight (\(w_i\)) | Low Risk (0.1) | Moderate (0.3) | High Risk (0.7) | Critical Risk (0.9) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **PERCLOS (1-min)** | **25%** | < 10% | 10% – 20% | 20% – 40% | > 40% |
| **HRV RMSSD (ms)** | **20%** | > 42 ms | 30 – 42 ms | 18 – 30 ms | < 18 ms |
| **Heart Rate (BPM)**| **15%** | 60 – 80 BPM | 80 – 95 BPM | 95 – 110 BPM | > 110 BPM |
| **Blink Frequency** | **15%** | 12 – 20 /min | 20 – 28 /min | 28 – 35 /min | > 35 /min |
| **Sleep Quality**   | **10%** | 75 – 100 | 50 – 74 | 25 – 49 | < 25 |
| **Yawn Frequency**  | **5%**  | < 2 /10min | 2 – 4 /10min | 4 – 6 /10min | > 6 /10min |
| **Weather / Visibility**| **5%**| Clear | Overcast | Rain / Fog | Heavy Storm |
| **Traffic Conditions** | **5%**| Light | Moderate | Heavy | Congested |

#### DRI Readiness Bands
| DRI Score | Readiness Band | System State | Recommended Action |
| :---: | :---: | :--- | :--- |
| **81 – 100** | 🟢 **OPTIMAL** | Full Driver Readiness | Standard driving mode |
| **61 – 80**  | 🟩 **ACCEPTABLE**| Mild Fatigue Detected | Gentle ambient adjustment |
| **41 – 60**  | 🟡 **REDUCED** | Moderate Impairment | Activate seat kinetics & cooling |
| **21 – 40**  | 🟠 **IMPAIRED**| High Risk | Haptic alerts & aggressive LKA |
| **0 – 20**   | 🔴 **CRITICAL**| Emergency State | Pre-brake, pull-over assist, SOS |

---

### 4. ⚡ Act (Cabin Adaptations & Safety Escalation)

| Adaptation System | Optimal (81–100) | Poor Sleep (<50) | Stressed | Impaired (21–40) | Critical (0–20) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ambient Music** | User Preference | Upbeat Alert Tone | Calming Acoustics | Alert Pulse Tone | Continuous SOS Siren |
| **Seat Massage** | Off | 💆 Seat Massage On | Massage + Violet Light | Haptic Vibration Pulse | Continuous Alert Pulse |
| **Climate Control** | 22°C Nominal | 22°C Nominal | 20°C Cooling | 20°C Alertness Flow | 18°C Alert Airflow |
| **Collision Warning**| Standard | High Alert (+2s) | Enhanced (+1s) | High Alert (+2s) | MAXIMUM (Pre-Brake) |
| **Lane Keep Assist** | Active | Aggressive Correction| Enhanced Correction | Aggressive Correction | AUTO STEER (Pull Over) |
| **Alert Intensity** | Standard | High (Haptic + Audio)| Medium (Audio Only) | High (Haptic + Audio) | MAX (Full Overlay + SOS) |

---

## 📁 Repository Structure

```
AURA_Co-Pilot/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── workflows/
│   │   └── ci.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── app.js                      # Core DRI algorithm & dashboard UI controller
├── aura_camera_tracker.py       # Python CV backend (OpenCV + MediaPipe Face Mesh)
├── AURA Logo.png               # Project branding asset
├── CODE_OF_CONDUCT.md          # Contributor Covenant v2.1
├── CONTRIBUTING.md             # Guidelines for code & CV contributions
├── face_tracker.js             # In-browser MediaPipe FaceLandmarker engine
├── index.html                  # Driver Readiness Dashboard markup
├── LICENSE                     # MIT License
├── package.json                # Project metadata & serve scripts
├── README.md                   # System documentation & technical reference
├── requirements.txt            # Python dependencies (opencv, mediapipe, numpy)
├── SECURITY.md                 # Vulnerability reporting procedure
└── style.css                   # Mercedes dark-mode design system & overlays
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Web Browser**: Chrome, Edge, or Firefox with webcam permissions.
- **Python**: v3.9+ (optional for backend CV tracking).
- **Node.js**: v18+ (for local web server).

### 1. Web Dashboard Setup
```bash
# Clone the repository
git clone https://github.com/KhyeVern/AURA_Co-Pilot.git
cd AURA_Co-Pilot

# Start local server
npx serve . -p 8080
```
Open `http://localhost:8080` in your web browser.

### 2. Python CV Tracker Setup (Optional Backend)
```bash
# Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch CV tracker HUD
python aura_camera_tracker.py
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/KhyeVern/AURA_Co-Pilot/issues) or review our [CONTRIBUTING.md](CONTRIBUTING.md) guide.
