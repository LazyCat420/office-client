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

        if (hasOldEvents) {
          if (!hasNewEvents || prev.events.length >= s.events.length) {
            resolvedEvents = prev.events;
          }
        }
        if (hasOldResults) {
          if (!hasNewResults || prev.results.length >= s.results.length) {
            resolvedResults = prev.results;
          }
        }
      }
      return { ...s, events: resolvedEvents, results: resolvedResults };
    });

    if (s.cycle_id) {
      setEventsByCycle((prev) => {
        const oldEvents = prev[s.cycle_id] || [];
        const finalEvents = (s.events && Array.isArray(s.events) && s.events.length > oldEvents.length) ? s.events : oldEvents;
        return {
          ...prev,
          [s.cycle_id]: finalEvents,
        };
      });
    }
  }, []);

  const loadCycleStatus = useCallback(async (summaryOnly = false) => {
    try {
      const s = await api.getCycleStatus(summaryOnly);
      if (s && !s.error) {
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

    const connectSSE = () => {
      if (!isSubscribed) return;

      es = new EventSource('/api/v1/run-cycle/status/stream');

      es.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const s = JSON.parse(event.data);
          if (s && !s.error && s.status !== 'Backend unreachable') {
            updateCycleState(s);
          }
        } catch (err) {
          console.error('[TelemetryStore] Failed to parse cycle status stream:', err);
        }
      };

      es.onerror = (error) => {
        console.error('[TelemetryStore] Cycle status stream error, reconnecting...', error);
        if (es) es.close();
        if (isSubscribed) {
          reconnectTimer = setTimeout(connectSSE, 5000);
        }
      };
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
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
