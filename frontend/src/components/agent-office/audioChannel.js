/**
 * audioChannel.js
 *
 * Single serial gate for all voice-like audio in the office: Piper agent
 * speech AND StarCraft barks flow through one FIFO queue, so only one clip
 * sounds at a time. Before this, speech played on an AudioContext while
 * barks played on HTMLAudioElements with no coordination — an SSE event
 * burst would start 3-6 clips on top of each other.
 *
 * Barks are disposable flavor: they drop instead of backlogging (cap on
 * pending barks, staleness check at dequeue) so a 15s speech clip never
 * builds a museum of stale "affirmative sir" clips behind it.
 *
 * Emits 'audio-start' on audioChannelEmitter when a job actually begins
 * playing — the caption overlay uses this to show who is talking.
 */

export const audioChannelEmitter = new EventTarget();

const queue = [];
let busy = false;

const MAX_PENDING_BARKS = 2;
const BARK_MAX_AGE_MS = 8000;
const INTER_CLIP_GAP_MS = 200;
// A job that never resolves (stuck decode, autoplay block) must not jam the
// channel forever. Speech clips can legitimately run long; barks are short.
const JOB_TIMEOUT_MS = { speech: 45000, bark: 8000 };

/**
 * Enqueue an audio job. Returns true if accepted, false if dropped.
 * job = { kind: 'speech'|'bark', play: () => Promise, meta: {...} }
 * meta is surfaced verbatim on the 'audio-start' event for captions.
 */
export function enqueueAudio(job) {
  if (job.kind === 'bark') {
    const pendingBarks = queue.filter(j => j.kind === 'bark').length;
    if (pendingBarks >= MAX_PENDING_BARKS) return false;
  }
  queue.push({ ...job, enqueuedAt: Date.now() });
  pump();
  return true;
}

/** Drop all pending jobs (used when audio is disabled/muted mid-run). */
export function clearAudioQueue(kind = null) {
  if (!kind) {
    queue.length = 0;
    return;
  }
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].kind === kind) queue.splice(i, 1);
  }
}

async function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;

  // Stale barks (queued behind a long speech clip) are noise by the time
  // their turn comes — skip straight to the next job.
  if (job.kind === 'bark' && Date.now() - job.enqueuedAt > BARK_MAX_AGE_MS) {
    pump();
    return;
  }

  busy = true;
  try {
    audioChannelEmitter.dispatchEvent(new CustomEvent('audio-start', {
      detail: { kind: job.kind, ...(job.meta || {}) },
    }));
  } catch {}
  try {
    const timeout = JOB_TIMEOUT_MS[job.kind] ?? 10000;
    await Promise.race([
      Promise.resolve(job.play()),
      new Promise(resolve => setTimeout(resolve, timeout)),
    ]);
  } catch {
    // Audio is never worth crashing the scene.
  } finally {
    busy = false;
    setTimeout(pump, INTER_CLIP_GAP_MS);
  }
}
