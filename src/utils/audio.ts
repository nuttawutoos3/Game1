// Custom 8-bit Web Audio Synth for game sounds and background music.
let audioCtx: AudioContext | null = null;
let musicInterval: number | null = null;
let musicNodes: AudioNode[] = [];
let currentMusicStep = 0;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play sound effect with volume check
export function playSound(type: 'click' | 'select' | 'shoot' | 'explosion' | 'hurt' | 'powerup', volume: number) {
  if (volume <= 0) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime((volume / 100) * 0.25, now);
    gainNode.connect(ctx.destination);

    if (type === 'click') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'select') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(587.33, now + 0.06);
      osc.frequency.setValueAtTime(659.25, now + 0.12);
      osc.frequency.setValueAtTime(880, now + 0.18);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'shoot') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'hurt') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.2);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'explosion') {
      // Noise buffer for explosion
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Lowpass filter for explosion crunchiness
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(10, now + 0.3);

      gainNode.gain.setValueAtTime((volume / 100) * 0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start(now);
      noise.stop(now + 0.3);
    } else if (type === 'powerup') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(261.63, now); // C4
      osc.frequency.setValueAtTime(329.63, now + 0.05); // E4
      osc.frequency.setValueAtTime(392.00, now + 0.10); // G4
      osc.frequency.setValueAtTime(523.25, now + 0.15); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.20); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.25); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.30); // C6
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    console.warn('Audio feedback failed or was blocked by browser policies.', e);
  }
}

// 8-bit background tracker
const MELODY = [
  349.23, 0, 392.00, 440.00, 0, 440.00, 392.00, 349.23,
  392.00, 0, 440.00, 523.25, 0, 440.00, 392.00, 0,
  349.23, 0, 392.00, 440.00, 0, 440.00, 523.25, 587.33,
  523.25, 440.00, 392.00, 349.23, 293.66, 0, 349.23, 0
];

const BASS = [
  110.00, 110.00, 130.81, 130.81, 146.83, 146.83, 130.81, 130.81,
  110.00, 110.00, 130.81, 130.81, 146.83, 146.83, 164.81, 164.81,
  110.00, 110.00, 130.81, 130.81, 146.83, 146.83, 130.81, 130.81,
  98.00, 98.00, 87.31, 87.31, 73.42, 73.42, 110.00, 110.00
];

export function startMusic(volume: number) {
  if (volume <= 0) {
    stopMusic();
    return;
  }
  try {
    const ctx = getAudioContext();
    if (musicInterval) return; // Already playing

    currentMusicStep = 0;
    const tempo = 130; // BPM
    const stepDuration = 60 / tempo / 2; // Eighth notes

    musicInterval = window.setInterval(() => {
      if (volume <= 0) return;
      const now = ctx.currentTime;

      // Create bass synth
      const bassFreq = BASS[currentMusicStep % BASS.length];
      if (bassFreq > 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime((volume / 100) * 0.15, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration - 0.02);

        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + stepDuration - 0.01);
      }

      // Create melody synth (only on some steps)
      const melFreq = MELODY[currentMusicStep % MELODY.length];
      if (melFreq > 0 && Math.random() > 0.15) {
        const melOsc = ctx.createOscillator();
        const melGain = ctx.createGain();
        melOsc.type = 'square';
        melOsc.frequency.setValueAtTime(melFreq, now);

        melGain.gain.setValueAtTime((volume / 100) * 0.06, now);
        melGain.gain.exponentialRampToValueAtTime(0.002, now + stepDuration * 1.5 - 0.05);

        melOsc.connect(melGain);
        melGain.connect(ctx.destination);
        melOsc.start(now);
        melOsc.stop(now + stepDuration * 1.5 - 0.02);
      }

      currentMusicStep++;
    }, stepDuration * 1000);
  } catch (e) {
    console.warn('Music playback failed', e);
  }
}

export function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

export function updateMusicVolume(volume: number) {
  // Volume is read dynamically in the interval, but if it becomes 0 we stop the music.
  if (volume <= 0) {
    stopMusic();
  } else if (!musicInterval) {
    startMusic(volume);
  }
}
