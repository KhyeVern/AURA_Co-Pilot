"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         Mercedes AURA — Adaptive Understanding & Responsive AI              ║
║         AuraCameraTracker  |  aura_camera_tracker.py  |  v3.0               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Unified CV Pipeline — run: python aura_camera_tracker.py  (q = quit)       ║
║                                                                              ║
║  Modules:                                                                    ║
║    1. Live Webcam Feed    — OpenCV capture @ 30 fps                          ║
║    2. Landmark Overlay    — MediaPipe Face Mesh eye+mouth contours           ║
║    3. Oculomotor Metrics  — PERCLOS (1-min), Blink Hz (1-min), Yawn (10-min) ║
║    4. Fusion Math Engine  — Weighted Rᵢ → Total Risk → DRI %                ║
║    5. Real-Time HUD       — Semi-transparent cv2.putText overlay             ║
║    6. Safe Mock Fallback  — Animated synthetic frame if no camera found      ║
║                                                                              ║
║  Framework Reference: framework_mbtmy.md / image_52f7ad.png                 ║
║  Dependencies: pip install opencv-python mediapipe numpy                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

# ─────────────────────────────────────────────────────────────────────────────
#  STANDARD LIBRARY IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import sys
import io
import math
import time
import random
import os
from collections import deque
from typing import Dict, List, Optional, Tuple

# Force UTF-8 on Windows consoles (cp1252 default cannot encode ✓ ✗ ║ etc.)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────────────────────────────────────
#  OPTIONAL CV IMPORTS — graceful degradation to math-only mode if absent
# ─────────────────────────────────────────────────────────────────────────────
_CV_AVAILABLE = False
try:
    import cv2
    import numpy as np
    import mediapipe as mp
    _CV_AVAILABLE = True
    print("[AURA] ✓ OpenCV + MediaPipe loaded.")
except ImportError as _e:
    print(f"[AURA] ⚡ CV libraries not found ({_e}). Math-only mock mode active.")


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION A — CONSTANTS, LANDMARK INDICES & FRAMEWORK WEIGHTS
# ═════════════════════════════════════════════════════════════════════════════

# ── MediaPipe 468-point Face Mesh landmark indices ────────────────────────────
#  EAR uses 6 points per eye (Soukupová & Čech, CVWW 2016):
#    [0] outer corner   [1] upper-outer  [2] upper-inner
#    [3] inner corner   [4] lower-inner  [5] lower-outer
LEFT_EYE_IDX   = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_IDX  = [33,  160, 158, 133, 153, 144]

#  Closed outline polylines — used to draw contours on the video frame
LEFT_EYE_OUTLINE  = [362, 382, 381, 380, 374, 373, 390, 249,
                      263, 466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_OUTLINE = [33,  7,   163, 144, 145, 153, 154, 155,
                      133, 173, 157, 158, 159, 160, 161, 246]

#  Mouth outer-lip outline (closed polyline)
MOUTH_OUTLINE = [61,  185, 40,  39,  37,  0,   267, 269,
                  270, 409, 291, 375, 321, 405, 314, 17,
                  84,  181, 91,  146]

#  MAR anchor points
MOUTH_TOP    = 13     # upper lip centre
MOUTH_BOTTOM = 14     # lower lip centre
MOUTH_LEFT   = 78     # left corner
MOUTH_RIGHT  = 308    # right corner

# ── Detection thresholds ──────────────────────────────────────────────────────
EAR_CLOSED_THRESHOLD = 0.22   # EAR below this → ≥80% pupil coverage (PERCLOS)
MAR_YAWN_THRESHOLD   = 0.55   # MAR above this → yawn onset detected
MIN_BLINK_FRAMES     = 2      # min consecutive closed frames for a valid blink
YAWN_COOLDOWN_S      = 3.0    # suppression window between yawn registrations
BLINK_IRREG_COV      = 0.60   # inter-blink CoV threshold → "Irregular" flag

# ── Rolling window durations ──────────────────────────────────────────────────
PERCLOS_WINDOW_S = 60.0    # 1-minute PERCLOS window
BLINK_WINDOW_S   = 60.0    # 1-minute blink frequency window
YAWN_WINDOW_S    = 600.0   # 10-minute yawn frequency window

# ── Framework sensor fusion weights (framework_mbtmy.md) ─────────────────────
#  Vision metrics: PERCLOS 25%, Blink 15%, Yawn 5%  = 45%
#  Non-vision:     HRV 20%, BPM 15%, Sleep 10%, Visibility 5%, Traffic 5% = 55%
#  Total = 100%
WEIGHTS: Dict[str, float] = {
    "perclos":    0.25,
    "blink":      0.15,
    "yawn":       0.05,
    "hrv":        0.20,
    "bpm":        0.15,
    "sleep":      0.10,
    "visibility": 0.05,
    "traffic":    0.05,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Fusion weights must sum to 1.0"

# ── DRI readiness status bands (threshold_inclusive, label, BGR_color) ────────
_DRI_BANDS: List[Tuple[float, str, Tuple]] = [
    (81, "OPTIMAL",      (50,  210,  60)),   # bright green
    (61, "SATISFACTORY", (50,  200, 160)),   # teal-green
    (41, "REDUCED",      (30,  165, 255)),   # amber-orange
    (21, "IMPAIRED",     (20,  100, 255)),   # deep orange
    (0,  "CRITICAL",     (0,    45, 220)),   # red
]

# ── HUD colour palette (BGR) ──────────────────────────────────────────────────
_C_TITLE   = (215, 215, 255)    # lavender white — panel title
_C_SECTION = (120, 200, 130)    # soft green — section headers
_C_LABEL   = (165, 165, 185)    # cool grey — metric labels
_C_VALUE   = (255, 255, 255)    # white — metric values
_C_SEP     = (50,  50,  72)     # dark navy — separator lines
_C_BG      = (12,  14,  20)     # near-black — panel background
_C_EYE     = (50,  225,  80)    # bright green — eye contour overlay
_C_MOUTH   = (200, 100, 200)    # magenta — mouth contour overlay
_C_DOT     = (0,   255, 180)    # cyan-green — key landmark dots


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION B — GEOMETRY HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _dist(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """2-D Euclidean distance between two pixel-coordinate tuples."""
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def _compute_ear(lm, eye_idx: List[int], w: int, h: int) -> float:
    """
    Eye Aspect Ratio (EAR).  Formula: Soukupová & Čech, CVWW 2016.
        EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    Returns ~0.28–0.35 when open; <0.22 when closed.
    """
    pts = [(int(lm[i].x * w), int(lm[i].y * h)) for i in eye_idx]
    A = _dist(pts[1], pts[5])
    B = _dist(pts[2], pts[4])
    C = _dist(pts[0], pts[3])
    return (A + B) / (2.0 * C) if C > 1.0 else 0.30


def _compute_mar(lm, w: int, h: int) -> float:
    """
    Mouth Aspect Ratio (MAR) for yawn detection.
        MAR = ||top - bottom|| / ||left - right||
    Returns >0.55 when yawning.
    """
    def _px(idx): return (int(lm[idx].x * w), int(lm[idx].y * h))
    vert  = _dist(_px(MOUTH_TOP), _px(MOUTH_BOTTOM))
    horiz = _dist(_px(MOUTH_LEFT), _px(MOUTH_RIGHT))
    return vert / horiz if horiz > 1.0 else 0.0


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION C — MOCK VIDEO STREAM GENERATOR
#  Produces time-varying EAR/MAR signals AND an animated synthetic frame
#  so the entire pipeline — including the HUD window — works without a camera.
# ═════════════════════════════════════════════════════════════════════════════

class _MockStream:
    """
    Sinusoidal fatigue envelope + scheduled blink/yawn impulses.

    The face skeleton drawn on the mock frame is animated:
      · Eye ellipse height shrinks/grows with EAR (simulating blink)
      · Mouth ellipse height grows with MAR (simulating yawn)
    This gives a visually rich demo even with no hardware.
    """

    def __init__(self, frame_w: int = 640, frame_h: int = 480):
        self._w = frame_w
        self._h = frame_h
        self._t0           = time.time()
        self._next_blink   = time.time() + random.uniform(3.5, 6.0)
        self._next_yawn    = time.time() + random.uniform(55.0, 110.0)
        self._blink_on     = False;  self._blink_end  = 0.0
        self._yawn_on      = False;  self._yawn_start = 0.0;  self._yawn_end = 0.0
        print("[AURA] ✓ Mock Video Stream Generator initialised (no webcam detected).")

    def read(self) -> Tuple[Optional["np.ndarray"], float, float]:
        """
        Returns (frame_bgr | None, ear, mar).
        frame_bgr is None if numpy/cv2 are unavailable.
        """
        now = time.time()
        elapsed = now - self._t0

        # ── Fatigue envelope: EAR baseline drifts 0.32→0.24 over a 5-min cycle ─
        fatigue  = math.sin((elapsed / 300.0) * math.pi)
        base_ear = 0.32 - 0.08 * fatigue
        ear      = base_ear + random.gauss(0, 0.008)

        # ── Blink impulse ─────────────────────────────────────────────────────
        if now >= self._next_blink and not self._blink_on:
            self._blink_on  = True
            self._blink_end = now + random.uniform(0.12, 0.22)
            self._next_blink = now + random.uniform(3.5, 6.5)
        if self._blink_on:
            ear = random.uniform(0.10, 0.19) if now < self._blink_end else base_ear
            if now >= self._blink_end:
                self._blink_on = False

        # ── Yawn impulse ──────────────────────────────────────────────────────
        mar = random.uniform(0.06, 0.16)
        if now >= self._next_yawn and not self._yawn_on:
            self._yawn_on    = True
            self._yawn_start = now
            self._yawn_end   = now + random.uniform(2.5, 4.0)
            self._next_yawn  = now + random.uniform(70.0, 130.0)
        if self._yawn_on:
            if now < self._yawn_end:
                dur  = self._yawn_end - self._yawn_start
                prog = (now - self._yawn_start) / dur if dur > 0 else 0
                peak = math.sin(prog * math.pi)
                mar  = MAR_YAWN_THRESHOLD + 0.04 + peak * 0.20 + abs(random.gauss(0, 0.03))
            else:
                self._yawn_on = False

        ear = round(max(0.05, min(0.50, ear)), 4)
        mar = round(max(0.00, min(1.00, mar)), 4)

        frame = self._build_frame(now, ear, mar) if _CV_AVAILABLE else None
        return frame, ear, mar

    def _build_frame(self, now: float, ear: float, mar: float) -> "np.ndarray":
        """Render an animated face-skeleton onto a dark canvas."""
        frame = np.full((self._h, self._w, 3), _C_BG, dtype=np.uint8)
        cx, cy = self._w // 2, self._h // 2

        # Subtle scan-line
        sy = int((now * 55) % self._h)
        cv2.line(frame, (0, sy), (self._w, sy), (0, 40, 30), 1)

        # Face oval
        cv2.ellipse(frame, (cx, cy - 10), (110, 140), 0, 0, 360,
                    (35, 55, 35), 1, cv2.LINE_AA)

        # Animated eyes — height proportional to EAR
        eye_h = max(2, int((ear - 0.09) / 0.26 * 16))
        for ex, ey in [(cx - 46, cy - 38), (cx + 46, cy - 38)]:
            cv2.ellipse(frame, (ex, ey), (22, eye_h), 0, 0, 360,
                        _C_EYE, 1, cv2.LINE_AA)
            cv2.circle(frame, (ex, ey), 3, _C_DOT, -1, cv2.LINE_AA)
            for dx, dy in [(-22, 0), (22, 0), (0, -eye_h), (0, eye_h)]:
                cv2.circle(frame, (ex + dx, ey + dy), 2, _C_DOT, -1)

        # Nose bridge
        cv2.line(frame, (cx, cy - 15), (cx, cy + 22), (30, 50, 30), 1, cv2.LINE_AA)
        cv2.circle(frame, (cx, cy + 22), 3, (30, 55, 30), -1)

        # Animated mouth — height proportional to MAR
        mouth_h = max(3, int(mar * 48))
        cv2.ellipse(frame, (cx, cy + 58), (30, mouth_h), 0, 0, 360,
                    _C_MOUTH, 1, cv2.LINE_AA)
        cv2.circle(frame, (cx - 30, cy + 58), 2, _C_DOT, -1)
        cv2.circle(frame, (cx + 30, cy + 58), 2, _C_DOT, -1)

        # Watermark
        cv2.putText(frame, "NO CAMERA  -  MOCK MODE", (cx - 112, self._h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (60, 60, 85), 1, cv2.LINE_AA)
        return frame


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION D — MEDIAPIPE FACE DETECTOR LOADER
#  Tries Tasks API (≥0.10) then falls back to legacy solutions API (0.9.x).
# ═════════════════════════════════════════════════════════════════════════════

def _load_face_detector():
    """
    Returns (detector, api_type) where api_type ∈ {"tasks", "solutions", None}.
    """
    if not _CV_AVAILABLE:
        return None, None

    # ── Attempt 1: Tasks API ──────────────────────────────────────────────────
    try:
        import urllib.request
        from mediapipe.tasks import python as _mpp
        from mediapipe.tasks.python import vision as _mpv

        MODEL = "face_landmarker.task"
        URL   = ("https://storage.googleapis.com/mediapipe-models/"
                 "face_landmarker/face_landmarker/float16/1/face_landmarker.task")
        if not os.path.exists(MODEL):
            print("[AURA] Downloading face_landmarker.task (~3 MB)…")
            urllib.request.urlretrieve(URL, MODEL)

        opts = _mpv.FaceLandmarkerOptions(
            base_options=_mpp.BaseOptions(model_asset_path=MODEL),
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        det = _mpv.FaceLandmarker.create_from_options(opts)
        print("[AURA] ✓ MediaPipe Tasks API (v0.10+) loaded.")
        return det, "tasks"
    except Exception:
        pass

    # ── Attempt 2: Legacy solutions API ──────────────────────────────────────
    try:
        fm  = mp.solutions.face_mesh
        det = fm.FaceMesh(max_num_faces=1, refine_landmarks=False,
                          min_detection_confidence=0.5, min_tracking_confidence=0.5)
        print("[AURA] ✓ MediaPipe solutions API (legacy) loaded.")
        return det, "solutions"
    except Exception:
        pass

    print("[AURA] ⚡ MediaPipe detector unavailable.")
    return None, None


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION E — ROLLING BUFFER
# ═════════════════════════════════════════════════════════════════════════════

class _RollingBuffer:
    """
    Time-indexed deque with automatic eviction of entries older than
    ``window_s`` seconds.  O(1) amortised append + prune.
    """

    def __init__(self, window_s: float):
        self._ws  = window_s
        self._buf: deque = deque()

    def append(self, value, ts: Optional[float] = None) -> None:
        self._buf.append((ts or time.time(), value))

    def prune(self, now: Optional[float] = None) -> None:
        cutoff = (now or time.time()) - self._ws
        while self._buf and self._buf[0][0] < cutoff:
            self._buf.popleft()

    def values(self) -> List:
        return [v for _, v in self._buf]

    def timestamps(self) -> List[float]:
        return [t for t, _ in self._buf]

    def __len__(self) -> int:
        return len(self._buf)


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION F — BLINK STATE MACHINE
# ═════════════════════════════════════════════════════════════════════════════

class _BlinkFSM:
    """
    Two-state FSM: OPEN ↔ CLOSED.
    Requires ≥ MIN_BLINK_FRAMES consecutive below-threshold frames before
    a CLOSED→OPEN transition is counted as a confirmed blink event.
    This suppresses single-frame tracking noise.
    """

    def __init__(self):
        self._closed = False
        self._frames = 0

    def update(self, ear: float, now: Optional[float] = None) -> bool:
        """
        Returns True exactly once when a valid blink completes (CLOSED→OPEN).
        """
        if ear < EAR_CLOSED_THRESHOLD:
            if not self._closed:
                self._closed = True
                self._frames = 1
            else:
                self._frames += 1
            return False
        else:
            completed = self._closed and self._frames >= MIN_BLINK_FRAMES
            self._closed = False
            self._frames = 0
            return completed

    @property
    def is_closed(self) -> bool:
        return self._closed


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION G — PIECEWISE RISK MAPPING FUNCTIONS
#  Each returns Rᵢ ∈ {0.1, 0.3, 0.5, 0.7, 0.9}  (framework_mbtmy.md)
# ═════════════════════════════════════════════════════════════════════════════

def _map_perclos(pct: float) -> float:
    """
    PERCLOS % → R_PERCLOS
    <10 → 0.1 | 10-20 → 0.3 | 20-30 → 0.5 | 30-40 → 0.7 | ≥40 → 0.9
    """
    if pct <  10: return 0.1
    if pct <  20: return 0.3
    if pct <  30: return 0.5
    if pct <  40: return 0.7
    return 0.9


def _map_blink(freq: float, is_irreg: bool) -> float:
    """
    Blinks/min + irregularity flag → R_Blink
    10-20 → 0.1 | 21-25 → 0.3 | 26-35 → 0.5 | >35 → 0.7 | <3/Irregular → 0.9
    """
    if freq < 3.0 or is_irreg: return 0.9
    if freq <= 20:              return 0.1
    if freq <= 25:              return 0.3
    if freq <= 35:              return 0.5
    return 0.7


def _map_yawn(count: float) -> float:
    """
    Yawns/10 min → R_Yawn
    0 → 0.1 | 1-2 → 0.3 | 3-4 → 0.5 | 5-6 → 0.7 | ≥7 → 0.9
    """
    if count == 0: return 0.1
    if count <= 2: return 0.3
    if count <= 4: return 0.5
    if count <= 6: return 0.7
    return 0.9


def _get_dri_status(dri_pct: float) -> Tuple[str, Tuple]:
    """Return (status_label, BGR_color) for the given DRI percentage."""
    for threshold, label, color in _DRI_BANDS:
        if dri_pct >= threshold:
            return label, color
    return "CRITICAL", (0, 45, 220)


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION H — MULTI-SENSOR FUSION MATH ENGINE  (framework_mbtmy.md)
#
#  Total Risk = Σ wᵢ · Rᵢ   (all weights sum to 1.0)
#  DRI %      = (1 − Total Risk) × 100
# ═════════════════════════════════════════════════════════════════════════════

def _compute_fusion(
    r_perclos:    float,
    r_blink:      float,
    r_yawn:       float,
    r_hrv:        float = 0.1,
    r_bpm:        float = 0.1,
    r_sleep:      float = 0.1,
    r_visibility: float = 0.1,
    r_traffic:    float = 0.1,
) -> Tuple[float, float]:
    """
    Compute weighted fusion Total Risk and Driver Readiness Index.

    Vision metrics (45% of model):
        PERCLOS (25%), Blink Frequency (15%), Yawn Frequency (5%)

    Non-vision fallbacks (55% of model, default baseline Rᵢ = 0.1):
        HRV (20%), BPM (15%), Sleep Duration (10%),
        Visibility (5%), Traffic Density (5%)

    Returns:
        (total_risk: float [0,1], dri_pct: float [0,100])
    """
    total = (
        WEIGHTS["perclos"]    * r_perclos  +
        WEIGHTS["blink"]      * r_blink    +
        WEIGHTS["yawn"]       * r_yawn     +
        WEIGHTS["hrv"]        * r_hrv      +
        WEIGHTS["bpm"]        * r_bpm      +
        WEIGHTS["sleep"]      * r_sleep    +
        WEIGHTS["visibility"] * r_visibility +
        WEIGHTS["traffic"]    * r_traffic
    )
    total   = round(min(1.0, max(0.0, total)), 4)
    dri_pct = round((1.0 - total) * 100.0, 2)
    return total, dri_pct


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION I — REAL-TIME HUD RENDERER
#  Draws a semi-transparent panel with cv2.putText directly onto the frame.
# ═════════════════════════════════════════════════════════════════════════════

def _draw_hud(frame: "np.ndarray", data: Dict, mode: str,
              fps: float, face_detected: bool) -> None:
    """
    Render the AURA metrics HUD onto the frame in-place.

    Panel layout (left side, ~215px wide):
        ┌─────────────────────┐
        │  AURA DRIVER MONITOR │
        ├─────────────────────┤
        │ Sensor Feed          │
        │  EAR  · MAR          │
        ├─────────────────────┤
        │ Oculomotor Metrics   │
        │  PERCLOS · Blinks    │
        │  Yawns               │
        ├─────────────────────┤
        │ Risk Coefficients Rᵢ │
        │  R_Perclos · R_Blink │
        │  R_Yawn              │
        ├─────────────────────┤
        │ Fusion Output        │
        │  Total Risk · DRI %  │
        └─────────────────────┘
        ┌─────────────────────┐
        │   STATUS BADGE       │  ← colour-coded DRI readiness
        └─────────────────────┘
    """
    FONT   = cv2.FONT_HERSHEY_SIMPLEX
    PX     = 5      # panel x origin
    PY     = 5      # panel y origin
    PW     = 218    # panel width
    PH     = 295    # panel height
    PAD    = 9      # inner left padding

    # ── Semi-transparent panel background ────────────────────────────────────
    overlay = frame.copy()
    cv2.rectangle(overlay, (PX, PY), (PX + PW, PY + PH), _C_BG, -1)
    cv2.rectangle(overlay, (PX, PY), (PX + PW, PY + PH), (40, 40, 62), 1)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

    # ── Helper closures ───────────────────────────────────────────────────────
    x0 = PX + PAD

    def put(text: str, rel_y: int, scale: float, color: Tuple, bold: bool = False):
        cv2.putText(frame, text, (x0, PY + rel_y), FONT, scale, color,
                    2 if bold else 1, cv2.LINE_AA)

    def sep(rel_y: int):
        cv2.line(frame, (PX + 4, PY + rel_y), (PX + PW - 4, PY + rel_y),
                 _C_SEP, 1, cv2.LINE_AA)

    def row(label: str, value: str, rel_y: int, val_color: Tuple = _C_VALUE):
        cv2.putText(frame, label, (x0, PY + rel_y), FONT, 0.40, _C_LABEL,
                    1, cv2.LINE_AA)
        tw = cv2.getTextSize(value, FONT, 0.40, 1)[0][0]
        cv2.putText(frame, value, (PX + PW - PAD - tw, PY + rel_y),
                    FONT, 0.40, val_color, 1, cv2.LINE_AA)

    # ── Title ─────────────────────────────────────────────────────────────────
    put("AURA DRIVER MONITOR", 20, 0.44, _C_TITLE, bold=True)
    sep(28)

    # ── Sensor feed ───────────────────────────────────────────────────────────
    put("Sensor Feed", 44, 0.38, _C_SECTION)
    row("EAR (Eye Ratio)",    f"{data['ear']:.3f}", 61)
    row("MAR (Mouth Ratio)",  f"{data['mar']:.3f}", 78)
    sep(86)

    # ── Oculomotor metrics ────────────────────────────────────────────────────
    put("Oculomotor Metrics", 102, 0.38, _C_SECTION)
    row("PERCLOS",   f"{data['perclos_pct']:.1f}%",  119)
    row("Blink Rate", f"{data['blink_freq']:.1f}/min", 136)
    row("Yawn Count", f"{data['yawn_freq']:.0f}/10m",  153)
    sep(161)

    # ── Risk coefficients ─────────────────────────────────────────────────────
    put("Risk Coefficients (Ri)", 177, 0.38, _C_SECTION)
    row("R_PERCLOS", f"{data['r_perclos']:.2f}", 194)
    row("R_Blink",   f"{data['r_blink']:.2f}",   211)
    row("R_Yawn",    f"{data['r_yawn']:.2f}",    228)
    sep(236)

    # ── Fusion output ─────────────────────────────────────────────────────────
    dri_color = data["dri_color"]
    put("Fusion Output", 252, 0.38, _C_SECTION)
    row("Total Risk", f"{data['total_risk']:.4f}", 269)
    row("DRI",        f"{data['dri_pct']:.1f}%",   286, val_color=dri_color)

    # ── Status badge (below main panel) ──────────────────────────────────────
    BDY = PY + PH + 5
    BDH = 32
    badge_overlay = frame.copy()
    cv2.rectangle(badge_overlay, (PX, BDY), (PX + PW, BDY + BDH), (0, 0, 0), -1)
    cv2.addWeighted(badge_overlay, 0.72, frame, 0.28, 0, frame)

    label = data["dri_status"]
    tsz   = cv2.getTextSize(label, FONT, 0.60, 2)[0]
    tx    = PX + (PW - tsz[0]) // 2
    cv2.putText(frame, label, (tx, BDY + 22), FONT, 0.60,
                dri_color, 2, cv2.LINE_AA)

    # ── Face detection indicator (top-right) ──────────────────────────────────
    h, w = frame.shape[:2]
    fd_color  = (50, 210, 60) if face_detected else (0, 45, 220)
    fd_label  = "FACE TRACKED" if face_detected else "SEARCHING..."
    cv2.circle(frame, (w - 12, 14), 6, fd_color, -1, cv2.LINE_AA)
    tsz2 = cv2.getTextSize(fd_label, FONT, 0.35, 1)[0]
    cv2.putText(frame, fd_label, (w - tsz2[0] - 22, 18),
                FONT, 0.35, fd_color, 1, cv2.LINE_AA)

    # ── Mode + FPS badge (bottom-right) ──────────────────────────────────────
    mode_str = f"{'LIVE CV' if mode == 'live_cv' else 'MOCK'} | {fps:.0f} fps"
    tsz3 = cv2.getTextSize(mode_str, FONT, 0.38, 1)[0]
    cv2.putText(frame, mode_str, (w - tsz3[0] - 8, h - 8),
                FONT, 0.38, (80, 80, 105), 1, cv2.LINE_AA)

    # ── Quit hint (bottom-left) ───────────────────────────────────────────────
    cv2.putText(frame, "Press  Q  to quit", (PX + 4, h - 8),
                FONT, 0.35, (55, 55, 75), 1, cv2.LINE_AA)


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION J — FACE MESH LANDMARK OVERLAY DRAWING
# ═════════════════════════════════════════════════════════════════════════════

def _draw_face_overlay(frame: "np.ndarray", landmarks, w: int, h: int) -> None:
    """
    Draw eye contours (green polylines), mouth contour (magenta polyline),
    and key landmark dots (cyan) directly onto the live video frame.

    This gives the user real-time visual confirmation that the system is
    correctly tracking blinks and yawn events.
    """
    def px(idx: int) -> Tuple[int, int]:
        return (int(landmarks[idx].x * w), int(landmarks[idx].y * h))

    def poly(indices: List[int], color: Tuple, closed: bool = True):
        pts = np.array([px(i) for i in indices], dtype=np.int32)
        cv2.polylines(frame, [pts], closed, color, 1, cv2.LINE_AA)

    # Eye outlines
    poly(LEFT_EYE_OUTLINE,  _C_EYE)
    poly(RIGHT_EYE_OUTLINE, _C_EYE)

    # Mouth outer lip
    poly(MOUTH_OUTLINE, _C_MOUTH)

    # Key landmark dots (EAR + MAR anchor points)
    key = (LEFT_EYE_IDX + RIGHT_EYE_IDX +
           [MOUTH_TOP, MOUTH_BOTTOM, MOUTH_LEFT, MOUTH_RIGHT])
    for idx in key:
        cv2.circle(frame, px(idx), 2, _C_DOT, -1, cv2.LINE_AA)


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION K — MAIN CLASS: AuraCameraTracker
# ═════════════════════════════════════════════════════════════════════════════

class AuraCameraTracker:
    """
    Unified CV feature-extraction and fusion engine with live HUD display.

    Lifecycle
    ---------
    ::
        tracker = AuraCameraTracker()
        tracker.run()          # blocking loop — shows window, press q to exit

    Or frame-by-frame (e.g. from Streamlit):
    ::
        tracker = AuraCameraTracker()
        while True:
            tracker.tick()
            payload = tracker.get_camera_metrics_payload()
            time.sleep(1/30)
        tracker.release()

    Non-vision risk parameters (default all to safe baseline Rᵢ = 0.1):
    ::
        tracker = AuraCameraTracker(hrv_risk=0.3, bpm_risk=0.1, ...)
    """

    def __init__(
        self,
        hrv_risk:        float = 0.1,   # HRV (weight 20%)
        bpm_risk:        float = 0.1,   # Heart rate BPM (weight 15%)
        sleep_risk:      float = 0.1,   # Prior sleep duration (weight 10%)
        visibility_risk: float = 0.1,   # Road visibility (weight 5%)
        traffic_risk:    float = 0.1,   # Traffic density (weight 5%)
    ):
        # ── Non-vision risk params (externally injected) ──────────────────────
        self._hrv_risk   = hrv_risk
        self._bpm_risk   = bpm_risk
        self._sleep_risk = sleep_risk
        self._vis_risk   = visibility_risk
        self._trf_risk   = traffic_risk

        # ── CV pipeline state ─────────────────────────────────────────────────
        self._cap:        Optional[object] = None
        self._detector:   Optional[object] = None
        self._api_type:   Optional[str]    = None
        self._mock:       Optional[_MockStream] = None
        self._mode:       str  = "unknown"
        self._frame_w:    int  = 640
        self._frame_h:    int  = 480

        # ── Latest per-frame raw values ───────────────────────────────────────
        self._ear:            float = 0.30
        self._mar:            float = 0.00
        self._face_detected:  bool  = False
        self._frame_bgr:      Optional["np.ndarray"] = None

        # ── Blink FSM ─────────────────────────────────────────────────────────
        self._blink_fsm = _BlinkFSM()

        # ── Yawn state ────────────────────────────────────────────────────────
        self._yawn_active  = False
        self._last_yawn_ts = -YAWN_COOLDOWN_S

        # ── Rolling metric buffers ────────────────────────────────────────────
        self._perclos_buf = _RollingBuffer(PERCLOS_WINDOW_S)
        self._blink_buf   = _RollingBuffer(BLINK_WINDOW_S)
        self._yawn_buf    = _RollingBuffer(YAWN_WINDOW_S)

        # ── Computed metrics (updated every tick) ─────────────────────────────
        self._perclos_pct  = 0.0
        self._blink_freq   = 0.0
        self._blink_irreg  = False
        self._yawn_freq    = 0.0
        self._r_perclos    = 0.1
        self._r_blink      = 0.9
        self._r_yawn       = 0.1
        self._total_risk   = 0.1
        self._dri_pct      = 90.0
        self._dri_status   = "OPTIMAL"
        self._dri_color    = _DRI_BANDS[0][2]

        # ── FPS counter ───────────────────────────────────────────────────────
        self._fps          = 0.0
        self._fps_frames   = 0
        self._fps_ts       = time.time()

        # ── Initialise camera / mock ──────────────────────────────────────────
        self._init_camera()

    # ── Camera initialisation ─────────────────────────────────────────────────
    def _init_camera(self) -> None:
        if not _CV_AVAILABLE:
            self._mock = _MockStream(self._frame_w, self._frame_h)
            self._mode = "mock"
            return
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened() and hasattr(cv2, "CAP_DSHOW"):
                cap.release()
                cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap.release()
                raise RuntimeError("No webcam found at index 0.")

            cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS,          30)
            cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)

            self._cap      = cap
            self._frame_w  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            self._frame_h  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self._detector, self._api_type = _load_face_detector()
            self._mode     = "live_cv"
            print(f"[AURA] ✓ Webcam ready ({self._frame_w}×{self._frame_h} @ 30 fps).")

        except Exception as exc:
            print(f"[AURA] ⚡ Camera failed ({exc}). Activating Mock Stream.")
            if self._cap:
                try: self._cap.release()
                except: pass
                self._cap = None
            self._mock = _MockStream(self._frame_w, self._frame_h)
            self._mode = "mock"

    # ── Live frame acquisition + MediaPipe processing ─────────────────────────
    def _read_live_frame(self):
        """
        Read one webcam frame, run MediaPipe Face Mesh, and return
        (frame_bgr, ear, mar, face_detected, landmarks | None).
        Falls back to last-known-good values on any CV error.
        """
        ret, frame = self._cap.read()
        if not ret:
            blank = np.zeros((self._frame_h, self._frame_w, 3), np.uint8)
            return blank, self._ear, self._mar, False, None

        frame = cv2.flip(frame, 1)
        h, w  = frame.shape[:2]
        rgb   = np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), np.uint8)

        ear, mar, face_ok, lm = self._ear, self._mar, False, None
        try:
            if self._api_type == "tasks" and self._detector:
                img  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                res  = self._detector.detect(img)
                if res.face_landmarks:
                    lm      = res.face_landmarks[0]
                    face_ok = True
            elif self._api_type == "solutions" and self._detector:
                res = self._detector.process(rgb)
                if res.multi_face_landmarks:
                    lm      = res.multi_face_landmarks[0].landmark
                    face_ok = True
        except Exception:
            pass

        if face_ok and lm is not None:
            ear = (_compute_ear(lm, LEFT_EYE_IDX,  w, h) +
                   _compute_ear(lm, RIGHT_EYE_IDX, w, h)) / 2.0
            mar = _compute_mar(lm, w, h)

        return frame, round(ear, 4), round(mar, 4), face_ok, lm

    # ── Primary processing tick ───────────────────────────────────────────────
    def tick(self) -> None:
        """
        Process one frame.  Call this at ~30 Hz in your main loop.

        Updates all rolling metric buffers, computes PERCLOS / Blink Hz /
        Yawn Hz / Risk / DRI, and prepares the annotated frame for display.
        """
        now = time.time()

        # ── 1. Acquire sensor data ────────────────────────────────────────────
        if self._mode == "mock":
            frame, ear, mar = self._mock.read()
            self._frame_bgr    = frame
            self._face_detected = True   # mock always has a "face"
            landmarks = None
        else:
            frame, ear, mar, face_ok, landmarks = self._read_live_frame()
            self._frame_bgr    = frame
            self._face_detected = face_ok

        self._ear = ear
        self._mar = mar

        # ── 2. Blink detection ────────────────────────────────────────────────
        if self._blink_fsm.update(ear, now):
            self._blink_buf.append(None, ts=now)

        # ── 3. PERCLOS frame sample (EAR < threshold → ≥80% pupil covered) ───
        self._perclos_buf.append(ear < EAR_CLOSED_THRESHOLD, ts=now)
        self._perclos_buf.prune(now)

        # ── 4. Yawn onset detection (with cooldown) ───────────────────────────
        if mar > MAR_YAWN_THRESHOLD:
            if not self._yawn_active:
                self._yawn_active = True
                if (now - self._last_yawn_ts) >= YAWN_COOLDOWN_S:
                    self._yawn_buf.append(None, ts=now)
                    self._last_yawn_ts = now
        else:
            self._yawn_active = False

        # ── 5. Compute oculomotor metrics ─────────────────────────────────────
        self._perclos_pct                   = self._calc_perclos()
        self._blink_freq, self._blink_irreg = self._calc_blink_freq(now)
        self._yawn_freq                     = self._calc_yawn_freq(now)

        # ── 6. Piecewise risk mapping ─────────────────────────────────────────
        self._r_perclos = _map_perclos(self._perclos_pct)
        self._r_blink   = _map_blink(self._blink_freq, self._blink_irreg)
        self._r_yawn    = _map_yawn(self._yawn_freq)

        # ── 7. Multi-sensor fusion ────────────────────────────────────────────
        self._total_risk, self._dri_pct = _compute_fusion(
            self._r_perclos, self._r_blink, self._r_yawn,
            self._hrv_risk, self._bpm_risk, self._sleep_risk,
            self._vis_risk, self._trf_risk,
        )
        self._dri_status, self._dri_color = _get_dri_status(self._dri_pct)

        # ── 8. Draw overlays onto frame ───────────────────────────────────────
        if _CV_AVAILABLE and self._frame_bgr is not None:
            if landmarks is not None and self._mode == "live_cv":
                _draw_face_overlay(self._frame_bgr, landmarks,
                                   self._frame_w, self._frame_h)
            _draw_hud(
                self._frame_bgr,
                self._build_hud_data(),
                self._mode,
                self._fps,
                self._face_detected,
            )

        # ── 9. FPS counter ────────────────────────────────────────────────────
        self._fps_frames += 1
        elapsed = now - self._fps_ts
        if elapsed >= 1.0:
            self._fps       = self._fps_frames / elapsed
            self._fps_frames = 0
            self._fps_ts    = now

    # ── Metric computation helpers ────────────────────────────────────────────
    def _calc_perclos(self) -> float:
        vals = self._perclos_buf.values()
        if not vals:
            return 0.0
        return round(100.0 * sum(1 for v in vals if v) / len(vals), 2)

    def _calc_blink_freq(self, now: float) -> Tuple[float, bool]:
        self._blink_buf.prune(now)
        ts = self._blink_buf.timestamps()
        n  = len(ts)
        if n == 0:
            return 0.0, False
        elapsed_min = min(BLINK_WINDOW_S, now - ts[0]) / 60.0
        freq = (n / elapsed_min) if elapsed_min > 0.01 else float(n)
        irreg = False
        if n >= 4:
            ibi  = [ts[i+1] - ts[i] for i in range(n - 1)]
            mu   = sum(ibi) / len(ibi)
            if mu > 0:
                cov  = math.sqrt(sum((x - mu)**2 for x in ibi) / len(ibi)) / mu
                irreg = cov > BLINK_IRREG_COV
        return round(freq, 2), irreg

    def _calc_yawn_freq(self, now: float) -> float:
        self._yawn_buf.prune(now)
        return float(len(self._yawn_buf))

    # ── HUD data snapshot ─────────────────────────────────────────────────────
    def _build_hud_data(self) -> Dict:
        return {
            "ear":         self._ear,
            "mar":         self._mar,
            "perclos_pct": self._perclos_pct,
            "blink_freq":  self._blink_freq,
            "blink_irreg": self._blink_irreg,
            "yawn_freq":   self._yawn_freq,
            "r_perclos":   self._r_perclos,
            "r_blink":     self._r_blink,
            "r_yawn":      self._r_yawn,
            "total_risk":  self._total_risk,
            "dri_pct":     self._dri_pct,
            "dri_status":  self._dri_status,
            "dri_color":   self._dri_color,
        }

    # ── Public payload interface ──────────────────────────────────────────────
    def get_camera_metrics_payload(self) -> Dict:
        """
        Return the complete metrics and fusion output as a structured dict.
        Safe to call from any thread after tick() has run at least once.

        Returns:
            {
                "raw_ear":         float,
                "raw_mar":         float,
                "perclos_pct":     float,      # % over last 60 s
                "blink_frequency": float,      # blinks/min over last 60 s
                "yawn_frequency":  float,      # count over last 10 min
                "risk_scores": {
                    "perclos":    float,        # Rᵢ ∈ {0.1,0.3,0.5,0.7,0.9}
                    "blink":      float,
                    "yawn":       float,
                    "hrv":        float,        # externally provided
                    "bpm":        float,
                    "sleep":      float,
                    "visibility": float,
                    "traffic":    float,
                },
                "total_risk":  float,          # ΣwᵢRᵢ ∈ [0,1]
                "dri_pct":     float,          # (1−total_risk)×100
                "dri_status":  str,            # OPTIMAL / SATISFACTORY / REDUCED / …
                "mode":        str,            # "live_cv" | "mock"
            }
        """
        return {
            "raw_ear":         self._ear,
            "raw_mar":         self._mar,
            "perclos_pct":     self._perclos_pct,
            "blink_frequency": self._blink_freq,
            "yawn_frequency":  self._yawn_freq,
            "risk_scores": {
                "perclos":    self._r_perclos,
                "blink":      self._r_blink,
                "yawn":       self._r_yawn,
                "hrv":        self._hrv_risk,
                "bpm":        self._bpm_risk,
                "sleep":      self._sleep_risk,
                "visibility": self._vis_risk,
                "traffic":    self._trf_risk,
            },
            "total_risk":  self._total_risk,
            "dri_pct":     self._dri_pct,
            "dri_status":  self._dri_status,
            "mode":        self._mode,
        }

    # ── Main blocking run loop ────────────────────────────────────────────────
    def run(self) -> None:
        """
        Launch the live tracking window.
        Blocks until the user presses 'q' in the window or Ctrl+C.

        Also prints a concise metrics summary to the terminal every 30 frames
        (~1 second at 30 fps) as requested for verification purposes.
        """
        WIN = "AURA Driver Monitoring System"

        print("\n" + "═" * 72)
        print(f"  AURA Tracker LIVE    Mode: {self._mode.upper()}")
        print("  Focus the video window and press  Q  to quit.")
        print("═" * 72 + "\n")

        if _CV_AVAILABLE:
            cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(WIN, self._frame_w, self._frame_h)

        frame_n = 0
        try:
            while True:
                self.tick()
                frame_n += 1

                # Display frame
                if _CV_AVAILABLE and self._frame_bgr is not None:
                    cv2.imshow(WIN, self._frame_bgr)
                    if (cv2.waitKey(1) & 0xFF) == ord("q"):
                        print("\n  [AURA] 'q' pressed — shutting down.")
                        break
                else:
                    time.sleep(1 / 30)

                # Console verification print every ~1 s
                if frame_n % 30 == 0:
                    p = self.get_camera_metrics_payload()
                    print(
                        f"  [{frame_n:>6}] "
                        f"EAR={p['raw_ear']:.3f} MAR={p['raw_mar']:.3f} | "
                        f"PERCLOS={p['perclos_pct']:5.1f}%  "
                        f"Blinks={p['blink_frequency']:5.1f}/min  "
                        f"Yawns={p['yawn_frequency']:3.0f}/10m | "
                        f"Risk={p['total_risk']:.4f}  "
                        f"DRI={p['dri_pct']:.1f}% [{p['dri_status']}]"
                    )

        except KeyboardInterrupt:
            print("\n  [AURA] Interrupted by user (Ctrl+C).")
        finally:
            self.release()
            if _CV_AVAILABLE:
                cv2.destroyAllWindows()

    @property
    def mode(self) -> str:
        """Active sensor mode: "live_cv" or "mock"."""
        return self._mode

    def update_non_vision_risks(
        self,
        hrv_risk:        Optional[float] = None,
        bpm_risk:        Optional[float] = None,
        sleep_risk:      Optional[float] = None,
        visibility_risk: Optional[float] = None,
        traffic_risk:    Optional[float] = None,
    ) -> None:
        """
        Hot-update non-vision Rᵢ values (e.g. from a wearable feed).
        Unspecified parameters retain their current values.
        """
        if hrv_risk        is not None: self._hrv_risk   = hrv_risk
        if bpm_risk        is not None: self._bpm_risk   = bpm_risk
        if sleep_risk      is not None: self._sleep_risk = sleep_risk
        if visibility_risk is not None: self._vis_risk   = visibility_risk
        if traffic_risk    is not None: self._trf_risk   = traffic_risk

    def release(self) -> None:
        """Release webcam resources. Idempotent — safe to call multiple times."""
        if self._cap is not None:
            try: self._cap.release()
            except: pass
            self._cap = None
            print("[AURA] Webcam released.")
        self._detector = None


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION L — AUTOMATED SELF-VERIFICATION SUITE
# ═════════════════════════════════════════════════════════════════════════════

def _hdr(title: str) -> None:
    print(f"\n{'═' * 72}\n  {title}\n{'═' * 72}")

def _chk(label: str, ok: bool, detail: str = "") -> bool:
    sym  = "✅ PASS" if ok else "❌ FAIL"
    line = f"  {sym}  │  {label}"
    if detail: line += f"  →  {detail}"
    print(line)
    return ok


def run_self_tests() -> bool:
    """
    Execute all self-verification checks. Returns True if every check passes.
    """
    all_ok = True

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 1 — Piecewise Risk Map Boundaries (all 29 boundary cases)
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 1 — Piecewise Risk Map Boundary Verification")

    for pct, exp in [(0, 0.1), (9.9, 0.1), (10, 0.3), (19.9, 0.3),
                      (20, 0.5), (29.9, 0.5), (30, 0.7), (39.9, 0.7), (40, 0.9), (75, 0.9)]:
        got = _map_perclos(pct)
        all_ok &= _chk(f"R_PERCLOS({pct}%) = {exp}", got == exp, f"got {got}")

    for freq, irr, exp in [
        (0, False, 0.9), (2.9, False, 0.9),
        (10, False, 0.1), (20, False, 0.1),
        (21, False, 0.3), (25, False, 0.3),
        (26, False, 0.5), (35, False, 0.5),
        (36, False, 0.7), (50, False, 0.7),
        (15, True,  0.9),   # Irregular overrides
    ]:
        got = _map_blink(freq, irr)
        all_ok &= _chk(f"R_Blink({freq}/min, irreg={irr}) = {exp}", got == exp, f"got {got}")

    for cnt, exp in [(0, 0.1), (1, 0.3), (2, 0.3), (3, 0.5), (4, 0.5),
                      (5, 0.7), (6, 0.7), (7, 0.9), (10, 0.9)]:
        got = _map_yawn(cnt)
        all_ok &= _chk(f"R_Yawn({cnt}/10min) = {exp}", got == exp, f"got {got}")

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 2 — Multi-Sensor Fusion Math Correctness
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 2 — Multi-Sensor Fusion Math Engine")

    # All-baseline (every Rᵢ = 0.1): Total Risk = 0.1, DRI = 90%
    tr0, dri0 = _compute_fusion(0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1)
    all_ok &= _chk("All Rᵢ=0.1 → Total Risk = 0.1000", abs(tr0 - 0.1) < 1e-6, f"got {tr0}")
    all_ok &= _chk("All Rᵢ=0.1 → DRI = 90.00%",        abs(dri0 - 90.0) < 1e-4, f"got {dri0}")

    # All-max (every Rᵢ = 0.9): Total Risk = 0.9, DRI = 10%
    tr1, dri1 = _compute_fusion(0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9)
    all_ok &= _chk("All Rᵢ=0.9 → Total Risk = 0.9000", abs(tr1 - 0.9) < 1e-6, f"got {tr1}")
    all_ok &= _chk("All Rᵢ=0.9 → DRI = 10.00%",        abs(dri1 - 10.0) < 1e-4, f"got {dri1}")

    # Weight verification: only PERCLOS critical, rest baseline
    # Expected: 0.25*0.9 + 0.75*0.1 = 0.225 + 0.075 = 0.300
    tr2, dri2 = _compute_fusion(0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1)
    expected_tr2 = 0.25*0.9 + 0.75*0.1
    all_ok &= _chk(
        f"PERCLOS=0.9, rest=0.1 → Total={expected_tr2:.4f}",
        abs(tr2 - expected_tr2) < 1e-6, f"got {tr2}"
    )
    all_ok &= _chk(
        f"PERCLOS=0.9, rest=0.1 → DRI={(1-expected_tr2)*100:.2f}%",
        abs(dri2 - (1-expected_tr2)*100) < 1e-4, f"got {dri2}"
    )

    # Fusion output clamped to [0,1]
    tr3, _ = _compute_fusion(1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5)
    all_ok &= _chk("Fusion clamped to ≤ 1.0", tr3 <= 1.0, f"got {tr3}")

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 3 — DRI Status Band Assignment
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 3 — DRI Status Band Assignment")

    for dri, expected_label in [
        (100, "OPTIMAL"), (81, "OPTIMAL"), (80, "SATISFACTORY"),
        (61, "SATISFACTORY"), (60, "REDUCED"), (41, "REDUCED"),
        (40, "IMPAIRED"), (21, "IMPAIRED"), (20, "CRITICAL"), (0, "CRITICAL"),
    ]:
        label, _ = _get_dri_status(float(dri))
        all_ok &= _chk(f"DRI={dri}% → {expected_label}", label == expected_label,
                        f"got '{label}'")

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 4 — Rolling Buffer Eviction
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 4 — Rolling Buffer Eviction Logic")

    buf = _RollingBuffer(2.0)
    now = time.time()
    buf.append("stale",   ts=now - 3.0)
    buf.append("current", ts=now - 0.5)
    buf.prune(now)
    vals = buf.values()
    all_ok &= _chk("Stale entry evicted",   "stale"   not in vals, f"vals={vals}")
    all_ok &= _chk("Current entry retained", "current" in vals,     f"vals={vals}")
    all_ok &= _chk("Buffer length == 1",     len(buf) == 1,          f"len={len(buf)}")

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 5 — Blink FSM Noise Rejection & Confirmation
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 5 — Blink FSM: Noise Rejection & Valid Blink Confirmation")

    # Single below-threshold frame should NOT fire (noise)
    fsm1 = _BlinkFSM()
    fsm1.update(0.10)
    r1 = fsm1.update(0.35)
    all_ok &= _chk("1-frame closure → rejected (noise)",  not r1, f"event={r1}")

    # Two consecutive below-threshold frames → valid blink on re-open
    fsm2 = _BlinkFSM()
    fsm2.update(0.10); fsm2.update(0.10)
    r2 = fsm2.update(0.35)
    all_ok &= _chk("2-frame closure → blink confirmed",  r2,      f"event={r2}")

    # Open eye stream → no events
    fsm3 = _BlinkFSM()
    events = [fsm3.update(0.32) for _ in range(10)]
    all_ok &= _chk("Open EAR stream → no blink events",  not any(events), f"events={events}")

    # ─────────────────────────────────────────────────────────────────────────
    #  TEST 6 — AuraCameraTracker Integration
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("TEST 6 — AuraCameraTracker Integration & Payload Schema")

    tracker = AuraCameraTracker()
    all_ok &= _chk("Tracker mode initialised", tracker.mode in ("live_cv", "mock"),
                   f"mode='{tracker.mode}'")

    for _ in range(30):
        tracker.tick()
        time.sleep(0.01)

    payload = tracker.get_camera_metrics_payload()

    required = {"raw_ear", "raw_mar", "perclos_pct", "blink_frequency",
                "yawn_frequency", "risk_scores", "total_risk", "dri_pct", "dri_status"}
    all_ok &= _chk("All required payload keys present",
                   required.issubset(payload.keys()), f"keys={set(payload.keys())}")

    rs_keys = {"perclos","blink","yawn","hrv","bpm","sleep","visibility","traffic"}
    all_ok &= _chk("risk_scores has all 8 Rᵢ keys",
                   rs_keys.issubset(payload["risk_scores"].keys()))

    valid_ri = {0.1, 0.3, 0.5, 0.7, 0.9}
    for k in ("perclos", "blink", "yawn"):
        ri = payload["risk_scores"][k]
        all_ok &= _chk(f"risk_scores['{k}'] ∈ {{0.1,0.3,0.5,0.7,0.9}}", ri in valid_ri, f"got {ri}")

    all_ok &= _chk("0 ≤ total_risk ≤ 1",   0 <= payload["total_risk"] <= 1,   f"{payload['total_risk']}")
    all_ok &= _chk("0 ≤ dri_pct ≤ 100",    0 <= payload["dri_pct"]   <= 100,  f"{payload['dri_pct']}")

    print(f"\n  Mode : {payload['mode']}")
    print(f"  EAR  : {payload['raw_ear']:.4f}   MAR: {payload['raw_mar']:.4f}")
    print(f"  PERCLOS: {payload['perclos_pct']:.1f}%   Blinks: {payload['blink_frequency']:.2f}/min")
    print(f"  Risk : {payload['total_risk']:.4f}   DRI: {payload['dri_pct']:.2f}%  [{payload['dri_status']}]")

    tracker.release()

    # ─────────────────────────────────────────────────────────────────────────
    #  SUMMARY
    # ─────────────────────────────────────────────────────────────────────────
    _hdr("SELF-TEST SUMMARY")
    verdict = ("✅  ALL TESTS PASSED — AuraCameraTracker v3.0 verified."
               if all_ok else
               "❌  ONE OR MORE TESTS FAILED — review output above.")
    print(f"\n  {verdict}\n")
    print("═" * 72 + "\n")
    return all_ok


# ═════════════════════════════════════════════════════════════════════════════
#  SECTION M — LIGHTWEIGHT HTTP METRICS SERVER
#  Serves GET /metrics → JSON payload so the web dashboard can poll live data.
#  Runs in a daemon thread; dies automatically when the main process exits.
#  No external dependencies — uses stdlib http.server only.
# ═════════════════════════════════════════════════════════════════════════════

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

METRICS_PORT = 5050          # dashboard polls http://localhost:5050/metrics
_shared_tracker: "AuraCameraTracker | None" = None


class _MetricsHandler(BaseHTTPRequestHandler):
    """Minimal GET /metrics handler — returns JSON, adds CORS headers."""

    def do_GET(self):
        if self.path != "/metrics":
            self.send_response(404)
            self.end_headers()
            return

        payload = _shared_tracker.get_camera_metrics_payload() if _shared_tracker else {}
        body    = json.dumps(payload).encode()

        self.send_response(200)
        self.send_header("Content-Type",  "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")   # allow browser fetch
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):   # suppress per-request console noise
        pass


def _start_metrics_server() -> None:
    """Launch the HTTP metrics server in a background daemon thread."""
    server = HTTPServer(("127.0.0.1", METRICS_PORT), _MetricsHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True, name="aura-metrics-http")
    t.start()
    print(f"[AURA] ✓ Metrics server running → http://127.0.0.1:{METRICS_PORT}/metrics")


# ═════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
#  python aura_camera_tracker.py
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n")
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║    Mercedes AURA — Adaptive Understanding & Responsive AI        ║")
    print("║    AuraCameraTracker  v3.0  |  aura_camera_tracker.py            ║")
    print("╠══════════════════════════════════════════════════════════════════╣")
    print(f"║  CV Available     : {str(_CV_AVAILABLE):<46}║")
    print(f"║  EAR Threshold    : {EAR_CLOSED_THRESHOLD:<46}║")
    print(f"║  MAR Threshold    : {MAR_YAWN_THRESHOLD:<46}║")
    print(f"║  Fusion Weights   : PERCLOS 25%  Blink 15%  Yawn 5%            ║")
    print(f"║                     HRV 20%  BPM 15%  Sleep 10%  Env 10%       ║")
    print(f"║  Metrics API      : http://127.0.0.1:{METRICS_PORT}/metrics              ║")
    print("╚══════════════════════════════════════════════════════════════════╝\n")

    # ── Step 1: Run self-tests ─────────────────────────────────────────────────
    print("[AURA] Step 1 — Running automated self-verification suite…\n")
    all_passed = run_self_tests()

    # ── Step 2: Launch live tracking + metrics server ─────────────────────────
    if all_passed:
        print("[AURA] Step 2 — Starting metrics HTTP server…")
        tracker = AuraCameraTracker()
        _shared_tracker = tracker           # expose to HTTP handler
        _start_metrics_server()

        print("[AURA] Step 3 — Launching live tracking window…")
        print("[AURA]          (Focus the window and press Q to exit)\n")
        tracker.run()
    else:
        print("[AURA] ❌ Tests failed — aborting live launch.\n")
