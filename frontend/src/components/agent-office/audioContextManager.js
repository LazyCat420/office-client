let audioEnabled = false;
let audioCtx = null;
let onAudioDisabledCallback = null;

export function isAudioEnabled() {
  return audioEnabled;
}

export function getAudioContext() {
  return audioCtx;
}

export function onAudioDisabled(callback) {
  onAudioDisabledCallback = callback;
}

/**
 * Disables audio and cleans up the AudioContext.
 */
export function disableAudio() {
  audioEnabled = false;
  if (onAudioDisabledCallback) {
    onAudioDisabledCallback();
  }
  
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

/**
 * Initializes and permanently unlocks the AudioContext.
 * MUST be called directly within a user interaction event (e.g. onClick).
 */
export async function initializeAudio() {
  audioEnabled = true;
  
  if (typeof window !== 'undefined') {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Explicitly resume within the user gesture.
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
        console.log('[AudioContextManager] AudioContext successfully resumed and unlocked.');
      } catch (err) {
        console.warn('[AudioContextManager] Failed to resume AudioContext:', err);
      }
    }
  }
}

/**
 * Preload browser voices so they are ready when the first speech event arrives.
 */
export function preloadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  }, { once: true });
}
