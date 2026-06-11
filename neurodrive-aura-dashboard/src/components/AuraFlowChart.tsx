/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Heart, Eye, Compass, CloudSnow, Sparkles, 
  Settings, Volume2, ShieldAlert, Zap, Layers, RefreshCw, KeyRound, CheckCircle2 
} from 'lucide-react';

export default function AuraFlowChart() {
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const stepsInfo: Record<string, { title: string; desc: string; inputs: string[]; icon: any }> = {
    perceive: {
      title: '1. PERCEIVE: Sensor Ingestion',
      desc: 'Ingests multi-modal data in real time from wearables (heartbeat, HRV) and in-cabin infrared camera (blink rate, yawning, driver eye vectors) on a 100ms polling loop.',
      inputs: ['Smartwatch Vitals', 'Fatigue Detection', 'Blink Interval Analytics'],
      icon: Eye
    },
    understand: {
      title: '2. UNDERSTAND: Context Engine',
      desc: 'Machine learning classifiers fusion stress score, fatigue stages, traffic density, and slippery weather maps to determine holistic pilot readiness.',
      inputs: ['Stress Indicator Model', 'Traffic Heatmaps', 'Road Grip Classifiers'],
      icon: Sparkles
    },
    decide: {
      title: '3. DECIDE: Predictive Action Strategy',
      desc: 'Evaluates priority rules and adaptive matrices. Resolves conflicts (e.g. driver wants sports mode but fatigue is critical -> triggers safety comfort mode override).',
      inputs: ['Override Matrix', 'Speed Trigger Safety', 'Co-Driving Prompt Loader'],
      icon: Settings
    },
    act: {
      title: '4. ACT: Vehicle ECU Dispatch',
      desc: 'Dispatches instant instructions to car active hardware and software buses (CAN-Bus, audio amplifier, ambient LED lights, throttle-by-wire controller).',
      inputs: ['Throttle Multiplexer', 'Adaptive Headlight Leveling', 'Active Assist Engager'],
      icon: Zap
    },
    loop: {
      title: '5. LEARNING LOOP: Continuous Adaptation',
      desc: 'Monitors the driver’s response back to adaptations (e.g. did driver stress lower after calming ambient light? did steer wobble decrease?). Stores anonymous logs to refine AI parameters.',
      inputs: ['Adaptation Response Tracker', 'Feedback Coefficient Tuning'],
      icon: RefreshCw
    }
  };

  return (
    <div id="aura-flow-chart-container" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-6 lg:p-8 text-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="mb-8 text-center max-w-4xl mx-auto">
        <span className="px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 font-mono text-xs uppercase tracking-widest rounded-full font-semibold">
          PRESENTATION SLIDE // ARCHITECTURAL PIPELINE
        </span>
        <h2 className="text-3xl font-bold font-sans tracking-tight text-white mt-3.5">
          Mercedes AURA & BioSync Architecture Flow
        </h2>
        <p className="text-slate-400 font-sans text-sm mt-2 leading-relaxed">
          Interactive flow diagram showing real-time feedback loop between driver biometrics, cabinet controls, and vehicle autonomous safety systems. Click on hot-spots to detail the pipeline layers.
        </p>
      </div>

      {/* Main flowchart skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center my-6 relative z-10">
        
        {/* Left column: INPUTS */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="border border-cyan-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-3 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Physiological Data
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
              <li>Heart Rate (bpm)</li>
              <li>Heart Rate Variability (HRV ms)</li>
              <li>Stress Indicator metrics</li>
            </ul>
          </div>

          <div className="border border-cyan-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-3 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-cyan-400" /> Behavioral In-Cabin
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
              <li>Eye closure rate %</li>
              <li>Yawning & blink intervals</li>
              <li>Distraction vectors (yaw/pitch)</li>
            </ul>
          </div>

          <div className="border border-cyan-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-3 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> Driving Conduct
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 font-sans">
              <li>Steering pattern fluctuations</li>
              <li>Braking reaction latency</li>
              <li>Throttle / speed profiles</li>
            </ul>
          </div>

          <div className="border border-cyan-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative font-sans">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-400 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-3 flex items-center gap-1">
              <CloudSnow className="w-3.5 h-3.5 text-cyan-400" /> Environment Logs
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Radar stop-&-go indices</li>
              <li>Weather reports (slippery index)</li>
              <li>Regional speed limits & hazards</li>
            </ul>
          </div>
        </div>

        {/* Arrow indicators (hidden on small screen, visual on desktop) */}
        <div className="hidden xl:flex xl:col-span-1 flex-col items-center justify-center gap-8">
          <div className="w-full h-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500 relative">
            <span className="absolute -right-1.5 -top-1 border-t-4 border-l-4 border-transparent border-l-indigo-500 w-2 h-2 transform rotate-45"></span>
          </div>
          <div className="w-full h-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500 relative">
            <span className="absolute -right-1.5 -top-1 border-t-4 border-l-4 border-transparent border-l-indigo-500 w-2 h-2 transform rotate-45"></span>
          </div>
          <div className="w-full h-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500 relative animate-pulse">
            <span className="absolute -right-1.5 -top-1 border-t-4 border-l-4 border-transparent border-l-indigo-500 w-2 h-2 transform rotate-45"></span>
          </div>
        </div>

        {/* Center: AURA ENGINE PROCESSING LOOP */}
        <div className="xl:col-span-4 flex flex-col gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-0.5 bg-indigo-500 text-slate-900 text-[10px] font-mono uppercase tracking-widest rounded-full font-bold">
            AURA AI AGENT Core
          </div>

          {/* Engine Processing Steps */}
          {Object.entries(stepsInfo).map(([key, value]) => {
            const IconComponent = value.icon;
            const isSelected = activeStep === key;
            return (
              <div 
                key={key}
                id={`flowcard-${key}`}
                onClick={() => setActiveStep(isSelected ? null : key)}
                className={`transition-all duration-300 cursor-pointer p-3 border rounded-xl flex items-start gap-3 relative ${
                  isSelected 
                    ? 'bg-gradient-to-r from-cyan-950 to-indigo-950 border-cyan-400 shadow-cyan-900/30 shadow-md transform -translate-y-0.5' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-cyan-400'}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-mono font-bold text-slate-200">{value.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{value.desc}</p>
                </div>
                <div className="text-[10px] text-slate-500 font-mono shrink-0">
                  {key === 'loop' ? '★ Loop' : `Layer ${key === 'perceive' ? 1 : key === 'understand' ? 2 : key === 'decide' ? 3 : 4}`}
                </div>
              </div>
            );
          })}

          {/* Connected learning loop status */}
          <div className="flex items-center justify-center py-1 mt-1 text-slate-400 text-xs gap-2 border-t border-slate-800/60 font-mono">
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Closed feedback frequency: ~20Hz</span>
          </div>
        </div>

        {/* Arrow indicators (hidden on small screen, visual on desktop) */}
        <div className="hidden xl:flex xl:col-span-1 flex-col items-center justify-center gap-8">
          <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-rose-500 relative">
            <span className="absolute -right-1.5 -top-1 border-t-4 border-l-4 border-transparent border-l-rose-500 w-2 h-2 transform rotate-45"></span>
          </div>
          <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-rose-500 relative">
            <span className="absolute -right-1.5 -top-1 border-t-4 border-l-4 border-transparent border-l-rose-500 w-2 h-2 transform rotate-45"></span>
          </div>
        </div>

        {/* Right column: OUTPUTS */}
        <div className="xl:col-span-3 flex flex-col gap-4 font-sans">
          <div className="border border-indigo-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-bold mb-3 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" /> Co-Driving Control
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Adaptive Cruise recommendations</li>
              <li>Active lane-centering assist strength</li>
              <li>Collision buffering scaling</li>
            </ul>
          </div>

          <div className="border border-indigo-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-bold mb-3 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Cabin Adaptation
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Mental-soothing ambient led shifts</li>
              <li>Decibel audio suppression rules</li>
              <li>Cognitive workload playlists</li>
            </ul>
          </div>

          <div className="border border-indigo-900/40 bg-slate-900/80 p-4 rounded-xl shadow-lg relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 rounded-l-xl"></div>
            <h3 className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-bold mb-3 flex items-center gap-1.5 flex-wrap">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> Emergency Overshield
            </h3>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Emergency roadside slowdown</li>
              <li>Critical vital transmission to EMS</li>
              <li>Steering redundancy override</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Detail panel for selected step */}
      <div id="glow-step-details-panel" className="mt-8 transition-all duration-300 min-h-16">
        {activeStep ? (
          <div className="bg-[#040816]/90 border border-cyan-500/20 p-5 rounded-xl relative animate-fade-in font-sans shadow-lg">
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-cyan-405 rounded-l-lg"></div>
            <h4 className="font-mono text-cyan-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" /> Deep Dive Analysis: {stepsInfo[activeStep].title}
            </h4>
            <p className="text-slate-300 text-xs mt-2.5 font-sans leading-relaxed">
              {stepsInfo[activeStep].desc}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider font-bold">Associated modules:</span>
              {stepsInfo[activeStep].inputs.map((inp, idx) => (
                <span key={idx} className="bg-cyan-950/40 text-cyan-300 border border-cyan-900/40 px-2.5 py-0.5 rounded-md text-[10.5px] font-mono font-semibold">
                  {inp}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-5 bg-[#030712]/50 border border-slate-900 rounded-xl text-slate-400 text-xs font-mono tracking-wider">
            💡 CLICK ON ANY PIPELINE STEP ABOVE TO EXPAND DETAILED TECHNICAL HIGHLIGHTS.
          </div>
        )}
      </div>

      {/* Grid footer: Key Differentiators vs Value Delivered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-800 font-sans">
        <div>
          <h3 className="text-xs font-mono tracking-wider uppercase text-cyan-400 font-bold mb-3">
            🎯 KEY DIFFERENTIATORS
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2 items-start">
              <div className="mt-1 flex items-center justify-center p-1 bg-cyan-950 border border-cyan-800 rounded-md">
                <Layers className="w-3 h-3 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Full-Spectrum Human-Centricity</h4>
                <p className="text-[11px] text-slate-400">Understands both physical tired indices (camera) and raw mental strain metrics (wristwatch) to calculate precise situational cognitive strain.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="mt-1 flex items-center justify-center p-1 bg-cyan-950 border border-cyan-800 rounded-md">
                <Zap className="w-3 h-3 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Adaptive Proactive Mitigation</h4>
                <p className="text-[11px] text-slate-400">Instead of sounding alarms *after* steering wiggles, matches traffic navigation data to change car setup *before* stress triggers (REACT BEFORE stress).</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono tracking-wider uppercase text-cyan-400 font-bold mb-3">
            💎 VALUE DELIVERED
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2 items-start">
              <div className="mt-1 flex items-center justify-center p-1 bg-cyan-950 border border-cyan-800 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Enhanced Driver Safety Buffer</h4>
                <p className="text-[11px] text-slate-400">Lowers collision rates and reduces false positives by combining smartwatch biometrics with cabin cameras.</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="mt-1 flex items-center justify-center p-1 bg-cyan-950 border border-cyan-800 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Zero Cognitive Overload</h4>
                <p className="text-[11px] text-slate-400">Protects driver health, energy, and mental focus during long highway commutes or stop-and-go jams.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
