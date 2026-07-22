import React, { useEffect, useState } from 'react';
import { getAgentGrid } from '@/lib/api';

// The /grid endpoint returns `agents` as an OBJECT keyed by agent id, each shaped
// { id, station, stationLabel, currentTool, status, bubbleText, lastSeen,
//   lastSeenIso, history, coordinates }. The panel previously did
// `gridData.agents.map(...)` (crash: objects have no .map) and read fields that
// don't exist (agent_id / current_tool / tool_description / latency_ms /
// last_updated). Normalize to an array and map the real fields.
function formatLastSeen(agent) {
  const t = typeof agent.lastSeen === 'number'
    ? agent.lastSeen
    : (agent.lastSeenIso ? Date.parse(agent.lastSeenIso) : NaN);
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString() : '-';
}

export function AgentGridPanel({ visible }) {
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;

    let mounted = true;

    const fetchGrid = async () => {
      try {
        const data = await getAgentGrid();
        if (mounted && data) {
          setGridData(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch agent grid:", err);
        if (mounted) setLoading(false);
      }
    };

    fetchGrid();
    const interval = setInterval(fetchGrid, 5000); // refresh every 5 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [visible]);

  if (!visible) return null;

  // `agents` is an object map; tolerate an array too in case the shape changes.
  const agents = gridData?.agents
    ? (Array.isArray(gridData.agents) ? gridData.agents : Object.values(gridData.agents))
    : [];

  return (
    <div className="agent-grid-panel">
      <div className="agent-grid-panel__header">
        <h3>📊 Agent Data Grid</h3>
        {gridData?.cycleId && (
          <span className="agent-grid-panel__cycle" style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>
            {gridData.cycleId}
          </span>
        )}
      </div>
      <div className="agent-grid-panel__content">
        {loading && !gridData ? (
          <div className="agent-grid-panel__loading">Loading grid data...</div>
        ) : (
          <table className="agent-grid-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Tool</th>
                <th>Activity</th>
                <th>Station</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => (
                <tr key={agent.id || i} className={`status-${agent.status}`}>
                  <td><strong>{agent.id}</strong></td>
                  <td>
                    <span className={`status-badge status-${agent.status}`}>
                      {agent.status || '-'}
                    </span>
                  </td>
                  <td><code>{agent.currentTool || '-'}</code></td>
                  <td className="desc-cell" title={agent.bubbleText}>{agent.bubbleText || '-'}</td>
                  <td>{agent.stationLabel || agent.station || '-'}</td>
                  <td className="time-cell">{formatLastSeen(agent)}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">No active agents in grid.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
