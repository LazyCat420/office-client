'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import AvatarPreview from './AvatarPreview';
import ToolSelection from './ToolSelection';

const ROLES = [
  { value: 'QUANT', label: 'Quantitative Analyst', icon: '📐' },
  { value: 'TECHNICAL', label: 'Technical Analyst', icon: '📈' },
  { value: 'FUNDAMENTAL', label: 'Fundamental Analyst', icon: '📊' },
  { value: 'BEHAVIORAL', label: 'Behavioral/Sentiment', icon: '🧠' },
  { value: 'RISK', label: 'Risk Manager', icon: '🛡️' },
  { value: 'DATA_JANITOR', label: 'Data Janitor', icon: '🧹' },
  { value: 'PM', label: 'Portfolio Manager', icon: '👔' },
];

const ACCESSORIES = [
  { value: '', label: 'None' },
  { value: 'glasses', label: 'Glasses' },
  { value: 'top_hat', label: 'Top Hat' },
  { value: 'cap', label: 'Baseball Cap' },
  { value: 'crown', label: 'Crown' },
  { value: 'beanie', label: 'Beanie' },
  { value: 'tie', label: 'Tie' },
  { value: 'headset', label: 'Headset' },
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

export default function AgentEditor({ agent, onSave, onDelete, RigComponent }) {
  const [form, setForm] = useState({});
  const [tools, setTools] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Sync form with selected agent
  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || '',
        display_name: agent.display_name || '',
        role: agent.role || 'QUANT',
        system_prompt: agent.system_prompt || '',
        voice_pitch: agent.voice_pitch ?? 1.0,
        voice_rate: agent.voice_rate ?? 1.0,
        voice_accent: agent.voice_accent || '',
        avatar_config: {
          skin_color: agent.avatar_config?.skin_color || '#fde68a',
          hair_color: agent.avatar_config?.hair_color || '#1e293b',
          outfit_color: agent.avatar_config?.outfit_color || '#3b82f6',
          accent_color: agent.avatar_config?.accent_color || '#f59e0b',
          accessory: agent.avatar_config?.accessory || '',
        },
        allowed_tools: agent.allowed_tools || [],
        execution_order: agent.execution_order ?? 1,
        is_active: agent.is_active ?? true,
        max_tokens: agent.max_tokens ?? 8192,
        temperature: agent.temperature ?? 0.7,
      });
      setStatusMsg('');
    }
  }, [agent]);

  // Load tools on mount
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
    } catch (e) {
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

  const handleTestVoice = async () => {
    const text = `Hello! I am ${form.display_name || form.name || "testing my voice"}. How do I sound?`;
    const accent = form.voice_accent || 'default';

    try {
      const res = await fetch('/api/v1/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_accent: accent })
      });

      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = (form.voice_rate ?? 1.0) * 1.15;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (err) {
      console.warn('[TestVoice] Piper TTS failed, falling back to browser speech:', err);
      // Fallback to browser speechSynthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = form.voice_pitch ?? 1.0;
        utterance.rate = (form.voice_rate ?? 1.0) * 1.15;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <>
      <div className="agent-studio__editor-header">
        <div className="agent-studio__editor-title">
          <span>{ROLES.find(r => r.value === form.role)?.icon || '🤖'}</span>
          <span>Editing: {form.display_name || form.name || 'New Agent'}</span>
        </div>
        <div className="agent-studio__editor-actions">
          <button
            className="agent-studio__btn agent-studio__btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '⏳' : '💾'} Save
          </button>
          {agent.id && (
            <button
              className="agent-studio__btn agent-studio__btn--danger"
              onClick={handleDelete}
              disabled={saving}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      <div className="agent-studio__editor-body">
        {/* ── Identity ── */}
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

        {/* ── System Prompt ── */}
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

        {/* ── Model Settings ── */}
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
                  value={form.max_tokens ?? 8192}
                  onChange={e => update('max_tokens', parseInt(e.target.value))}
                />
                <span className="agent-studio__slider-value">{form.max_tokens ?? 8192}</span>
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
                  value={form.temperature ?? 0.7}
                  onChange={e => update('temperature', parseFloat(e.target.value))}
                />
                <span className="agent-studio__slider-value">{(form.temperature ?? 0.7).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Voice ── */}
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
                  value={form.voice_pitch ?? 1.0}
                  onChange={e => update('voice_pitch', parseFloat(e.target.value))}
                />
                <span className="agent-studio__slider-value">{(form.voice_pitch ?? 1.0).toFixed(2)}</span>
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
                  value={form.voice_rate ?? 1.0}
                  onChange={e => update('voice_rate', parseFloat(e.target.value))}
                />
                <span className="agent-studio__slider-value">{(form.voice_rate ?? 1.0).toFixed(2)}</span>
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
                  onClick={handleTestVoice}
                  title="Play a voice sample"
                >
                  🔊 Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Avatar ── */}
        <div className="agent-studio__section">
          <div className="agent-studio__section-title">🎨 Avatar Appearance</div>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            {/* Left side: Preview Canvas */}
            <div style={{ flex: '1' }}>
              <AvatarPreview form={form} RigComponent={RigComponent} />
            </div>
            
            {/* Right side: Color Controls */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="agent-studio__color-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="agent-studio__color-field">
                  <input
                    type="color"
                    className="agent-studio__color-input"
                    value={form.avatar_config?.skin_color || '#fde68a'}
                    onChange={e => updateAvatar('skin_color', e.target.value)}
                  />
                  <span className="agent-studio__color-label">Skin</span>
                </div>
                <div className="agent-studio__color-field">
                  <input
                    type="color"
                    className="agent-studio__color-input"
                    value={form.avatar_config?.hair_color || '#1e293b'}
                    onChange={e => updateAvatar('hair_color', e.target.value)}
                  />
                  <span className="agent-studio__color-label">Hair</span>
                </div>
                <div className="agent-studio__color-field">
                  <input
                    type="color"
                    className="agent-studio__color-input"
                    value={form.avatar_config?.outfit_color || '#3b82f6'}
                    onChange={e => updateAvatar('outfit_color', e.target.value)}
                  />
                  <span className="agent-studio__color-label">Outfit</span>
                </div>
                <div className="agent-studio__color-field">
                  <input
                    type="color"
                    className="agent-studio__color-input"
                    value={form.avatar_config?.accent_color || '#f59e0b'}
                    onChange={e => updateAvatar('accent_color', e.target.value)}
                  />
                  <span className="agent-studio__color-label">Accent</span>
                </div>
              </div>
              <div className="agent-studio__field" style={{ marginTop: 8 }}>
                <label className="agent-studio__label">Accessory / Hat</label>
                <select
                  className="agent-studio__select"
                  value={form.avatar_config?.accessory || ''}
                  onChange={e => updateAvatar('accessory', e.target.value || null)}
                >
                  {ACCESSORIES.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tools ── */}
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

      {/* ── Status Bar ── */}
      {statusMsg && (
        <div className={`agent-studio__status ${
          statusMsg === 'Saved!' ? 'agent-studio__status--saved' :
          statusMsg.startsWith('Error') ? 'agent-studio__status--error' : ''
        }`}>
          {statusMsg === 'Saved!' ? '✓' : statusMsg.startsWith('Error') ? '✗' : 'ℹ'} {statusMsg}
        </div>
      )}
    </>
  );
}
