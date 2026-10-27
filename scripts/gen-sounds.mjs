// scripts/gen-sounds.mjs
// Generates studio-quality 16-bit PCM WAV sound files for Consuela notifications.
// Deterministic sine/harmonic synthesis with smooth ADSR envelopes.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOUNDS_DIR = path.join(__dirname, "..", "assets", "sounds");

if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

const SAMPLE_RATE = 44100;

function createWavBuffer(samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono = 2 bytes per sample
  const blockAlign = 2;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.round(int16), 44 + i * 2);
  }

  return buffer;
}

// 1. Chime: Warm C5 + E5 harmonic bell chime with gentle decay (0.9s)
function genChime() {
  const duration = 0.9;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);
  const f1 = 523.25; // C5
  const f2 = 659.25; // E5
  const f3 = 1046.5; // C6 shimmer

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-4.5 * t); // smooth exponential decay
    const val =
      0.55 * Math.sin(2 * Math.PI * f1 * t) +
      0.35 * Math.sin(2 * Math.PI * f2 * t) +
      0.10 * Math.sin(2 * Math.PI * f3 * t);
    samples[i] = val * env;
  }
  return samples;
}

// 2. Radar: Alerting dual-pulse tone for weather advisories (0.8s)
function genRadar() {
  const duration = 0.8;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);
  const p1 = 0.28;
  const p2 = 0.35;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let env = 0;
    let freq = 880;

    if (t < p1) {
      const pt = t;
      env = Math.sin((Math.PI * pt) / p1) * Math.exp(-2 * pt);
      freq = 784 + 100 * (pt / p1);
    } else if (t >= p1 + 0.08 && t < p1 + 0.08 + p2) {
      const pt = t - (p1 + 0.08);
      env = Math.sin((Math.PI * pt) / p2) * Math.exp(-1.5 * pt);
      freq = 880 + 150 * (pt / p2);
    }

    samples[i] = 0.85 * Math.sin(2 * Math.PI * freq * t) * env;
  }
  return samples;
}

// 3. Harp: Gentle 3-note ascending arpeggio chord (C5 -> E5 -> G5) (1.1s)
function genHarp() {
  const duration = 1.1;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);
  const notes = [
    { freq: 523.25, start: 0.0 },  // C5
    { freq: 659.25, start: 0.12 }, // E5
    { freq: 783.99, start: 0.24 }, // G5
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;
    for (const note of notes) {
      if (t >= note.start) {
        const dt = t - note.start;
        const env = Math.exp(-3.8 * dt);
        val += 0.35 * Math.sin(2 * Math.PI * note.freq * dt) * env;
        // Warm sub-harmonic
        val += 0.08 * Math.sin(Math.PI * note.freq * dt) * env;
      }
    }
    samples[i] = val;
  }
  return samples;
}

// 4. Bell: Resonant clear service bell (1.0s)
function genBell() {
  const duration = 1.0;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);
  const fundamental = 880; // A5

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-3.2 * t);
    const val =
      0.6 * Math.sin(2 * Math.PI * fundamental * t) +
      0.3 * Math.sin(2 * Math.PI * (fundamental * 2.76) * t) * Math.exp(-6 * t) +
      0.15 * Math.sin(2 * Math.PI * (fundamental * 5.4) * t) * Math.exp(-10 * t);
    samples[i] = val * env;
  }
  return samples;
}

// 5. Marimba: Warm wooden percussion strike (0.6s)
function genMarimba() {
  const duration = 0.6;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);
  const freq = 440; // A4

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-9.0 * t);
    const val =
      0.7 * Math.sin(2 * Math.PI * freq * t) +
      0.25 * Math.sin(2 * Math.PI * (freq * 3.8) * t) * Math.exp(-20 * t) +
      0.1 * Math.sin(2 * Math.PI * (freq * 0.5) * t);
    samples[i] = val * env;
  }
  return samples;
}

// 6. Pulse: Subtle modern double-glass tap (0.5s)
function genPulse() {
  const duration = 0.5;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let env = 0;
    let freq = 1200;

    if (t < 0.12) {
      const dt = t;
      env = Math.exp(-22 * dt);
      freq = 1320;
    } else if (t >= 0.12 && t < 0.35) {
      const dt = t - 0.12;
      env = Math.exp(-16 * dt);
      freq = 1760;
    }

    samples[i] = 0.7 * Math.sin(2 * Math.PI * freq * t) * env;
  }
  return samples;
}

const generators = {
  chime: genChime,
  radar: genRadar,
  harp: genHarp,
  bell: genBell,
  marimba: genMarimba,
  pulse: genPulse,
};

for (const [name, fn] of Object.entries(generators)) {
  const wavPath = path.join(SOUNDS_DIR, `${name}.wav`);
  const buf = createWavBuffer(fn());
  fs.writeFileSync(wavPath, buf);
  console.log(`Generated ${name}.wav (${buf.length} bytes)`);
}
console.log("Studio sound kit generated successfully.");
