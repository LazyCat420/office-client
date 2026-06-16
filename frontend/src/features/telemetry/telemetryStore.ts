'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

export interface TelemetryContextType {
  currentCycle: any;
  eventsByCycle: Record<string, any[]>;
  refreshCycleStatus: () => Promise<any>;
}

export const TelemetryContext = createContext<TelemetryContextType | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [eventsByCycle, setEventsByCycle] = useState<Record<string, any[]>>({});

  const updateCycleState = useCallback((s: any) => {
    if (!s) return;

    let resolvedEvents: any[] = s.events || [];
    let resolvedResults: any[] = s.results || [];

    setCurrentCycle((prev: any) => {
      if (prev && prev.cycle_id && prev.cycle_id === s.cycle_id) {
        const hasOldEvents = prev.events && prev.events.length > 0;
        const hasNewEvents = s.events && s.events.length > 0;
        const hasOldResults = prev.results && prev.results.length > 0;
        const hasNewResults = s.results && s.results.length > 0;

        if (hasOldEvents && hasNewEvents) {
          // Prefer newer payload when same or greater length (may have updated statuses)
          resolvedEvents = s.events.length >= prev.events.length ? s.events : prev.events;
        } else if (hasOldEvents && !hasNewEvents) {
          resolvedEvents = prev.events;
        }
        if (hasOldResults && hasNewResults) {
          resolvedResults = s.results.length >= prev.results.length ? s.results : prev.results;
        } else if (hasOldResults && !hasNewResults) {
          resolvedResults = prev.results;
        }
      }
      return { ...s, events: resolvedEvents, results: resolvedResults };
    });

    if (s.cycle_id) {
      setEventsByCycle((prev) => {
        const next = { ...prev };
        const oldEvents = next[s.cycle_id] || [];
        const finalEvents = (s.events && Array.isArray(s.events) && s.events.length >= oldEvents.length) ? s.events : oldEvents;
        next[s.cycle_id] = finalEvents;

        // Keep at most 5 cycles to prevent unbounded memory growth
        const keys = Object.keys(next);
        if (keys.length > 5) {
          const oldestKey = keys.find(k => k !== s.cycle_id);
          if (oldestKey) {
            delete next[oldestKey];
          }
        }
        return next;
      });
    }
  }, []);

  const loadCycleStatus = useCallback(async (summaryOnly = false) => {
    try {
      const s = await api.getCycleStatus(summaryOnly);
      if (s && s.status !== 'Backend unreachable') {
        updateCycleState(s);
      }
      return s;
    } catch (e) {
      console.warn('[TelemetryStore] Failed to load cycle status:', e);
    }
  }, [updateCycleState]);

  useEffect(() => {
    // Initial fetch to paint immediately
    loadCycleStatus(false);

    let isSubscribed = true;
    let es: EventSource | null = null;
    let reconnectTimer: any = null;
    let isSSEActive = false;

    // Heartbeat: poll every 10s as fallback for missed SSE events.
    // This catches cycle-end transitions the SSE stream might miss
    // due to reconnect gaps or JSON dedup.
    const heartbeatInterval = setInterval(() => {
      if (isSubscribed) {
        loadCycleStatus(false); // full payload to catch missed SSE events
      }
    }, 10_000);

    const connectSSE = () => {
      if (!isSubscribed) return;

      es = new EventSource('/api/v1/run-cycle/status/stream');

      es.onmessage = (event) => {
        if (!isSubscribed) return;
        isSSEActive = true;
        try {
          const s = JSON.parse(event.data);
          if (s && s.status !== 'Backend unreachable') {
            updateCycleState(s);
          }
        } catch (err) {
          console.error('[TelemetryStore] Failed to parse cycle status stream:', err);
        }
      };

      es.onerror = (error) => {
        console.error('[TelemetryStore] Cycle status stream error, reconnecting...', error);
        isSSEActive = false;
        if (es) es.close();
        if (isSubscribed) {
          // Immediate full fetch to bridge the SSE gap
          loadCycleStatus(false);
          reconnectTimer = setTimeout(connectSSE, 2000);
        }
      };
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(heartbeatInterval);
    };
  }, [loadCycleStatus, updateCycleState]);

  const refreshCycleStatus = useCallback(() => {
    return loadCycleStatus(false);
  }, [loadCycleStatus]);

  const value = {
    currentCycle,
    eventsByCycle,
    refreshCycleStatus,
  };

  return React.createElement(TelemetryContext.Provider, { value }, children);
}
