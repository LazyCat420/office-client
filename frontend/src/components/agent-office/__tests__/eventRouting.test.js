import { describe, it, expect } from 'vitest';
import { mapEvent } from '../eventMapper';

/**
 * Guards the mapping between the step strings trading-service actually emits
 * and the office room an avatar walks to.
 *
 * Nearly every V3 event carries phase="analyzing", so room routing hangs almost
 * entirely off step-keyword matching. That made it easy for whole event
 * families (triage, tournament, board of directors, the policy gate, watch-desk
 * trips) to silently land in the wrong room. Sources for these strings:
 * trading-service app/v3/orchestrator.py, app/v3/agent_runner.py and
 * app/services/pipeline_service.py.
 */
const CASES = [
  // Research layer → Research Desk
  ['analyzing', 'v3_research_done_AAPL', 'research'],
  ['analyzing', 'v3_triage_AAPL', 'research'],
  ['analyzing', 'v3_ja_triage_AAPL', 'research'],
  ['analyzing', 'v3_precollect_AAPL', 'research'],
  ['discovery', 'discover_universe', 'research'],
  ['freshness_gate', 'freshness_AAPL', 'research'],

  // Per-agent analysis. NOTE the split below is pre-existing and inconsistent:
  // the quant analyst matches the generic 'analy' keyword and works at the
  // Trading Floor, while the fundamental analyst matches 'fundamental' and
  // works at the Research Desk — even though getHomeStation() sends BOTH home
  // to 'research'. So the quant walks back and forth between rooms and the
  // fundamental analyst doesn't. Asserted as-is to pin current behaviour;
  // worth a product decision rather than a silent change.
  ['analyzing', 'v3_quant_analyst_AAPL', 'desk'],
  ['analyzing', 'v3_fundamental_analyst_done_AAPL', 'research'],

  // Debate / tournament / board → War Room
  ['analyzing', 'v3_debate_pitch_1_AAPL', 'debate'],
  ['analyzing', 'v3_debate_clash_AAPL', 'debate'],
  ['analyzing', 'v3_debate_vote_judge_AAPL', 'debate'],
  ['analyzing', 'v3_debate_verdict_AAPL', 'debate'],
  ['analyzing', 'v3_tournament_done_AAPL', 'debate'],
  ['analyzing', 'v3_bod_AAPL', 'debate'],
  ['analyzing', 'v3_shadow_AAPL', 'debate'],

  // Execution → Exec Office
  ['trading', 'trade_executed_AAPL', 'inbox'],
  ['trading', 'trade_rejected_AAPL', 'inbox'],

  // Risk / gating / watch desk → Risk Mgmt
  ['analyzing', 'v3_policy_AAPL', 'error'],
  ['watch', 'watch_desk_trip_AAPL', 'error'],
  ['gatekeeper', 'gate_check', 'error'],
];

describe('V3 pipeline step → office station routing', () => {
  for (const [phase, step, expected] of CASES) {
    it(`${phase}/${step} → ${expected}`, () => {
      const out = mapEvent({ ts: 1, phase, step, detail: '', status: 'start', data: {} });
      expect(out.length).toBeGreaterThan(0);
      expect(out[0].station).toBe(expected);
    });
  }
});
