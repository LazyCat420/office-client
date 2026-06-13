import { CHARACTERISTICS, resolveArchetype, getFallbackQuote } from './voiceConstants';
import { isAudioEnabled, getAudioContext, onAudioDisabled } from './audioContextManager';
import { cleanAgentId } from './agentUtils';

export const ttsEventEmitter = new EventTarget();

const speechQueue = [];
let isProcessingQueue = false;
let currentReject = null;

// Register cleanup
onAudioDisabled(() => {
  speechQueue.length = 0;
  isProcessingQueue = false;
  if (currentReject) {
    try {
      currentReject();
    } catch (e) {}
    currentReject = null;
  }
});

export function computeVolume(agent, sceneEl) {
  if (!agent) return 1.0;
  
  const is3D = agent.z !== undefined;
  let depthRatio = 0.5;
  let widthRatio = 0.5;
  
  if (is3D) {
    const z = agent.z ?? 0;
    depthRatio = Math.min(Math.max((z + 30) / 60, 0), 1);
    
    const x = agent.x ?? 0;
    widthRatio = Math.min(Math.max((x + 30) / 60, 0), 1);
  } else {
    const y = agent.y ?? 60;
    depthRatio = Math.min(Math.max(y / 120, 0), 1);
    
    const x = agent.x ?? 100;
    widthRatio = Math.min(Math.max(x / 200, 0), 1);
  }
  
  const baseVolume = 0.3 + 0.7 * depthRatio;
  const distFromCenter = Math.abs(widthRatio - 0.5);
  const edgeAttenuation = 1.0 - distFromCenter * 0.4;
  
  let scaleFactor = 1.0;
  if (sceneEl) {
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

  const requestedAccent = agent?.voice_accent || agent?.avatar_config?.voice_accent;
  if (requestedAccent) {
    const parsedLang = requestedAccent.replace('_', '-').substring(0, 5);
    const exactMatches = voices.filter(v => v.lang.startsWith(parsedLang));
    if (exactMatches.length > 0) {
      candidateVoices = exactMatches;
    }
  } else {
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    candidateVoices = enVoices.length > 0 ? enVoices : voices;
  }

  let hash = 0;
  const seed = (agent && agent.id) ? agent.id : (archetype || "default");
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % candidateVoices.length;
  return candidateVoices[index];
}

export async function executeSpeech({ quote, agent, sceneEl, onProgress, audioPromise }) {
  const archetype = resolveArchetype(agent);
  const textToSpeak = quote || getFallbackQuote(archetype);
  const cleanText = textToSpeak ? textToSpeak.replace(/[*_`~#]/g, '') : '';

  const rawAgentId = (agent && typeof agent === 'object') 
    ? (agent.id || agent.agentId || 'unknown') 
    : (typeof agent === 'string' ? agent : 'unknown');
  const cleanedId = cleanAgentId(rawAgentId) || rawAgentId || 'unknown';

  if (typeof window === 'undefined' || !isAudioEnabled()) {
    if (!cleanText) return;
    const words = cleanText.split(' ').filter(w => w.length > 0);
    if (words.length === 0) {
      if (onProgress) onProgress('', true);
      return;
    }

    try {
      ttsEventEmitter.dispatchEvent(new CustomEvent('speech', {
        detail: {
          agentId: cleanedId,
          quote: cleanText,
          timestamp: new Date().toLocaleTimeString(),
          ttsEngine: 'Simulated Typing'
        }
      }));
    } catch (e) {
      console.warn("Failed to dispatch local speech event:", e);
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
            wordTimeout = setTimeout(typeNextWord, 200);
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
  const audioCtx = getAudioContext();

  if (!audioCtx || audioCtx.state !== 'running') {
     console.warn("[AgentVoice] AudioContext is missing or not running. Have you clicked Unmute?");
  }

  try {
    let ttsResponse;
    if (audioPromise) {
      ttsResponse = await audioPromise;
    } else {
      ttsResponse = await fetch('/api/v1/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice_accent: requestedAccent })
      });
    }

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

      try {
        ttsEventEmitter.dispatchEvent(new CustomEvent('speech', {
          detail: {
            agentId: cleanedId,
            quote: cleanText,
            timestamp: new Date().toLocaleTimeString(),
            ttsEngine: 'Piper TTS'
          }
        }));
      } catch (e) {
        console.warn("Failed to dispatch local speech event:", e);
      }

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

    try {
      ttsEventEmitter.dispatchEvent(new CustomEvent('speech', {
        detail: {
          agentId: cleanedId,
          quote: cleanText,
          timestamp: new Date().toLocaleTimeString(),
          ttsEngine: 'Web Speech API'
        }
      }));
    } catch (e) {
      console.warn("Failed to dispatch local speech event:", e);
    }

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
    setTimeout(processQueue, 150);
  }
}

export function triggerAgentSpeech(quote, agent, sceneEl, onProgress) {
  const archetype = resolveArchetype(agent);
  const textToSpeak = quote || getFallbackQuote(archetype);
  const cleanText = textToSpeak ? textToSpeak.replace(/[*_`~#]/g, '') : '';
  const requestedAccent = agent?.voice_accent || agent?.avatar_config?.voice_accent || "default";

  let audioPromise = null;
  if (typeof window !== 'undefined' && isAudioEnabled() && cleanText) {
    audioPromise = fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice_accent: requestedAccent })
    }).catch(err => {
      console.warn("Pre-fetch TTS failed:", err);
      throw err;
    });
  }

  speechQueue.push({ quote, agent, sceneEl, onProgress, audioPromise });
  processQueue();
}
