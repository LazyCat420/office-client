/**
 * SoundManager.js
 * 
 * Manages spatial and global sounds for the 3D office.
 * Exposes a helper to play sounds globally if Web Audio is available.
 */

class SoundManager {
  constructor() {
    this.context = null;
    this.sounds = {};
    this.enabled = false;
    this.muted = true;
  }

  init() {
    if (this.context || typeof window === 'undefined') return;
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
      // We could fetch and decode sound buffers here, but for simplicity
      // and Fall Guys feel, we'll synthesize simple bouncy beeps and pops.
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  setMute(muted) {
    this.muted = muted;
  }

  playPop() {
    if (!this.enabled || !this.context || this.muted) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  playGlassBreak() {
    if (!this.enabled || !this.context || this.muted) return;

    // Glass-break: short noise burst through bandpass filter + high chirp
    const now = this.context.currentTime;
    const duration = 0.35;

    // Noise burst — sounds like crackle/shatter
    const bufferSize = this.context.sampleRate * duration;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = this.context.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(4000, now);
    bandpass.Q.setValueAtTime(0.8, now);

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.context.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // High-freq tinkle chirp
    const osc = this.context.createOscillator();
    const oscGain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(8000, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(oscGain);
    oscGain.connect(this.context.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playQuack(force = false) {
    if (!this.enabled || !this.context || (!force && this.muted)) return;
    const now = this.context.currentTime;
    const duration = 0.25;

    const osc = this.context.createOscillator();
    osc.type = 'sawtooth';
    
    // Frequency envelope (pitch drops quickly)
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    // Bandpass filter to make it sound "nasal"
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.value = 2;
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);

    // Amplitude envelope
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playStep() {
    if (!this.enabled || !this.context || this.muted) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.05);
  }
}

export const soundManager = new SoundManager();
