'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';
import AgentEditor from './AgentEditor';
import OmniChat from './OmniChat';
import { DEFAULT_AVATAR_CONFIG } from '@/components/3d-office/agent/avatarConfig';
import './agentStudio.css';

const ROLE_COLORS = {
  QUANT: '#3b82f6',
  TECHNICAL: '#06b6d4',
  FUNDAMENTAL: '#7c3aed',
  BEHAVIORAL: '#dc2626',
  RISK: '#64748b',
  DATA_JANITOR: '#a3e635',
  PM: '#d4af37',
};

const ROLE_ICONS = {
  QUANT: '📐',
  TECHNICAL: '📈',
  FUNDAMENTAL: '📊',
  BEHAVIORAL: '🧠',
  RISK: '🛡️',
  DATA_JANITOR: '🧹',
  PM: '👔',
};

export default function AgentStudio({
  showExtraTabs = false,
  ChatPanelComponent,
  LogsPanelComponent,
  AgentDataPanelComponent,
  RigComponent
}) {
  const [agents, setAgents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newlySavedId, setNewlySavedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rightTab, setRightTab] = useState('editor'); // 'editor' | 'omni' | 'chat' | 'logs' | 'data'

  // State for the agent's specific chat panel
  const [agentMessages, setAgentMessages] = useState([]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const data = await api.getAgentPersonas();
    if (data?.agents) {
      setAgents(data.agents);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const selectedAgent = agents.find(a => a.id === selectedId) || null;

  const handleSave = useCallback((saved) => {
    setAgents(prev => {
      // Filter out any temporary/draft cards that might have been saved
      const filtered = prev.filter(a => !a.id || !a.id.startsWith('__new__'));
      const idx = filtered.findIndex(a => a.id === saved.id);
      if (idx >= 0) {
        const next = [...filtered];
        next[idx] = saved;
        return next;
      }
      return [...filtered, saved];
    });
    setSelectedId(saved.id);
    setNewlySavedId(saved.id);
  }, []);

  useEffect(() => {
    if (newlySavedId) {
      const element = document.getElementById(`agent-card-${newlySavedId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      const timer = setTimeout(() => {
        setNewlySavedId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [newlySavedId]);

  const handleDelete = useCallback((deletedId) => {
    setAgents(prev => prev.filter(a => a.id !== deletedId));
    setSelectedId(null);
  }, []);

  const handleNew = useCallback((initialData = {}) => {
    const newAgent = {
      id: null,
      name: initialData.name || initialData.display_name || '',
      display_name: initialData.display_name || initialData.name || '',
      role: (initialData.role || 'QUANT').toUpperCase().replace(/\s+/g, '_'),
      system_prompt: initialData.system_prompt || initialData.prompt || '',
      voice_pitch: initialData.voice_pitch || 1.0,
      voice_rate: initialData.voice_rate || 1.0,
      avatar_config: initialData.avatar_config || { ...DEFAULT_AVATAR_CONFIG },
      allowed_tools: initialData.allowed_tools || initialData.tools || [],
      execution_order: Math.min(10, Math.max(1, initialData.execution_order || (agents.length + 1))),
      is_active: initialData.is_active !== undefined ? initialData.is_active : true,
      max_tokens: initialData.max_tokens || 8192,
      temperature: initialData.temperature || 0.7,
    };
    // Use a temp key so the editor binds to it
    const tempId = '__new__' + Date.now();
    newAgent.id = tempId;
    setAgents(prev => [...prev, newAgent]);
    setSelectedId(tempId);
    setRightTab('editor');
  }, [agents.length]);

  const handleResetDefaults = useCallback(async () => {
    const data = await api.resetAgentDefaults();
    if (data?.agents) {
      setAgents(data.agents);
      setSelectedId(null);
    }
  }, []);

  return (
    <div className="agent-studio">
      {/* ── Left: Agent Roster ── */}
      <div className="agent-studio__roster">
        <div className="agent-studio__roster-header">
          <div className="agent-studio__roster-title">
            🤖 Agent Roster
            <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 400 }}>
              {agents.length} agents
            </span>
          </div>
          <div className="agent-studio__roster-actions">
            <button
              className="agent-studio__btn agent-studio__btn--primary"
              onClick={handleNew}
            >
              + New
            </button>
            <button
              className="agent-studio__btn"
              onClick={handleResetDefaults}
              title="Reset all agents to defaults"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        <div className="agent-studio__roster-list">
          {loading && (
            <div className="agent-studio__empty">
              <span className="spinner" style={{ width: 16, height: 16 }} />
              Loading agents...
            </div>
          )}
          {!loading && agents.length === 0 && (
            <div className="agent-studio__empty">
              <div>No agents configured</div>
              <button className="agent-studio__btn agent-studio__btn--primary" onClick={handleNew}>
                Create your first agent
              </button>
            </div>
          )}
          {agents.map(agent => (
            <div
              key={agent.id}
              id={`agent-card-${agent.id}`}
              className={`agent-studio__card ${
                selectedId === agent.id ? 'agent-studio__card--selected' : ''
              } ${newlySavedId === agent.id ? 'agent-studio__card--newly-saved' : ''} ${!agent.is_active ? 'agent-studio__card--inactive' : ''}`}
              style={{ '--card-accent': ROLE_COLORS[agent.role] || '#3b82f6' }}
              onClick={() => { setSelectedId(agent.id); setRightTab('editor'); }}
            >
              <div
                className="agent-studio__card-avatar"
                style={{
                  background: agent.avatar_config?.outfit_color
                    ? `${agent.avatar_config.outfit_color}30`
                    : 'rgba(255,255,255,0.05)',
                  borderColor: ROLE_COLORS[agent.role] || '#3b82f6',
                }}
              >
                {ROLE_ICONS[agent.role] || '🤖'}
              </div>
              <div className="agent-studio__card-info">
                <div className="agent-studio__card-name">
                  {agent.display_name || agent.name || 'Unnamed'}
                </div>
                <div className="agent-studio__card-role">
                  {agent.role?.replace('_', ' ') || 'Unknown'}
                </div>
              </div>
              <div className="agent-studio__card-order">
                #{agent.execution_order || '?'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Tabbed Panel ── */}
      <div className="agent-studio__editor">
        {/* Tab bar */}
        <div className="agent-studio__tabs">
          <button
            className={`agent-studio__tab${rightTab === 'editor' ? ' agent-studio__tab--active' : ''}`}
            onClick={() => setRightTab('editor')}
          >
            ✏️ Agent Editor
          </button>
          {showExtraTabs && ChatPanelComponent && (
            <button
              className={`agent-studio__tab${rightTab === 'chat' ? ' agent-studio__tab--active' : ''}`}
              onClick={() => setRightTab('chat')}
              disabled={!selectedAgent}
            >
              💬 Live Chat
            </button>
          )}
          {showExtraTabs && LogsPanelComponent && (
            <button
              className={`agent-studio__tab${rightTab === 'logs' ? ' agent-studio__tab--active' : ''}`}
              onClick={() => setRightTab('logs')}
              disabled={!selectedAgent}
            >
              📋 Logs
            </button>
          )}
          {showExtraTabs && AgentDataPanelComponent && (
            <button
              className={`agent-studio__tab${rightTab === 'data' ? ' agent-studio__tab--active' : ''}`}
              onClick={() => setRightTab('data')}
              disabled={!selectedAgent}
            >
              📊 Outputs & Data
            </button>
          )}
          <button
            className={`agent-studio__tab${rightTab === 'omni' ? ' agent-studio__tab--active' : ''}`}
            onClick={() => setRightTab('omni')}
          >
            🧠 OmniAgent
          </button>
        </div>

        {/* Tab content — both always mounted, inactive hidden to preserve state */}
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'editor' ? undefined : 'none' }}>
          <AgentEditor
            agent={selectedAgent}
            onSave={handleSave}
            onDelete={handleDelete}
            RigComponent={RigComponent}
          />
        </div>
        {showExtraTabs && ChatPanelComponent && (
          <div className="agent-studio__tab-content" style={{ display: rightTab === 'chat' ? undefined : 'none', overflow: 'hidden' }}>
            {selectedAgent && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--space-md)' }}>
                <ChatPanelComponent
                  messages={agentMessages}
                  setMessages={setAgentMessages}
                  agentNameFilter={selectedAgent.name}
                />
              </div>
            )}
          </div>
        )}
        {showExtraTabs && LogsPanelComponent && (
          <div className="agent-studio__tab-content" style={{ display: rightTab === 'logs' ? undefined : 'none', overflow: 'hidden' }}>
            {selectedAgent && <LogsPanelComponent agentName={selectedAgent.name} />}
          </div>
        )}
        {showExtraTabs && AgentDataPanelComponent && (
          <div className="agent-studio__tab-content" style={{ display: rightTab === 'data' ? undefined : 'none', overflow: 'hidden' }}>
            {selectedAgent && <AgentDataPanelComponent agentName={selectedAgent.name} />}
          </div>
        )}
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'omni' ? undefined : 'none' }}>
          <OmniChat onCreateAgent={handleNew} onRefreshRoster={loadAgents} onAgentSaved={handleSave} rosterCount={agents.length} />
        </div>
      </div>
    </div>
  );
}

