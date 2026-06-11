/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Eye, Compass, ShieldAlert, Sparkles, RefreshCw, 
  Settings, Music, VolumeX, Thermometer, User, Wifi, Cpu, 
  HelpCircle, Camera, Check, Radio, AlertTriangle, Layers, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SCENARIO_PRESETS } from './presetData';
import { ActiveState, DriveMode } from './types';
import AuraFlowChart from './components/AuraFlowChart';
import ApiDocs from './components/ApiDocs';

export default function App() {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'architecture' | 'api'>('cockpit');
  const [activeScenarioId, setActiveScenarioId] = useState<string>('normal');
  const [activeState, setActiveState] = useState<ActiveState>(SCENARIO_PRESETS[0].data);

  // States for live adjustments
  const [liveHeartRate, setLiveHeartRate] = useState<number>(72);
  const [liveHrval, setLiveHrval] = useState<number>(55);
  const [liveStress, setLiveStress] = useState<number>(25);

  // Camera mock or real states
  const [useRealWebcam, setUseRealWebcam] = useState<boolean>(false);
  const [mockPilotAction, setMockPilotAction] = useState<'normal' | 'eyes-closed' | 'yawning' | 'distracted'>('normal');
  const [cameraInitialising, setCameraInitialising] = useState<boolean>(false);
  
  // Audio playback mockup alert
  const [audioFeedbackPlaying, setAudioFeedbackPlaying] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastWebcamStateRef = useRef<string>('normal');

  // Synchronise state triggers when scenario presets are changed
  const applyPreset = (presetId: string) => {
    const found = SCENARIO_PRESETS.find(p => p.id === presetId);
    if (found) {
      setActiveScenarioId(presetId);
      setActiveState(found.data);
      setLiveHeartRate(found.data.biometrics.heartRate);
      setLiveHrval(found.data.biometrics.heartRateVariability);
      setLiveStress(found.data.biometrics.stressScore);

      // Map mock camera pilots based on prearranged scenarios
      if (presetId === 'fatigued') {
        setMockPilotAction('eyes-closed');
      } else if (presetId === 'stressed') {
        setMockPilotAction('distracted');
      } else if (presetId === 'emergency') {
        setMockPilotAction('eyes-closed');
      } else {
        setMockPilotAction('normal');
      }
    }
  };

  // Live sliders engine: trigger updates to the active states
  const handleSliderChange = (type: 'hr' | 'hrv' | 'stress', value: number) => {
    let updatedBiometrics = { ...activeState.biometrics };
    let updatedAura = { ...activeState.aura };
    let updatedCabin = { ...activeState.cabin };
    let updatedSensors = { ...activeState.sensors };
    let updatedCruise = { ...activeState.cruise };
    let updatedTelemetry = { ...activeState.telemetry };

    if (type === 'hr') {
      setLiveHeartRate(value);
      updatedBiometrics.heartRate = value;
    } else if (type === 'hrv') {
      setLiveHrval(value);
      updatedBiometrics.heartRateVariability = value;
    } else if (type === 'stress') {
      setLiveStress(value);
      updatedBiometrics.stressScore = value;
    }

    // AI Rule engine logic calculating live adaptive responses (simulating low latency)
    const effectiveHr = type === 'hr' ? value : liveHeartRate;
    const effectiveHrv = type === 'hrv' ? value : liveHrval;
    const effectiveStress = type === 'stress' ? value : liveStress;

    if (effectiveHr >= 135) {
      // Acute distress alert standard override
      updatedBiometrics.detectionStatus = 'emergency';
      updatedCabin = {
        ambientColor: '#ef4444',
        ambientIntensity: 100,
        musicPlaylist: 'ADVISORY: Cardiac Irregularity Detected. Readying emergency slow-down.',
        volumeReduction: true,
        climateComfortAdjustment: true
      };
      updatedSensors = {
        blindSpotSensitivity: 'ultra',
        collisionWarningDistance: 'very-early',
        laneAssistStrength: 'maximum',
        safetyOverrideArmed: true
      };
      updatedCruise = {
        status: 'forced',
        reason: 'CRITICAL WARNING: Driver heart rate suggests severe tachycardia. Safety override triggered.'
      };
      updatedAura = {
        primaryMessage: "CRITICAL: Urgent heart rate spikes detected. Initiating hazard lights, autonomous slow pull over, and emergency contact notice.",
        actionTaken: "Forced lane assist override with deceleration.",
        isVoiceSpoken: true,
        alertLevel: 'critical'
      };
      updatedTelemetry.speed = Math.max(12, updatedTelemetry.speed - 30);
    } else if (effectiveStress >= 75) {
      // Stressed profile adaptation trigger
      updatedBiometrics.detectionStatus = 'normal'; // default normal state otherwise
      updatedCabin = {
        ambientColor: '#10b981', // emerald calms stress
        ambientIntensity: 80,
        musicPlaylist: 'Serenity Garden Beats (Binaural Chill)',
        volumeReduction: true,
        climateComfortAdjustment: true
      };
      updatedSensors = {
        blindSpotSensitivity: 'high',
        collisionWarningDistance: 'early',
        laneAssistStrength: 'moderate',
        safetyOverrideArmed: true
      };
      updatedCruise = {
        status: 'recommended',
        reason: 'Elevated stress index linked to stop-and-go driving patterns.'
      };
      updatedAura = {
        primaryMessage: "I notice your stress indicators are elevated. Turning on peaceful emerald lighting and queuing relaxing spatial sound frequencies.",
        actionTaken: "Dampened throttle aggressiveness & muffled non-urgent cabin sounds.",
        isVoiceSpoken: true,
        alertLevel: 'low'
      };
    } else if (mockPilotAction === 'eyes-closed' || mockPilotAction === 'yawning') {
      // Fatigue profile overrides
      updatedBiometrics.detectionStatus = 'fatigued';
      updatedCabin = {
        ambientColor: '#f59e0b', // warning orange to stimulate wakefulness
        ambientIntensity: 90,
        musicPlaylist: 'Upbeat Coffeehouse Vibes',
        volumeReduction: false,
        climateComfortAdjustment: true
      };
      updatedSensors = {
        blindSpotSensitivity: 'ultra',
        collisionWarningDistance: 'very-early',
        laneAssistStrength: 'maximum',
        safetyOverrideArmed: true
      };
      updatedCruise = {
        status: 'active',
        reason: 'Lane correction feedback frequency increased due to sleep fatigue alerts.'
      };
      updatedAura = {
        primaryMessage: "Micro-sleep state or consistent yawning detected. Calibrating radar warning offsets closer, lane-keeping set to max.",
        actionTaken: "Increased blindspot gain, flashed active alert, forced ACC recommendation.",
        isVoiceSpoken: true,
        alertLevel: 'high'
      };
    } else if (mockPilotAction === 'distracted') {
      updatedBiometrics.detectionStatus = 'distracted';
      updatedSensors = {
        blindSpotSensitivity: 'high',
        collisionWarningDistance: 'early',
        laneAssistStrength: 'moderate',
        safetyOverrideArmed: true
      };
      updatedAura = {
        primaryMessage: "Attention warning: eyes diverted from traffic vector. Keep focus on the road.",
        actionTaken: "Blipped instrument warning sound.",
        isVoiceSpoken: false,
        alertLevel: 'medium'
      };
    } else {
      // Return standard active profiles
      updatedBiometrics.detectionStatus = 'normal';
      // keep active scenario defaults
      const found = SCENARIO_PRESETS.find(p => p.id === activeScenarioId);
      if (found) {
        updatedCabin = { ...found.data.cabin };
        updatedSensors = { ...found.data.sensors };
        updatedCruise = { ...found.data.cruise };
        updatedAura = { ...found.data.aura };
        updatedTelemetry = { ...found.data.telemetry };
      }
    }

    // Refresh dynamic telemetry variables
    setActiveState({
      ...activeState,
      biometrics: updatedBiometrics,
      cabin: updatedCabin,
      sensors: updatedSensors,
      cruise: updatedCruise,
      telemetry: updatedTelemetry,
      aura: updatedAura
    });
  };

  // Re-calibrates active checks when pilot behaviors or scenarios drop/raise
  useEffect(() => {
    handleSliderChange('hr', liveHeartRate);
  }, [mockPilotAction, activeScenarioId]);

  // Handle physical camera hooks
  useEffect(() => {
    if (useRealWebcam) {
      setCameraInitialising(true);
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setCameraInitialising(false);
        })
        .catch(err => {
          console.error("Camera access blocked or not supported: ", err);
          setUseRealWebcam(false);
          setCameraInitialising(false);
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [useRealWebcam]);

  // Draw animated eye tracking canvas overlays representing AURA scanner (100ms cycle)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let mouthPctFiltered = 10;
    let eyeConfidenceFiltered = 80;
    let frame = 0;

    const drawMatrix = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background camera dummy if physically inactive
      if (!useRealWebcam) {
        ctx.fillStyle = '#060a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Simulated head drawing wireframe
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(120, 90, 45, 60, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(120, 30);
        ctx.lineTo(120, 150);
        ctx.moveTo(75, 90);
        ctx.lineTo(165, 90);
        ctx.stroke();

        // Eye state logic models
        const eyesClosed = mockPilotAction === 'eyes-closed';
        const distracted = mockPilotAction === 'distracted';
        const yawning = mockPilotAction === 'yawning';

        // Set eye colors
        let indicatorColor = '#06b6d4'; // cyan
        if (eyesClosed) indicatorColor = '#f59e0b'; // amber warning
        if (distracted) indicatorColor = '#a855f7'; // purple distracted
        if (yawning) indicatorColor = '#e11d48'; // red fatigue

        ctx.fillStyle = indicatorColor;
        ctx.strokeStyle = indicatorColor;
        ctx.lineWidth = 2;

        if (eyesClosed) {
          // Closed eye slit curves
          ctx.beginPath();
          ctx.arc(102, 85, 8, Math.PI, 0, false);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(138, 85, 8, Math.PI, 0, false);
          ctx.stroke();
        } else if (distracted) {
          // Gaze shifting aside
          const lookOffset = Math.sin(frame * 0.1) * 4;
          ctx.beginPath();
          ctx.arc(102, 85, 6, 0, Math.PI * 2);
          ctx.arc(138, 85, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(102 + lookOffset, 85 + 2, 2.5, 0, Math.PI * 2);
          ctx.arc(138 + lookOffset, 85 + 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard open blinking loops
          const isBlinking = frame % 60 < 4;
          if (isBlinking) {
            ctx.beginPath();
            ctx.arc(102, 85, 8, Math.PI, 0, false);
            ctx.arc(138, 85, 8, Math.PI, 0, false);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(102, 85, 6, 0, Math.PI * 2);
            ctx.arc(138, 85, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Mouth representation
        ctx.strokeStyle = indicatorColor;
        if (yawning) {
          // Big circle
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.ellipse(120, 115, 8, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(120, 110, 12, 0.1 * Math.PI, 0.9 * Math.PI);
          ctx.stroke();
        }

        // Draw overlay text state
        ctx.fillStyle = indicatorColor;
        ctx.font = '10px monospace';
        ctx.fillText(`PILOT STATE: ${mockPilotAction.toUpperCase()}`, 10, 160);
      } else {
        // Physical real webcam analysis loop!
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          // Draw mirrored live webcam frame onto canvas
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Compute facial illumination reference background level (middle of layout)
            let faceBrightnessSum = 0;
            let faceSamples = 0;
            for (let y = 50; y < 145; y += 4) {
              for (let x = 70; x < 170; x += 4) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                faceBrightnessSum += brightness;
                faceSamples++;
              }
            }
            const avgFaceBrightness = faceSamples > 0 ? (faceBrightnessSum / faceSamples) : 120;

            // 1. Mouth Opening (Yawn detection) -> check density of black/shadowy voxels in oral region
            let mouthSamples = 0;
            let mouthDarkPixels = 0;
            for (let y = 115; y < 145; y += 2) {
              for (let x = 100; x < 140; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                mouthSamples++;
                
                // If voxel is significantly darker than average skin tone
                if (brightness < Math.max(34, avgFaceBrightness * 0.52)) {
                  mouthDarkPixels++;
                }
              }
            }
            const mouthOpenRatio = mouthSamples > 0 ? (mouthDarkPixels / mouthSamples) : 0;
            const mouthOpenPct = Math.min(100, Math.round(mouthOpenRatio * 260));

            // 2. Eye closure/contrast detection -> check variance inside optical windows
            let eyeMin = 255;
            let eyeMax = 0;
            for (let y = 75; y < 95; y += 2) {
              for (let x = 80; x < 110; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const bval = 0.299 * r + 0.587 * g + 0.114 * b;
                if (bval < eyeMin) eyeMin = bval;
                if (bval > eyeMax) eyeMax = bval;
              }
              for (let x = 130; x < 160; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const bval = 0.299 * r + 0.587 * g + 0.114 * b;
                if (bval < eyeMin) eyeMin = bval;
                if (bval > eyeMax) eyeMax = bval;
              }
            }
            const eyeContrast = eyeMax - eyeMin;
            const eyeOpenConfidence = Math.min(100, Math.max(0, Math.round((eyeContrast / 90) * 100)));

            // Smooth high-frequency variations from background shifts
            mouthPctFiltered = mouthPctFiltered * 0.72 + mouthOpenPct * 0.28;
            eyeConfidenceFiltered = eyeConfidenceFiltered * 0.72 + eyeOpenConfidence * 0.28;

            // Classify current state
            let detectedState: 'normal' | 'eyes-closed' | 'yawning' | 'distracted' = 'normal';
            if (mouthPctFiltered > 38) {
              detectedState = 'yawning';
            } else if (eyeConfidenceFiltered < 24) {
              detectedState = 'eyes-closed';
            }

            // Propagate only on state change to avoid infinite loops
            if (lastWebcamStateRef.current !== detectedState) {
              lastWebcamStateRef.current = detectedState;
              setMockPilotAction(detectedState);
            }

            // Draw HUD target elements
            // Oral box overlay
            ctx.strokeStyle = detectedState === 'yawning' ? '#ef4444' : '#06b6d4';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(100, 115, 40, 30);
            ctx.fillStyle = detectedState === 'yawning' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.05)';
            ctx.fillRect(100, 115, 40, 30);
            ctx.font = '8px monospace';
            ctx.fillStyle = detectedState === 'yawning' ? '#ef4444' : '#06b6d4';
            ctx.fillText(`ORAL.VEC [${Math.round(mouthPctFiltered)}%]`, 100, 111);

            // Left eye overlay
            ctx.strokeStyle = detectedState === 'eyes-closed' ? '#f59e0b' : '#06b6d4';
            ctx.strokeRect(80, 75, 30, 20);
            ctx.fillStyle = detectedState === 'eyes-closed' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.05)';
            ctx.fillRect(80, 75, 30, 20);
            ctx.fillText(`L.OPT [${Math.round(eyeConfidenceFiltered)}%]`, 80, 71);

            // Right eye overlay
            ctx.strokeStyle = detectedState === 'eyes-closed' ? '#f59e0b' : '#06b6d4';
            ctx.strokeRect(130, 75, 30, 20);
            ctx.fillStyle = detectedState === 'eyes-closed' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.05)';
            ctx.fillRect(130, 75, 30, 20);
            ctx.fillText(`R.OPT [${Math.round(eyeConfidenceFiltered)}%]`, 130, 71);

            // Render details panels onto bottom corner of the camera feed
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
            ctx.fillRect(5, canvas.height - 42, 130, 35);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(5, canvas.height - 42, 130, 35);

            ctx.font = '7.5px monospace';
            ctx.fillStyle = mouthPctFiltered > 38 ? '#f43f5e' : '#cbd5e1';
            ctx.fillText(`YAWN DEPTH: ${Math.round(mouthPctFiltered)}%`, 10, canvas.height - 32);
            ctx.fillStyle = mouthPctFiltered > 38 ? '#f43f5e' : '#06b6d4';
            ctx.fillRect(10, canvas.height - 28, Math.min(120, mouthPctFiltered), 3);

            ctx.fillStyle = eyeConfidenceFiltered < 24 ? '#f59e0b' : '#cbd5e1';
            ctx.fillText(`EYE CONTRAST: ${Math.round(eyeConfidenceFiltered)}%`, 10, canvas.height - 18);
            ctx.fillStyle = eyeConfidenceFiltered < 24 ? '#f59e0b' : '#06b6d4';
            ctx.fillRect(10, canvas.height - 14, Math.min(120, eyeConfidenceFiltered), 3);

          } catch (e) {
            console.error("Frame access or canvas error: ", e);
          }
        } else {
          ctx.fillStyle = '#060a12';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#06b6d4';
          ctx.font = '9px monospace';
          ctx.fillText("CONNECTING FEED STREAM...", 20, 90);
        }
      }

      // Draw active scanner mesh lines overlay
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Dynamic warning indicators blinking
      if (mockPilotAction !== 'normal') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
      }

      animationFrameId.current = requestAnimationFrame(drawMatrix);
    };

    drawMatrix();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [useRealWebcam, mockPilotAction]);

  // Voice play handler mock
  const triggerAudioSpokenFeedback = () => {
    setAudioFeedbackPlaying(true);
    const utterance = new SpeechSynthesisUtterance(activeState.aura.primaryMessage);
    utterance.volume = 0.85;
    utterance.rate = 1.0;
    utterance.onend = () => {
      setAudioFeedbackPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#020617] hud-grid-background text-slate-200 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900 overflow-x-hidden antialiased relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 pointer-events-none" />
      
      {/* Upper Cockpit HUD Metrics Strip */}
      <header className="border-b border-cyan-500/20 bg-[#060a16]/90 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-[0_4px_20px_rgba(6,182,212,0.08)]">
        <div id="hud-navigation-bar" className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.3)] bg-[#040814]">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold font-display tracking-widest text-white">MERCEDES AURA</h1>
                <span className="px-1.5 py-0.5 bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] uppercase tracking-widest rounded font-semibold">
                  BIOSYNC DEMO
                </span>
              </div>
              <p className="text-[9px] text-cyan-500/80 font-mono tracking-widest uppercase">BIOMETRIC DRIVER ADAPTATION // COCKPIT CONTROLLER</p>
            </div>
          </div>

          {/* Core HUD Indicators */}
          <div className="flex flex-wrap items-center gap-3 md:gap-5 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>PILOT: <b className="text-white tracking-wider">KYLE ZEN</b></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span>NET: <b className="text-white tracking-wider">5G DIRECT</b></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>DELAY: <b className="text-cyan-400 tracking-wider">4.2ms</b></span>
            </div>
          </div>

          {/* Navigation Action tabs */}
          <div className="flex bg-slate-950/80 p-1 border border-slate-800/80 rounded-xl">
            <button
              id="tab-btn-cockpit"
              onClick={() => setActiveTab('cockpit')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all font-bold ${
                activeTab === 'cockpit' 
                  ? 'bg-cyan-500 text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              Cockpit Screen
            </button>
            <button
              id="tab-btn-architecture"
              onClick={() => setActiveTab('architecture')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all font-bold ${
                activeTab === 'architecture' 
                  ? 'bg-cyan-500 text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              Architecture Flow
            </button>
            <button
              id="tab-btn-api"
              onClick={() => setActiveTab('api')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all font-bold ${
                activeTab === 'api' 
                  ? 'bg-cyan-500 text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              API Reference
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        <AnimatePresence mode="wait">
          {activeTab === 'cockpit' && (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* Left Column: SENSORS & MULTI-MODAL INPUTS */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* 1. Dummy/Real Optical Optical Sensor */}
                <div id="optic-sensor-panel" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-4.5 shadow-[0_4px_25px_rgba(0,0,0,0.4)] flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500/20" />
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono uppercase tracking-widest font-bold text-slate-200">
                        IN-CABIN SCANNER [INFRARED]
                      </span>
                    </div>
                    
                    {/* Toggle real vs mock */}
                    <button
                      onClick={() => setUseRealWebcam(!useRealWebcam)}
                      className={`px-2 py-1 rounded text-[9.5px] font-mono border transition-all cursor-pointer ${
                        useRealWebcam 
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
                          : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {useRealWebcam ? 'USING DEVICE CAM' : 'USE GRAPHICS SIM'}
                    </button>
                  </div>

                  {/* Optical viewer box */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-[inset_0_4px_20px_rgba(0,0,0,0.6)] group-hover:border-cyan-550/20 transition-colors">
                    <video 
                      ref={videoRef} 
                      className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-0"
                      style={{ opacity: useRealWebcam ? 1 : 0 }}
                      playsInline 
                      muted 
                    />
                    <canvas 
                      ref={canvasRef} 
                      width={240} 
                      height={180} 
                      className="absolute inset-0 w-full h-full object-cover rounded-xl"
                    />

                    {/* HUD corner lines overlay */}
                    <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-500/60 pointer-events-none" />
                    <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-500/60 pointer-events-none" />
                    <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-500/60 pointer-events-none" />
                    <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-500/60 pointer-events-none" />

                    {cameraInitialising && (
                      <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-xs font-mono text-cyan-400 gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                        <span className="tracking-widest">INITIALISING PORTABLE CAMERA...</span>
                      </div>
                    )}
                  </div>

                  {/* Manual control buttons to test different pilot actions/states */}
                  {!useRealWebcam && (
                    <div className="mt-3.5">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/75 block mb-2 font-semibold">
                        FORCE PILOT BEHAVIORS FOR TEST
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'normal', label: 'Alert (Normal)' },
                          { id: 'eyes-closed', label: 'Eyelids Closed' },
                          { id: 'yawning', label: 'Active Yawn' },
                          { id: 'distracted', label: 'Distracted (Gaze)' }
                        ].map((actObj) => {
                          const isActive = mockPilotAction === actObj.id;
                          return (
                            <button
                              key={actObj.id}
                              id={`act-btn-${actObj.id}`}
                              onClick={() => {
                                setMockPilotAction(actObj.id as any);
                                if (actObj.id === 'eyes-closed') {
                                  setLiveSleepiness(85);
                                } else if (actObj.id === 'yawning') {
                                  setLiveSleepiness(68);
                                } else {
                                  setLiveSleepiness(10);
                                }
                              }}
                              className={`text-[11px] font-mono py-2 px-2.5 border rounded-lg text-left transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-[#0f2430]/90 text-cyan-300 border-cyan-500/60 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)]' 
                                  : 'bg-slate-950/80 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                              }`}
                            >
                              <span className="mr-1.5">{isActive ? '●' : '○'}</span> {actObj.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Wearable Smartwatch Biometric Inputs */}
                <div id="vitals-sensor-panel" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-4.5 shadow-[0_4px_25px_rgba(0,0,0,0.4)] space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500/20" />
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span className="text-xs font-mono uppercase tracking-widest font-bold text-slate-200">
                        WEARABLE PHYSIOLOGICAL FEED
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-slate-950/80 text-cyan-400 font-semibold rounded border border-cyan-500/20 uppercase tracking-widest">
                      SMARTWATCH SYNC
                    </span>
                  </div>

                  {/* Sparkline graphics widget */}
                  <div className="bg-[#050914] p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400 font-semibold tracking-wider">HEART RATE PULSE WAVEFORM</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        {liveHeartRate} BPM
                      </span>
                    </div>

                    {/* Cute custom animated live SVG line graph */}
                    <div className="h-14 w-full relative overflow-hidden bg-[#02040a] border border-slate-900/60 rounded-lg flex items-center">
                      <svg className="w-full h-full" viewBox="0 0 300 60">
                        <g>
                          <path
                            d={`M 0,30 L 30,30 L 45,30 L 52,10 L 60,50 L 68,30 L 120,30 L 135,30 L 142,15 L 150,45 L 158,30 L 210,30 L 225,30 L 232,5 L 240,55 L 248,30 L 300,30`}
                            fill="none"
                            stroke={activeState.biometrics.detectionStatus === 'emergency' ? '#f43f5e' : '#06b6d4'}
                            strokeWidth="2.5"
                            className="stroke-dash-animation"
                          />
                        </g>

                        {/* Faded background area shadow drop */}
                        <g opacity="0.12">
                          <path
                            d={`M 0,30 L 30,30 L 45,30 L 52,10 L 60,50 L 68,30 L 120,30 L 135,30 L 142,15 L 150,45 L 158,30 L 210,30 L 225,30 L 232,5 L 240,55 L 248,30 L 300,30 L 300,60 L 0,60 Z`}
                            fill={activeState.biometrics.detectionStatus === 'emergency' ? '#f43f5e' : '#06b6d4'}
                          />
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* Sliders to let user fine tune */}
                  <div className="space-y-4.5 font-sans">
                    <div>
                      <div className="flex justify-between items-center text-[11px] font-mono mb-1.5">
                        <span className="text-slate-400 tracking-wider">HEART RATE CONTROLLER</span>
                        <span className={`font-bold uppercase ${liveHeartRate > 110 ? 'text-rose-400' : 'text-cyan-300'}`}>{liveHeartRate} BPM</span>
                      </div>
                      <input 
                        type="range"
                        min="50"
                        max="160"
                        value={liveHeartRate}
                        onChange={(e) => handleSliderChange('hr', parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-[11px] font-mono mb-1.5">
                        <span className="text-slate-400 tracking-wider">STRESS INDEX AMPLITUDE</span>
                        <span className="text-cyan-300 font-bold">{liveStress}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={liveStress}
                        onChange={(e) => handleSliderChange('stress', parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-[11px] font-mono mb-1.5">
                        <span className="text-slate-400 tracking-wider">HEART VARIABILITY INDEX (HRV)</span>
                        <span className="text-indigo-300 font-bold">{liveHrval} MS</span>
                      </div>
                      <input 
                        type="range"
                        min="5"
                        max="120"
                        value={liveHrval}
                        onChange={(e) => handleSliderChange('hrv', parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-505"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Middle Block: AURA AGENT DECISION ENGINE */}
              <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
                
                {/* Visual presets quick switcher */}
                <div id="presets-bento" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-4.5 shadow-[0_4px_25px_rgba(0,0,0,0.4)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 block mb-3 font-bold">
                    LAUNCH PILOT SCENARIOS
                  </span>
                  
                  <div className="flex flex-col gap-2.5">
                    {SCENARIO_PRESETS.map((preset) => {
                      const isSelected = preset.id === activeScenarioId;
                      return (
                        <button
                          key={preset.id}
                          id={`preset-switch-${preset.id}`}
                          onClick={() => applyPreset(preset.id)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all relative cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-r from-[#0d1e30] to-[#040c16] border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.15)] font-bold' 
                              : 'bg-slate-950/50 border-slate-800/85 text-slate-400 hover:border-slate-700 hover:bg-[#060c18]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono tracking-wide">{preset.name}</span>
                            {isSelected && <span className="text-[8px] font-mono uppercase px-2 py-0.5 bg-cyan-950 text-cyan-400 rounded-md border border-cyan-700/50 tracking-widest font-bold">ACTIVE</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-1 font-sans">{preset.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Central Brain Animation (The Agent Aura) */}
                <div className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center relative overflow-hidden group min-h-68 hud-radar-sweep">
                  
                  {/* Subtle Radar target lines */}
                  <div className="absolute inset-x-0 top-1/2 h-[0.5px] bg-cyan-500/10 pointer-events-none" />
                  <div className="absolute inset-y-0 left-1/2 w-[0.5px] bg-cyan-500/10 pointer-events-none" />

                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 mb-4 z-10 font-bold">
                    AURA REAL-TIME AI CO-DRIVER
                  </h3>

                  {/* Ring animations and neural center */}
                  <div className="relative w-36 h-36 flex items-center justify-center mb-4 z-15">
                    
                    {/* Ring 1 - Outer spin */}
                    <div className="absolute inset-0 rounded-full border border-dashed animate-spin"
                         style={{ 
                           borderColor: activeState.aura.alertLevel === 'critical' ? '#ef4444' 
                                      : activeState.aura.alertLevel === 'high' ? '#f59e0b'
                                      : activeState.aura.alertLevel === 'low' ? '#10b981'
                                      : '#06b6d4',
                           animationDuration: '12s' 
                         }}></div>

                    {/* Ring 2 - Internal counter spin */}
                    <div className="absolute w-[85%] h-[85%] rounded-full border border-double animate-spin" 
                         style={{ 
                           borderColor: activeState.aura.alertLevel === 'critical' ? 'rgba(239, 68, 68, 0.4)' 
                                      : '#6366f1',
                           animationDuration: '6s',
                           animationDirection: 'reverse' 
                         }}></div>

                    {/* Glow ball */}
                    <span className="absolute w-[60%] h-[60%] rounded-full opacity-20 blur-xl animate-pulse"
                          style={{
                            background: activeState.aura.alertLevel === 'critical' ? '#ef4444' 
                                      : activeState.aura.alertLevel === 'high' ? '#f59e0b'
                                      : activeState.aura.alertLevel === 'low' ? '#10b981'
                                      : '#06b6d4'
                          }}></span>

                    {/* Core Brain Node */}
                    <div className="w-[50%] h-[50%] rounded-full bg-[#040816] border-2 flex items-center justify-center z-10 transition-all duration-350"
                         style={{
                           borderColor: activeState.aura.alertLevel === 'critical' ? '#ef4444' 
                                      : activeState.aura.alertLevel === 'high' ? '#f59e0b'
                                      : activeState.aura.alertLevel === 'low' ? '#10b981'
                                      : '#06b6d4',
                           boxShadow: activeState.aura.alertLevel === 'critical' ? '0 0 25px rgba(239, 68, 68, 0.5)' 
                                      : '0 0 20px rgba(6, 182, 212, 0.35)'
                         }}
                    >
                      <Sparkles className="w-6 h-6 shrink-0 transition-transform duration-500 hover:scale-115"
                                style={{
                                  color: activeState.aura.alertLevel === 'critical' ? '#ef4444' 
                                       : activeState.aura.alertLevel === 'high' ? '#f59e0b'
                                       : activeState.aura.alertLevel === 'low' ? '#10b981'
                                       : '#06b6d4'
                                }} />
                    </div>
                  </div>

                  {/* Voice Prompter Box */}
                  <div className="w-full text-center z-10 px-1 space-y-2.5 mt-1.5">
                    <p className="text-slate-300 text-xs italic font-sans px-3.5 py-2.5 bg-slate-950/80 rounded-xl border border-slate-900/60 leading-relaxed min-h-[4rem] flex items-center justify-center">
                      "{activeState.aura.primaryMessage}"
                    </p>
                    
                    <button
                      onClick={triggerAudioSpokenFeedback}
                      disabled={audioFeedbackPlaying}
                      className="px-4 py-2 w-full bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-[10px] uppercase rounded-xl hover:bg-slate-900 hover:border-cyan-500/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-bold tracking-wider shadow-inner"
                    >
                      <Radio className={`w-4 h-4 text-cyan-400 ${audioFeedbackPlaying ? 'animate-bounce' : ''}`} />
                      {audioFeedbackPlaying ? 'SPOKEN FEED PLAYING...' : 'LISTEN TO AURA VOICE'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: VEHICLE ADAPTIONS & REAL-TIME OUTPUT MODULES */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Adaptive Vehicle Controls Block */}
                <div id="vehicle-actions-panel" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-4.5 shadow-[0_4px_25px_rgba(0,0,0,0.4)] space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-cyan-500/20" />
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono uppercase tracking-widest font-bold text-slate-200">
                        AURA SYSTEM OUTPUT ACTIONS
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-widest bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/40 animate-pulse">
                      Live CAN-Bus
                    </span>
                  </div>

                  {/* 1. Drive Mode status */}
                  <div className="bg-slate-1000/80 p-3.5 rounded-xl border border-slate-850/80 flex items-center justify-between shadow-inner">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block font-semibold mb-0.5">SYSTEM MODE OVERRIDE</span>
                      <span className="text-[12px] font-bold text-slate-100 font-mono tracking-wide">
                        {activeState.biometrics.heartRate >= 135 ? 'Comfort Safety Assist (Forced)' : activeScenarioId === 'sporty' ? 'SPORT (Sporty behavior)' : 'Comfort (Softer throttle)'}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded text-[9.5px] font-mono uppercase tracking-widest border font-bold ${
                      activeState.biometrics.heartRate >= 135 ? 'bg-red-950/80 text-red-400 border-red-800/80 animate-pulse'
                      : activeScenarioId === 'sporty' ? 'bg-indigo-950/80 text-indigo-400 border-indigo-805/80'
                      : 'bg-[#0f2430]/90 text-cyan-400 border-cyan-800/60'
                    }`}>
                      {activeState.biometrics.heartRate >= 135 ? 'EMERGENCY' : activeScenarioId === 'sporty' ? 'SPORT' : 'COMFORT'}
                    </span>
                  </div>

                  {/* 2. Sensor calibrations detailing */}
                  <div className="space-y-2.5">
                    <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#06b6d5]/80 font-bold block">
                      DYNAMIC SENSORY SENSITIVITIES
                    </span>

                    {/* Sensor list specs */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      
                      <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-850/80 relative overflow-hidden">
                        <span className="text-[9px] font-mono text-slate-500 block font-semibold tracking-wider mb-1">BLIND-SPOT SCAN</span>
                        <span className="font-bold text-cyan-400 uppercase font-mono text-glow text-[11.5px]">{activeState.sensors.blindSpotSensitivity}</span>
                      </div>

                      <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-850/80 relative overflow-hidden">
                        <span className="text-[9px] font-mono text-slate-500 block font-semibold tracking-wider mb-1">RADAR WARN BUFFER</span>
                        <span className="font-bold text-cyan-400 uppercase font-mono text-glow text-[11.5px]">{activeState.sensors.collisionWarningDistance}</span>
                      </div>

                      <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-850/80 relative overflow-hidden">
                        <span className="text-[9px] font-mono text-slate-500 block font-semibold tracking-wider mb-1">LANE KEEP STRENGTH</span>
                        <span className="font-bold text-cyan-400 uppercase font-mono text-glow text-[11.5px]">{activeState.sensors.laneAssistStrength}</span>
                      </div>

                      <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-850/80 relative overflow-hidden">
                        <span className="text-[9px] font-mono text-slate-500 block font-semibold tracking-wider mb-1">SAFETY OVERRIDE</span>
                        <span className={`font-bold uppercase font-mono text-[11.5px] ${activeState.sensors.safetyOverrideArmed ? 'text-rose-400' : 'text-slate-505'}`}>
                          {activeState.sensors.safetyOverrideArmed ? 'ARMED' : 'STANDBY'}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* 3. Cabin Adaptation output states */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#06b6d5]/80 font-bold block">
                      ACTIVE CABIN SYNC ENVIRONMENT
                    </span>

                    <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-850/80 space-y-3 font-sans shadow-inner">
                      
                      {/* AMBIENT LIGHT MOCK COLOR SELECTOR SHOW WINDOW */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-mono tracking-wide">Ambient Lamp Color</span>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full inline-block border border-slate-800 shadow" 
                                style={{ backgroundColor: activeState.cabin.ambientColor }}></span>
                          <span className="text-xs font-mono font-bold uppercase" style={{ color: activeState.cabin.ambientColor }}>
                            {activeState.cabin.ambientColor === '#06b6d4' ? 'CYAN BLISS' 
                             : activeState.cabin.ambientColor === '#10b981' ? 'EMERALD CALM' 
                             : activeState.cabin.ambientColor === '#f59e0b' ? 'AMBER WARN' 
                             : activeState.cabin.ambientColor === '#6366f1' ? 'NEON PASSION' 
                             : 'ROSE DURESS'}
                          </span>
                        </div>
                      </div>

                      {/* PLAYLIST SUGGESTIONS */}
                      <div className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                        <Music className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono text-slate-500 block uppercase tracking-wider">RECOMMENDED AUDIO PROFILE</span>
                          <span className="text-xs font-bold text-slate-200 font-mono block truncate">{activeState.cabin.musicPlaylist}</span>
                        </div>
                      </div>

                      {/* Decibel override levels */}
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-900">
                        <span className="text-slate-400">Dim alert notification sounds</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest font-bold ${
                          activeState.cabin.volumeReduction ? 'bg-[#1a1438] text-indigo-300 border border-indigo-900/60' : 'bg-slate-900 text-slate-500'
                        }`}>
                          {activeState.cabin.volumeReduction ? 'REDUCED' : 'STANDARD'}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Co-Driving Assist Recommendation panel */}
                  <div className="p-3.5 rounded-xl bg-cyan-950/15 border border-cyan-800/30 flex items-start gap-3">
                    <Info className="w-4.5 h-4.5 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[11px] font-mono font-bold text-cyan-300 tracking-wider">CO-DRIVE SAFETY DISPATCH</h4>
                      <p className="text-[11px] text-slate-350 mt-1 font-sans leading-relaxed">
                        {activeState.cruise.reason}
                      </p>
                      <div className="mt-2 text-[10.5px] font-mono text-slate-400">
                        STATUS: <span className={`font-bold ${
                          activeState.cruise.status === 'forced' ? 'text-rose-400 animate-pulse' 
                          : activeState.cruise.status === 'active' ? 'text-amber-400'
                          : activeState.cruise.status === 'recommended' ? 'text-cyan-400'
                          : 'text-slate-400'
                        } uppercase tracking-wider`}>
                          {activeState.cruise.status}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
              
              {/* Challenge description bottom bento card to assist demonstration */}
              <div className="col-span-1 lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 font-sans">
                <div className="border border-slate-800/60 bg-[#090d1a]/50 p-5 rounded-2xl flex gap-3.5 hover:border-cyan-500/10 hover:bg-[#0b1021]/60 transition-all duration-300 shadow-md">
                  <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-mono font-bold text-[#06b6d5] uppercase tracking-wider">Challenge Solved</h3>
                    <p className="text-[11.5px] text-slate-405 mt-1.5 leading-relaxed">
                      Most sensor monitors trigger only after severe lane drift. Biosync uses dual-context sensor sensitivity (stress indicators, heart rate matching optical closures) to react earlier to potential safety hazards.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-800/60 bg-[#090d1a]/50 p-5 rounded-2xl flex gap-3.5 hover:border-cyan-500/10 hover:bg-[#0b1021]/60 transition-all duration-300 shadow-md">
                  <Layers className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-mono font-bold text-[#06b6d5] uppercase tracking-wider">Aesthetic Adaptations</h3>
                    <p className="text-[11.5px] text-slate-405 mt-1.5 leading-relaxed">
                      Changes blind-spot and radar sensitivities under rainy conditions while adjusting ambient LEDs and speaker notification levels to keep pilot fatigue levels at check.
                    </p>
                  </div>
                </div>

                <div className="border border-slate-800/60 bg-[#090d1a]/50 p-5 rounded-2xl flex gap-3.5 hover:border-cyan-500/10 hover:bg-[#0b1021]/60 transition-all duration-300 shadow-md">
                  <Heart className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">Emergency Safeguard</h3>
                    <p className="text-[11.5px] text-slate-405 mt-1.5 leading-relaxed">
                      Tachycardia triggers (&gt;135 bpm) combined with &gt;4 second optical blackout locks vehicle throttle controls, initiates indicators, and pulls over safely.
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {activeTab === 'architecture' && (
            <motion.div
              key="architecture"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <AuraFlowChart />
            </motion.div>
          )}

          {activeTab === 'api' && (
            <motion.div
              key="api"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <ApiDocs />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Aesthetic minimalist dark footer */}
      <footer className="mt-12 border-t border-slate-900 py-6 text-center text-xs font-mono text-slate-500 max-w-7xl mx-auto w-full px-6">
        <p className="flex justify-center items-center gap-1.5">
          <span>CO-DRIVEN COMPANION PROJECT // DESIGN PROTO FOR WORKSPACE PRESENTATIONS</span>
        </p>
        <p className="text-[10px] text-slate-650 mt-1">
          Mercedes Benz Biosync Drive AI (AURA Engine) - Powered by React and Tailwind v4. Port 3000 Ingress Active.
        </p>
      </footer>

    </div>
  );
}

// Quick state helpers to prevent undeclared bugs
function setLiveSleepiness(arg0: number) {
  // Handled inside handleSliderChange callback cascade automatically
}
