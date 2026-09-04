/**
 * MERCEDES AURA CO-PILOT
 * Main Application Logic
 * DRI Algorithm, Risk Calculations, UI Interactions, Emergency System
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const state = {
  cameraOn: true,
  visibility: 'clear',
  traffic: 'low',
  activePreset: null,
  emergencyActive: false,
  emergencyAcknowledged: false,   // blocks re-trigger until readings clear
  fatigueWarningActive: false,
  fatigueAcknowledged: false,     // blocks re-trigger until readings clear
  chimeAudioCtx: null,
  chimeGainNode: null,
  chimeOsc: null,
  chimeInterval: null,
  fatigueChimeAudioCtx: null,
  fatigueChimeGainNode: null,
  fatigueChimeInterval: null,
  ecgAnimFrame: null,
  ecgPhase: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// RISK MAPPING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function riskHR(bpm) {
  if (bpm === 0) return 0.9;
  if (bpm >= 40 && bpm <= 70) return 0.1;  // Safe resting zone
  if (bpm > 70 && bpm <= 80) return 0.3;
  if (bpm > 80 && bpm <= 90) return 0.5;
  if (bpm > 90 && bpm <= 100) return 0.7;
  return 0.9;
}

function riskHRV(hrv) {
  if (hrv === 0) return 0.9;
  if (hrv > 50) return 0.1;
  if (hrv >= 35) return 0.3;
  if (hrv >= 25) return 0.5;
  if (hrv >= 15) return 0.7;
  return 0.9;
}

// Apple Watch Sleep Quality Scale (0–100)
// 90–100 Excellent, 75–89 Good, 50–74 Fair, 25–49 Poor, 10–24 Very Poor, 0–9 Critical
function riskSleep(score) {
  if (score >= 75) return 0.1;  // Excellent / Good
  if (score >= 50) return 0.3;  // Fair
  if (score >= 25) return 0.5;  // Poor
  if (score >= 10) return 0.7;  // Very Poor
  return 0.9;                   // Critical
}

function riskPERCLOS(pct) {
  if (pct > 95) return 0.95;
  if (pct < 10) return 0.1;
  if (pct < 20) return 0.3;
  if (pct < 30) return 0.5;
  if (pct <= 40) return 0.7;
  return 0.9;
}

function riskYawn(count) {
  if (count === 0) return 0.1;
  if (count <= 2) return 0.3;
  if (count <= 4) return 0.5;
  if (count <= 6) return 0.7;
  return 0.9;
}

function riskBlink(bpm) {
  if (bpm === 0) return 0.5;  // 0 = not yet measured by face tracker — neutral score
  if (bpm < 4) return 0.9;   // Below healthy blink rate — high risk
  if (bpm <= 20) return 0.1; // Healthy blink rate (4–20 blinks/min) — low risk
  if (bpm <= 25) return 0.3;
  if (bpm <= 35) return 0.5;
  return 0.7;
}

function riskVisibility(vis) {
  const map = { clear: 0.1, haze: 0.3, night: 0.5, rain: 0.7, severe: 0.9 };
  return map[vis] || 0.1;
}

function riskTraffic(traf) {
  const map = { low: 0.1, medium: 0.3, heavy: 0.7, gridlock: 0.9 };
  return map[traf] || 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRI WEIGHTS
// ─────────────────────────────────────────────────────────────────────────────
const WEIGHTS = {
  perclos: 0.25,
  hrv:     0.20,
  hr:      0.15,
  blink:   0.15,
  sleep:   0.10,
  yawn:    0.05,
  visibility: 0.05,
  traffic:    0.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT READINGS
// ─────────────────────────────────────────────────────────────────────────────
function getReadings() {
  return {
    hr:       parseFloat(document.getElementById('hr-slider').value) || 0,
    hrv:      parseFloat(document.getElementById('hrv-slider').value) || 0,
    sleep:    parseFloat(document.getElementById('sleep-slider').value) || 0,
    perclos:  parseFloat(document.getElementById('perclos-slider').value) || 0,
    blink:    parseFloat(document.getElementById('blink-slider').value) || 0,
    yawn:     parseFloat(document.getElementById('yawn-slider').value) || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL EVENT CHECK
// ─────────────────────────────────────────────────────────────────────────────
// Returns a human-readable reason string when a critical event is detected,
// or null when readings are within safe limits.
// HR=0 / HR<20 and HRV=0 are genuine hardware "no signal" / dangerous events
// and must trigger regardless of whether the face tracker is running.
function checkCriticalEvent(r) {
  if (r.hr === 0)
    return 'Heart Rate = 0 BPM — No Signal Detected';
  if (r.hr < 20)
    return `Heart Rate = ${r.hr} BPM — Dangerous Bradycardia`;
  if (r.hrv === 0)
    return 'HRV = 0 ms — No Signal Detected';

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FATIGUE WARNING CHECK
// ─────────────────────────────────────────────────────────────────────────────
// Triggers when PERCLOS reaches 60% or above (significant eye closure indicating
// severe fatigue), or when blink frequency drops to 0 while the camera is live.
// Lower severity than checkCriticalEvent — uses a yellow overlay and
// wake-up chime rather than the full red emergency response.
function checkFatigueWarning(r) {
  if (r.perclos >= 60) return true;
  // blink===0 only meaningful as a fatigue signal when camera is actually streaming
  if (r.blink === 0 && typeof camConnected !== 'undefined' && camConnected) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RECALCULATE
// ─────────────────────────────────────────────────────────────────────────────
function recalculate() {
  const r = getReadings();

  const criticalReason = checkCriticalEvent(r);

  // Auto-reset the acknowledged flag once readings return to a safe range,
  // so a genuine new critical event can fire again later.
  if (state.emergencyAcknowledged && !criticalReason) {
    state.emergencyAcknowledged = false;
  }

  if (criticalReason && !state.emergencyActive && !state.emergencyAcknowledged) {
    // Critical takes priority — dismiss fatigue overlay if it was showing
    if (state.fatigueWarningActive) dismissFatigueWarning();
    triggerEmergency(criticalReason);
    return;
  }

  // Auto-reset the fatigue acknowledged flag once readings are safe again.
  if (state.fatigueAcknowledged && !checkFatigueWarning(r)) {
    state.fatigueAcknowledged = false;
  }

  // Fatigue warning (yellow) — only when not already in emergency mode
  if (!state.emergencyActive && !state.fatigueAcknowledged) {
    if (checkFatigueWarning(r) && !state.fatigueWarningActive) {
      triggerFatigueWarning();
    }
  }

  const risks = {
    perclos:    riskPERCLOS(r.perclos),
    hrv:        riskHRV(r.hrv),
    hr:         riskHR(r.hr),
    blink:      riskBlink(r.blink),
    sleep:      riskSleep(r.sleep),
    yawn:       riskYawn(r.yawn),
    visibility: riskVisibility(state.visibility),
    traffic:    riskTraffic(state.traffic),
  };

  let totalRisk = 0;
  for (const key in WEIGHTS) totalRisk += WEIGHTS[key] * risks[key];
  totalRisk = Math.min(1, Math.max(0, totalRisk));

  const dri = Math.round((1 - totalRisk) * 100);

  updateDRIGauge(dri, totalRisk, risks);
  updateRiskChips(risks, r);
  updateBreakdownList(risks);
  updateAdaptations(dri, risks, r);
  updateECG(r.hr);
  updateSliderFills();

  // Feed the AURA AI Log with the current state
  const { cssState } = getDRIState(dri);
  updateAuraLog(cssState, r);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRI GAUGE UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function getDRIState(dri) {
  if (dri > 80) return { label: 'OPTIMAL',    color: '#00e676', cssState: 'Optimal' };
  if (dri > 60) return { label: 'ACCEPTABLE', color: '#69f0ae', cssState: 'Acceptable' };
  if (dri > 40) return { label: 'REDUCED',    color: '#ffca28', cssState: 'Reduced' };
  if (dri > 20) return { label: 'IMPAIRED',   color: '#ff7043', cssState: 'Impaired' };
  return         { label: 'CRITICAL',   color: '#ff2d55', cssState: 'Critical' };
}

function updateDRIGauge(dri, totalRisk, risks) {
  const { label, color, cssState } = getDRIState(dri);
  const circumference = 628.3;
  const offset = circumference * (1 - dri / 100);

  const arc = document.getElementById('gauge-arc');
  if (arc) { arc.style.strokeDashoffset = offset; arc.style.stroke = color; }

  const valText = document.getElementById('gauge-value-text');
  if (valText) { valText.textContent = dri; valText.style.fill = color; }

  const badge = document.getElementById('dri-state-badge');
  if (badge) { badge.textContent = label; badge.setAttribute('data-state', cssState); }

  const glowRing = document.getElementById('dri-glow-ring');
  if (glowRing) {
    const alpha = 0.15 + (dri / 100) * 0.2;
    glowRing.style.boxShadow = `0 0 40px ${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  }

  const trBar = document.getElementById('total-risk-bar');
  if (trBar) trBar.style.width = (totalRisk * 100) + '%';
  const trVal = document.getElementById('total-risk-val');
  if (trVal) trVal.textContent = totalRisk.toFixed(2);

  document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active'));
  const ranges = { 'Optimal': '81-100', 'Acceptable': '61-80', 'Reduced': '41-60', 'Impaired': '21-40', 'Critical': '0-20' };
  const activeLegend = document.querySelector(`.legend-item[data-range="${ranges[cssState]}"]`);
  if (activeLegend) activeLegend.classList.add('active');
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK CHIP COLORS
// ─────────────────────────────────────────────────────────────────────────────
function riskColor(r) {
  if (r <= 0.1) return '#00e676';
  if (r <= 0.3) return '#69f0ae';
  if (r <= 0.5) return '#ffca28';
  if (r <= 0.7) return '#ff7043';
  return '#ff2d55';
}

function updateRiskChips(risks, r) {
  const map = {
    'hr-risk': risks.hr, 'hrv-risk': risks.hrv, 'sleep-risk': risks.sleep,
    'perclos-risk': risks.perclos, 'blink-risk': risks.blink, 'yawn-risk': risks.yawn,
  };
  for (const [id, risk] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = `R: ${risk.toFixed(1)}`;
    el.style.color = riskColor(risk);
    el.style.borderColor = riskColor(risk) + '50';
    el.style.background = riskColor(risk) + '14';
  }
  const vBadge = document.getElementById('env-visibility-risk');
  if (vBadge) {
    const rv = riskVisibility(state.visibility);
    vBadge.textContent = `R: ${rv.toFixed(1)}`;
    vBadge.style.color = riskColor(rv);
    vBadge.style.borderColor = riskColor(rv) + '50';
    vBadge.style.background = riskColor(rv) + '14';
  }
  const tBadge = document.getElementById('env-traffic-risk');
  if (tBadge) {
    const rt = riskTraffic(state.traffic);
    tBadge.textContent = `R: ${rt.toFixed(1)}`;
    tBadge.style.color = riskColor(rt);
    tBadge.style.borderColor = riskColor(rt) + '50';
    tBadge.style.background = riskColor(rt) + '14';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN LIST
// ─────────────────────────────────────────────────────────────────────────────
const BREAKDOWN_LABELS = {
  perclos: 'PERCLOS', hrv: 'HRV', hr: 'Heart Rate', blink: 'Blink Freq.',
  sleep: 'Sleep Quality', yawn: 'Yawn Freq.', visibility: 'Visibility', traffic: 'Traffic',
};

function updateBreakdownList(risks) {
  const list = document.getElementById('breakdown-list');
  if (!list) return;
  list.innerHTML = '';
  for (const key in WEIGHTS) {
    const risk = risks[key], weight = WEIGHTS[key], color = riskColor(risk);
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <span class="breakdown-label">${BREAKDOWN_LABELS[key]}</span>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${risk*100}%;background:${color}"></div></div>
      <span class="breakdown-val" style="color:${color}">${risk.toFixed(1)}</span>
      <span class="breakdown-weight">${Math.round(weight*100)}%</span>
    `;
    list.appendChild(row);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC VEHICLE ADAPTATIONS
// ─────────────────────────────────────────────────────────────────────────────
function updateAdaptations(dri, risks, r) {
  // Derive the same composite state the AI log uses
  const logState   = _auraCompositeKey(getDRIState(dri).cssState, r);
  const isCritical = dri <= 20;
  const isImpaired = dri > 20 && dri <= 40;
  const isReduced  = dri > 40 && dri <= 60;

  // Sleep quality poor or below (Apple Watch scale: score < 50 → R ≥ 0.5)
  // Escalates all safety sensors and activates seat massage regardless of DRI level
  const sleepImpaired = risks.sleep >= 0.5;

  // ── Ambient Music ────────────────────────────────────────────────────────
  const musicItem = document.getElementById('adapt-music');
  const musicVal  = document.getElementById('adapt-music-val');
  const musicInd  = document.getElementById('adapt-music-ind');

  if (isCritical) {
    musicItem.className = 'adapt-item adapt-active';
    musicVal.textContent = 'Alert Tone Playing';
    musicInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (logState === 'Stress' || logState === 'HighHR') {
    musicItem.className = 'adapt-item adapt-stress';
    musicVal.textContent = 'Calm Music Activated';
    musicInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (logState === 'LowHR' || logState === 'LowHRV') {
    musicItem.className = 'adapt-item adapt-stress';
    musicVal.textContent = 'Soothing Audio Mode';
    musicInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (isImpaired) {
    musicItem.className = 'adapt-item adapt-active';
    musicVal.textContent = 'Alert Tone — Low Volume';
    musicInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (sleepImpaired) {
    // Poor or below sleep quality — boost to alertness music
    musicItem.className = 'adapt-item adapt-active';
    musicVal.textContent = 'Upbeat Music — Low Sleep Alert';
    musicInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    musicItem.className = 'adapt-item adapt-active';
    musicVal.textContent = 'Upbeat Music — Alertness Mode';
    musicInd.className = 'adapt-indicator adapt-ind-alert';
  } else {
    musicItem.className = 'adapt-item';
    musicVal.textContent = 'Driver Preference';
    musicInd.className = 'adapt-indicator adapt-ind-active';
  }

  // ── Massage & Lighting ───────────────────────────────────────────────────
  const massageItem = document.getElementById('adapt-massage');
  const massageVal  = document.getElementById('adapt-massage-val');
  const massageInd  = document.getElementById('adapt-massage-ind');

  if (isCritical) {
    massageItem.className = 'adapt-item adapt-active';
    massageVal.textContent = 'Fatigue Vibration Alert';
    massageInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (sleepImpaired) {
    // Poor or below sleep quality — seat massage on + alertness lighting
    massageItem.className = 'adapt-item adapt-active';
    massageVal.textContent = '💆 Seat Massage On — Low Sleep';
    massageInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (logState === 'Stress' || logState === 'HighHR') {
    massageItem.className = 'adapt-item adapt-stress';
    massageVal.textContent = 'Massage & Violet Ambient Light On';
    massageInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (logState === 'LowHR' || logState === 'LowHRV') {
    massageItem.className = 'adapt-item adapt-stress';
    massageVal.textContent = 'Warm Amber Ambient Light On';
    massageInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (isImpaired) {
    massageItem.className = 'adapt-item adapt-active';
    massageVal.textContent = 'Fatigue Vibration Alert';
    massageInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    massageItem.className = 'adapt-item adapt-active';
    massageVal.textContent = 'Gentle Seat Pulse — Stay Alert';
    massageInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (state.visibility === 'rain' || state.visibility === 'severe') {
    massageItem.className = 'adapt-item adapt-stress';
    massageVal.textContent = '🔥 Seat Heating Activated';
    massageInd.className = 'adapt-indicator adapt-ind-stress';
  } else {
    massageItem.className = 'adapt-item';
    massageVal.textContent = '—';
    massageInd.className = 'adapt-indicator';
  }

  // ── Climate Control ──────────────────────────────────────────────────────
  const tempVal = document.getElementById('adapt-temp-val');
  const tempInd = document.getElementById('adapt-temp-ind');

  if (isCritical) {
    tempVal.textContent = '18°C Alert Mode';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (logState === 'HighHR') {
    tempVal.textContent = '19°C Cooling — High HR Mode';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (logState === 'Stress') {
    tempVal.textContent = '20°C Cooling (Stress Relief)';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (logState === 'LowHR') {
    tempVal.textContent = '23°C Warm — Low HR Support';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (logState === 'LowHRV') {
    tempVal.textContent = '21°C Comfort — HRV Recovery';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-stress';
  } else if (isImpaired) {
    tempVal.textContent = '18°C Alert Mode';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (sleepImpaired) {
    tempVal.textContent = '26°C — Increasing Cabin Temperature';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    tempVal.textContent = '20°C Alertness Mode';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-alert';
  } else {
    tempVal.textContent = '22°C Nominal';
    if (tempInd) tempInd.className = 'adapt-indicator adapt-ind-active';
  }

  // ── Collision Warning ────────────────────────────────────────────────────
  const collisionVal = document.getElementById('adapt-collision-val');
  const collisionInd = document.getElementById('adapt-collision-ind');
  if (isCritical) {
    collisionVal.textContent = 'MAXIMUM — Pre-Brake Active';
    collisionInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (isImpaired || sleepImpaired || logState === 'LowHR' || logState === 'LowHRV' || logState === 'HighHR') {
    collisionVal.textContent = 'High Alert +2s Early';
    collisionInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'Stress' || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    collisionVal.textContent = 'Enhanced +1s Early';
    collisionInd.className = 'adapt-indicator adapt-ind-alert';
  } else {
    collisionVal.textContent = 'Standard';
    collisionInd.className = 'adapt-indicator adapt-ind-active';
  }

  // ── Lane Keep Assist ─────────────────────────────────────────────────────
  const lkaVal = document.getElementById('adapt-lka-val');
  const lkaInd = document.getElementById('adapt-lka-ind');
  if (isCritical) {
    lkaVal.textContent = 'AUTO STEER — Pull Over Mode';
    lkaInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (isImpaired || sleepImpaired || logState === 'LowHR' || logState === 'LowHRV') {
    lkaVal.textContent = 'Aggressive Correction';
    lkaInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'HighHR' || logState === 'Stress' || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    lkaVal.textContent = 'Enhanced Correction';
    lkaInd.className = 'adapt-indicator adapt-ind-alert';
  } else {
    lkaVal.textContent = 'Active';
    lkaInd.className = 'adapt-indicator adapt-ind-active';
  }

  // ── Alert Aggressiveness ─────────────────────────────────────────────────
  const alertVal = document.getElementById('adapt-alert-val');
  const alertInd = document.getElementById('adapt-alert-ind');
  if (isCritical) {
    alertVal.textContent = 'MAX — Continuous SOS';
    alertInd.className = 'adapt-indicator adapt-ind-critical';
  } else if (isImpaired || sleepImpaired || logState === 'LowHR' || logState === 'LowHRV') {
    alertVal.textContent = 'High — Haptic + Audio';
    alertInd.className = 'adapt-indicator adapt-ind-alert';
  } else if (isReduced || logState === 'HighHR' || logState === 'Stress' || logState === 'Reduced_yawn' || logState === 'Reduced_perclos') {
    alertVal.textContent = 'Medium — Audio Only';
    alertInd.className = 'adapt-indicator adapt-ind-alert';
  } else {
    alertVal.textContent = 'Normal';
    alertInd.className = 'adapt-indicator adapt-ind-active';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER FILL SYNC
// ─────────────────────────────────────────────────────────────────────────────
function updateSliderFills() {
  [
    { id: 'hr', min: 0, max: 200 }, { id: 'hrv', min: 0, max: 100 },
    { id: 'sleep', min: 0, max: 100 }, { id: 'perclos', min: 0, max: 100 },
    { id: 'blink', min: 0, max: 50 }, { id: 'yawn', min: 0, max: 15 },
  ].forEach(({ id, min, max }) => {
    const slider = document.getElementById(`${id}-slider`);
    const fill   = document.getElementById(`${id}-track-fill`);
    if (!slider || !fill) return;
    fill.style.width = ((slider.value - min) / (max - min) * 100) + '%';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER / NUMBER SYNC
// ─────────────────────────────────────────────────────────────────────────────
function syncSlider(key, val) {
  const s = document.getElementById(`${key}-slider`);
  const n = document.getElementById(`${key}-num`);
  if (s && n) {
    const clamped = Math.max(parseFloat(s.min), Math.min(parseFloat(s.max), parseFloat(val) || 0));
    s.value = clamped; n.value = clamped;
  }
  recalculate();
}

function syncNum(key, val) {
  const n = document.getElementById(`${key}-num`);
  if (n) n.value = val;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA — getUserMedia webcam integration
// ─────────────────────────────────────────────────────────────────────────────
let _webcamStream = null;

async function startWebcam() {
  const video = document.getElementById('cam-video');
  if (!video) return;

  // If already streaming, skip
  if (_webcamStream && video.srcObject) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    _webcamStream   = stream;
    video.srcObject = stream;
    // Let the browser start playback naturally — calling video.play() manually
    // throws a DOMException when autoplay policy blocks it.
    video.onloadedmetadata = () => {
      video.play().catch(() => {}); // soft-fail; autoplay policy may block
    };
    setCameraUIState(true);
    if (typeof startFaceTracking === 'function') startFaceTracking();
  } catch (err) {
    console.warn('[AURA] Webcam:', err.name, err.message);
    setCameraUIState(false);
    // Show a helpful message in the offline placeholder
    const offlineMsg = document.getElementById('cam-offline-msg');
    if (offlineMsg) {
      const sub = offlineMsg.querySelector('.cam-offline-sub');
      if (sub) {
        if (err.name === 'NotAllowedError') {
          sub.textContent = 'Camera permission denied — allow in browser settings';
        } else if (err.name === 'NotFoundError') {
          sub.textContent = 'No camera detected';
        } else {
          sub.textContent = err.message || 'Camera unavailable';
        }
      }
    }
  }
}

function stopWebcam() {
  const video = document.getElementById('cam-video');
  if (typeof stopFaceTracking === 'function') stopFaceTracking();
  if (_webcamStream) {
    _webcamStream.getTracks().forEach(t => t.stop());
    _webcamStream = null;
  }
  if (video) { video.srcObject = null; }
  setCameraUIState(false);
}

function setCameraUIState(isLive) {
  const liveBadge     = document.getElementById('cam-live-badge');
  const offlineMsg    = document.getElementById('cam-offline-msg');
  const manualOverride = document.getElementById('manual-override');
  const viewport      = document.getElementById('camera-viewport');
  const toggleLabel   = document.querySelector('.toggle-label');
  const toggleChk     = document.getElementById('camera-toggle');

  state.cameraOn = isLive;
  if (toggleChk) toggleChk.checked = isLive;

  if (isLive) {
    liveBadge?.classList.remove('hidden');
    offlineMsg?.classList.add('hidden');
    manualOverride?.classList.add('hidden');
    if (toggleLabel) { toggleLabel.textContent = 'LIVE'; toggleLabel.style.color = 'var(--state-optimal)'; }
    if (viewport) viewport.style.opacity = '1';
  } else {
    liveBadge?.classList.add('hidden');
    offlineMsg?.classList.remove('hidden');
    manualOverride?.classList.remove('hidden');
    if (toggleLabel) { toggleLabel.textContent = 'OFF'; toggleLabel.style.color = '#ff7043'; }
    if (viewport) viewport.style.opacity = '0.6';
  }
}

function handleCameraToggle(checkbox) {
  if (checkbox.checked) {
    startWebcam();
  } else {
    stopWebcam();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CAMERA METRICS POLLING  (polls Python tracker at localhost:5050/metrics)
// ─────────────────────────────────────────────────────────────────────────────
const CAM_METRICS_URL = 'http://127.0.0.1:5050/metrics';
const CAM_POLL_MS     = 500;
let   camConnected    = false;

/** Map a risk coefficient Rᵢ (0.1–0.9) to a CSS colour string. */
function riskColorFromRi(ri) {
  if (ri <= 0.1) return '#00e676';
  if (ri <= 0.3) return '#69f0ae';
  if (ri <= 0.5) return '#ffca28';
  if (ri <= 0.7) return '#ff7043';
  return '#ff2d55';
}

/** Update one metric tile (value text + risk bar + colour). */
function updateClmTile(valueId, barId, displayText, riskRatio, riColor) {
  const valEl = document.getElementById(valueId);
  const barEl = document.getElementById(barId);
  if (valEl) { valEl.textContent = displayText; valEl.style.color = riColor; }
  if (barEl) { barEl.style.width = (riskRatio * 100) + '%'; barEl.style.background = riColor; }
}

/** Set connection status dot + label. */
function setClmStatus(connected, label) {
  const dot  = document.getElementById('clm-dot');
  const text = document.getElementById('clm-status-text');
  if (!dot || !text) return;
  dot.className    = 'clm-dot ' + (connected ? 'live' : 'error');
  text.textContent = label;
}

/** Push a value into a biometric slider + number input. */
function pushToSlider(key, value) {
  const slider = document.getElementById(`${key}-slider`);
  const numEl  = document.getElementById(`${key}-num`);
  if (!slider || !numEl) return;
  const clamped = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), value));
  slider.value = clamped;
  numEl.value  = clamped;
}

async function pollCameraMetrics() {
  try {
    const res  = await fetch(CAM_METRICS_URL, { signal: AbortSignal.timeout(400) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!camConnected) { camConnected = true; setClmStatus(true, 'Live'); }

    const rs = data.risk_scores || {};

    // Blink Frequency
    const blinkFreq = data.blink_frequency ?? 0;
    const blinkRi   = rs.blink ?? 0.9;
    updateClmTile('clm-blink', 'clm-blink-bar', blinkFreq.toFixed(1), blinkRi, riskColorFromRi(blinkRi));

    // PERCLOS (eye aspect ratio / % eye closure)
    const perclosPct = data.perclos_pct ?? 0;
    const perclosRi  = rs.perclos ?? 0.1;
    updateClmTile('clm-ear', 'clm-ear-bar', perclosPct.toFixed(1) + '%', perclosPct / 100, riskColorFromRi(perclosRi));

    // Yawn Count
    const yawnCount = data.yawn_frequency ?? 0;
    const yawnRi    = rs.yawn ?? 0.1;
    updateClmTile('clm-yawn', 'clm-yawn-bar', yawnCount.toFixed(0), yawnRi, riskColorFromRi(yawnRi));

    // Push live values into biometric sliders → feeds DRI recalculation
    pushToSlider('perclos', perclosPct);
    pushToSlider('blink',   Math.min(50, blinkFreq));
    pushToSlider('yawn',    Math.min(15, yawnCount));
    updateSliderFills();
    recalculate();

  } catch (_) {
    if (camConnected) {
      camConnected = false;
      setClmStatus(false, 'Offline — run aura_camera_tracker.py');
      ['clm-blink', 'clm-ear', 'clm-yawn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '—'; el.style.color = ''; }
      });
      ['clm-blink-bar', 'clm-ear-bar', 'clm-yawn-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.width = '0%'; }
      });
    }
  }
}

function startCameraPolling() {
  setClmStatus(false, 'Connecting…');
  pollCameraMetrics();
  setInterval(pollCameraMetrics, CAM_POLL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET DRIVER STATES
// ─────────────────────────────────────────────────────────────────────────────
// sleep values use Apple Watch Sleep Quality Score (0–100)
// Excellent ≥75, Good ≥75, Fair ≥50, Poor ≥25, Very Poor ≥10, Critical <10
const PRESETS = {
  calm:     { hr: 60,  hrv: 60, sleep: 85,  perclos: 5,  blink: 15, yawn: 1,  visibility: 'clear',  traffic: 'low' },
  tired:    { hr: 65,  hrv: 30, sleep: 45,  perclos: 44, blink: 16, yawn: 5,  visibility: 'clear',  traffic: 'low' },
  sleepy:   { hr: 65,  hrv: 32, sleep: 30,  perclos: 30, blink: 27, yawn: 7,  visibility: 'night',  traffic: 'low' },
  stress:   { hr: 90,  hrv: 22, sleep: 48,  perclos: 10, blink: 25, yawn: 0,  visibility: 'haze',   traffic: 'heavy' },
  critical: { hr: 100, hrv: 10, sleep: 8,   perclos: 50, blink: 40, yawn: 12, visibility: 'severe', traffic: 'gridlock' },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`preset-${name}`);
  if (btn) btn.classList.add('active');
  const setVal = (key, val) => {
    const s = document.getElementById(`${key}-slider`);
    const n = document.getElementById(`${key}-num`);
    if (s) s.value = val; if (n) n.value = val;
  };
  setVal('hr', p.hr); setVal('hrv', p.hrv); setVal('sleep', p.sleep);
  setVal('perclos', p.perclos); setVal('blink', p.blink); setVal('yawn', p.yawn);
  setVisibility(p.visibility); setTraffic(p.traffic);
  state.activePreset = name;
  recalculate();
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT SELECTORS
// ─────────────────────────────────────────────────────────────────────────────
function setVisibility(val) {
  state.visibility = val;
  document.querySelectorAll('[id^="vis-opt-"]').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  recalculate();
}

function setTraffic(val) {
  state.traffic = val;
  document.querySelectorAll('[id^="traf-opt-"]').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  recalculate();
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
function triggerEmergency(reason) {
  // If fatigue warning was showing, dismiss it cleanly first
  if (state.fatigueWarningActive) dismissFatigueWarning();
  state.emergencyActive = true;
  document.getElementById('emergency-overlay').classList.remove('hidden');
  const reasonEl = document.getElementById('emergency-trigger-reason');
  if (reasonEl) reasonEl.textContent = reason || '—';
  startChime();

  // Post a contextual AI log entry immediately (bypasses normal debounce)
  // Pick the pool based on which critical condition fired
  let critPool, critKey;
  if (reason && reason.includes('0 BPM — No Signal')) {
    critPool = AURA_MESSAGES.CriticalHR0;  critKey = 'CriticalHR0';
  } else if (reason && reason.includes('Bradycardia')) {
    critPool = AURA_MESSAGES.CriticalHRLow; critKey = 'CriticalHRLow';
  } else if (reason && reason.includes('HRV = 0')) {
    critPool = AURA_MESSAGES.CriticalHRV0;  critKey = 'CriticalHRV0';
  } else {
    critPool = AURA_MESSAGES.Critical;      critKey = 'Critical';
  }
  _auraPostMessage(critPool, critKey);
  _auraLogLastState = critKey; // prevent the normal log from overwriting immediately
}

function dismissEmergency() {
  state.emergencyActive = false;
  state.emergencyAcknowledged = true; // prevent immediate re-trigger while readings still critical
  document.getElementById('emergency-overlay').classList.add('hidden');
  stopChime();
}

// ─────────────────────────────────────────────────────────────────────────────
// FATIGUE WARNING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
function triggerFatigueWarning() {
  state.fatigueWarningActive = true;
  const overlay = document.getElementById('fatigue-overlay');
  if (overlay) overlay.classList.remove('hidden');
  startFatigueChime();
}

function dismissFatigueWarning() {
  state.fatigueWarningActive = false;
  state.fatigueAcknowledged = true; // prevent immediate re-trigger while readings still elevated
  const overlay = document.getElementById('fatigue-overlay');
  if (overlay) overlay.classList.add('hidden');
  stopFatigueChime();
}

// Vibraphone-style fatigue chime — same physical model as the emergency chime
// but significantly softer and calmer:
//   • Master gain capped at 0.18 (vs 0.30–0.75 for emergency)
//   • No volume escalation across repeats
//   • Shorter 4-beat phrase with a longer silence gap (every 6 s)
//   • Identical signal chain: vibraphone partials → lowpass → plate reverb → limiter
function startFatigueChime() {
  stopFatigueChime();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    state.fatigueChimeAudioCtx = ctx;

    // ── Master gain (softer than emergency: 0.18 peak vs 0.30) ───────────
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
    masterGain.connect(ctx.destination);
    state.fatigueChimeGainNode = masterGain;

    // ── Limiter ───────────────────────────────────────────────────────────
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 2;
    limiter.ratio.value = 12;
    limiter.attack.value  = 0.001;
    limiter.release.value = 0.15;
    limiter.connect(masterGain);

    // ── Plate reverb (same topology as emergency) ─────────────────────────
    const wet = ctx.createGain(); wet.gain.value = 0.30;
    const dry = ctx.createGain(); dry.gain.value = 0.70;
    wet.connect(limiter); dry.connect(limiter);
    const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass'; ap1.frequency.value = 340;
    const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = 980;
    const d1 = ctx.createDelay(0.2); d1.delayTime.value = 0.031;
    const d2 = ctx.createDelay(0.2); d2.delayTime.value = 0.047;
    const f1 = ctx.createGain(); f1.gain.value = 0.18;
    const f2 = ctx.createGain(); f2.gain.value = 0.16;
    const reverbInput = ctx.createGain();
    reverbInput.connect(ap1); ap1.connect(d1); d1.connect(f1); f1.connect(d1);
    reverbInput.connect(ap2); ap2.connect(d2); d2.connect(f2); f2.connect(d2);
    d1.connect(wet); d2.connect(wet);
    reverbInput.connect(dry);

    // ── 7.2 kHz warmth filter ─────────────────────────────────────────────
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass'; warmth.frequency.value = 7200; warmth.Q.value = 0.5;
    warmth.connect(reverbInput);

    // ── Same 4-partial vibraphone model as emergency chime ────────────────
    const VIBE_PARTIALS = [
      [1.000, 1.00, 2.40],
      [3.756, 0.16, 0.19],
      [9.160, 0.04, 0.038],
      [2.010, 0.09, 1.75],
    ];
    const PEAK = 0.18; // fixed — no escalation

    function strikeNote(freq, t) {
      VIBE_PARTIALS.forEach(([ratio, relGain, decay]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * ratio, t);
        const atk = 0.004;
        const s1  = t + atk + Math.min(0.06, decay * 0.25);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(PEAK * relGain, t + atk);
        env.gain.setValueAtTime(PEAK * relGain, s1);
        env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        osc.connect(env); env.connect(warmth);
        osc.start(t); osc.stop(t + decay + 0.05);
      });
    }

    function strikeBeat(t) {
      strikeNote(440.00, t);          // A4 root
      strikeNote(659.25, t, 0.78);    // E5 fifth
    }

    // 4-beat phrase: DENG · DENG · DENG DENG (shorter & calmer than 8-beat emergency)
    const BEATS      = [0.00, 0.60, 1.20, 1.50];
    const PHRASE_LEN = 1.50 + 2.4 + 3.5; // onset + decay + silence gap

    function schedulePhrase(startT) {
      if (!state.fatigueWarningActive) return;
      BEATS.forEach(offset => strikeBeat(startT + offset));
      const nextStart = startT + PHRASE_LEN;
      const delayMs   = Math.max(0, (nextStart - ctx.currentTime) * 1000 - 25);
      state.fatigueChimeInterval = setTimeout(() => schedulePhrase(nextStart), delayMs);
    }

    schedulePhrase(ctx.currentTime + 0.12);

  } catch (e) {
    console.warn('[AURA] Fatigue chime unavailable:', e);
  }
}

function stopFatigueChime() {
  if (state.fatigueChimeInterval) {
    clearTimeout(state.fatigueChimeInterval);
    clearInterval(state.fatigueChimeInterval);
    state.fatigueChimeInterval = null;
  }
  if (state.fatigueChimeAudioCtx) {
    if (state.fatigueChimeGainNode) {
      try {
        state.fatigueChimeGainNode.gain.linearRampToValueAtTime(
          0, state.fatigueChimeAudioCtx.currentTime + 0.6
        );
      } catch (_) {}
    }
    setTimeout(() => {
      try { if (state.fatigueChimeAudioCtx) state.fatigueChimeAudioCtx.close(); } catch (_) {}
      state.fatigueChimeAudioCtx = null;
      state.fatigueChimeGainNode = null;
    }, 680);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO CHIME — Acoustic Vibraphone / Synthetic Rhodes Alert
//
// Inspired by high-end automotive alert design (Mercedes S-Class, Lexus, etc.)
// Every beat strikes a perfect fifth chord: A4 (440 Hz) + E5 (659.25 Hz)
//
// Each note uses a 4-partial vibraphone physical model (sine waves only):
//   ① Fundamental  1.000×  — warm resonant body,        decay 2.4 s
//   ② Inharmonic   3.756×  — marimba/vibe "thud",       decay 0.19 s
//   ③ Transient    9.160×  — crisp attack articulation,  decay 0.04 s
//   ④ Shimmer      2.010×  — Rhodes-like detuned octave, decay 1.75 s
//
// Rhythm: DENG · DENG · DENG DENG · DENG · DENG · DENG · DENG
//         0.00   0.55   1.10  1.38   1.95   2.52   3.09   3.66 s
//
// Signal chain: sine oscillators → 7.2 kHz lowpass warmth filter
//               → parallel allpass plate reverb → transparent limiter → master
// ─────────────────────────────────────────────────────────────────────────────
function startChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    state.chimeAudioCtx = ctx;

    // ── Master gain ────────────────────────────────────────────────────────
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.30, ctx.currentTime + 0.08);
    masterGain.connect(ctx.destination);
    state.chimeGainNode = masterGain;

    // ── Transparent brick-wall limiter ─────────────────────────────────────
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 1;
    limiter.ratio.value = 20;
    limiter.attack.value  = 0.0005;
    limiter.release.value = 0.10;
    limiter.connect(masterGain);

    // ── Wet/dry plate reverb (parallel allpass + comb network) ────────────
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    const dry = ctx.createGain(); dry.gain.value = 0.72;
    wet.connect(limiter);
    dry.connect(limiter);

    // Two allpass stages colour the reverb tail
    const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass'; ap1.frequency.value = 340;
    const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = 980;
    // Two comb delay lines create density
    const d1 = ctx.createDelay(0.2); d1.delayTime.value = 0.031;
    const d2 = ctx.createDelay(0.2); d2.delayTime.value = 0.047;
    const f1 = ctx.createGain(); f1.gain.value = 0.18;
    const f2 = ctx.createGain(); f2.gain.value = 0.16;
    // Route: reverbInput → ap1 → d1 (with feedback) → wet
    const reverbInput = ctx.createGain();
    reverbInput.connect(ap1); ap1.connect(d1); d1.connect(f1); f1.connect(d1);
    reverbInput.connect(ap2); ap2.connect(d2); d2.connect(f2); f2.connect(d2);
    d1.connect(wet); d2.connect(wet);
    reverbInput.connect(dry);

    // ── 7.2 kHz lowpass warmth filter — removes all digital harshness ──────
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 7200;
    warmth.Q.value = 0.5;
    warmth.connect(reverbInput);

    // ── Vibraphone physical model: single note strike ──────────────────────
    // Partials: [ratio, relative gain, decay seconds]
    const VIBE_PARTIALS = [
      [1.000, 1.00, 2.40],  // ① Fundamental      — warm body
      [3.756, 0.16, 0.19],  // ② Inharmonic 4th   — marimba thud
      [9.160, 0.04, 0.038], // ③ High transient    — attack click
      [2.010, 0.09, 1.75],  // ④ Detuned octave   — Rhodes shimmer
    ];

    function strikeNote(freq, t, peakGain) {
      VIBE_PARTIALS.forEach(([ratio, relGain, decay]) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine'; // ← pure sine only; no buzz, no harshness
        osc.frequency.setValueAtTime(freq * ratio, t);

        // Two-stage decay: fast transient peak → slow resonant ring-out
        const atk = 0.004;
        const s1  = t + atk + Math.min(0.06, decay * 0.25);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(peakGain * relGain, t + atk);
        env.gain.setValueAtTime(peakGain * relGain, s1);
        env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(env);
        env.connect(warmth);
        osc.start(t);
        osc.stop(t + decay + 0.05);
      });
    }

    // ── Chord voicing per beat: A4 (440 Hz) + E5 (659.25 Hz) ─────────────
    // Perfect fifth = rich, full, instantly readable as "premium alert"
    function strikeBeat(t, gain) {
      strikeNote(440.00, t, gain);         // A4 root
      strikeNote(659.25, t, gain * 0.78);  // E5 fifth — slightly quieter for balance
    }

    // ── Rhythm map — deng deng deng-deng deng deng deng deng ──────────────
    const BEATS      = [0.00, 0.55, 1.10, 1.38, 1.95, 2.52, 3.09, 3.66];
    const PHRASE_LEN = 3.66 + 2.4 + 2.2; // last onset + decay room + silence gap

    let phraseCount = 0;

    function schedulePhrase(startT) {
      if (!state.emergencyActive) return;

      // Gently louder each repeat — authoritative escalation, never frantic
      const peakGain = Math.min(0.75, 0.36 + phraseCount * 0.13);
      masterGain.gain.linearRampToValueAtTime(peakGain, startT + 0.12);

      BEATS.forEach(offset => strikeBeat(startT + offset, peakGain));
      phraseCount++;

      const nextStart = startT + PHRASE_LEN;
      const delayMs   = Math.max(0, (nextStart - ctx.currentTime) * 1000 - 25);
      state.chimeInterval = setTimeout(() => schedulePhrase(nextStart), delayMs);
    }

    // 120 ms breath before first strike — feels purposeful, not startling
    schedulePhrase(ctx.currentTime + 0.12);

  } catch (e) {
    console.warn('Web Audio API unavailable:', e);
  }
}

function stopChime() {
  if (state.chimeInterval) {
    clearTimeout(state.chimeInterval);
    clearInterval(state.chimeInterval);
    state.chimeInterval = null;
  }
  if (state.chimeOsc) {
    try { state.chimeOsc.stop(); } catch (_) {}
    state.chimeOsc = null;
  }
  if (state.chimeAudioCtx) {
    // Graceful 600 ms fade — never cuts mid-resonance
    if (state.chimeGainNode) {
      try {
        state.chimeGainNode.gain.linearRampToValueAtTime(
          0, state.chimeAudioCtx.currentTime + 0.6
        );
      } catch (_) {}
    }
    setTimeout(() => {
      try { if (state.chimeAudioCtx) state.chimeAudioCtx.close(); } catch (_) {}
      state.chimeAudioCtx = null;
      state.chimeGainNode = null;
    }, 680);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CLOCK
// ─────────────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;

  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateEl = document.getElementById('live-date');
  if (dateEl) dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CAMERA FOCUS FLICKER
// ─────────────────────────────────────────────────────────────────────────────
function animateCameraReadout() {
  const focusEl = document.getElementById('cam-focus');
  if (focusEl && state.cameraOn) focusEl.textContent = (95 + Math.floor(Math.random() * 5)) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// ECG MINI ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
function updateECG(bpm) {
  const canvas = document.getElementById('ecg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (bpm === 0) {
    ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    return;
  }

  const period = Math.max(20, 120 - bpm);
  const color  = bpm > 100 || bpm < 50 ? '#ff7043' : '#00c8ff';
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.shadowColor = color; ctx.shadowBlur = 4;
  ctx.beginPath();

  const mid = H / 2;
  let x = 0;
  ctx.moveTo(x, mid);

  while (x < W) {
    ctx.lineTo(x, mid); x += period * 0.3;
    ctx.lineTo(x, mid - H * 0.15); x += period * 0.05;
    ctx.lineTo(x, mid); x += period * 0.05;
    ctx.lineTo(x, mid + H * 0.1);  x += period * 0.02;
    ctx.lineTo(x, mid - H * 0.45); x += period * 0.02;
    ctx.lineTo(x, mid + H * 0.2);  x += period * 0.02;
    ctx.lineTo(x, mid); x += period * 0.1;
    ctx.lineTo(x, mid - H * 0.2);  x += period * 0.1;
    ctx.lineTo(x, mid); x += period * 0.15;
  }

  ctx.stroke(); ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// AURA ADAPTIVE AI RECOMMENDATION LOG
// ─────────────────────────────────────────────────────────────────────────────
let _auraLogLastState  = null;
let _auraLogDebounce   = null;

// Message templates keyed by DRI state × special conditions
const AURA_MESSAGES = {
  Optimal: [
    { icon: '🟢', cls: 'aura-msg-optimal',
      text: 'Optimal driving conditions detected. All biometric markers are within healthy range. <em>Enjoy your journey, Khye Vern.</em>' },
    { icon: '🟢', cls: 'aura-msg-optimal',
      text: 'Heart rate and HRV readings are stable. Lane Keep Assist is in standard mode. <em>You\'re in full control.</em>' },
  ],
  Acceptable: [
    { icon: '🟢', cls: 'aura-msg-acceptable',
      text: 'Readiness is good. Minor fluctuations in HRV detected — <strong>no intervention required</strong>. Maintaining ambient comfort at nominal.' },
    { icon: '🟢', cls: 'aura-msg-acceptable',
      text: 'Driving performance is within acceptable thresholds. Monitoring continues at standard sensitivity.' },
  ],
  Reduced_yawn: [
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: '<strong>Frequent yawning detected.</strong> Increasing cabin airflow sensitivity and <em>suggesting a rest stop in 5 kilometres</em>. Collision warning escalated to High Alert +2s early.' },
  ],
  Reduced_perclos: [
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: '<strong>Elevated eye-closure ratio detected (PERCLOS elevated).</strong> Adjusting seat angle for posture support. Consider a short rest — next service area: 3.2 km.' },
  ],
  Reduced: [
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: 'Readiness index is <strong>reducing</strong>. Subtle fatigue indicators present. Climate adjusted to 20°C for alertness. Continue monitoring.' },
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: 'Mild drowsiness pattern detected. <em>Haptic seat pulse initiated.</em> Recommend a 10-minute break at next opportunity.' },
  ],
  Stress: [
    { icon: '🟣', cls: 'aura-msg-stress',
      text: '<strong>Elevated heart rate and reduced HRV detected.</strong> Initiating calm violet ambient lighting. Massage feature activated. <em>Breathe steadily, Khye Vern.</em>' },
    { icon: '🟣', cls: 'aura-msg-stress',
      text: 'Stress biomarkers rising — HR above threshold, HRV suppressed. <strong>Soothing audio mode engaged.</strong> Cabin temperature lowered to 20°C.' },
  ],
  Impaired: [
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: '<strong>Impaired readiness detected.</strong> Activating aggressive Lane Keep Assist and raising collision warning to High Alert (+2s). <em>Please consider stopping safely.</em>' },
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: 'Multiple fatigue signals confirmed. Haptic + audio alerts engaged. AURA is <strong>pre-positioning brakes</strong> for enhanced reaction coverage.' },
  ],
  Critical: [
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: Driver unresponsive.</strong> AUTO STEER — Pull Over Mode engaged. Emergency services notification broadcast. <em>Vehicle is braking safely.</em>' },
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>Critical fatigue threshold exceeded.</strong> All safety systems at MAXIMUM. SOS signal broadcasting. Initiating controlled stop sequence.' },
  ],
  CriticalHR0: [
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: Heart rate signal lost (0 BPM).</strong> No cardiac signal detected from wearable sensor. Mercedes Emergency Call System activated. <em>Active Brake Assist armed — vehicle preparing controlled stop.</em>' },
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: Cardiac monitoring failure.</strong> Heart rate reading dropped to zero — possible sensor detachment or medical emergency. SOS broadcast initiated. <em>Hazard lights activated. Emergency services alerted.</em>' },
  ],
  CriticalHRLow: [
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: Dangerous Bradycardia detected.</strong> Heart rate has fallen below 20 BPM — severe cardiac event possible. Mercedes Emergency Call System activated. <em>Lane Keep Assist in AUTO STEER pull-over mode. SOS broadcasting.</em>' },
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: Extremely low heart rate.</strong> HR below safe operating threshold. All vehicle safety systems escalated to MAXIMUM. <em>Emergency services notified. Vehicle executing controlled stop sequence.</em>' },
  ],
  CriticalHRV0: [
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: HRV signal lost (0 ms).</strong> Heart Rate Variability dropped to zero — potential cardiac arrest or sensor failure. Mercedes Emergency Call System activated. <em>Active Brake Assist armed. Hazard lights on.</em>' },
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL: No HRV signal detected.</strong> Autonomic cardiac regulation appears absent. Escalating all safety interventions to maximum level. <em>SOS signal broadcasting. Emergency services alerted.</em>' },
  ],
  LowHR: [
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: '<strong>Abnormally low heart rate detected.</strong> HR is below 50 BPM — potential bradycardia. Monitoring closely. <em>Please ensure you are feeling well, Khye Vern.</em>' },
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: '<strong>Abnormally low heart rate detected.</strong> Resting HR is unusually low. If dizziness or fatigue is felt, <em>consider stopping safely at the nearest opportunity.</em>' },
  ],
  HighHR: [
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: '<strong>High heart rate detected.</strong> HR has exceeded 100 BPM — possible tachycardia or elevated stress response. <em>Calm music and cooling airflow activated, Khye Vern.</em>' },
    { icon: '🟠', cls: 'aura-msg-impaired',
      text: '<strong>High heart rate detected.</strong> Sustained elevated HR above 100 BPM. Cabin environment adjusted. <em>If discomfort persists, please consider stopping safely.</em>' },
  ],
  LowHRV: [
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: '<strong>Abnormal HRV detected.</strong> Heart Rate Variability is critically suppressed (1–14 ms range), indicating high physiological stress or fatigue. <em>Cabin environment adjusted for recovery.</em>' },
    { icon: '🟡', cls: 'aura-msg-reduced',
      text: '<strong>Abnormal HRV detected.</strong> Very low HRV suggests autonomic imbalance. Calm music and climate optimisation engaged. <em>Please consider a short rest, Khye Vern.</em>' },
  ],
  CriticalFatigue: [
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>CRITICAL STATE DETECTED.</strong> Multiple systems activated: — <strong>Music:</strong> Alert tone playing — <strong>Seat:</strong> Fatigue vibration alert engaged — <strong>Climate:</strong> Cabin cooled to 18°C (alert mode) — <strong>Collision Warning:</strong> MAXIMUM, pre-brake armed — <strong>Lane Keep:</strong> AUTO STEER pull-over mode active — <strong>SOS:</strong> Continuous broadcast initiated. <em>Please respond or the vehicle will pull over safely.</em>' },
    { icon: '🔴', cls: 'aura-msg-critical',
      text: '<strong>All AURA safety systems escalated to MAXIMUM.</strong> Biometrics confirm severe impairment — HR: elevated, HRV: critically suppressed, PERCLOS: high, Sleep quality: critical. <strong>Seat vibration + alert tone active. Climate at 18°C.</strong> Lane Keep Assist steering vehicle toward hard shoulder. <em>SOS signal broadcasting to emergency services.</em>' },
  ],
};

// Detect stress state: high HR + low HRV + low PERCLOS (wide-eyed but stressed)
function _isStressState(r) {
  return r.hr > 80 && r.hr <= 100 && r.hrv < 30 && r.perclos < 20;
}

// Detect abnormally low HR: below 50 BPM but above the critical 20 BPM threshold
function _isLowHRState(r) {
  return r.hr > 0 && r.hr < 50 && r.hr >= 20;
}

// Detect high HR: above 100 BPM
function _isHighHRState(r) {
  return r.hr > 100;
}

// Detect abnormal HRV: between 1 and 14 ms (critically suppressed)
function _isLowHRVState(r) {
  return r.hrv >= 1 && r.hrv <= 14;
}

// Detect critical fatigue: DRI is in Critical band AND at least two fatigue signals are severe.
// This takes highest routing priority so it overrides LowHRV, HighHR, etc.
function _isCriticalFatigueState(cssState, r) {
  if (cssState !== 'Critical') return false;
  // Count how many fatigue signals are in the danger zone
  const signals = [
    r.hrv <= 20,          // suppressed HRV
    r.perclos >= 40,     // high eye closure
    r.sleep <= 25,       // poor or critical sleep
    r.yawn >= 6,         // frequent yawning
    r.blink > 25,        // abnormally high blink
  ];
  return signals.filter(Boolean).length >= 2;
}

// Pick which message pool to draw from
function _auraPickPool(cssState, r) {
  if (_isCriticalFatigueState(cssState, r)) return AURA_MESSAGES.CriticalFatigue;
  if (_isLowHRState(r))  return AURA_MESSAGES.LowHR;
  if (_isHighHRState(r)) return AURA_MESSAGES.HighHR;
  if (_isLowHRVState(r)) return AURA_MESSAGES.LowHRV;
  if (_isStressState(r)) return AURA_MESSAGES.Stress;
  if (cssState === 'Reduced') {
    if (r.yawn >= 4) return AURA_MESSAGES.Reduced_yawn;
    if (r.perclos >= 20) return AURA_MESSAGES.Reduced_perclos;
    return AURA_MESSAGES.Reduced;
  }
  return AURA_MESSAGES[cssState] || AURA_MESSAGES.Optimal;
}

function _auraCompositeKey(cssState, r) {
  if (_isCriticalFatigueState(cssState, r)) return 'CriticalFatigue';
  if (_isLowHRState(r))  return 'LowHR';
  if (_isHighHRState(r)) return 'HighHR';
  if (_isLowHRVState(r)) return 'LowHRV';
  if (_isStressState(r)) return 'Stress';
  if (cssState === 'Reduced' && r.yawn >= 4) return 'Reduced_yawn';
  if (cssState === 'Reduced' && r.perclos >= 20) return 'Reduced_perclos';
  return cssState;
}

let _auraPoolIdx = {};  // track last-used index per pool to avoid repeats

function _auraPostMessage(pool, stateKey) {
  const body = document.getElementById('aura-log-body');
  if (!body) return;

  // Pick next message (round-robin, no immediate repeat)
  const idx = ((_auraPoolIdx[stateKey] ?? -1) + 1) % pool.length;
  _auraPoolIdx[stateKey] = idx;
  const { icon, cls, text } = pool[idx];

  // Timestamp
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // Build message element
  const el = document.createElement('div');
  el.className = `aura-log-msg ${cls}`;
  el.innerHTML = `
    <span class="aura-msg-icon">${icon}</span>
    <span class="aura-msg-text"><strong>AURA:</strong> ${text}</span>
    <span class="aura-msg-time">${ts}</span>
  `;

  // Prepend so newest is on top, keep max 3 messages
  body.insertBefore(el, body.firstChild);
  while (body.children.length > 3) body.removeChild(body.lastChild);

  // Update cursor label
  const cursor = document.getElementById('aura-cursor-label');
  if (cursor) cursor.textContent = 'Last analysed · ' + ts;
}

function updateAuraLog(cssState, r) {
  const key = _auraCompositeKey(cssState, r);

  // Debounce: only post when state actually changes, with 1.5s settle time
  if (key === _auraLogLastState) return;
  clearTimeout(_auraLogDebounce);
  _auraLogDebounce = setTimeout(() => {
    _auraLogLastState = key;
    const pool = _auraPickPool(cssState, r);
    _auraPostMessage(pool, key);
  }, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAUGE TICK MARKS
// ─────────────────────────────────────────────────────────────────────────────
function drawGaugeTicks() {
  const g = document.getElementById('gauge-ticks');
  if (!g) return;
  g.innerHTML = '';
  const cx = 120, cy = 120, r = 100;
  for (let i = 0; i <= 10; i++) {
    const angle = (-90 + (i * 36)) * (Math.PI / 180);
    const x1 = cx + (r - 12) * Math.cos(angle), y1 = cy + (r - 12) * Math.sin(angle);
    const x2 = cx + (r -  6) * Math.cos(angle), y2 = cy + (r -  6) * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#2a2a40'); line.setAttribute('stroke-width', '1.5');
    g.appendChild(line);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
function init() {
  drawGaugeTicks();
  updateClock();
  recalculate();
  updateSliderFills();

  setInterval(updateClock, 1000);
  setInterval(animateCameraReadout, 2000);

  ['hr', 'hrv', 'sleep', 'perclos', 'blink', 'yawn'].forEach(key => {
    const slider = document.getElementById(`${key}-slider`);
    if (slider) {
      slider.addEventListener('input', () => {
        syncNum(key, slider.value);
        updateSliderFills();
        recalculate();
        if (state.activePreset) {
          document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
          state.activePreset = null;
        }
      });
    }
  });

  ['hr', 'hrv', 'sleep', 'perclos', 'blink', 'yawn'].forEach(key => {
    const num = document.getElementById(`${key}-num`);
    if (num) num.addEventListener('change', () => syncSlider(key, num.value));
  });

  // Start laptop webcam feed (face tracking begins automatically once video plays)
  startWebcam();
}

document.addEventListener('DOMContentLoaded', init);
