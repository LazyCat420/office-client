# Agent Office (`agent-office/`)

Shared foundation layer for the office visualization system. Contains utilities
used by both the legacy 2D office and the active 3D office (`3d-office/`).

## Structure

```
agent-office/
├── shared/                  # ← Import from here
│   └── index.js             # Barrel export for all shared modules
│
├── agentUtils.js            # Agent ID normalization, home station routing
├── agentVoice.js            # TTS synthesis (Piper backend + Web Speech fallback)
├── eventMapper.js           # Backend pipeline event → office event translation
├── stateMachine.js          # 2D station positions, slot management, pathfinding
│
├── AgentOffice.jsx          # Legacy 2D SVG office (no longer mounted in page.js)
├── AgentOfficeScene.jsx     # 2D SVG scene renderer
├── SwordOverlay.jsx         # Debate animation overlay
├── agentOffice.css          # Shared CSS for both 2D and 3D office
├── clashEffects.js          # Debate visual effects
├── swordAssets.js           # Sword animation sprites
└── README.md                # This file
```

## Shared Barrel (`shared/index.js`)

All cross-directory consumers should import from the barrel:

```javascript
import {
  cleanAgentId,
  getHomeStation,
  triggerAgentSpeech,
  setAudioEnabled,
  mapEvent,
} from '../agent-office/shared';
```

### Exported Modules

| Module | Exports | Purpose |
|--------|---------|---------|
| `agentUtils.js` | `cleanAgentId`, `getHomeStation`, `getStationForAgentOrTool`, `NON_PIPELINE_AGENTS` | Agent identification and station routing |
| `agentVoice.js` | `triggerAgentSpeech`, `setAudioEnabled`, `isAudioEnabled`, `resolveArchetype`, `getFallbackQuote`, `computeVolume`, `getVoiceForAgent` | Voice synthesis with Piper TTS + Web Speech API fallback |
| `eventMapper.js` | `mapEvent`, `mapAllEvents`, `getActiveAgents`, `getStationForTool` | Backend pipeline events → office visualization events |

## TTS Data Flow

1. Backend (`trading-service/app/services/agent_voice_service.py`) generates voice quotes via vLLM
2. Quotes are POSTed to `trading-client/api/v1/prism/emit` as `agent_voice` events
3. Frontend SSE stream (`/api/v1/prism/stream`) delivers them to the 3D office
4. `triggerAgentSpeech()` tries Piper TTS (port 3032) first, falls back to Web Speech API
5. AudioContext requires explicit user gesture (click unmute) before audio plays
