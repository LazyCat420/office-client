'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import AvatarPreview from './AvatarPreview';
import ToolSelection from './ToolSelection';
import {
  DEFAULT_AVATAR_CONFIG,
  ACCESSORY_OPTIONS,
  SLOT_ORDER,
  SLOT_LABELS,
  normalizeAccessories,
  accessoryForSlot,
  setAccessorySlot,
} from '@/components/3d-office/agent/avatarConfig';

const ROLES = [
  { value: 'QUANT', label: 'Quantitative Analyst', icon: '📐' },
  { value: 'TECHNICAL', label: 'Technical Analyst', icon: '📈' },
  { value: 'FUNDAMENTAL', label: 'Fundamental Analyst', icon: '📊' },
  { value: 'BEHAVIORAL', label: 'Behavioral/Sentiment', icon: '🧠' },
  { value: 'RISK', label: 'Risk Manager', icon: '🛡️' },
  { value: 'DATA_JANITOR', label: 'Data Janitor', icon: '🧹' },
  { value: 'PM', label: 'Portfolio Manager', icon: '👔' },
];

const ACCENTS = [
  { value: '', label: 'Default (Auto)' },
  { value: "en_GB-alan-low", label: "GB Alan (Low)" },
  { value: "en_GB-alan-medium", label: "GB Alan (Medium)" },
  { value: "en_GB-alba-medium", label: "GB Alba (Medium)" },
  { value: "en_GB-aru-medium", label: "GB Aru (Medium)" },
  { value: "en_GB-cori-high", label: "GB Cori (High)" },
  { value: "en_GB-cori-medium", label: "GB Cori (Medium)" },
  { value: "en_GB-jenny_dioco-medium", label: "GB Jenny Dioco (Medium)" },
  { value: "en_GB-northern_english_male-medium", label: "GB Northern English Male (Medium)" },
  { value: "en_GB-semaine-medium", label: "GB Semaine (Medium)" },
  { value: "en_GB-southern_english_female-low", label: "GB Southern English Female (Low)" },
  { value: "en_GB-vctk-medium", label: "GB Vctk (Medium)" },
  { value: "en_US-amy-low", label: "US Amy (Low)" },
  { value: "en_US-amy-medium", label: "US Amy (Medium)" },
  { value: "en_US-arctic-medium", label: "US Arctic (Medium)" },
  { value: "en_US-bryce-medium", label: "US Bryce (Medium)" },
  { value: "en_US-danny-low", label: "US Danny (Low)" },
  { value: "en_US-hfc_female-medium", label: "US Hfc Female (Medium)" },
  { value: "en_US-hfc_male-medium", label: "US Hfc Male (Medium)" },
  { value: "en_US-joe-medium", label: "US Joe (Medium)" },
  { value: "en_US-john-medium", label: "US John (Medium)" },
  { value: "en_US-kathleen-low", label: "US Kathleen (Low)" },
  { value: "en_US-kristin-medium", label: "US Kristin (Medium)" },
  { value: "en_US-kusal-medium", label: "US Kusal (Medium)" },
  { value: "en_US-l2arctic-medium", label: "US L2Arctic (Medium)" },
  { value: "en_US-lessac-high", label: "US Lessac (High)" },
  { value: "en_US-lessac-low", label: "US Lessac (Low)" },
  { value: "en_US-lessac-medium", label: "US Lessac (Medium)" },
  { value: "en_US-libritts-high", label: "US Libritts (High)" },
  { value: "en_US-libritts_r-medium", label: "US Libritts R (Medium)" },
  { value: "en_US-ljspeech-high", label: "US Ljspeech (High)" },
  { value: "en_US-ljspeech-medium", label: "US Ljspeech (Medium)" },
  { value: "en_US-norman-medium", label: "US Norman (Medium)" },
  { value: "en_US-reza_ibrahim-medium", label: "US Reza Ibrahim (Medium)" },
  { value: "en_US-ryan-high", label: "US Ryan (High)" },
  { value: "en_US-ryan-low", label: "US Ryan (Low)" },
  { value: "en_US-ryan-medium", label: "US Ryan (Medium)" },
  { value: "en_US-sam-medium", label: "US Sam (Medium)" },
];

function buildAgentFormState(agent) {
  return {
    name: agent.name || '',
    display_name: agent.display_name || '',
    role: agent.role || 'QUANT',
    system_prompt: agent.system_prompt || '',
    voice_pitch: agent.voice_pitch ?? 1.0,
    voice_rate: agent.voice_rate ?? 1.0,
    voice_accent: agent.voice_accent || '',
    avatar_config: {
      ...DEFAULT_AVATAR_CONFIG,
      ...(agent.avatar_config || {}),
      accessories: normalizeAccessories(agent.avatar_config),
    },
    allowed_tools: agent.allowed_tools || [],
    execution_order: agent.execution_order ?? 1,
    is_active: agent.is_active ?? true,
    max_tokens: agent.max_tokens ?? 8192,
    temperature: agent.temperature ?? 0.7,
  };
}

async function synthesizeAndPlayVoiceSample(form) {
  const text = `Hello! I am ${form.display_name || form.name || 'testing my voice'}. How do I sound?`;
  const accent = form.voice_accent || 'default';

  try {
    const res = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_accent: accent }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = form.voice_rate ?? 1.0;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (err) {
    console.warn('[TestVoice] Piper TTS failed, falling back to browser speech:', err);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = form.voice_pitch ?? 1.0;
      utterance.rate = form.voice_rate ?? 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }
}

function AgentEditorHeader({ form, agentId, saving, onSave, onDelete }) {
  const roleIcon = ROLES.find(r => r.value === form.role)?.icon || '🤖';
  const titleLabel = form.display_name || form.name || 'New Agent';
  return (
    <div className="agent-studio__editor-header">
      <div className="agent-studio__editor-title">
        <span>{roleIcon}</span>
        <span>Editing: {titleLabel}</span>
      </div>
      <div className="agent-studio__editor-actions">
        <button
          className="agent-studio__btn agent-studio__btn--primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? '⏳' : '💾'} Save
        </button>
        {agentId && (
          <button
            className="agent-studio__btn agent-studio__btn--danger"
            onClick={onDelete}
            disabled={saving}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}

function AgentIdentitySection({ form, update }) {
  return (
    <div className="agent-studio__section">
      <div className="agent-studio__section-title">🏷️ Identity</div>
      <div className="agent-studio__row">
        <div className="agent-studio__field">
          <label className="agent-studio__label">Name</label>
          <input
            className="agent-studio__input"
            value={form.name || ''}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g., Dr. Aris"
          />
        </div>
        <div className="agent-studio__field">
          <label className="agent-studio__label">Display Name</label>
          <input
            className="agent-studio__input"
            value={form.display_name || ''}
            onChange={e => update('display_name', e.target.value)}
            placeholder="e.g., The Quant"
          />
        </div>
      </div>
      <div className="agent-studio__row">
        <div className="agent-studio__field">
          <label className="agent-studio__label">Role Key</label>
          <input
            list="roles-list"
            className="agent-studio__input"
            value={form.role || ''}
            onChange={e => update('role', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
            placeholder="e.g., QUANT, AUDITOR"
          />
          <datalist id="roles-list">
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </datalist>
        </div>
        <div className="agent-studio__field">
          <label className="agent-studio__label">Execution Order</label>
          <input
            className="agent-studio__input"
            type="number"
            min={1}
            max={10}
            value={form.execution_order ?? 1}
            onChange={e => update('execution_order', parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
      <div className="agent-studio__field">
        <div className="agent-studio__toggle" onClick={() => update('is_active', !form.is_active)}>
          <div className={`agent-studio__toggle-track ${form.is_active ? 'agent-studio__toggle-track--on' : ''}`}>
            <div className="agent-studio__toggle-thumb" />
          </div>
          <span className="agent-studio__toggle-label">
            {form.is_active ? 'Active — participates in cycles' : 'Inactive — skipped during cycles'}
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentModelAndVoiceSections({ form, update, onTestVoice }) {
  const maxTokens = form.max_tokens ?? 8192;
  const temperature = form.temperature ?? 0.7;
  const voicePitch = form.voice_pitch ?? 1.0;
  const voiceRate = form.voice_rate ?? 1.0;

  return (
    <>
      <div className="agent-studio__section">
        <div className="agent-studio__section-title">⚙️ Model Settings</div>
        <div className="agent-studio__row">
          <div className="agent-studio__field">
            <label className="agent-studio__label">Max Tokens</label>
            <div className="agent-studio__slider-row">
              <input
                type="range"
                className="agent-studio__slider"
                min={128}
                max={65536}
                step={256}
                value={maxTokens}
                onChange={e => update('max_tokens', parseInt(e.target.value))}
              />
              <span className="agent-studio__slider-value">{maxTokens}</span>
            </div>
          </div>
          <div className="agent-studio__field">
            <label className="agent-studio__label">Temperature</label>
            <div className="agent-studio__slider-row">
              <input
                type="range"
                className="agent-studio__slider"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={e => update('temperature', parseFloat(e.target.value))}
              />
              <span className="agent-studio__slider-value">{temperature.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="agent-studio__section">
        <div className="agent-studio__section-title">🎙️ Voice Settings</div>
        <div className="agent-studio__row">
          <div className="agent-studio__field">
            <label className="agent-studio__label">Pitch</label>
            <div className="agent-studio__slider-row">
              <input
                type="range"
                className="agent-studio__slider"
                min={0.5}
                max={2}
                step={0.05}
                value={voicePitch}
                onChange={e => update('voice_pitch', parseFloat(e.target.value))}
              />
              <span className="agent-studio__slider-value">{voicePitch.toFixed(2)}</span>
            </div>
          </div>
          <div className="agent-studio__field">
            <label className="agent-studio__label">Rate</label>
            <div className="agent-studio__slider-row">
              <input
                type="range"
                className="agent-studio__slider"
                min={0.5}
                max={2}
                step={0.05}
                value={voiceRate}
                onChange={e => update('voice_rate', parseFloat(e.target.value))}
              />
              <span className="agent-studio__slider-value">{voiceRate.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="agent-studio__row" style={{ marginTop: 12 }}>
          <div className="agent-studio__field">
            <label className="agent-studio__label">Voice Accent</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="agent-studio__select"
                style={{ flex: 1 }}
                value={form.voice_accent || ''}
                onChange={e => update('voice_accent', e.target.value || null)}
              >
                {ACCENTS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <button
                className="agent-studio__btn agent-studio__btn--secondary"
                onClick={onTestVoice}
                title="Play a voice sample"
              >
                🔊 Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const AVATAR_COLOR_FIELDS = [
  { key: 'skin_color', label: 'Skin', fallback: '#fde68a' },
  { key: 'hair_color', label: 'Hair', fallback: '#1e293b' },
  { key: 'outfit_color', label: 'Outfit', fallback: '#3b82f6' },
  { key: 'accent_color', label: 'Accent', fallback: '#f59e0b' },
];

function AgentAvatarSection({ form, RigComponent, updateAvatar, updateAvatarSlot }) {
  const ac = form.avatar_config || {};
  return (
    <div className="agent-studio__section">
      <div className="agent-studio__section-title">🎨 Avatar Appearance</div>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        <div style={{ flex: '1' }}>
          <AvatarPreview form={form} RigComponent={RigComponent} />
        </div>
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="agent-studio__color-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {AVATAR_COLOR_FIELDS.map(f => (
              <div key={f.key} className="agent-studio__color-field">
                <input
                  type="color"
                  className="agent-studio__color-input"
                  value={ac[f.key] || f.fallback}
                  onChange={e => updateAvatar(f.key, e.target.value)}
                />
                <span className="agent-studio__color-label">{f.label}</span>
              </div>
            ))}
          </div>
          {SLOT_ORDER.map(slot => (
            <div key={slot} className="agent-studio__field" style={{ marginTop: 8 }}>
              <label className="agent-studio__label">{SLOT_LABELS[slot]}</label>
              <select
                className="agent-studio__select"
                value={accessoryForSlot(form.avatar_config, slot)}
                onChange={e => updateAvatarSlot(slot, e.target.value)}
              >
                {ACCESSORY_OPTIONS[slot].map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentStatusBanner({ statusMsg }) {
  if (!statusMsg) return null;
  const isSaved = statusMsg === 'Saved!';
  const isErr = statusMsg.startsWith('Error');
  const modClass = isSaved ? 'agent-studio__status--saved' : (isErr ? 'agent-studio__status--error' : '');
  const icon = isSaved ? '✓' : (isErr ? '✗' : 'ℹ');
  return (
    <div className={`agent-studio__status ${modClass}`}>
      {icon} {statusMsg}
    </div>
  );
}

export default function AgentEditor({ agent, onSave, onDelete, RigComponent }) {
  const [form, setForm] = useState({});
  const [tools, setTools] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (agent) {
      setForm(buildAgentFormState(agent));
      setStatusMsg('');
    }
  }, [agent]);

  useEffect(() => {
    api.getAgentTools().then(data => {
      if (data?.tools) setTools(data.tools);
    });
  }, []);

  const update = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAvatar = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      avatar_config: { ...prev.avatar_config, [key]: value },
    }));
  }, []);

  const updateAvatarSlot = useCallback((slot, value) => {
    setForm(prev => ({
      ...prev,
      avatar_config: setAccessorySlot(prev.avatar_config, slot, value),
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const isNew = !agent?.id || agent.id.startsWith('__new__');
      const result = isNew
        ? await api.createAgentPersona(form)
        : await api.updateAgentPersona(agent.id, form);

      if (result) {
        setStatusMsg('Saved!');
        onSave?.(result);
        setTimeout(() => setStatusMsg(''), 3000);
      } else {
        setStatusMsg('Error saving');
      }
    } catch (e) {
      setStatusMsg('Error: ' + (e.message || 'unknown'));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!agent?.id) return;
    setSaving(true);
    try {
      await api.deleteAgentPersona(agent.id);
      onDelete?.(agent.id);
    } catch {
      setStatusMsg('Delete failed');
    }
    setSaving(false);
  };

  if (!agent) {
    return (
      <div className="agent-studio__empty">
        <div className="agent-studio__empty-icon">🤖</div>
        <div>Select an agent to edit their persona</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          Or click &ldquo;+ New&rdquo; to create a new agent
        </div>
      </div>
    );
  }

  return (
    <>
      <AgentEditorHeader
        form={form}
        agentId={agent.id}
        saving={saving}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <div className="agent-studio__editor-body">
        <AgentIdentitySection form={form} update={update} />

        <div className="agent-studio__section">
          <div className="agent-studio__section-title">💬 System Prompt</div>
          <textarea
            className="agent-studio__textarea"
            value={form.system_prompt || ''}
            onChange={e => update('system_prompt', e.target.value)}
            placeholder="You are [Agent Name], the [Role]..."
            rows={8}
          />
        </div>

        <AgentModelAndVoiceSections
          form={form}
          update={update}
          onTestVoice={() => synthesizeAndPlayVoiceSample(form)}
        />

        <AgentAvatarSection
          form={form}
          RigComponent={RigComponent}
          updateAvatar={updateAvatar}
          updateAvatarSlot={updateAvatarSlot}
        />

        <div className="agent-studio__section">
          <div className="agent-studio__section-title">
            🔧 Tool Access
            <span style={{ fontSize: '0.6rem', opacity: 0.6, marginLeft: 8 }}>
              {(form.allowed_tools || []).length} selected
            </span>
          </div>
          <ToolSelection
            availableTools={tools}
            enabledTools={form.allowed_tools || []}
            onEnabledToolsChange={(newTools) => update('allowed_tools', newTools)}
          />
        </div>
      </div>

      <AgentStatusBanner statusMsg={statusMsg} />
    </>
  );
}
