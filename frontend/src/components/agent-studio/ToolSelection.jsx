'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Globe2,
  BarChart3,
  BookOpen,
  Cpu,
  Bot,
  Layers,
  Brain,
  Wrench,
  TrendingUp,
  Database,
  Shield,
  Users,
  Zap,
  Activity,
} from 'lucide-react';
import './toolSelection.css';

// ── Domain icon mapping (matches prism-client's DOMAIN_ICONS) ──
const DOMAIN_ICONS = {
  'Market Data': BarChart3,
  'Research & Intelligence': Globe2,
  'Memory & Knowledge': BookOpen,
  'Quant & Analytics': TrendingUp,
  'Agent Coordination': Users,
  'Trading & Execution': Zap,
  'System & Autonomy': Shield,
  'General': Wrench,
  'Other': Layers,
};

const DOMAIN_ORDER = [
  'Market Data',
  'Research & Intelligence',
  'Memory & Knowledge',
  'Quant & Analytics',
  'Agent Coordination',
  'Trading & Execution',
  'System & Autonomy',
  'General',
  'Other',
];

// ── Label icon mapping ──
const LABEL_ICONS = {
  'market-data': BarChart3,
  'stock-analysis': TrendingUp,
  'research': Globe2,
  'scraping': Globe2,
  'web-search': Globe2,
  'memory': BookOpen,
  'knowledge': BookOpen,
  'wiki': BookOpen,
  'quant': TrendingUp,
  'analytics': Activity,
  'calculations': Cpu,
  'coordination': Users,
  'teamwork': Users,
  'cycle-context': Users,
  'trading': Zap,
  'execution': Zap,
  'portfolio': BarChart3,
  'system': Shield,
  'autonomy': Shield,
  'audit': Shield,
  'tool': Wrench,
};

const LABEL_DISPLAY = {
  'market-data': 'Market Data',
  'stock-analysis': 'Stock Analysis',
  'research': 'Research',
  'scraping': 'Scraping',
  'web-search': 'Web Search',
  'memory': 'Memory',
  'knowledge': 'Knowledge',
  'wiki': 'Wiki',
  'quant': 'Quantitative',
  'analytics': 'Analytics',
  'calculations': 'Calculations',
  'coordination': 'Coordination',
  'teamwork': 'Teamwork',
  'cycle-context': 'Cycle Context',
  'trading': 'Trading',
  'execution': 'Execution',
  'portfolio': 'Portfolio',
  'system': 'System',
  'autonomy': 'Autonomy',
  'audit': 'Audit',
  'tool': 'Tool',
};

const LABEL_ORDER = [
  'market-data', 'stock-analysis', 'research', 'web-search', 'scraping',
  'memory', 'knowledge', 'wiki',
  'quant', 'analytics', 'calculations',
  'coordination', 'teamwork', 'cycle-context',
  'trading', 'execution', 'portfolio',
  'system', 'autonomy', 'audit',
  'tool',
];

// ── Tier mapping ──
const TIER_ORDER = [0, 1, 2];
const TIER_LABELS = {
  0: 'Core (Tier 0)',
  1: 'Standard (Tier 1)',
  2: 'Advanced (Tier 2)',
};
const TIER_ICONS = {
  0: Brain,
  1: Cpu,
  2: Bot,
};

// ── Helper: snake_case → Title Case ──
function renderToolName(name) {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function filterToolsByQuery(availableTools, query) {
  if (!query) return availableTools;
  return availableTools.filter(
    tool =>
      tool.name?.toLowerCase().includes(query) ||
      renderToolName(tool.name)?.toLowerCase().includes(query) ||
      tool.description?.toLowerCase().includes(query)
  );
}

function sortGroupsByOrder(groups, orderList) {
  const sorted = [];
  for (const key of orderList) {
    if (groups.has(key)) sorted.push([key, groups.get(key)]);
  }
  for (const [key, tools] of groups) {
    if (!orderList.includes(key)) sorted.push([key, tools]);
  }
  return sorted;
}

function groupToolsByDomain(tools) {
  const groups = new Map();
  for (const tool of tools) {
    const domain = tool.domain || 'Other';
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tool);
  }
  return sortGroupsByOrder(groups, DOMAIN_ORDER);
}

function groupToolsByLabel(tools) {
  const groups = new Map();
  for (const tool of tools) {
    const labels = tool.labels && tool.labels.length > 0 ? tool.labels : ['other'];
    for (const label of labels) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(tool);
    }
  }
  return sortGroupsByOrder(groups, LABEL_ORDER);
}

function groupToolsByTier(tools) {
  const groups = new Map();
  for (const tool of tools) {
    const tier = tool.tier ?? 0;
    if (!groups.has(tier)) groups.set(tier, []);
    groups.get(tier).push(tool);
  }
  return sortGroupsByOrder(groups, TIER_ORDER);
}

function getGroupIcon(groupMode, key) {
  if (groupMode === 'label') return LABEL_ICONS[key] || Layers;
  if (groupMode === 'tier') return TIER_ICONS[key] || Layers;
  return DOMAIN_ICONS[key] || Layers;
}

function getGroupLabel(groupMode, key) {
  if (groupMode === 'label') {
    return LABEL_DISPLAY[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }
  if (groupMode === 'tier') {
    return TIER_LABELS[key] || `Tier ${key}`;
  }
  return key;
}

function ToolSelectionBulkRow({ availableCount, enabledCount, totalEnabledCount, selectAll, deselectAll }) {
  const allSelected = availableCount > 0 && enabledCount === availableCount;
  const isIndeterminate = enabledCount > 0 && enabledCount < availableCount;
  const handleToggleAll = () => {
    if (enabledCount === availableCount) deselectAll();
    else selectAll();
  };

  return (
    <div className="tool-selection__bulk-row">
      <input
        type="checkbox"
        checked={allSelected}
        ref={el => { if (el) el.indeterminate = isIndeterminate; }}
        onChange={handleToggleAll}
      />
      <span className="tool-selection__bulk-label" onClick={handleToggleAll}>
        {enabledCount === availableCount ? 'Deselect All' : 'Select All'}
      </span>
      <span className="tool-selection__global-count">
        {totalEnabledCount}/{availableCount}
      </span>
    </div>
  );
}

function ToolSelectionEmptyState({ groupMode }) {
  const isSelectedMode = groupMode === 'selected';
  return (
    <div className="tool-selection__empty">
      <Layers size={24} className="tool-selection__empty-icon" />
      <span className="tool-selection__empty-text">
        {isSelectedMode ? 'No tools selected' : 'No matching tools'}
      </span>
      <span className="tool-selection__empty-subtext">
        {isSelectedMode
          ? 'Enable tools from Domain, Label, or Tier tabs'
          : 'Try adjusting your search query'}
      </span>
    </div>
  );
}

function ToolSelectionGroupSection({
  groupMode,
  groupKey,
  groupTools,
  enabledSet,
  isCollapsed,
  toggleGroup,
  toggleGroupTools,
  toggleTool,
}) {
  const GroupIcon = getGroupIcon(groupMode, groupKey);
  const label = getGroupLabel(groupMode, groupKey);
  const compositeKey = `${groupMode}:${groupKey}`;
  const groupEnabledCount = groupTools.filter(t => enabledSet.has(t.name)).length;
  const isAllEnabled = groupTools.length > 0 && groupEnabledCount === groupTools.length;
  const isIndeterminate = groupEnabledCount > 0 && groupEnabledCount < groupTools.length;

  return (
    <div className="tool-selection__group">
      <div
        className="tool-selection__group-header"
        onClick={() => toggleGroup(compositeKey)}
      >
        <span className="tool-selection__group-caret">
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
        <span className="tool-selection__group-icon">
          <GroupIcon size={13} />
        </span>
        <span className="tool-selection__group-title">
          {label}
        </span>
        <span className="tool-selection__group-count">
          {groupEnabledCount}/{groupTools.length}
        </span>
        <span
          className="tool-selection__group-checkbox"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isAllEnabled}
            ref={el => { if (el) el.indeterminate = isIndeterminate; }}
            onChange={() => toggleGroupTools(groupTools)}
          />
        </span>
      </div>

      {!isCollapsed && (
        <div className="tool-selection__group-content">
          {groupTools.map(tool => (
            <label
              key={tool.name}
              className="tool-selection__tool"
              title={tool.description || ''}
            >
              <input
                type="checkbox"
                checked={enabledSet.has(tool.name)}
                onChange={() => toggleTool(tool.name)}
              />
              <span className="tool-selection__tool-name">
                {renderToolName(tool.name)}
              </span>
              <span className="tool-selection__tool-source">
                {tool.source}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ToolSelection — prism-style grouped tool picker with domain/label/tier
 * segmented views, search, tri-state checkboxes, and collapsible groups.
 */
export default function ToolSelection({
  availableTools = [],
  enabledTools = [],
  onEnabledToolsChange,
}) {
  const [toolSearch, setToolSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [groupMode, setGroupMode] = useState('domain');

  const query = toolSearch.toLowerCase().trim();
  const filteredTools = useMemo(() => filterToolsByQuery(availableTools, query), [availableTools, query]);
  const enabledSet = useMemo(() => new Set(enabledTools), [enabledTools]);
  const enabledCount = useMemo(
    () => filteredTools.filter(t => enabledSet.has(t.name)).length,
    [filteredTools, enabledSet]
  );

  const toggleTool = useCallback((toolName) => {
    const current = enabledTools || [];
    const next = current.includes(toolName)
      ? current.filter(t => t !== toolName)
      : [...current, toolName];
    onEnabledToolsChange?.(next);
  }, [enabledTools, onEnabledToolsChange]);

  const selectAll = useCallback(() => {
    onEnabledToolsChange?.(availableTools.map(t => t.name));
  }, [availableTools, onEnabledToolsChange]);

  const deselectAll = useCallback(() => {
    onEnabledToolsChange?.([]);
  }, [onEnabledToolsChange]);

  const toggleGroup = useCallback((key) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroupTools = useCallback((groupTools) => {
    const current = enabledTools || [];
    const names = groupTools.map(t => t.name);
    const allEnabled = names.every(n => current.includes(n));
    const next = allEnabled
      ? current.filter(n => !names.includes(n))
      : [...current, ...names.filter(n => !current.includes(n))];
    onEnabledToolsChange?.(next);
  }, [enabledTools, onEnabledToolsChange]);

  const activeGroups = useMemo(() => {
    if (groupMode === 'label') return groupToolsByLabel(filteredTools);
    if (groupMode === 'tier') return groupToolsByTier(filteredTools);
    if (groupMode === 'selected') {
      return groupToolsByDomain(filteredTools.filter(t => enabledSet.has(t.name)));
    }
    return groupToolsByDomain(filteredTools);
  }, [groupMode, filteredTools, enabledSet]);

  return (
    <div className="tool-selection">
      <div className="tool-selection__search-wrapper">
        <Search size={14} className="tool-selection__search-icon" />
        <input
          className="tool-selection__search"
          placeholder="Search tools..."
          value={toolSearch}
          onChange={e => setToolSearch(e.target.value)}
        />
      </div>

      <div className="tool-selection__segments">
        {['domain', 'label', 'tier', 'selected'].map(mode => (
          <button
            key={mode}
            className={`tool-selection__segment${groupMode === mode ? ' tool-selection__segment--active' : ''}`}
            onClick={() => setGroupMode(mode)}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {groupMode !== 'selected' && (
        <ToolSelectionBulkRow
          availableCount={availableTools.length}
          enabledCount={enabledCount}
          totalEnabledCount={enabledTools.length}
          selectAll={selectAll}
          deselectAll={deselectAll}
        />
      )}

      <div className="tool-selection__list">
        {activeGroups.length === 0 && <ToolSelectionEmptyState groupMode={groupMode} />}

        {activeGroups.map(([groupKey, groupTools]) => (
          <ToolSelectionGroupSection
            key={`${groupMode}:${groupKey}`}
            groupMode={groupMode}
            groupKey={groupKey}
            groupTools={groupTools}
            enabledSet={enabledSet}
            isCollapsed={collapsedGroups.has(`${groupMode}:${groupKey}`)}
            toggleGroup={toggleGroup}
            toggleGroupTools={toggleGroupTools}
            toggleTool={toggleTool}
          />
        ))}
      </div>
    </div>
  );
}
