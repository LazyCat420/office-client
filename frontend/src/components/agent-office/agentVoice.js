/**
 * agentVoice.js
 * 
 * Web Speech API manager for the 3D Agent Office floor.
 * Handles speech synthesis, custom voices/pitches/rates per archetype,
 * proximity volume computation, fallback quote selection, and mute toggling.
 */

let audioEnabled = false;
let audioCtx = null;

// Global speech queue
const speechQueue = [];
let isProcessingQueue = false;
let currentReject = null;

/**
 * Preload browser voices so they are ready when the first speech event arrives.
 * Chrome lazy-loads voices — calling getVoices() early ensures the list is populated.
 */
function preloadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  // Chrome fires 'voiceschanged' asynchronously the first time
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  }, { once: true });
}

// Trigger voice preloading as soon as this module is imported
preloadVoices();

const CHARACTERISTICS = {
  QUANT: { pitch: 1.2, rate: 1.1 },       // fast and math-obsessed
  DATA_JANITOR: { pitch: 0.75, rate: 0.85 }, // deep and grimy/slow
  BULL: { pitch: 1.3, rate: 1.2 },         // hype-filled and excited
  BEAR: { pitch: 0.8, rate: 0.8 },         // pessimistic, low/slow
  RISK: { pitch: 1.4, rate: 1.3 },         // high pitch and fast (anxious)
  RESEARCH: { pitch: 1.0, rate: 0.95 }     // nerdy, academic, measured
};

const FALLBACK_QUOTES = {
  QUANT: [
    "Kelly criterion says we are underallocated here.",
    "Eigenvalues are trending toward severe decay.",
    "This signal to noise ratio is statistically insulting.",
    "Let us solve for maximum alpha variance.",
    "Variance is high. Recalculating decay factors.",
    "Our covariance matrix is looking pretty sweet.",
    "A perfect distribution of alpha decay.",
    "Markov chain indicates ninety nine percent doom probability."
  ],
  DATA_JANITOR: [
    "Cleaning up this absolute garbage data.",
    "Trash in, trash out. Same old story.",
    "Dumpster fire on the feed again.",
    "Sweep the duplicate records into the bin.",
    "Just sweeping the data dust, move along.",
    "Smells like raw database garbage to me.",
    "Filter the noise, keep the grimy truth.",
    "This spreadsheet is a biohazard."
  ],
  BULL: [
    "Leverage to the moon, boys! Buy!",
    "Rockets are fueled. We cannot lose!",
    "Buy the dip, do not look at the charts!",
    "Infinity leverage or bust. Let us go!",
    "Buy the dip, sell the mortgage!",
    "Strap in, this baby is mooning!",
    "Market cap is just a suggestion anyway.",
    "Up only. Bears are going extinct!"
  ],
  BEAR: [
    "It is a bubble. Sell everything now!",
    "Heading to zero. Panic is logical.",
    "Absolute doom. The end is near.",
    "Cash is the only safe haven left.",
    "I see macro bubbles in every chart.",
    "The house of cards is falling down.",
    "Margin calls are coming for everyone.",
    "Liquidation is the only certainty."
  ],
  RISK: [
    "Compliance is going to murder us.",
    "Stop losses triggered! Out out out!",
    "Veto! This is a margin call waiting to happen.",
    "Where is the risk mitigation strategy?",
    "Auditors are watching. Keep it clean.",
    "My stress levels are through the roof.",
    "Safety first. Protect the capital!",
    "I am locking down this account."
  ],
  RESEARCH: [
    "Section ten K footnote forty two is concerning.",
    "Federal Reserve minutes suggest hawkish pauses.",
    "Macro indicators suggest structural headwinds.",
    "Academic research indicates long term deviations.",
    "Statistically significant anomalies detected in filings.",
    "The data points to a paradigm shift.",
    "Yield curve inversion remains deeply troubling.",
    "Let us consult the quantitative historical files."
  ]
};

const fallbackIndexes = {
  QUANT: 0,
  DATA_JANITOR: 0,
  BULL: 0,
  BEAR: 0,
  RISK: 0,
  RESEARCH: 0
};

export function resolveArchetype(agent) {
  const id = (agent.id || '').toUpperCase();
  if (id.includes('QUANT')) return 'QUANT';
  if (id.includes('JANITOR')) return 'DATA_JANITOR';
  if (id.includes('BULL')) return 'BULL';
  if (id.includes('BEAR')) return 'BEAR';
  if (id.includes('RISK')) return 'RISK';
  if (id.includes('RESEARCH') || id.includes('DEBATER')) return 'RESEARCH';
  
  // Fallback to station if ID doesn't match
  const station = agent.station || '';
  if (station === 'research') return 'RESEARCH';
  if (station === 'error') return 'RISK';
  if (station === 'debate') return 'RESEARCH';
  if (station === 'desk') return 'QUANT';
  
  return 'RESEARCH';
}

export function getFallbackQuote(archetype) {
  const pool = FALLBACK_QUOTES[archetype] || FALLBACK_QUOTES.RESEARCH;
  const index = fallbackIndexes[archetype] ?? 0;
  const quote = pool[index % pool.length];
  fallbackIndexes[archetype] = (index + 1) % pool.length;
  return quote;
}

export function computeVolume(agent, sceneEl) {
  if (!agent) return 1.0;
  
  // Support both 2D (x, y) and 3D (x, z) positions
  const is3D = agent.z !== undefined;
  
  let depthRatio = 0.5;
  let widthRatio = 0.5;
  
  if (is3D) {
    // 3D: z ranges roughly from -30 (back/quieter) to +30 (front/louder)
    const z = agent.z ?? 0;
    depthRatio = Math.min(Math.max((z + 30) / 60, 0), 1);
    
    // 3D: x ranges roughly from -30 to +30
    const x = agent.x ?? 0;
    widthRatio = Math.min(Math.max((x + 30) / 60, 0), 1);
  } else {
    // 2D: y ranges from 0 to 120
    const y = agent.y ?? 60;
    depthRatio = Math.min(Math.max(y / 120, 0), 1);
    
    // 2D: x ranges from 0 to 200
    const x = agent.x ?? 100;
    widthRatio = Math.min(Math.max(x / 200, 0), 1);
  }
  
  const baseVolume = 0.3 + 0.7 * depthRatio; // 0.3 to 1.0
  const distFromCenter = Math.abs(widthRatio - 0.5); // 0 to 0.5
  const edgeAttenuation = 1.0 - distFromCenter * 0.4; // 0.8 to 1.0
  
  let scaleFactor = 1.0;
  if (sceneEl) {
    // If the scene container is physically small, reduce volume slightly to avoid clipping / overcrowding sound
    const rect = sceneEl.getBoundingClientRect();
    if (rect.width < 500) {
      scaleFactor = 0.7;
    }
  }

  return Math.min(Math.max(baseVolume * edgeAttenuation * scaleFactor, 0.1), 1.0);
}

export function getVoiceForAgent(agent, archetype) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  let candidateVoices = voices;

  // Filter by requested accent if specified
  const requestedAccent = agent?.voice_accent || agent?.avatar_config?.voice_accent; // Fallback for nested keys if any
  if (requestedAccent) {
    // Parse formats like 'en_GB-alan-low' to 'en-GB' for Web Speech API matching
    const parsedLang = requestedAccent.replace('_', '-').substring(0, 5);
    const exactMatches = voices.filter(v => v.lang.startsWith(parsedLang));
    if (exactMatches.length > 0) {
      candidateVoices = exactMatches;
    }
  } else {
    // Default: Prefer English voices
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    candidateVoices = enVoices.length > 0 ? enVoices : voices;
  }

  // Deterministically select a voice from candidates based on agent.id
  let hash = 0;
  const seed = (agent && agent.id) ? agent.id : (archetype || "default");
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % candidateVoices.length;
  return candidateVoices[index];
}

export function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  if (!enabled) {
    speechQueue.length = 0;
    isProcessingQueue = false;
    if (currentReject) {
      try {
        currentReject();
      } catch (e) {}
      currentReject = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  } else {
    if (typeof window !== 'undefined') {
      // Replace closed or missing AudioContext with a fresh instance
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Resume suspended context — browsers suspend contexts created outside
      // a user gesture. When the user clicks unmute this runs inside a click
      // handler, so the browser allows the resume.
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }
  }
}

export function isAudioEnabled() {
  return audioEnabled;
}

export async function executeSpeech({ quote, agent, sceneEl, onProgress }) {
  const archetype = resolveArchetype(agent);
  const textToSpeak = quote || getFallbackQuote(archetype);
  const cleanText = textToSpeak ? textToSpeak.replace(/[*_`~#]/g, '') : '';

  if (typeof window === 'undefined' || !audioEnabled) {
    if (!cleanText) return;
    const words = cleanText.split(' ').filter(w => w.length > 0);
    if (words.length === 0) {
      if (onProgress) onProgress('', true);
      return;
    }
    return new Promise((resolve) => {
      let currentWordIndex = 0;
      let wordTimeout = null;
      const typeNextWord = () => {
        if (currentWordIndex < words.length) {
          const textSoFar = words.slice(0, currentWordIndex + 1).join(' ');
          const isComplete = currentWordIndex === words.length - 1;
          if (onProgress) onProgress(textSoFar, isComplete);
          if (!isComplete) {
            currentWordIndex++;
            wordTimeout = setTimeout(typeNextWord, 200); // 200ms per word simulates standard talking speed
          } else {
            resolve();
          }
        }
      };
      currentReject = () => {
        if (wordTimeout) clearTimeout(wordTimeout);
        resolve();
      };
      typeNextWord();
    });
  }

  if (!cleanText) return;

  const volume = computeVolume(agent, sceneEl);
  const requestedAccent = agent?.voice_accent || agent?.avatar_config?.voice_accent || "default";

  // Ensure AudioContext is alive and running before attempting playback
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  // Attempt Piper TTS backend first
  try {
    const ttsResponse = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice_accent: requestedAccent })
    });

    if (!ttsResponse.ok) throw new Error("Piper TTS HTTP error " + ttsResponse.status);

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const decodedAudioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

    return new Promise((resolve) => {
      const bufferSource = audioCtx.createBufferSource();
      bufferSource.buffer = decodedAudioBuffer;
      
      const customPlaybackRate = agent?.voice_rate ?? agent?.voiceRate ?? (CHARACTERISTICS[archetype] || CHARACTERISTICS.RESEARCH).rate;
      bufferSource.playbackRate.value = customPlaybackRate;
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;

      bufferSource.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const durationSec = decodedAudioBuffer.duration;
      const actualDurationMs = (durationSec * 1000) / customPlaybackRate;
      const words = cleanText.split(' ').filter(w => w.length > 0);
      const msPerWord = actualDurationMs / Math.max(words.length, 1);

      let wordTimeout = null;
      let currentWordIndex = 0;

      const triggerNextWord = () => {
        if (currentWordIndex < words.length) {
          const textSoFar = words.slice(0, currentWordIndex + 1).join(' ');
          const isComplete = currentWordIndex === words.length - 1;
          if (onProgress) onProgress(textSoFar, isComplete);
          if (!isComplete) {
            currentWordIndex++;
            wordTimeout = setTimeout(triggerNextWord, msPerWord);
          }
        }
      };

      currentReject = () => {
        if (wordTimeout) clearTimeout(wordTimeout);
        try {
          bufferSource.stop();
        } catch (e) {}
        resolve();
      };

      bufferSource.onended = () => {
        currentReject = null;
        if (wordTimeout) clearTimeout(wordTimeout);
        if (onProgress) onProgress(cleanText, true);
        resolve();
      };

      // Start word-by-word progress in sync with audio playback duration
      triggerNextWord();

      console.log(`[PiperTTS] Speaking (${requestedAccent}): "${textToSpeak}" at volume ${volume.toFixed(2)}`);
      bufferSource.start(0);
    });

  } catch (piperError) {
    console.warn("[PiperTTS] Backend synthesis failed, falling back to local Web Speech API:", piperError);
  }

  // FALLBACK to native browser TTS
  if (!window.speechSynthesis) {
    if (onProgress) onProgress(cleanText, true);
    return;
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);

    currentReject = () => {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      resolve();
    };

    if (onProgress) {
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          let nextSpace = cleanText.indexOf(' ', event.charIndex);
          if (nextSpace === -1) nextSpace = cleanText.length;
          onProgress(cleanText.substring(0, nextSpace), false);
        }
      };
    }
    
    utterance.onend = () => {
      currentReject = null;
      if (onProgress) onProgress(cleanText, true);
      resolve();
    };
    utterance.onerror = () => {
      currentReject = null;
      if (onProgress) onProgress(cleanText, true);
      resolve();
    };

    const char = CHARACTERISTICS[archetype] || CHARACTERISTICS.RESEARCH;
    
    const customPitch = agent?.voice_pitch ?? agent?.voicePitch;
    const customRate = agent?.voice_rate ?? agent?.voiceRate;
    
    utterance.pitch = (customPitch !== undefined && customPitch !== null) ? customPitch : char.pitch;
    utterance.rate = (customRate !== undefined && customRate !== null) ? customRate : char.rate;

    const voice = getVoiceForAgent(agent, archetype);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.volume = volume;

    console.log(`[AgentVoice Fallback] Speaking (${archetype}): "${textToSpeak}"`);
    window.speechSynthesis.speak(utterance);
  });
}

async function processQueue() {
  if (isProcessingQueue || speechQueue.length === 0) return;
  isProcessingQueue = true;

  const item = speechQueue[0];
  try {
    await executeSpeech(item);
  } catch (err) {
    console.error("[AgentVoice Queue] Error during speech execution:", err);
  } finally {
    speechQueue.shift();
    isProcessingQueue = false;
    // Brief pause between speakers to let animation catch up
    setTimeout(processQueue, 150);
  }
}

export function triggerAgentSpeech(quote, agent, sceneEl, onProgress) {
  speechQueue.push({ quote, agent, sceneEl, onProgress });
  processQueue();
}
