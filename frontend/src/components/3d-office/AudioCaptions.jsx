'use client';

import React, { useEffect, useState, useRef } from 'react';
import { audioChannelEmitter } from '../agent-office/audioChannel';

const CAPTION_TTL_MS = 6000;
const MAX_CAPTIONS = 4;

// 'V3_PORTFOLIO_MANAGER' → 'Portfolio Manager'
function displayName(agentId) {
  if (!agentId || agentId === 'system') return 'Office';
  return String(agentId)
    .replace(/^V3_/i, '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * AudioCaptions — bottom-left ticker naming every clip the audio channel
 * plays: StarCraft barks ("Quant Analyst · casting a vote") and spoken TTS
 * lines. This is the answer to "who is saying what" — before this, barks
 * played with zero on-screen attribution.
 */
export function AudioCaptions() {
  const [captions, setCaptions] = useState([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const onAudioStart = (e) => {
      const { kind, agentId, reason, text } = e.detail || {};
      const id = nextIdRef.current++;
      const caption = {
        id,
        kind,
        name: displayName(agentId),
        detail: kind === 'speech'
          ? `“${(text || '').length > 90 ? `${text.slice(0, 90)}…` : (text || '')}”`
          : (reason || ''),
      };
      setCaptions(prev => [...prev.slice(-(MAX_CAPTIONS - 1)), caption]);
      setTimeout(() => {
        setCaptions(prev => prev.filter(c => c.id !== id));
      }, CAPTION_TTL_MS);
    };
    audioChannelEmitter.addEventListener('audio-start', onAudioStart);
    return () => audioChannelEmitter.removeEventListener('audio-start', onAudioStart);
  }, []);

  if (captions.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 12,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      pointerEvents: 'none',
      maxWidth: '46%',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {captions.map(c => (
        <div key={c.id} style={{
          background: 'rgba(2, 6, 23, 0.82)',
          border: `1px solid ${c.kind === 'speech' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(148, 163, 184, 0.35)'}`,
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          color: '#e2e8f0',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
          animation: 'agent-bubble-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ marginRight: 6 }}>{c.kind === 'speech' ? '🗣️' : '📢'}</span>
          <span style={{ fontWeight: 700, color: c.kind === 'speech' ? '#38bdf8' : '#fbbf24' }}>{c.name}</span>
          {c.detail && <span style={{ color: '#94a3b8' }}> · {c.detail}</span>}
        </div>
      ))}
    </div>
  );
}
