import React, { useEffect, useState } from 'react';
import { getAgentGrid } from '@/lib/api';

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

  return (
    <div className="agent-grid-panel">
      <div className="agent-grid-panel__header">
        <h3>📊 Agent Data Grid</h3>
      </div>
      <div className="agent-grid-panel__content">
        {loading && !gridData ? (
          <div className="agent-grid-panel__loading">Loading grid data...</div>
        ) : (
          <table className="agent-grid-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Tool</th>
                <th>Description</th>
                <th>Latency (ms)</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {gridData?.agents?.map((agent, i) => (
                <tr key={i} className={`status-${agent.status}`}>
                  <td><strong>{agent.agent_id}</strong></td>
                  <td>
                    <span className={`status-badge status-${agent.status}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td><code>{agent.current_tool || '-'}</code></td>
                  <td className="desc-cell" title={agent.tool_description}>{agent.tool_description || '-'}</td>
                  <td className="latency-cell">
                    {agent.latency_ms ? `${agent.latency_ms.toFixed(0)}ms` : '-'}
                  </td>
                  <td className="time-cell">{new Date(agent.last_updated).toLocaleTimeString()}</td>
                </tr>
              ))}
              {(!gridData?.agents || gridData.agents.length === 0) && (
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
