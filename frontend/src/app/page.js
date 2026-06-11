'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { TelemetryProvider } from '@/features/telemetry/telemetryStore';
import { useTelemetry } from '@/features/telemetry/useTelemetry';
import { setAudioEnabled as setVoiceAudioEnabled } from '@/components/agent-office/shared';
import { soundManager } from '@/components/3d-office/SoundManager';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy-load heavy 3D and Agent Studio components
const AgentOffice3D = dynamic(() => import('@/components/3d-office/AgentOffice3D'), { ssr: false });
const AgentStudio = dynamic(() => import('@/components/agent-studio/AgentStudio'), { ssr: false });

function OfficeApp() {
  const { currentCycle } = useTelemetry();
  const cycleStatus = currentCycle;

  // Audio mute
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const stored = localStorage.getItem('office-audioMutedV1');
      return stored !== null ? stored === 'true' : true;
    } catch { return true; }
  });

  // Initialize SoundManager on first user interaction (browsers require user gesture)
  useEffect(() => {
    const initOnClick = () => {
      soundManager.init();
      document.removeEventListener('click', initOnClick);
    };
    document.addEventListener('click', initOnClick, { once: true });
    return () => document.removeEventListener('click', initOnClick);
  }, []);

  useEffect(() => {
    localStorage.setItem('office-audioMutedV1', String(isMuted));
    soundManager.setMute(isMuted);
    setVoiceAudioEnabled(!isMuted);
  }, [isMuted]);

  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState('studio');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Pipeline status display
  const pipelineStatus = cycleStatus?.status || 'idle';
  const pipelinePhase = cycleStatus?.phase;

  const statusLabel = pipelineStatus === 'running'
    ? `🟢 Running${pipelinePhase ? ` — ${pipelinePhase}` : ''}`
    : pipelineStatus === 'paused'
      ? '🟡 Paused'
      : '⚫ Idle';

  return (
    <div className="office-shell">
      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="office-toolbar">
        <div className="office-toolbar-title">
          <span>🏢</span>
          <span>Agent Office</span>
          <span className="status-indicator" style={{ marginLeft: 12 }}>{statusLabel}</span>
        </div>

        <div className="office-toolbar-actions">
          <button
            className={`mute-btn ${!isMuted ? 'unmuted' : ''}`}
            onClick={() => setIsMuted(prev => !prev)}
          >
            {isMuted ? '🔇 Muted' : '🔊 Audio On'}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setSidebarOpen(prev => !prev)}
          >
            {sidebarOpen ? '◀ Hide Panel' : '▶ Show Panel'}
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="office-content">
        {/* Main 3D Office */}
        <div className="office-main">
          <ErrorBoundary>
            <AgentOffice3D
              events={cycleStatus?.events || []}
              status={cycleStatus?.status || 'idle'}
              phase={cycleStatus?.phase}
              audioEnabled={!isMuted}
            />
          </ErrorBoundary>
        </div>

        {/* Sidebar: Agent Studio */}
        <div className={`office-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
          {sidebarOpen && (
            <>
              <div className="tab-bar">
                <button
                  className={`tab-item ${sidebarTab === 'studio' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('studio')}
                >
                  🎨 Agent Studio
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <ErrorBoundary>
                  {sidebarTab === 'studio' && <AgentStudio />}
                </ErrorBoundary>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <TelemetryProvider>
      <OfficeApp />
    </TelemetryProvider>
  );
}
