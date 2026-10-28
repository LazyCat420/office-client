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

function buildNewAgentDraft(initialData = {}, rosterLength = 0) {
  const roleRaw = initialData.role || 'QUANT';
  const orderRaw = initialData.execution_order || (rosterLength + 1);
  return {
    id: '__new__' + Date.now(),
    name: initialData.name || initialData.display_name || '',
    display_name: initialData.display_name || initialData.name || '',
    role: roleRaw.toUpperCase().replace(/\s+/g, '_'),
    system_prompt: initialData.system_prompt || initialData.prompt || '',
    voice_pitch: initialData.voice_pitch || 1.0,
    voice_rate: initialData.voice_rate || 1.0,
    avatar_config: initialData.avatar_config || { ...DEFAULT_AVATAR_CONFIG },
    allowed_tools: initialData.allowed_tools || initialData.tools || [],
    execution_order: Math.min(10, Math.max(1, orderRaw)),
    is_active: initialData.is_active !== undefined ? initialData.is_active : true,
    max_tokens: initialData.max_tokens || 8192,
    temperature: initialData.temperature || 0.7,
  };
}

function AgentRosterCard({ agent, isSelected, isNewlySaved, onSelect }) {
  const accentColor = ROLE_COLORS[agent.role] || '#3b82f6';
  const outfitColor = agent.avatar_config?.outfit_color;
  const cardClasses = [
    'agent-studio__card',
    isSelected ? 'agent-studio__card--selected' : '',
    isNewlySaved ? 'agent-studio__card--newly-saved' : '',
    !agent.is_active ? 'agent-studio__card--inactive' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      id={`agent-card-${agent.id}`}
      className={cardClasses}
      style={{ '--card-accent': accentColor }}
      onClick={() => onSelect(agent.id)}
    >
      <div
        className="agent-studio__card-avatar"
        style={{
          background: outfitColor ? `${outfitColor}30` : 'rgba(255,255,255,0.05)',
          borderColor: accentColor,
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
  );
}

function AgentRosterPanel({ agents, loading, selectedId, newlySavedId, onNew, onResetDefaults, onSelectAgent }) {
  return (
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
            onClick={onNew}
          >
            + New
          </button>
          <button
            className="agent-studio__btn"
            onClick={onResetDefaults}
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
            <button className="agent-studio__btn agent-studio__btn--primary" onClick={onNew}>
              Create your first agent
            </button>
          </div>
        )}
        {agents.map(agent => (
          <AgentRosterCard
            key={agent.id}
            agent={agent}
            isSelected={selectedId === agent.id}
            isNewlySaved={newlySavedId === agent.id}
            onSelect={onSelectAgent}
          />
        ))}
      </div>
    </div>
  );
}

function AgentStudioTabsBar({
  rightTab,
  setRightTab,
  showExtraTabs,
  selectedAgent,
  ChatPanelComponent,
  LogsPanelComponent,
  AgentDataPanelComponent,
}) {
  return (
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
  );
}

function AgentStudioExtraTabPanels({
  rightTab,
  selectedAgent,
  showExtraTabs,
  ChatPanelComponent,
  LogsPanelComponent,
  AgentDataPanelComponent,
  agentMessages,
  setAgentMessages,
}) {
  if (!showExtraTabs) return null;
  return (
    <>
      {ChatPanelComponent && (
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
      {LogsPanelComponent && (
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'logs' ? undefined : 'none', overflow: 'hidden' }}>
          {selectedAgent && <LogsPanelComponent agentName={selectedAgent.name} />}
        </div>
      )}
      {AgentDataPanelComponent && (
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'data' ? undefined : 'none', overflow: 'hidden' }}>
          {selectedAgent && <AgentDataPanelComponent agentName={selectedAgent.name} />}
        </div>
      )}
    </>
  );
}

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
    const newAgent = buildNewAgentDraft(initialData, agents.length);
    setAgents(prev => [...prev, newAgent]);
    setSelectedId(newAgent.id);
    setRightTab('editor');
  }, [agents.length]);

  const handleResetDefaults = useCallback(async () => {
    const data = await api.resetAgentDefaults();
    if (data?.agents) {
      setAgents(data.agents);
      setSelectedId(null);
    }
  }, []);

  const handleSelectAgent = useCallback((id) => {
    setSelectedId(id);
    setRightTab('editor');
  }, []);

  return (
    <div className="agent-studio">
      {/* ── Left: Agent Roster ── */}
      <AgentRosterPanel
        agents={agents}
        loading={loading}
        selectedId={selectedId}
        newlySavedId={newlySavedId}
        onNew={handleNew}
        onResetDefaults={handleResetDefaults}
        onSelectAgent={handleSelectAgent}
      />

      {/* ── Right: Tabbed Panel ── */}
      <div className="agent-studio__editor">
        {/* Tab bar */}
        <AgentStudioTabsBar
          rightTab={rightTab}
          setRightTab={setRightTab}
          showExtraTabs={showExtraTabs}
          selectedAgent={selectedAgent}
          ChatPanelComponent={ChatPanelComponent}
          LogsPanelComponent={LogsPanelComponent}
          AgentDataPanelComponent={AgentDataPanelComponent}
        />

        {/* Tab content — both always mounted, inactive hidden to preserve state */}
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'editor' ? undefined : 'none' }}>
          <AgentEditor
            agent={selectedAgent}
            onSave={handleSave}
            onDelete={handleDelete}
            RigComponent={RigComponent}
          />
        </div>
        <AgentStudioExtraTabPanels
          rightTab={rightTab}
          selectedAgent={selectedAgent}
          showExtraTabs={showExtraTabs}
          ChatPanelComponent={ChatPanelComponent}
          LogsPanelComponent={LogsPanelComponent}
          AgentDataPanelComponent={AgentDataPanelComponent}
          agentMessages={agentMessages}
          setAgentMessages={setAgentMessages}
        />
        <div className="agent-studio__tab-content" style={{ display: rightTab === 'omni' ? undefined : 'none' }}>
          <OmniChat onCreateAgent={handleNew} onRefreshRoster={loadAgents} onAgentSaved={handleSave} rosterCount={agents.length} />
        </div>
      </div>
    </div>
  );
}

