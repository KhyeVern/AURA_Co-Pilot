# Contributing to Mercedes AURA Co-Pilot

Thank you for taking the time to contribute to **Mercedes AURA Co-Pilot**! Contributions from the community help refine our driver readiness tracking algorithms, web dashboard UI, and computer vision models.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Local Development Setup](#local-development-setup)
3. [Project Architecture](#project-architecture)
4. [Development Workflow](#development-workflow)
   - [Git Branching Strategy](#git-branching-strategy)
   - [Commit Guidelines](#commit-guidelines)
5. [Submitting Pull Requests](#submitting-pull-requests)
6. [Reporting Bugs & Feature Requests](#reporting-bugs--feature-requests)

---

## Code of Conduct

This project enforces the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold these standards.

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (for local web server testing)
- **Python**: v3.9 or higher (for OpenCV + MediaPipe tracking backend)
- **Webcam**: Standard USB or built-in camera for face tracking features

### Local Development Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/KhyeVern/AURA_Co-Pilot.git
   cd AURA_Co-Pilot
   ```

2. **Set Up Python Virtual Environment:**
   ```bash
   python -m venv .venv
   # Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   # macOS / Linux
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Run Python CV Tracker Backend:**
   ```bash
   python aura_camera_tracker.py
   ```
   *Press `q` in the OpenCV window to exit.*

4. **Launch Web Dashboard:**
   ```bash
   npx serve . -p 8080
   ```
   Open `http://localhost:8080` in your web browser.

---

## Project Architecture

- **`index.html`**: Driver Readiness Dashboard HTML structure.
- **`style.css`**: Custom dark-mode Mercedes styling tokens, animations, glassmorphism, and emergency overlays.
- **`app.js`**: Core DRI mathematical engine, risk mapping, biometrics sliders, presets, cabin adaptation matrix, emergency overlays.
- **`face_tracker.js`**: Web-based MediaPipe FaceLandmarker tracking script.
- **`aura_camera_tracker.py`**: Python computer vision backend utilizing MediaPipe Face Mesh and OpenCV for live oculomotor tracking (PERCLOS, EAR, MAR, Blink rate, Yawn frequency).

---

## Development Workflow

### Git Branching Strategy

- **`main`**: Production-ready branch. All changes must pass CI checks.
- **Feature Branches**: Name feature branches descriptively, e.g.:
  - `feat/driver-fatigue-sound`
  - `fix/blink-cooldown-timer`
  - `docs/update-architecture`

### Commit Guidelines

Use standard conventional commit prefixes:
- `feat:` New features or algorithms.
- `fix:` Bug fixes.
- `docs:` Documentation improvements.
- `style:` Formatting, UI design tweaks.
- `refactor:` Code restructuring without functional changes.
- `test:` Unit or integration testing.

---

## Submitting Pull Requests

1. Fork the repo and create your feature branch.
2. Ensure Python syntax compiles cleanly: `python -m py_compile aura_camera_tracker.py`.
3. Test web dashboard functionality in Chrome/Edge/Firefox.
4. Open a Pull Request against `main` using our PR template.

---

## Reporting Bugs & Feature Requests

- Use GitHub Issues to submit reports.
- Provide detailed steps to reproduce, environment specifics, and expected outcomes.
