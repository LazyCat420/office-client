/**
 * API Client — Slim version for office-client.
 * Only includes endpoints used by the 3D Agent Office and Agent Studio.
 * All requests proxy through Next.js rewrites to trading-service/prism-service.
 */

const BASE = '/api/v1';

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const method = (opts.method || 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? 3 : 0;
  const timeoutMs = opts.timeoutMs || 60_000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchOpts = { ...opts };
      delete fetchOpts.timeoutMs;
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        cache: 'no-store',
        signal: controller.signal,
        ...fetchOpts,
      });
      if (!res.ok) {
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (method !== 'GET') {
          let detail = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            detail = errBody.detail || errBody.message || JSON.stringify(errBody);
          } catch {
            detail = `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
          }
          throw new Error(detail);
        }
        if (attempt >= maxRetries) {
          console.warn(`API ${res.status}: ${path} (retries exhausted)`);
        }
        return null;
      }
      return await res.json();
    } catch (e) {
      if (method !== 'GET' && e.name !== 'AbortError') throw e;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (typeof window !== 'undefined') {
        console.warn(`API unreachable: ${path} — backend may still be starting`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ── Cycle Status ──
export const getCycleStatus = (summaryOnly) =>
  request(`/run-cycle/status${summaryOnly ? '?summary_only=true' : ''}`);

// ── Agent Personas (Agent Studio) ──
export const getAgentPersonas = () => request('/agents');
export const getAgentPersona = (id) => request(`/agents/${id}`);
export const createAgentPersona = (data) =>
  request('/agents', { method: 'POST', body: JSON.stringify(data) });
export const updateAgentPersona = (id, data) =>
  request(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAgentPersona = (id) =>
  request(`/agents/${id}`, { method: 'DELETE' });
export const resetAgentDefaults = () =>
  request('/agents/reset-defaults', { method: 'POST' });
export const getAgentTools = () => request('/agent-tools');

// ── Active Agents ──
export const getActiveAgents = () => request('/agents/active');
