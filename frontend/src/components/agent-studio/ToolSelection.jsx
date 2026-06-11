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

  // ── Filtering ──
  const query = toolSearch.toLowerCase().trim();

  const filteredTools = useMemo(() => {
    if (!query) return availableTools;
    return availableTools.filter(
      tool =>
        tool.name?.toLowerCase().includes(query) ||
        renderToolName(tool.name)?.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [availableTools, query]);

  // ── Enabled set ──
  const enabledSet = useMemo(() => new Set(enabledTools), [enabledTools]);

  const enabledCount = useMemo(() => {
    return filteredTools.filter(t => enabledSet.has(t.name)).length;
  }, [filteredTools, enabledSet]);

  // ── Tool toggling ──
  const toggleTool = useCallback((toolName) => {
    const current = enabledTools || [];
    if (current.includes(toolName)) {
      onEnabledToolsChange?.(current.filter(t => t !== toolName));
    } else {
      onEnabledToolsChange?.([...current, toolName]);
    }
  }, [enabledTools, onEnabledToolsChange]);

  const selectAll = useCallback(() => {
    onEnabledToolsChange?.(availableTools.map(t => t.name));
  }, [availableTools, onEnabledToolsChange]);

  const deselectAll = useCallback(() => {
    onEnabledToolsChange?.([]);
  }, [onEnabledToolsChange]);

  // ── Group toggling ──
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

    if (allEnabled) {
      onEnabledToolsChange?.(current.filter(n => !names.includes(n)));
    } else {
      const toAdd = names.filter(n => !current.includes(n));
      onEnabledToolsChange?.([...current, ...toAdd]);
    }
  }, [enabledTools, onEnabledToolsChange]);

  // ── Group by domain ──
  const groupedByDomain = useMemo(() => {
    const groups = new Map();
    for (const tool of filteredTools) {
      const domain = tool.domain || 'Other';
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(tool);
    }
    const sorted = [];
    for (const domain of DOMAIN_ORDER) {
      if (groups.has(domain)) sorted.push([domain, groups.get(domain)]);
    }
    for (const [domain, tools] of groups) {
      if (!DOMAIN_ORDER.includes(domain)) sorted.push([domain, tools]);
    }
    return sorted;
  }, [filteredTools]);

  // ── Group by label ──
  const groupedByLabel = useMemo(() => {
    const groups = new Map();
    for (const tool of filteredTools) {
      const labels = tool.labels && tool.labels.length > 0 ? tool.labels : ['other'];
      for (const label of labels) {
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(tool);
      }
    }
    const sorted = [];
    for (const label of LABEL_ORDER) {
      if (groups.has(label)) sorted.push([label, groups.get(label)]);
    }
    for (const [label, tools] of groups) {
      if (!LABEL_ORDER.includes(label)) sorted.push([label, tools]);
    }
    return sorted;
  }, [filteredTools]);

  // ── Group by tier ──
  const groupedByTier = useMemo(() => {
    const groups = new Map();
    for (const tool of filteredTools) {
      const tier = tool.tier ?? 0;
      if (!groups.has(tier)) groups.set(tier, []);
      groups.get(tier).push(tool);
    }
    const sorted = [];
    for (const tier of TIER_ORDER) {
      if (groups.has(tier)) sorted.push([tier, groups.get(tier)]);
    }
    for (const [tier, tools] of groups) {
      if (!TIER_ORDER.includes(tier)) sorted.push([tier, tools]);
    }
    return sorted;
  }, [filteredTools]);

  // ── Selected mode: only enabled tools grouped by domain ──
  const selectedGroupedByDomain = useMemo(() => {
    const selected = filteredTools.filter(t => enabledSet.has(t.name));
    const groups = new Map();
    for (const tool of selected) {
      const domain = tool.domain || 'Other';
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(tool);
    }
    const sorted = [];
    for (const domain of DOMAIN_ORDER) {
      if (groups.has(domain)) sorted.push([domain, groups.get(domain)]);
    }
    for (const [domain, tools] of groups) {
      if (!DOMAIN_ORDER.includes(domain)) sorted.push([domain, tools]);
    }
    return sorted;
  }, [filteredTools, enabledSet]);

  // ── Determine active groups based on mode ──
  const activeGroups = useMemo(() => {
    switch (groupMode) {
      case 'label': return groupedByLabel;
      case 'tier': return groupedByTier;
      case 'selected': return selectedGroupedByDomain;
      default: return groupedByDomain;
    }
  }, [groupMode, groupedByDomain, groupedByLabel, groupedByTier, selectedGroupedByDomain]);

  // ── Get icon/label helpers ──
  const getGroupIcon = (key) => {
    switch (groupMode) {
      case 'label': return LABEL_ICONS[key] || Layers;
      case 'tier': return TIER_ICONS[key] || Layers;
      default: return DOMAIN_ICONS[key] || Layers;
    }
  };

  const getGroupLabel = (key) => {
    switch (groupMode) {
      case 'label':
        return LABEL_DISPLAY[key] || key.charAt(0).toUpperCase() + key.slice(1);
      case 'tier':
        return TIER_LABELS[key] || `Tier ${key}`;
      default:
        return key;
    }
  };

  // ── Render ──
  return (
    <div className="tool-selection">
      {/* Search */}
      <div className="tool-selection__search-wrapper">
        <Search size={14} className="tool-selection__search-icon" />
        <input
          className="tool-selection__search"
          placeholder="Search tools..."
          value={toolSearch}
          onChange={e => setToolSearch(e.target.value)}
        />
      </div>

      {/* Segmented control */}
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

      {/* Bulk select */}
      {groupMode !== 'selected' && (
        <div className="tool-selection__bulk-row">
          <input
            type="checkbox"
            checked={availableTools.length > 0 && enabledCount === availableTools.length}
            ref={el => { if (el) el.indeterminate = enabledCount > 0 && enabledCount < availableTools.length; }}
            onChange={() => {
              if (enabledCount === availableTools.length) {
                deselectAll();
              } else {
                selectAll();
              }
            }}
          />
          <span
            className="tool-selection__bulk-label"
            onClick={() => {
              if (enabledCount === availableTools.length) {
                deselectAll();
              } else {
                selectAll();
              }
            }}
          >
            {enabledCount === availableTools.length ? 'Deselect All' : 'Select All'}
          </span>
          <span className="tool-selection__global-count">
            {enabledTools.length}/{availableTools.length}
          </span>
        </div>
      )}

      {/* Groups */}
      <div className="tool-selection__list">
        {activeGroups.length === 0 && (
          <div className="tool-selection__empty">
            <Layers size={24} className="tool-selection__empty-icon" />
            <span className="tool-selection__empty-text">
              {groupMode === 'selected' ? 'No tools selected' : 'No matching tools'}
            </span>
            <span className="tool-selection__empty-subtext">
              {groupMode === 'selected'
                ? 'Enable tools from Domain, Label, or Tier tabs'
                : 'Try adjusting your search query'}
            </span>
          </div>
        )}

        {activeGroups.map(([groupKey, groupTools]) => {
          const GroupIcon = getGroupIcon(groupKey);
          const label = getGroupLabel(groupKey);
          const isCollapsed = collapsedGroups.has(`${groupMode}:${groupKey}`);

          const groupEnabledCount = groupTools.filter(t => enabledSet.has(t.name)).length;
          const isAllEnabled = groupTools.length > 0 && groupEnabledCount === groupTools.length;
          const isIndeterminate = groupEnabledCount > 0 && groupEnabledCount < groupTools.length;

          return (
            <div key={`${groupMode}:${groupKey}`} className="tool-selection__group">
              <div
                className="tool-selection__group-header"
                onClick={() => toggleGroup(`${groupMode}:${groupKey}`)}
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
        })}
      </div>
    </div>
  );
}
