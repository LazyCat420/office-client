# 3D Agent Office (`3d-office/`)

Interactive Three.js-based 3D visualization of the trading pipeline's agent activity.
Agents move between stations on a skyscraper floor as they execute tools, analyze data,
and debate trading decisions.

## Architecture

```
3d-office/
├── AgentOffice3D.jsx        # Root component — Canvas, SSE voice handler, persona loader
├── SceneLayout.jsx          # Three.js scene orchestrator
├── Stations.jsx             # Station geometry (desks, rooms, positions)
├── SoundManager.js          # Web Audio synthesized SFX (pop, glass break, footstep)
├── ToucanScene.jsx          # Office mascot
├── AgentDetailsSidebar.jsx  # Selection sidebar with live agent logs
│
├── agent/                   # Agent visual rendering
│   ├── Agent.jsx            # Agent mesh wrapper
│   ├── AgentVisualRig.jsx   # Body, head, arms, animation driver
│   ├── HandheldProps.jsx    # Items agents carry (papers, envelopes)
│   ├── ProceduralHats.jsx   # Role-based headwear
│   ├── ToolEmoji.jsx        # Floating emoji above agents
│   └── useAnimationLoop.js  # Station-specific animation variants
│
├── animations/              # Per-station animation definitions
│   ├── research.js          # Shuffling papers, comparing charts
│   ├── desk.js              # Yelling bids, hand signals, dancing
│   ├── debate.js            # Gesturing, table slamming
│   ├── janitor.js           # Sweeping, mopping
│   └── ...
│
├── environment/             # Scene backdrop
│   ├── SkyscraperShell.jsx  # Building frame
│   ├── SkyDome.jsx          # Dynamic sky
│   └── CloudLayer.jsx       # Animated clouds
│
├── primitives/              # Reusable 3D furniture
│   ├── Chair.jsx, Table.jsx, Monitor.jsx, ...
│   └── index.js             # Barrel export
│
└── routing/                 # Agent state management and pathfinding
    ├── stateMachine.js      # 3D station positions, agent lifecycle, slot management
    ├── useAgentEvents.js    # Event processing hook (pipeline events + system logs SSE)
    ├── toolStationMap.js    # Tool → station + animation variant mapping
    ├── collisionMap.js      # Obstacle avoidance pathfinding
    └── index.js             # Barrel export
```

## Dependency on `agent-office/shared`

The 3D office imports shared utilities via `agent-office/shared/index.js`:

| Import | Source | Purpose |
|--------|--------|---------|
| `cleanAgentId` | `agentUtils.js` | Normalize raw agent names |
| `getHomeStation` | `agentUtils.js` | Map agent ID → home station |
| `getStationForAgentOrTool` | `agentUtils.js` | Resolve station from agent/tool |
| `mapEvent` | `eventMapper.js` | Backend event → office event |
| `triggerAgentSpeech` | `agentVoice.js` | TTS synthesis (Piper + Web Speech) |
| `setAudioEnabled` | `agentVoice.js` | Toggle audio globally |

The `agentOffice.css` is imported directly for shared CSS class names.

## Data Flow

1. **Pipeline events** → `page.js` polls cycle status → passes `events` prop → `useAgentEvents` hook processes them via `mapEvent` → agents walk between stations
2. **Prism SSE** → `useAgentEvents` listens to `/api/v1/system/stream` for real-time agent execution logs
3. **Voice quotes** → structured `data.kind` payloads on the pipeline events (`agent_done`, `debate_verdict`, `board_convened`, `trade_executed`, …) are turned into quotes by `emitRichFeedback` → `triggerAgentSpeech()` → Piper TTS (port 3032) or Web Speech API fallback
4. **Persona config** → Fetched on mount via `getAgentPersonas()` → merged into agent state as `avatar_config`
