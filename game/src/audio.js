// Shadow Courier — every sound is synthesized with the Web Audio API:
// footsteps that tell you where a warden is, a soft chime for a seal, a
// sting when you are spotted. No audio files, no network.
let audioCtx = null;
let muted = false;
let master = null;

/** Create the audio graph on the first user gesture (browsers require one). */
export function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.5;
    master.connect(audioCtx.destination);
  } catch {
    audioCtx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone({ frequency, endFrequency, duration, type = 'sine', volume = 0.2, when = 0 }) {
  if (!audioCtx || muted) return;
  const start = audioCtx.currentTime + when;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function noise({ duration, volume = 0.15, frequency = 800, when = 0 }) {
  if (!audioCtx || muted) return;
  const start = audioCtx.currentTime + when;
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
}

/**
 * Play one of the world's events. `distance` (0 near, 1 far) quiets a
 * warden's footsteps the further away it walks — that is how you hear
 * where a guard is without seeing it.
 */
export function playEvent(event, distance = 0) {
  if (!audioCtx || muted) return;
  const far = Math.max(0, Math.min(1, distance));
  switch (event.type) {
    case 'step':
      if (event.byPlayer) {
        noise({ duration: 0.05, volume: event.running ? 0.12 : 0.05, frequency: event.running ? 1200 : 700 });
      } else {
        // A warden's step: a low thud, quieter the further away it is.
        tone({ frequency: 95, duration: 0.09, type: 'triangle', volume: 0.22 * (1 - far * 0.8) });
      }
      break;
    case 'pickup':
      tone({ frequency: 880, endFrequency: 1318, duration: 0.18, volume: 0.18 });
      tone({ frequency: 1318, duration: 0.12, volume: 0.12, when: 0.1 });
      break;
    case 'spotted':
      tone({ frequency: 220, endFrequency: 330, duration: 0.25, type: 'square', volume: 0.1 });
      break;
    case 'alarmed':
      tone({ frequency: 196, duration: 0.16, type: 'sawtooth', volume: 0.16 });
      tone({ frequency: 147, duration: 0.3, type: 'sawtooth', volume: 0.16, when: 0.14 });
      break;
    case 'lost':
      tone({ frequency: 330, endFrequency: 220, duration: 0.3, volume: 0.08 });
      break;
    case 'pebble':
      noise({ duration: 0.08, volume: 0.1, frequency: 2000 });
      break;
    case 'pebbleLand':
      tone({ frequency: 1400, endFrequency: 900, duration: 0.07, type: 'triangle', volume: 0.14 });
      noise({ duration: 0.12, volume: 0.12, frequency: 900, when: 0.02 });
      break;
    case 'exitOpen':
      tone({ frequency: 523, duration: 0.2, volume: 0.14 });
      tone({ frequency: 784, duration: 0.3, volume: 0.14, when: 0.12 });
      break;
    case 'levelClear':
      [523, 659, 784, 1047].forEach((frequency, i) => {
        tone({ frequency, duration: 0.22, volume: 0.14, when: i * 0.11 });
      });
      break;
    case 'caught':
      tone({ frequency: 110, endFrequency: 55, duration: 0.5, type: 'sawtooth', volume: 0.2 });
      break;
    default:
      break;
  }
}
