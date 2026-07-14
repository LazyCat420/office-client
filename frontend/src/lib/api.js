/**
 * API Client — all backend endpoint calls.
 * Uses Next.js proxy: requests go to /api/v1/* which rewrites to localhost:8888.
 */

const BASE = '/api/v1';

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const method = (opts.method || 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? 3 : 0; // only retry GETs
  const timeoutMs = opts.timeoutMs || 60_000; // default 60s, overridable

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchOpts = { ...opts };
      delete fetchOpts.timeoutMs; // explicitly remove without destructuring rest spread
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        cache: 'no-store',
        signal: controller.signal,
        ...fetchOpts,
      });
      if (!res.ok) {
        // Retry on server errors (backend not ready yet)
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        // For mutation requests (POST/PUT/DELETE), throw with error details
        // so callers can display meaningful error messages to the user
        if (method !== 'GET') {
          let detail = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            detail = errBody.detail || errBody.message || JSON.stringify(errBody);
          } catch {
            // If body isn't JSON, use status text
            detail = `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
          }
          throw new Error(detail);
        }
        // Only log non-retry failures (suppress startup noise)
        if (attempt >= maxRetries) {
          console.warn(`API ${res.status}: ${path} (retries exhausted)`);
        }
        return null;
      }
      return await res.json();
    } catch (e) {
      // Re-throw mutation errors (don't swallow them)
      if (method !== 'GET' && e.name !== 'AbortError') {
        throw e;
      }
      // Retry on network errors (ECONNREFUSED = backend not started)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      // Only warn on final failure — these are expected during startup
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


// ── Health ──
export const getModelHealth = () => request('/models/health');
export const getModelRoles = () => request('/models/roles');

// ── Dashboard ──
export const getDashboardOverview = () => request('/dashboard/overview');
export const getTickerDashboard = (t) => request(`/dashboard/${t}`);

// ── Watchlist ──
export const getWatchlist = () => request('/watchlist');
export const addToWatchlist = (ticker, source = 'manual') =>
  request('/watchlist', { method: 'POST', body: JSON.stringify({ ticker, source }) });
export const removeFromWatchlist = (ticker) =>
  request(`/watchlist/${ticker}`, { method: 'DELETE' });
export const importDiscovery = (minScore = 50) =>
  request('/watchlist/import', { method: 'POST', body: JSON.stringify({ min_score: minScore }) });
export const pauseWatchlistTicker = (ticker) =>
  request(`/watchlist/${ticker}/pause`, { method: 'PATCH' });
export const resumeWatchlistTicker = (ticker) =>
  request(`/watchlist/${ticker}/resume`, { method: 'PATCH' });
export const banWatchlistTicker = (ticker, reason = '') =>
  request(`/watchlist/${ticker}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
export const unbanWatchlistTicker = (ticker) =>
  request(`/watchlist/${ticker}/ban`, { method: 'DELETE' });
export const getPausedWatchlist = () => request('/watchlist/paused');
export const getBannedWatchlist = () => request('/watchlist/banned');

// ── Portfolio ──
export async function getPortfolio(botId) {
  const url = `/portfolio${botId ? `?bot_id=${botId}` : ''}`;
  console.log('[DEBUG][API] GET', url);
  const data = await request(url);
  console.log('[DEBUG][API] portfolio response:', {
    status: data ? 'ok' : 'null',
    bot_id: data?.bot_id,
    position_count: data?.position_count,
    positions: data?.positions?.map(p => ({ ticker: p.ticker, qty: p.qty, current_price: p.current_price })),
    cash: data?.cash,
    total_value: data?.total_value,
  });
  return data;
}
export async function getTrades(botId, limit = 50) {
  const url = `/portfolio/trades?limit=${limit}${botId ? `&bot_id=${botId}` : ''}`;
  console.log('[DEBUG][API] GET', url);
  const data = await request(url);
  console.log('[DEBUG][API] trades response:', {
    status: data ? 'ok' : 'null',
    count: Array.isArray(data) ? data.length : 'not-array',
    first: Array.isArray(data) && data.length > 0 ? { ticker: data[0].ticker, side: data[0].side, qty: data[0].qty, price: data[0].price, created_at: data[0].created_at } : null,
  });
  return data;
}
export const getEquityCurve = (botId, days = 30) => request(`/portfolio/history?days=${days}${botId ? `&bot_id=${botId}` : ''}`);
export const takeSnapshot = (botId) => request(`/portfolio/snapshot${botId ? `?bot_id=${botId}` : ''}`, { method: 'POST' });
export async function getPerformance(botId) {
  const url = `/portfolio/performance${botId ? `?bot_id=${botId}` : ''}`;
  console.log('[DEBUG][API] GET', url);
  const data = await request(url);
  console.log('[DEBUG][API] performance response:', {
    status: data ? 'ok' : 'null',
    bot_id: data?.bot_id,
    current_value: data?.current_value,
    pnl: data?.pnl,
    total_trades: data?.total_trades,
    open_positions: data?.open_positions,
  });
  return data;
}

// ── Broker Ledger ──
export const getPositionLots = (ticker) => request(`/portfolio/lots${ticker ? `?ticker=${ticker}` : ''}`);
export const getClosedLots = (ticker, limit = 50) => request(`/portfolio/lots/closed?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}`);
export const getTradeFills = (limit = 50) => request(`/portfolio/fills?limit=${limit}`);

// ── Analysis ──
export const analyzeTicker = (ticker) =>
  request(`/analyze/${ticker}`, { method: 'POST', timeoutMs: 900_000 });
export const getLatestAnalysis = (ticker) => request(`/analysis/${ticker}/latest`);
export const getAnalysisHistory = (ticker) => request(`/analysis/${ticker}/history`);

// ── Persistent Verdicts ──
export const getLatestVerdicts = (limit = 100) => request(`/verdicts/latest?limit=${limit}`);
export const getVerdictHistory = (ticker, limit = 20) => request(`/verdicts/history/${encodeURIComponent(ticker)}?limit=${limit}`);

// ── Ticker User Notes ──
export const getTickerNotes = () => request('/ticker-notes');
export const getTickerNote = (ticker) => request(`/ticker-notes/${encodeURIComponent(ticker)}`);
export const saveTickerNote = (ticker, note) =>
  request(`/ticker-notes/${encodeURIComponent(ticker)}`, { method: 'PUT', body: JSON.stringify({ note }) });
export const deleteTickerNote = (ticker) =>
  request(`/ticker-notes/${encodeURIComponent(ticker)}`, { method: 'DELETE' });

// ── Discovery ──
export const getDiscoveryResults = () => request('/discovery/results');
export const getCongressReport = () => request('/discovery/congress');
export const getFundReport = () => request('/discovery/funds');
export const removeDiscoveredTicker = (ticker) =>
  request(`/discovery/${ticker}`, { method: 'DELETE' });
export const getEnrichedDiscovery = (limit) =>
  request(`/discovery/enriched${limit ? `?limit=${limit}` : ''}`);

// ── Models ──
export const getModels = () => request('/models');
export const switchModel = (name, endpoint) =>
  request('/models/switch', { method: 'POST', body: JSON.stringify({ model_name: name, endpoint }) });
export const configureEndpoint = (endpoint, { enabled } = {}) =>
  request('/models/config', { method: 'POST', body: JSON.stringify({ endpoint, enabled }) });
export const setModelLimit = (model_id, limit) =>
  request('/models/limits', { method: 'POST', body: JSON.stringify({ model_id, limit }) });
export const rediscoverEndpoints = () =>
  request('/models/rediscover', { method: 'POST' });

// ── Collaboration ──
export const getUserNotes = (ticker) =>
  request(`/user/notes${ticker ? `?ticker=${ticker}` : ''}`);
export const createNote = (data) =>
  request('/user/notes', { method: 'POST', body: JSON.stringify(data) });
export const deleteNote = (id) =>
  request(`/user/notes/${id}`, { method: 'DELETE' });
export const getUserConstraints = (ticker) =>
  request(`/user/constraints${ticker ? `?ticker=${ticker}` : ''}`);
export const createConstraint = (data) =>
  request('/user/constraints', { method: 'POST', body: JSON.stringify(data) });
export const deleteConstraint = (id) =>
  request(`/user/constraints/${id}`, { method: 'DELETE' });
export const chat = (message, ticker, webSearch = false, model = null, endpoint = null, history = [], images = null, agentName = null) =>
  request('/chat', { method: 'POST', body: JSON.stringify({ message, ticker, web_search: webSearch, model, endpoint, history, images: images ? images.map(img => img.dataUri || img) : null, agent_name: agentName }), timeoutMs: 900_000 });

/**
 * Streaming chat — reads SSE from /chat/stream.
 * @param {string} message
 * @param {string|null} ticker
 * @param {boolean} webSearch
 * @param {string|null} model
 * @param {string|null} endpoint
 * @param {object} callbacks — { onInit, onToken, onThinking, onToolCall, onDone, onError }
 * @param {boolean} enableThinking — enable chain-of-thought reasoning
 * @returns {Promise<void>}
 */
export async function chatStream(message, ticker, webSearch = false, model = null, endpoint = null, images = null, callbacks = {}, enableThinking = false, history = [], agentName = null) {
  const { onInit, onToken, onThinking, onToolCall, onDone, onError, onStart } = callbacks;
  // Use Next.js edge route proxy for SSE to avoid CORS issues and ensure
  // compatibility with containerized deployments (backend is only on 127.0.0.1).
  const url = `${BASE}/chat/stream`;
  const controller = new AbortController();
  onStart?.(controller);
  const timer = setTimeout(() => controller.abort(), 900_000); // 15-minute timeout for streaming

  // Build image URIs array from attached images
  const imageUris = images ? images.map(img => img.dataUri || img) : null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ticker, web_search: webSearch, model, endpoint, enable_thinking: enableThinking, history, images: imageUris, agent_name: agentName }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      onError?.(`HTTP ${res.status}: ${res.statusText}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const event = JSON.parse(dataStr);
          switch (event.type) {
            case 'init':
              onInit?.(event);
              break;
            case 'token':
              onToken?.(event.text);
              break;
            case 'thinking':
              onThinking?.(event.text);
              break;
            case 'tool_call':
              onToolCall?.(event.tool_call);
              break;
            case 'done':
              onDone?.(event);
              break;
            case 'error':
              onError?.(event.text);
              break;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      onError?.('Streaming request timed out (15 minutes)');
    } else {
      onError?.(e.message || 'Streaming failed');
    }
  } finally {
    clearTimeout(timer);
  }
}
export const getChatHistory = (ticker, limit = 20, sessionId, agentName) =>
  request(`/chat/history?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}${sessionId ? `&session_id=${sessionId}` : ''}${agentName ? `&agent_name=${encodeURIComponent(agentName)}` : ''}`);
export const newChatSession = () =>
  request('/chat/session/new', { method: 'POST' });
export const clearChatSession = () =>
  request('/chat/session/clear', { method: 'POST' });
export const deleteActiveChatSession = () =>
  request('/chat/session/active', { method: 'DELETE' });
export const deleteChatSession = (sessionId) =>
  request(`/chat/session/${sessionId}`, { method: 'DELETE' });
export const listChatSessions = (limit = 20) =>
  request(`/chat/sessions?limit=${limit}`);
export const getSessionMessages = (sessionId, limit = 100) =>
  request(`/chat/session/${sessionId}/messages?limit=${limit}`);
export const executeChatTool = (toolCall) =>
  request('/chat/tools/execute', { method: 'POST', body: JSON.stringify({ tool_call: toolCall }), timeoutMs: 900_000 });

// ── Sources ──
export const getYoutubeChannels = () => request('/sources/youtube-channels');
export const addYoutubeChannel = (handle, display_name) =>
  request('/sources/youtube-channels', { method: 'POST', body: JSON.stringify({ handle, display_name }) });
export const removeYoutubeChannel = (handle) =>
  request(`/sources/youtube-channels/${handle}`, { method: 'DELETE' });
export const getRssFeeds = () => request('/sources/rss-feeds');
export const addRssFeed = (name, url) =>
  request('/sources/rss-feeds', { method: 'POST', body: JSON.stringify({ name, url }) });
export const removeRssFeed = (id) =>
  request(`/sources/rss-feeds/${id}`, { method: 'DELETE' });
export const getSubreddits = () => request('/sources/subreddits');
export const addSubreddit = (subreddit) =>
  request('/sources/subreddits', { method: 'POST', body: JSON.stringify({ subreddit }) });
export const removeSubreddit = (id) =>
  request(`/sources/subreddits/${id}`, { method: 'DELETE' });
export const getFreshness = () => request('/sources/freshness');

// ── Pipeline ──
export const runCycle = (tickers = [], collect = true, analyze = true, trade = false, maxTickers = null, discoveredTickers = null) =>
  request('/run-cycle', { method: 'POST', body: JSON.stringify({ tickers, collect, analyze, trade, max_tickers: maxTickers, discovered_tickers: discoveredTickers }), timeoutMs: 900_000 });
export const getGlobalRegime = () => request('/global/regime');
export const getConflictEvents = (limit = 500) => request(`/global/conflicts/events?limit=${limit}`);

export const triggerGlobalCollection = () => request('/global/collect', { method: 'POST', timeoutMs: 900_000 });
export const getCycleStatus = (summaryOnly) => request(`/run-cycle/status${summaryOnly ? '?summary_only=true' : ''}`);
export const pauseCycle = () => request('/run-cycle/pause', { method: 'POST' });
export const resumeCycle = () => request('/run-cycle/resume', { method: 'POST' });
export const stopCycle = () => request('/run-cycle/stop', { method: 'POST' });
export const stopCycleFast = () => request('/run-cycle/stop-fast', { method: 'POST' });
export const resumeInterruptedCycle = () => request('/run-cycle/resume-interrupted', { method: 'POST' });
export const discardCheckpoint = () => request('/run-cycle/discard-checkpoint', { method: 'POST' });
export const saveCheckpoint = () => request('/run-cycle/checkpoint', { method: 'POST' });
export const forceResetPipeline = () => request('/run-cycle/force-reset', { method: 'POST' });
export const getBenchmarks = (limit = 20) => request(`/benchmarks?limit=${limit}`);

// ── Scheduler ──
export const getSchedules = () => request('/schedules');
export const createSchedule = (data) => request('/schedules', { method: 'POST', body: JSON.stringify(data) });
export const updateSchedule = (id, data) => request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSchedule = (id) => request(`/schedules/${id}`, { method: 'DELETE' });
export const deleteAllSchedules = () => request('/schedules/all', { method: 'DELETE' });
export const toggleSchedule = (id, active) => request(`/schedules/${id}/toggle?active=${active}`, { method: 'POST' });
export const getScheduleHistory = (limit = 50) => request(`/schedules/history?limit=${limit}`);
export const getNextRuns = () => request('/schedules/next-runs');

// ── Data Browser ──
export const browseNews = (ticker, limit = 50, sector, sortBy = 'published_at', sortDir = 'desc') =>
  request(`/data/news?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}${sector ? `&sector=${sector}` : ''}&sort_by=${sortBy}&sort_dir=${sortDir}`);
export const browseReddit = (ticker, limit = 50, sector, sortBy = 'created_at', sortDir = 'desc') =>
  request(`/data/reddit?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}${sector ? `&sector=${sector}` : ''}&sort_by=${sortBy}&sort_dir=${sortDir}`);
export const browseYoutube = (ticker, limit = 30, sector, sortBy = 'published_at', sortDir = 'desc') =>
  request(`/data/youtube?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}${sector ? `&sector=${sector}` : ''}&sort_by=${sortBy}&sort_dir=${sortDir}`);
export const browseCongress = (ticker, limit = 50, sector) =>
  request(`/data/congress?limit=${limit}${ticker ? `&ticker=${ticker}` : ''}${sector ? `&sector=${sector}` : ''}`);
export const browsePrices = (ticker, days = 10000) =>
  request(`/data/prices?ticker=${ticker}&days=${days}`);
export const recentAnalyses = (limit = 20) =>
  request(`/data/analysis/recent?limit=${limit}`);
export const getDataCounts = () => request('/data/counts');
export const getDataAudit = (ticker) => request(`/data/audit/${ticker}`);
export const getDataInventory = () => request('/data/inventory');
export const getSectors = () => request('/data/sectors');
export const deleteNewsItem = (id) => request(`/data/news/${id}`, { method: 'DELETE' });
export const deleteRedditItem = (id) => request(`/data/reddit/${id}`, { method: 'DELETE' });
export const deleteYoutubeItem = (videoId) => request(`/data/youtube/${videoId}`, { method: 'DELETE' });

// ── Sectors Dashboard ──
export const getSectorHeatmap = () => request('/sectors/heatmap');
export const getSectorCorrelations = (period = '30d') =>
  request(`/sectors/correlations?period=${period}`);
export const getInverseCorrelations = (period = '30d') =>
  request(`/sectors/correlations/inverse?period=${period}`);
export const getSectorRotations = (limit = 10) =>
  request(`/sectors/rotations?limit=${limit}`);
export const getCommodityLinks = (commodity) =>
  request(`/sectors/commodity-links/${commodity}`);
export const getSectorDivergences = (sector, minDiv = 3.0) =>
  request(`/sectors/divergences/${sector}?min_divergence=${minDiv}`);
export const getSectorStocks = (sector) =>
  request(`/sectors/${encodeURIComponent(sector)}/stocks`);
export const refreshSectors = () =>
  request('/sectors/refresh', { method: 'POST' });
export const collectFred = () =>
  request('/sectors/collect-fred', { method: 'POST' });
export const collectSP500 = (enrich = true, period = '6mo') =>
  request(`/sectors/collect?enrich=${enrich}&price_period=${period}`, { method: 'POST' });
export const getUniverseStats = () => request('/sectors/universe/stats');
export const getUniverseList = (sector, search) => {
  let url = '/sectors/universe/list';
  const params = [];
  if (sector) params.push(`sector=${encodeURIComponent(sector)}`);
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  if (params.length) url += '?' + params.join('&');
  return request(url);
};

// ── Cross-Asset Market Intelligence ──
export const getMarketRegime = () => request('/sectors/market-regime');
export const getSectorBreadth = () => request('/sectors/breadth');
export const collectMarketData = (period = '6mo') =>
  request(`/sectors/collect-market?period=${period}`, { method: 'POST' });

// ── FRED Macro Indicators ──
export const getMacroIndicators = (period = '2y') => request(`/sectors/macro-indicators?period=${period}`);

// ── War / Oil Intelligence Map ──
// Moved to plugins/intel-map/api-functions.js
// Re-enable by copying those functions back here (see plugins/intel-map/README.md)

// ── Futures Dashboard ──
export const getFuturesData = (period = '6m') => request(`/sectors/futures?period=${period}`);

// ── Smart Money (13F Hedge Funds) ──
export const getTrackerFunds = (sort = 'value', search = '') =>
  request(`/tracker/funds?sort=${sort}&search=${encodeURIComponent(search)}`);
export const getTrackerHoldings = (cik, sort = 'value_usd', search = '', order = 'desc', page = 1, limit = 100, filterTrend = 'ALL') =>
  request(`/tracker/funds/${cik}/holdings?sort=${sort}&order=${order}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}&filter_trend=${filterTrend}`);
export const getTrackerHistory = (cik, ticker) =>
  request(`/tracker/funds/${cik}/history/${ticker}`);
export const getTrackerOverlap = (minFunds = 2) =>
  request(`/tracker/funds/overlap?min_funds=${minFunds}`);
export const triggerTrackerBackfill = () =>
  request('/tracker/backfill', { method: 'POST' });

// ── Cognition ──
export const getCognitionLogs = (limit = 100) => request(`/cognition/logs?limit=${limit}`);
export const getCognitionRejections = (limit = 50) => request(`/cognition/rejections?limit=${limit}`);
export const getBrainGraph = (ticker) => request(`/cognition/graph${ticker ? `?ticker=${ticker}` : ''}`);
export const activateBrainGraph = (ticker, maxHops = 3) =>
  request(`/cognition/graph/activate?ticker=${ticker}&max_hops=${maxHops}`, { method: 'POST' });
export const getTasks = () => request('/cognition/tasks');

// ── Evaluations ──
export const getEvaluations = (limit = 100) => request(`/cognition/evaluations?limit=${limit}`);
export const submitEvaluation = (decisionId, data) =>
  request(`/cognition/evaluations/${decisionId}`, { method: 'POST', body: JSON.stringify(data) });
export const runAutoEvaluator = () => request(`/cognition/evaluations/auto`, { method: 'POST' });

// ── Strategy Audit ──
export const getLatestStrategyAudit = () => request('/strategy/audit/latest');
export const getAuditStatus = () => request('/strategy/audit/status');
export const getStrategyAuditHistory = () => request('/strategy/audit/history');
export const runStrategyAudit = () => request('/strategy/audit/run', { method: 'POST', timeoutMs: 900_000 });

// ── Evolution (ASI-Evolve) ──
export const getEvolutionSessions = () => request('/evolution/sessions');
export const getEvolutionSession = (sessionId) => request(`/evolution/sessions/${sessionId}`);
export const getEvolutionBest = (sessionId) => request(`/evolution/sessions/${sessionId}/best`);
export const getEvolutionNodes = (sessionId, limit = 100) =>
  request(`/evolution/nodes?limit=${limit}${sessionId ? `&session_id=${sessionId}` : ''}`);
export const getEvolutionLessons = (sessionId, limit = 50) =>
  request(`/evolution/lessons?limit=${limit}${sessionId ? `&session_id=${sessionId}` : ''}`);
export const getEvolutionScoreHistory = (sessionId) =>
  request(`/evolution/score-history${sessionId ? `?session_id=${sessionId}` : ''}`);
export const getEvolutionProgram = () => request('/evolution/program');
export const getEvolutionConfig = () => request('/evolution/config');
export const getCoralEvolutionStatus = () => request('/evolution/status');
export const startCoralEvolution = () => request('/evolution/start', { method: 'POST', timeoutMs: 900_000 });
export const stopCoralEvolution = () => request('/evolution/stop', { method: 'POST' });

// ── CORAL Recovery & Resilience ──
export const getRecoveryOverview = () => request('/recovery/overview');
export const getRecoveryStats = () => request('/recovery/stats');
export const getRecoveryHistory = (limit = 50) => request(`/recovery/history?limit=${limit}`);
export const getAgentRegistry = () => request('/recovery/agents');
export const getCheckpointStats = () => request('/recovery/checkpoints');

// ── AutoResearch ──
export const getLatestAutoresearch = () => request('/autoresearch/latest');
export const getAutoresearchReports = (limit = 20) => request(`/autoresearch/reports?limit=${limit}`);
export const getAutoresearchStatus = () => request('/autoresearch/status');
export const getAutoresearchFailures = (limit = 20) => request(`/autoresearch/failures?limit=${limit}`);
export const runAutoresearch = () => request('/autoresearch/run', { method: 'POST', timeoutMs: 900_000 });

// ── Pending Evolution Fixes ──
export const getPendingFixes = (status = 'all', limit = 50) => request(`/autoresearch/fixes?status=${status}&limit=${limit}`);
export const approveFix = (fixId) => request(`/autoresearch/fixes/${fixId}/approve`, { method: 'POST' });
export const rejectFix = (fixId) => request(`/autoresearch/fixes/${fixId}/reject`, { method: 'POST' });
export const deployFix = (fixId) => request(`/autoresearch/fixes/${fixId}/deploy`, { method: 'POST' });
export const rollbackFix = (fixId) => request(`/autoresearch/fixes/${fixId}/rollback`, { method: 'POST' });
export const getSubsystemTrends = (limit = 10) => request(`/autoresearch/benchmarks/subsystems?limit=${limit}`);
export const getDeadEnds = (limit = 20) => request(`/autoresearch/dead-ends?limit=${limit}`);

// ── Layout Presets (cross-browser sync) ──
export const getLayoutPresets = () => request('/layout/presets');
export const saveLayoutPreset = (name, layoutData, isActive = true) =>
  request('/layout/presets', { method: 'POST', body: JSON.stringify({ name, layout_data: layoutData, is_active: isActive }) });
export const deleteLayoutPreset = (name) =>
  request(`/layout/presets/${encodeURIComponent(name)}`, { method: 'DELETE' });
export const setActiveLayoutPreset = (name) =>
  request('/layout/presets/active', { method: 'POST', body: JSON.stringify({ name }) });

// ── Bot Profiles ──
export const getBotProfiles = () => request('/bots');
export const getActiveBotProfile = () => request('/bots/active');
export const setActiveBotProfile = (botId) =>
  request('/bots/active', { method: 'POST', body: JSON.stringify({ bot_id: botId }) });
export const createBotProfile = (data) =>
  request('/bots', { method: 'POST', body: JSON.stringify(data) });
export const updateBotProfile = (botId, data) =>
  request(`/bots/${botId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteBotProfile = (botId) =>
  request(`/bots/${botId}`, { method: 'DELETE' });
export const resetBotProfile = (botId) =>
  request(`/bots/${botId}/reset`, { method: 'POST' });

// ── Tools Registry & Stats ──
export const getToolRegistry = () => request('/tools');
export const getToolStats = (hours = 24) => request(`/tools/stats?hours=${hours}`);
export const getToolTimeline = (hours = 24) => request(`/tools/stats/timeline?hours=${hours}`);
export const getRecentToolCalls = (toolName, limit = 50) =>
  request(`/tools/recent?limit=${limit}${toolName ? `&tool_name=${encodeURIComponent(toolName)}` : ''}`);

// ── Monitoring ──
export const getMonitorStats = () => request('/monitor/stats');
export const getMonitorCalls = (limit = 50, agent = null) => request(`/monitor/calls?limit=${limit}${agent ? `&agent=${agent}` : ''}`);
export const getMonitorCallDetail = (callId) => request(`/monitor/calls/${callId}`);
export const getMonitorAgents = () => request('/monitor/agents');
export const getMonitorQueue = () => request('/monitor/queue');
export const getMonitorTelemetry = (hours = 48) => request(`/monitor/telemetry/charts?hours=${hours}`);

// ── Node Health (per-box LLM endpoint status) ──
export const getNodeHealth = () => request('/node-health');

// ── Morning & Flash Briefings ──
export const getMorningBriefing = () => request('/dashboard/morning-briefing/latest');
export const triggerMorningBriefing = () => request('/dashboard/morning-briefing/generate', { method: 'POST', timeoutMs: 300_000 });
export const getFlashBriefings = (limit = 10) => request(`/dashboard/flash-briefings/recent?limit=${limit}`);
export const triggerFlashBriefing = () => request('/dashboard/flash-briefings/generate', { method: 'POST', timeoutMs: 300_000 });
export const getCollectorStatus = () => request('/dashboard/collector/status');

// ── Archive ──
export const browseArchive = (search, ticker, sourceTable, limit = 50) => {
  let url = `/data/archive?limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (ticker) url += `&ticker=${ticker}`;
  if (sourceTable) url += `&source_table=${sourceTable}`;
  return request(url);
};
export const getArchiveCount = () => request('/data/archive/count');
export const restoreArchiveItem = (id) => request(`/data/archive/restore/${id}`, { method: 'POST' });
export const bulkDeleteArchive = (ids) => request('/data/archive/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
export const purgeAllArchive = () => request('/data/archive/purge-all', { method: 'DELETE' });

// ── Raw Database Browser ──
export const listDbTables = () => request('/data/tables');
export const browseDbTable = (table, page = 1, pageSize = 50, search = null, sortCol = null, sortDir = 'desc') => {
  let url = `/data/browse/${table}?page=${page}&page_size=${pageSize}&sort_dir=${sortDir}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (sortCol) url += `&sort_col=${sortCol}`;
  return request(url);
};

// ── Outliers Review ──
export const getPendingOutliers = () => request('/outliers/pending');
export const approveOutlier = (id) => request(`/outliers/${id}/approve`, { method: 'POST' });
export const rejectOutlier = (id) => request(`/outliers/${id}/reject`, { method: 'POST' });
export const addOutlierRule = (id, rule_content) => request(`/outliers/${id}/rule`, { method: 'POST', body: JSON.stringify({ rule_content }) });

// ── Cycle Audit Trail ──
export const getCycleAudit = (cycleId) => request(`/run-cycle/audit/${cycleId}`);
export const getLatestCycleAudit = () => request('/run-cycle/audit/latest');

// ── Per-Ticker Reports ──
export const getReportCycles = () => request('/reports/cycles');
export const getCycleReports = (cycleId) => request(`/reports/cycle/${encodeURIComponent(cycleId)}`);
export const getCycleSummary = (cycleId) => request(`/reports/cycle/${encodeURIComponent(cycleId)}/summary`);
export const getTickerReport = (cycleId, ticker) => request(`/reports/cycle/${encodeURIComponent(cycleId)}/${encodeURIComponent(ticker)}`);
export const deleteCycleReports = (cycleId) => request(`/reports/cycle/${encodeURIComponent(cycleId)}`, { method: 'DELETE' });
export const deleteTickerReport = (cycleId, ticker) => request(`/reports/cycle/${encodeURIComponent(cycleId)}/${encodeURIComponent(ticker)}`, { method: 'DELETE' });


// ── Prism Settings ──
export const getPrismSettings = () => request('/system/prism');
export const setPrismSettings = (data) =>
  request('/system/prism', { method: 'POST', body: JSON.stringify(data) });

export const getActiveAgents = () => request('/agents/active');
export const postAgentInbox = (agentName, message, ticker = null) =>
  request(`/agents/${agentName}/inbox`, { method: 'POST', body: JSON.stringify({ message, ticker }) });

// ── Agent Mention Context ──
export async function getAgentContext(agentName, ticker = null) {
  // Run all fetches in parallel — if any fail they return null gracefully
  const [activeRes, auditRes, monitorRes] = await Promise.all([
    request('/agents/active'),
    request('/run-cycle/audit/latest'),
    request(`/monitor/calls?agent=${encodeURIComponent(agentName)}&limit=10`),
  ]);

  // Find this specific agent's live instance
  const instance = activeRes?.instances?.find(a =>
    a.agent_name?.toLowerCase() === agentName.toLowerCase()
  ) || null;

  // Pull cycle audit entries attributed to this agent
  const cycleId = instance?.cycle_id || auditRes?.cycle_id || null;
  const auditEntries = (auditRes?.entries || [])
    .filter(e => !e.agent || e.agent?.toLowerCase() === agentName.toLowerCase())
    .slice(0, 15);

  // Recent LLM calls this agent made
  const monitorCalls = (monitorRes?.calls || monitorRes || []).slice(0, 5);

  // If we have a cycle and ticker, also grab the per-ticker report
  let tickerReport = null;
  if (cycleId && ticker) {
    tickerReport = await request(`/reports/cycle/${encodeURIComponent(cycleId)}/${encodeURIComponent(ticker)}`);
  }

  return { instance, cycleId, auditEntries, monitorCalls, tickerReport };
}

// ── System Logs ──
export const getSystemHistory = () => request('/system/history');

// ── Agent Studio ──
export const getAgentPersonas = () => request('/agents');
export const getAgentOutputs = (agentName, limit = 50) => request(`/agents/${agentName}/outputs?limit=${limit}`);
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

// ── Agent Data Grid ──
export const getAgentGrid = () => request('/grid');

