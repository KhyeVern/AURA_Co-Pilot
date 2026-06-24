/**
 * AURA — Browser Face Tracker  v4
 *
 * Fixes vs v3:
 *  • Landmark overlay: object-fit:cover offset correction → landmarks land on face correctly
 *  • Blink freq: inter-blink-interval method — only updates on each new blink, never drifts
 *  • PERCLOS: 10 s window + threshold 0.20 → closing eyes reaches high % quickly
 *  • EAR thresholds separated: blink detection (0.22) vs PERCLOS (0.20)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// LANDMARK INDICES  (MediaPipe 468-point Face Mesh)
// ─────────────────────────────────────────────────────────────────────────────
// 6-point EAR sets (used for blink / PERCLOS computation)
const FT_LEFT_EYE  = [362, 385, 387, 263, 373, 380];
const FT_RIGHT_EYE = [33,  160, 158, 133, 153, 144];

// Full eyelid arcs for drawing (verified MediaPipe indices)
const FT_LEFT_EYE_UPPER  = [362, 398, 384, 385, 386, 387, 388, 466, 263];
const FT_LEFT_EYE_LOWER  = [362, 382, 381, 380, 374, 373, 390, 249, 263];
const FT_RIGHT_EYE_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const FT_RIGHT_EYE_LOWER = [33, 155, 154, 153, 145, 144, 163,   7, 133];

// Iris / pupil (landmarks 468-477 only if refineLandmarks=true, else use centre fallbacks)
const FT_L_IRIS_CENTER = 468;
const FT_R_IRIS_CENTER = 473;
const FT_L_EYE_MID = [362, 263];  // fallback midpoint
const FT_R_EYE_MID = [33,  133];

// Outer lip loop
const FT_OUTER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
                       375, 321, 405, 314, 17, 84, 181, 91, 146, 61];

// Inner lip
const FT_INNER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
                       324, 318, 402, 317, 14, 87, 178, 88, 95, 78];

// Mouth metric landmarks
const FT_MOUTH_TOP    = 13;
const FT_MOUTH_BOTTOM = 14;
const FT_MOUTH_LEFT   = 78;
const FT_MOUTH_RIGHT  = 308;

// ─────────────────────────────────────────────────────────────────────────────
// TUNING PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────
const FT_EAR_BLINK    = 0.22;   // threshold for blink detection
const FT_EAR_PERCLOS  = 0.20;   // separate (lower) threshold for PERCLOS
const FT_MAR_YAWN     = 0.55;
const FT_BLINK_MIN_F  = 2;      // min consecutive closed frames → valid blink
const FT_YAWN_COOLDOWN = 4000;

const FT_PERCLOS_WIN  = 10_000;  // 10 s window — reach 100% in 10 s of closed eyes
const FT_BLINK_WIN    = 120_000; // 2 min buffer for inter-blink intervals
const FT_YAWN_WIN     = 600_000;

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let ft_landmarker     = null;
let ft_running        = false;
let ft_lastTimestamp  = -1;
let ft_rafId          = null;

const ft_perclosBuffer = [];  // [ts, isClosed]
const ft_blinkBuffer   = [];  // [ts, 1]   — timestamps of confirmed blinks
const ft_yawnBuffer    = [];  // [ts, 1]

let ft_blinkClosed = false;
let ft_blinkFrames = 0;
let ft_yawnActive  = false;
let ft_lastYawnTs  = -FT_YAWN_COOLDOWN;

// Published values
let ft_perclosPct = 0;
let ft_blinkFreq  = 0;   // only updated on new blink → stable between blinks
let ft_yawnCount  = 0;

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────
function ft_dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function ft_computeEAR(lm, idx) {
  const p = idx.map(i => lm[i]);
  const A = ft_dist(p[1], p[5]);
  const B = ft_dist(p[2], p[4]);
  const C = ft_dist(p[0], p[3]);
  return C > 0.001 ? (A + B) / (2.0 * C) : 0.30;
}

function ft_computeMAR(lm) {
  const v = ft_dist(lm[FT_MOUTH_TOP], lm[FT_MOUTH_BOTTOM]);
  const h = ft_dist(lm[FT_MOUTH_LEFT], lm[FT_MOUTH_RIGHT]);
  return h > 0.001 ? v / h : 0;
}

function ft_mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function ft_prune(buf, windowMs) {
  const cutoff = Date.now() - windowMs;
  while (buf.length && buf[0][0] < cutoff) buf.shift();
}

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE TRANSFORM  — landmark (normalized) → canvas pixel
// Accounts for object-fit: cover cropping so overlay lands on the face.
// ─────────────────────────────────────────────────────────────────────────────
function ft_makePxFn(video, canvas) {
  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth  || 640;
  const vh = video.videoHeight || 480;

  // object-fit: cover → scale so the smaller canvas dimension fills
  const scale  = Math.max(cw / vw, ch / vh);
  const scaledW = vw * scale;
  const scaledH = vh * scale;

  // How many scaled px are cropped from each side (centred crop)
  const offX = (scaledW - cw) / 2;
  const offY = (scaledH - ch) / 2;

  // Returns canvas pixel coords. x is NOT mirrored here — the canvas element
  // itself has transform: scaleX(-1) applied via CSS, which mirrors everything.
  return (pt) => ({
    x: pt.x * scaledW - offX,
    y: pt.y * scaledH - offY,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS OVERLAY  — Premium Neon Mesh
//
// Visual language:
//   Lines  : glowing neon blue (rgba 0,220,255) — eye arcs + lip contours
//   Dots   : deep electric-blue / purple glowing anchors at structural corners
//             • Eye inner/outer corners    → deep electric blue (#0af)
//             • Mouth left/right extremes  → deep purple (#c060ff)
//             • Eye brow/lash midpoints    → smaller electric blue
// ─────────────────────────────────────────────────────────────────────────────
function ft_drawOverlay(lm) {
  const canvas = document.getElementById('ft-canvas');
  const video  = document.getElementById('cam-video');
  if (!canvas || !video || !lm) return;

  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width  = cw;
    canvas.height = ch;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);

  const px = ft_makePxFn(video, canvas);

  // ── Shared glow line helper ───────────────────────────────────────────────
  // Draws a polyline with soft glow: wide faint under-stroke + sharp top-stroke
  function glowLine(indices, color, lw, glowRadius, close = false) {
    const pts = indices.map(i => lm[i] ? px(lm[i]) : null).filter(Boolean);
    if (pts.length < 2) return;

    function tracePath() {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (close) ctx.closePath();
    }

    // Glow halo pass
    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = glowRadius;
    ctx.strokeStyle  = color;
    ctx.lineWidth    = lw + 1;
    ctx.globalAlpha  = 0.35;
    tracePath();
    ctx.stroke();
    ctx.restore();

    // Crisp core pass
    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = glowRadius * 0.5;
    ctx.strokeStyle  = color;
    ctx.lineWidth    = lw;
    ctx.globalAlpha  = 0.92;
    tracePath();
    ctx.stroke();
    ctx.restore();
  }

  // ── Anchor dot helper ─────────────────────────────────────────────────────
  // Renders a high-contrast glowing dot: halo ring + filled core
  function anchorDot(lm_pt, r, coreColor, glowColor) {
    if (!lm_pt) return;
    const p = px(lm_pt);

    // Outer glow halo (large, very transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
    ctx.fillStyle   = glowColor || coreColor;
    ctx.globalAlpha = 0.15;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = glowColor || coreColor;
    ctx.fill();
    ctx.restore();

    // Middle ring (medium, semi-transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
    ctx.fillStyle   = glowColor || coreColor;
    ctx.globalAlpha = 0.30;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = glowColor || coreColor;
    ctx.fill();
    ctx.restore();

    // Core dot (solid, fully opaque)
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = coreColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = glowColor || coreColor;
    ctx.fill();
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. EYE CONTOUR LINES — neon blue arcs tracing upper + lower eyelids
  // ─────────────────────────────────────────────────────────────────────────
  const eyeLineColor = 'rgba(0, 215, 255, 0.88)';
  const eyeGlow      = 14;

  glowLine(FT_LEFT_EYE_UPPER,  eyeLineColor, 1.4, eyeGlow);
  glowLine(FT_LEFT_EYE_LOWER,  eyeLineColor, 1.4, eyeGlow);
  glowLine(FT_RIGHT_EYE_UPPER, eyeLineColor, 1.4, eyeGlow);
  glowLine(FT_RIGHT_EYE_LOWER, eyeLineColor, 1.4, eyeGlow);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. EYE CORNER ANCHOR DOTS
  //    Inner corners (lachrymal)  : landmark 133 (R) / 362→263 area (L)
  //    Outer corners              : landmark 33  (R) / 263 (L)
  //    Upper/lower brow extremes  : from the 6-pt EAR set
  // ─────────────────────────────────────────────────────────────────────────
  const eyeCornerColor = '#00aaff';   // deep electric blue
  const eyeCornerGlow  = '#0066ff';   // darker blue glow behind it

  // Outer corners
  anchorDot(lm[33],  3.2, eyeCornerColor, eyeCornerGlow);  // R outer
  anchorDot(lm[263], 3.2, eyeCornerColor, eyeCornerGlow);  // L outer

  // Inner corners (nearest to nose bridge)
  anchorDot(lm[133], 3.2, eyeCornerColor, eyeCornerGlow);  // R inner
  anchorDot(lm[362], 3.2, eyeCornerColor, eyeCornerGlow);  // L inner

  // Upper/lower lid midpoints from EAR set (smaller, secondary anchors)
  const eyeMidColor = '#40c8ff';
  const earMidPts = [160, 158, 153, 144, 385, 387, 380, 373];
  for (const i of earMidPts) {
    if (lm[i]) anchorDot(lm[i], 1.8, eyeMidColor, '#0088cc');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. OUTER LIP CONTOUR — neon blue (same family as eyes for cohesion)
  // ─────────────────────────────────────────────────────────────────────────
  const lipColor = 'rgba(0, 200, 255, 0.75)';
  glowLine(FT_OUTER_LIP, lipColor, 1.3, 12, true);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. INNER LIP CONTOUR — slightly more purple tint, softer
  // ─────────────────────────────────────────────────────────────────────────
  const lipInnerColor = 'rgba(100, 160, 255, 0.55)';
  glowLine(FT_INNER_LIP, lipInnerColor, 1.0, 8, true);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. MOUTH CORNER ANCHOR DOTS — deep purple, prominently glowing
  //    Left corner: landmark 61 / 78    Right corner: 291 / 308
  // ─────────────────────────────────────────────────────────────────────────
  const mouthCornerColor = '#b040ff';   // vivid deep purple
  const mouthCornerGlow  = '#7000cc';   // darker purple aura

  anchorDot(lm[61],  3.5, mouthCornerColor, mouthCornerGlow);  // L outer corner
  anchorDot(lm[291], 3.5, mouthCornerColor, mouthCornerGlow);  // R outer corner

  // Top and bottom lip mid-anchors (smaller, electric blue)
  const lipMidColor = '#60b0ff';
  anchorDot(lm[FT_MOUTH_TOP],    2.0, lipMidColor, '#0060cc');
  anchorDot(lm[FT_MOUTH_BOTTOM], 2.0, lipMidColor, '#0060cc');
}


// ─────────────────────────────────────────────────────────────────────────────
// MEDIAPIPE LOADER
// ─────────────────────────────────────────────────────────────────────────────
async function ft_loadMediaPipe() {
  if (window.vision && window.vision.FaceLandmarker) {
    console.log('[AURA] Using window.vision (UMD)');
    return window.vision;
  }
  const urls = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3',
    'https://unpkg.com/@mediapipe/tasks-vision@0.10.14',
  ];
  for (const url of urls) {
    try {
      const mod = await import(url);
      if (mod && mod.FaceLandmarker) { console.log('[AURA] CDN import OK:', url); return mod; }
    } catch (e) { console.warn('[AURA] Import failed:', url, e.message); }
  }
  throw new Error('Cannot load MediaPipe — need internet + HTTP server (not file://)');
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
async function ft_init() {
  if (ft_landmarker || ft_running) return;
  ft_setStatus(false, 'Loading model…');
  try {
    const lib = await ft_loadMediaPipe();
    const { FaceLandmarker, FilesetResolver } = lib;
    const fsr = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    ft_landmarker = await FaceLandmarker.createFromOptions(fsr, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces:    1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    ft_running = true;
    ft_setStatus(true, 'Tracking');
    console.log('[AURA FaceTracker] ✓ Ready');
    ft_loop();
  } catch (err) {
    console.error('[AURA FaceTracker] Init failed:', err);
    let msg = 'Model error';
    if (/fetch|network|internet/i.test(err.message)) msg = 'Network error — need internet';
    else if (/file:\/\//i.test(err.message))          msg = 'Needs HTTP server';
    ft_setStatus(false, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────────────────────
function ft_loop() {
  if (!ft_running || !ft_landmarker) return;

  const video = document.getElementById('cam-video');
  if (video && video.readyState >= 2 && !video.paused) {
    const nowMs = performance.now();
    if (nowMs > ft_lastTimestamp) {
      ft_lastTimestamp = nowMs;
      let result;
      try { result = ft_landmarker.detectForVideo(video, nowMs); } catch (_) {}

      const lm = result?.faceLandmarks?.[0];
      if (lm && lm.length > 0) {
        ft_processFrame(lm);
        ft_drawOverlay(lm);
      } else {
        // Clear canvas when no face
        const canvas = document.getElementById('ft-canvas');
        const ctx = canvas?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ft_updateUI();
    }
  }

  ft_rafId = requestAnimationFrame(ft_loop);
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-FRAME PROCESSING
// ─────────────────────────────────────────────────────────────────────────────
function ft_processFrame(lm) {
  const now = Date.now();

  const earL = ft_computeEAR(lm, FT_LEFT_EYE);
  const earR = ft_computeEAR(lm, FT_RIGHT_EYE);
  const ear  = (earL + earR) / 2;
  const mar  = ft_computeMAR(lm);

  // ── PERCLOS (10 s window, lower threshold = more sensitive) ───────────────
  const eyeClosed = ear < FT_EAR_PERCLOS;
  ft_perclosBuffer.push([now, eyeClosed]);
  ft_prune(ft_perclosBuffer, FT_PERCLOS_WIN);
  const nClosed = ft_perclosBuffer.filter(e => e[1]).length;
  ft_perclosPct = ft_perclosBuffer.length
    ? (nClosed / ft_perclosBuffer.length) * 100
    : 0;

  // ── BLINK FSM (slightly higher threshold than PERCLOS) ────────────────────
  if (ear < FT_EAR_BLINK) {
    if (!ft_blinkClosed) { ft_blinkClosed = true; ft_blinkFrames = 1; }
    else ft_blinkFrames++;
  } else {
    if (ft_blinkClosed && ft_blinkFrames >= FT_BLINK_MIN_F) {
      ft_blinkBuffer.push([now, 1]);
      ft_updateBlinkFreq(now);   // recalculate freq only on new blink
    }
    ft_blinkClosed = false;
    ft_blinkFrames = 0;
  }
  ft_prune(ft_blinkBuffer, FT_BLINK_WIN);

  // ── YAWN ──────────────────────────────────────────────────────────────────
  if (mar > FT_MAR_YAWN) {
    if (!ft_yawnActive) {
      ft_yawnActive = true;
      if (now - ft_lastYawnTs >= FT_YAWN_COOLDOWN) {
        ft_yawnBuffer.push([now, 1]);
        ft_lastYawnTs = now;
      }
    }
  } else { ft_yawnActive = false; }
  ft_prune(ft_yawnBuffer, FT_YAWN_WIN);
  ft_yawnCount = ft_yawnBuffer.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLINK FREQUENCY — inter-blink interval method
// Only recalculated when a new blink is confirmed.
// Does NOT drift between blinks.
// ─────────────────────────────────────────────────────────────────────────────
function ft_updateBlinkFreq(now) {
  const buf = ft_blinkBuffer;
  if (buf.length < 2) {
    ft_blinkFreq = 0;   // can't estimate yet — need at least 2 blinks
    return;
  }
  // Average inter-blink interval over last 10 confirmed blinks
  const recent = buf.slice(-10);
  let totalMs = 0;
  for (let i = 1; i < recent.length; i++) {
    totalMs += recent[i][0] - recent[i - 1][0];
  }
  const avgIntervalMs = totalMs / (recent.length - 1);
  // Guard: interval must be at least 200 ms (300 blinks/min max = impossible)
  if (avgIntervalMs < 200) return;
  ft_blinkFreq = Math.min(Math.round(60000 / avgIntervalMs), 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function ft_setStatus(live, label) {
  if (typeof setClmStatus === 'function') setClmStatus(live, label);
}

function ft_call(fn, ...args) {
  if (typeof fn === 'function') fn(...args);
}

function ft_updateUI() {
  const blinkRi   = typeof riskBlink   === 'function' ? riskBlink(ft_blinkFreq)    : 0.5;
  const perclosRi = typeof riskPERCLOS === 'function' ? riskPERCLOS(ft_perclosPct) : 0.5;
  const yawnRi    = typeof riskYawn    === 'function' ? riskYawn(ft_yawnCount)      : 0.5;

  const colorFn = typeof riskColorFromRi === 'function'
    ? riskColorFromRi
    : ri => ri <= 0.1 ? '#00e676' : ri <= 0.3 ? '#69f0ae'
           : ri <= 0.5 ? '#ffca28' : ri <= 0.7 ? '#ff7043' : '#ff2d55';

  ft_call(updateClmTile, 'clm-blink', 'clm-blink-bar',
    ft_blinkFreq > 0 ? String(ft_blinkFreq) : '—',
    blinkRi, colorFn(blinkRi));
  ft_call(updateClmTile, 'clm-ear',  'clm-ear-bar',
    ft_perclosPct.toFixed(1) + '%', perclosRi, colorFn(perclosRi));
  ft_call(updateClmTile, 'clm-yawn', 'clm-yawn-bar',
    String(ft_yawnCount), yawnRi, colorFn(yawnRi));

  ft_call(pushToSlider, 'perclos', ft_perclosPct);
  // Only push blink freq once at least one inter-blink interval is measured.
  // ft_blinkFreq stays 0 until 2+ blinks are confirmed (ft_updateBlinkFreq).
  // Pushing 0 into the slider before that would lower the DRI with a false reading.
  if (ft_blinkFreq > 0) {
    ft_call(pushToSlider, 'blink', Math.min(50, ft_blinkFreq));
  }
  ft_call(pushToSlider, 'yawn',    Math.min(15, ft_yawnCount));
  ft_call(updateSliderFills);
  ft_call(recalculate);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function startFaceTracking() {
  const video = document.getElementById('cam-video');
  if (!video) return;
  if (video.readyState >= 2 && !video.paused) {
    ft_init();
  } else {
    video.addEventListener('playing', function h() {
      video.removeEventListener('playing', h);
      ft_init();
    });
  }
}

function stopFaceTracking() {
  ft_running = false;
  if (ft_rafId) { cancelAnimationFrame(ft_rafId); ft_rafId = null; }
  const canvas = document.getElementById('ft-canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  ft_setStatus(false, 'Camera off');
}

function ft_resetMetrics() {
  ft_perclosBuffer.length = 0;
  ft_blinkBuffer.length   = 0;
  ft_yawnBuffer.length    = 0;
  ft_blinkClosed  = false;
  ft_blinkFrames  = 0;
  ft_yawnActive   = false;
  ft_lastYawnTs   = -FT_YAWN_COOLDOWN;
  ft_perclosPct   = 0;
  ft_blinkFreq    = 0;
  ft_yawnCount    = 0;

  ft_call(updateClmTile, 'clm-blink', 'clm-blink-bar', '—',    0.1, '#00e676');
  ft_call(updateClmTile, 'clm-ear',   'clm-ear-bar',   '0.0%', 0.1, '#00e676');
  ft_call(updateClmTile, 'clm-yawn',  'clm-yawn-bar',  '0',    0.1, '#00e676');
  ft_call(pushToSlider, 'perclos', 0);
  ft_call(pushToSlider, 'blink',   0);
  ft_call(pushToSlider, 'yawn',    0);
  ft_call(updateSliderFills);
  ft_call(recalculate);
  console.log('[AURA FaceTracker] Metrics reset');
}
