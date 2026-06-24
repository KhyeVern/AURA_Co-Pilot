# Mercedes_AURA (Prototype)
Mercedes AURA is a Python-based interactive prototype of an AI co-driver that transforms vehicles into proactive companions. Mirroring a 4-tier architecture (Perceive, Understand, Decide, Act), it fuses simulated behavioral, physiological biometrics, and environmental data to trigger real-time safety alerts and cabin comfort adaptations.

## What AURA stands for
* **A — Adaptive:** Learns and adapts to every journey.

* **U — Understanding:** Interprets driver emotions, behavior, and context.

* **R — Responsive:** Responds instantly with meaningful assistance.

* **A — AI:** Powers intelligent and human-centered interactions.

## Benefits
### 🛡️ Enhanced Safety
AURA continuously monitors driver conditions and surroundings to improve road safety.

- Early fatigue detection
- Reduced driver distraction
- Predictive risk awareness
- Improved decision support

### 🎯 Personalized Experience
AURA adapts its assistance based on individual driver needs and driving contexts.

- Adaptive assistance
- Context-aware interactions
- Driver-specific recommendations

### 🤝 Stronger Human-Vehicle Connection
AURA transforms the vehicle into an intelligent companion that understands and evolves with the driver.

- Continuous understanding
- Real-time adaptation
- Intelligent companionship

## Vision
To redefine the relationship between humans and vehicles by creating an AI system that is:
* Proactive rather than reactive
* Adaptive rather than static
* Collaborative rather than assistive
* Human-centered rather than technology-centered

## System Architecture
### 1. Perceive 
Responsible for multi-modal data ingestion. In a production environment, this layer interfaces with hardware APIs. In this prototype, it is split into two components:
* **Behavioral Tracking:** Tracks driver states such as eye-blink rates, Eye Aspect Ratio (EAR) for micro-sleep detection, and mouth geometry for yawning.
* **Telemetry Simulation:** Generates synthetic data streams simulating vehicle dynamics (speed, braking, steering patterns), environmental metrics (weather, road conditions), and physiological telemetry (heart rate, rest duration).

### 2. Understand 
Acts as the state aggregator. This module collects individual data packets from the perception layer and fuses them into a structured, time-stamped JSON payload. This payload establishes a holistic, contextual profile of the driver-vehicle environment at any given second.

### 3. Decide 
The core analytics engine. It evaluates the consolidated driver profile using conditional risk-threshold logic and predictive patterns to calculate real-time threat levels (e.g., Nominal, Stressed, Fatigued, Critical).

### 4. Act 
The execution and dispatch layer. It broadcasts the calculated decisions instantly via a lightweight WebSocket protocol to the frontend interface, triggering real-time cabin and mechanical changes.

---

## Core System Logic (Examples)

The AURA Engine runs on a real-time data-fusion matrix. Instead of looking at individual sensors in isolation, it combines behavioral, physiological, and environmental data to make smart, context-aware decisions:

| Scenario / Driver State | Multi-Modal Inputs (Perceive & Understand) | Vehicle Reaction (Decide & Act) |
| :--- | :--- | :--- |
| **1. Fatigue Detected** *(Micro-sleep / Yawning)* | • **Webcam:** Eye Aspect Ratio drops below threshold for >2 seconds.<br>• **Telemetry:** Vehicle speed is high (>80 km/h). | • **Safety:** Increases collision warning sensitivity.<br>• **Cabin:** Triggers strong driver's seat vibrations and emits a focused audio pulse. |
| **2. High Stress Detected** *(Traffic / Agitation)* | • **Wearable:** Heart rate spikes abruptly above 110 bpm.<br>• **Webcam:** Driver remains attentive (eyes on road, no yawning). | • **Wellness:** Dynamic cabin adaptation shifts ambient lighting to a calming blue.<br>• **Comfort:** Activates seat massaging and plays a relaxed audio playlist. |
| **3. Critical Health Emergency** *(Medical Anomaly)* | • **Wearable:** Sudden heart rate drop / prolonged biometric silence.<br>• **Webcam:** Driver is unresponsive or slumped over for >4 seconds. | • **Emergency:** System takes control, initiates progressive autonomous braking, guides the car safely to the shoulder, and automatically contacts emergency authorities. |

---

## Tech Stack & Dependencies

* **Language:** Python 3.10+
* **Interface & Control Dashboard:** Streamlit (for live telemetry manipulation and visualization)
* **Computer Vision Core:** OpenCV & MediaPipe Face Mesh (for optional camera-based tracking components)
* **Data Pipelines:** Python standard libraries (`json`, `time`, `math`) codebase.

---
