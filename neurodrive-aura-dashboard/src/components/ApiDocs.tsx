/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, Globe, Key, ShieldAlert } from 'lucide-react';
import { MOCK_API_DOCUMENTATION } from '../presetData';

export default function ApiDocs() {
  const [activeEndpointId, setActiveEndpointId] = useState<string>(MOCK_API_DOCUMENTATION[0].id);
  const [copied, setCopied] = useState<boolean>(false);

  const activeEndpoint = MOCK_API_DOCUMENTATION.find(e => e.id === activeEndpointId) || MOCK_API_DOCUMENTATION[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="aura-api-docs-container" className="bg-[#090d1a]/70 backdrop-blur-md border border-cyan-500/10 rounded-2xl p-6 lg:p-8 text-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.5)] relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="mb-8 border-b border-slate-800 pb-5 max-w-4xl">
        <span className="px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 font-mono text-xs uppercase tracking-widest rounded-full font-semibold">
          DEVELOPER INTEGRATION API
        </span>
        <h2 className="text-3xl font-bold font-sans tracking-tight text-white mt-3.5">
          AURA Core REST API & WebSockets
        </h2>
        <p className="text-slate-400 font-sans text-sm mt-2 leading-relaxed">
          Technical specifications for syncing the AURA Engine with external wearables (watch integration modules) and car-telematics ECUs over ultralow-latency micro-rest endpoints. Use these points to trigger system adaptive behaviors remotely.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left side list of endpoints */}
        <div className="lg:col-span-4 space-y-3.5">
          <h3 className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">ENDPOINTS</h3>
          
          <div className="space-y-2">
            {MOCK_API_DOCUMENTATION.map(endpoint => {
              const isActive = endpoint.id === activeEndpointId;
              const isPost = endpoint.method === 'POST';
              return (
                <button
                  key={endpoint.id}
                  id={`api-btn-${endpoint.id}`}
                  onClick={() => {
                    setActiveEndpointId(endpoint.id);
                    setCopied(false);
                  }}
                  className={`w-full text-left p-3.5 border rounded-xl transition-all font-mono block cursor-pointer ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#0d1e30] to-[#040c16] border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.15)] font-bold' 
                      : 'bg-[#060b18]/50 border-[#1a2536] hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isPost ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-850 text-slate-400 border border-slate-700'
                    }`}>
                      {endpoint.method}
                    </span>
                    <span className="text-[12px] font-bold text-slate-200 truncate">{endpoint.path}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                    {endpoint.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="border border-cyan-500/10 bg-[#040816]/40 p-4 rounded-xl space-y-2.5">
            <span className="text-[11px] font-mono tracking-widest font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> Authentication
            </span>
            <p className="text-[11px] text-slate-450 font-sans leading-relaxed">
              Authenticate requests using the <code className="bg-slate-950 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] border border-slate-900">X-AURA-Vehicle-Token</code> in the HTTP request header. Vehicles refresh this token autonomously during key cycles.
            </p>
          </div>
        </div>

        {/* Right side content detail explorer */}
        <div className="lg:col-span-8 space-y-5">
          <div className="border border-cyan-500/10 bg-[#040816]/60 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl">
            {/* Window bar */}
            <div className="bg-[#0b1021] px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-slate-200">REST Client Simulator</span>
              </div>
              <span className="text-slate-400 text-[10px] font-mono uppercase bg-[#030611] px-2 py-0.5 rounded-md border border-cyan-800/10">
                Host: https://api.neurodrive.aura/v1
              </span>
            </div>

            {/* Content info info body */}
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#06b6d5]">ENDPOINT OVERVIEW</span>
                <h4 className="text-base font-bold text-white mt-1.5 flex items-center gap-2 font-mono">
                  <span className={`text-[10.5px] px-2.5 py-0.5 rounded border font-semibold ${
                    activeEndpoint.method === 'POST' ? 'bg-[#0f2430]/90 text-cyan-300 border-cyan-500/30' : 'bg-[#1e1a38] text-indigo-300 border-indigo-900/40'
                  }`}>
                    {activeEndpoint.method}
                  </span>
                  <span className="tracking-wide text-slate-100">{activeEndpoint.path}</span>
                </h4>
                <p className="text-xs text-slate-350 mt-2 font-sans leading-relaxed">
                  {activeEndpoint.description}
                </p>
              </div>

              {/* Request schema payload section if present */}
              {activeEndpoint.requestBody && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">HTTP Request JSON Body</span>
                    <button 
                      onClick={() => handleCopy(activeEndpoint.requestBody || '')}
                      className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-[10px]"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy Payload'}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-[#070b13] border border-slate-850 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                    {activeEndpoint.requestBody}
                  </pre>
                </div>
              )}

              {/* Response payload block */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">JSON Success Response (200 OK)</span>
                  {!activeEndpoint.requestBody && (
                    <button 
                      onClick={() => handleCopy(activeEndpoint.responseBody)}
                      className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-[10px]"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy Response'}
                    </button>
                  )}
                </div>
                <pre className="p-3.5 bg-[#070b13] border border-indigo-950/50 rounded-lg text-[11px] font-mono text-indigo-300 overflow-x-auto leading-relaxed">
                  {activeEndpoint.responseBody}
                </pre>
              </div>
            </div>
          </div>

          {/* Quick WebSocket details block */}
          <div className="border border-indigo-900/10 bg-indigo-950/5 rounded-xl p-4.5 flex gap-4 items-start font-sans">
            <Terminal className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-mono font-bold text-indigo-200">💡 Dynamic High-Frequency WebSocket Streaming</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                For telemetry and blink vector streams, dial a raw coordinate stream to <code className="bg-slate-950 border border-slate-850 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-300">wss://api.neurodrive.aura/v1/telemetry/stream</code>. Supports binary protobuffers over 5G networks to ensure overall packet delay resides under 5 milliseconds.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
