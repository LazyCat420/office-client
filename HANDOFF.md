# HANDOFF — One audio channel (no more overlapping TTS) + per-agent sidebar data

**Status:** committed → pushed `origin/main` (e584f0d) → deployed to synology,
office-client live at http://10.0.0.16:3035 (HTTP 200) on 2026-07-22.
`next build`-verified. Audio behavior not click-tested (needs a browser with
the unmute gesture); the log/chat filtering was curl-verified against the live
backends.

## Problem 1 — everything talked at once

Two independent audio systems with zero coordination:

- **Piper agent speech** (`agent-office/ttsClient.js`) — Web Audio
  `AudioContext`, had its own serial queue.
- **StarCraft barks** (`3d-office/SoundManager.js` `playSC`) — raw
  `HTMLAudioElement.play()`, NO queue, only per-category cooldowns. A polled
  SSE batch loops all new events synchronously (`useAgentEvents.js`), so
  3–6 barks from different categories + a speech clip all started in one tick.

### Fix: `agent-office/audioChannel.js` (new)

Single FIFO gate both systems flow through — one clip audible at a time:

- `enqueueAudio({kind: 'speech'|'bark', play, meta})`; jobs run serially with
  a 200ms gap; per-kind stuck-job timeouts (speech 45s, bark 8s).
- Barks are disposable: max 2 pending (extra dropped at enqueue), and stale
  barks (>8s queued, e.g. behind a long speech clip) are skipped at dequeue.
  Dropped barks do NOT stamp the category cooldown.
- `ttsClient.processQueue` wraps `executeSpeech` in a channel job;
  `SoundManager.playSC` enqueues `_playScClip` (resolves on `ended`).
- Emits `audio-start` on `audioChannelEmitter` with the job's meta when a clip
  actually begins.

## Problem 2 — nobody knew who was barking

`playSC(category)` carried no identity. Now every call site passes
`{agentId, reason}` (`useAgentEvents.js` applyTimers + emitRichFeedback +
cycle-end), and the new **`3d-office/AudioCaptions.jsx`** overlay
(bottom-left of the 3D pane, mounted in `AgentOffice3D.jsx`) names every clip
as it starts: `📢 Quant Analyst · casting a vote` for barks,
`🗣️ Board Of Directors · "quote…"` for speech. Captions fade after 6s.

## Problem 3 — sidebar showed ALL agents' data

Client-side half of the fix (server half in trading-client 3ebcfd7, see its
HANDOFF.md):

- **Chat history** (`AgentDetailsSidebar.jsx`): now fetches
  `/prism-api/conversations?agent=<id>` — an exact equality filter in Prism —
  instead of substring `search=<id>`. `resolvePrismAgentId` resolves `v3_*`
  ids to `CUSTOM_V3_*` verbatim BEFORE the fuzzy rules (verified live:
  conversations are stored as CUSTOM_V3_QUANT_ANALYST etc.; the fuzzy rules
  used to dump every V3 agent into CUSTOM_QUANT_RESEARCH_AGENT).
- **Live logs**: defense-in-depth `normalizeForMatch` check — any event whose
  `data.agent` names a different agent is never rendered, regardless of what
  the server stream forwards. (Normalization strips CUSTOM_/V3_ prefixes via
  cleanAgentId + canonicalAgentId so all spellings compare equal.)

## Gotchas for next session

- The bark/speech serialization means a noisy office now sounds *sequential*;
  if it feels too quiet, tune `MAX_PENDING_BARKS` / chances in
  `useAgentEvents.js`, not the channel.
- `AudioCaptions` listens only to `audio-start`; if you add a new audio path,
  route it through `enqueueAudio` or it will both overlap and be anonymous.
- Deploy note: office deploy.sh syncs shared frontend folders from
  trading-client (PRE_BUILD) — deploy trading-client first when both changed.
