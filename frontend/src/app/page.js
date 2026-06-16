'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { TelemetryProvider } from '@/features/telemetry/telemetryStore';
import { useTelemetry } from '@/features/telemetry/useTelemetry';
import { initializeAudio, disableAudio } from '@/components/agent-office/audioContextManager';
import { soundManager } from '@/components/3d-office/SoundManager';
import ErrorBoundary from '@/components/ErrorBoundary';

import { AgentGridPanel } from '@/components/agent-office/AgentGridPanel';

const AgentOffice3D = dynamic(() => import('@/components/3d-office/AgentOffice3D'), { ssr: false });

function OfficeApp() {
  const { currentCycle } = useTelemetry();
  const cycleStatus = currentCycle;

  // Audio mute
  const [isMuted, setIsMuted] = useState(true);
  const isMutedRef = useRef(isMuted);
  const isInitialMount = useRef(true);
  const hasInteractedRef = useRef(false);

  // Data Grid Toggle
  const [showDataGrid, setShowDataGrid] = useState(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Sync mute state on mount (restoring localStorage value)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('office-audioMutedV1');
      if (stored !== null) {
        setIsMuted(stored === 'true');
      }
    } catch (localStorageError) {}
  }, []);

  // Initialize SoundManager on first user interaction (browsers require user gesture)
  useEffect(() => {
    const initOnClick = () => {
      hasInteractedRef.current = true;
      soundManager.init();
      if (!isMutedRef.current) {
        initializeAudio();
      }
      document.removeEventListener('click', initOnClick);
    };
    document.addEventListener('click', initOnClick, { once: true });
    return () => document.removeEventListener('click', initOnClick);
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    try {
      localStorage.setItem('office-audioMutedV1', String(isMuted));
    } catch (localStorageError) {}

    soundManager.setMute(isMuted);
    if (!isMuted) {
      if (hasInteractedRef.current) {
        initializeAudio();
      }
    } else {
      disableAudio();
    }
  }, [isMuted]);


  // Pipeline status display
  const pipelineStatus = cycleStatus?.status || 'idle';
  const pipelinePhase = cycleStatus?.phase;

  const statusLabel = pipelineStatus === 'running'
    ? `🟢 Running${pipelinePhase ? ` — ${pipelinePhase}` : ''}`
    : pipelineStatus === 'paused'
      ? '🟡 Paused'
      : '⚫ Idle';

  return (
    <main className="office-shell">
      {/* ── Toolbar ─────────────────────────────────── */}
      <header className="office-toolbar">
        <div className="office-toolbar-title">
          <span>🏢</span>
          <span>Agent Office</span>
          <span className="status-indicator" style={{ marginLeft: 12 }}>{statusLabel}</span>
        </div>

        <div className="office-toolbar-actions">
          <button
            className={`toolbar-btn ${showDataGrid ? 'active' : ''}`}
            onClick={() => setShowDataGrid(previousState => !previousState)}
            aria-pressed={showDataGrid}
            style={{ marginRight: 8, padding: '4px 12px', borderRadius: 4, background: showDataGrid ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showDataGrid ? '#38bdf8' : 'transparent'}`, color: showDataGrid ? '#38bdf8' : '#e2e8f0', cursor: 'pointer' }}
          >
            📊 Data Grid
          </button>
          <button
            className={`mute-btn ${!isMuted ? 'unmuted' : ''}`}
            onClick={() => setIsMuted(previousMuteState => !previousMuteState)}
            aria-pressed={!isMuted}
          >
            {isMuted ? '🔇 Muted' : '🔊 Audio On'}
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────── */}
      <section className="office-content" style={{ position: 'relative' }}>
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

        {/* Data Grid Overlay */}
        <AgentGridPanel visible={showDataGrid} />
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <TelemetryProvider>
      <OfficeApp />
    </TelemetryProvider>
  );
}
