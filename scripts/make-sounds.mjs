// Generates the three tiny game sounds as 16-bit PCM WAV files — synthesized
// sine tones with decay envelopes, so the repo owns them outright (no
// licensing, no downloads). Re-run with `node scripts/make-sounds.mjs`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(outDir, { recursive: true });

function tone(freq, seconds, { harmonics = [1], decay = 6, delay = 0 } = {}) {
  const total = Math.floor(SAMPLE_RATE * (delay + seconds));
  const samples = new Float32Array(total);
  const start = Math.floor(SAMPLE_RATE * delay);
  const n = Math.floor(SAMPLE_RATE * seconds);
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp((-decay * i) / n);
    let v = 0;
    harmonics.forEach(([mult, amp], k) => {
      v += amp * Math.sin(2 * Math.PI * freq * mult * t + k);
    });
    samples[start + i] += v * env;
  }
  return samples;
}

function mix(...tracks) {
  const len = Math.max(...tracks.map((t) => t.length));
  const out = new Float32Array(len);
  for (const t of tracks) for (let i = 0; i < t.length; i += 1) out[i] += t[i];
  const peak = Math.max(0.001, ...Array.from(out, (v) => Math.abs(v)));
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] / peak) * 0.85;
  return out;
}

function toWav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SAMPLE_RATE, 24);
  data.writeUInt32LE(SAMPLE_RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    data.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  }
  return data;
}

// Your turn: bright two-note chime (E5 -> A5).
writeFileSync(join(outDir, 'turn.wav'), toWav(mix(
  tone(659.25, 0.22, { harmonics: [[1, 1], [2, 0.3]] }),
  tone(880, 0.35, { harmonics: [[1, 1], [2, 0.3]], delay: 0.16 }),
)));

// Jailed: low descending "cell door" (A3 -> E3) with a metallic edge.
writeFileSync(join(outDir, 'jail.wav'), toWav(mix(
  tone(220, 0.3, { harmonics: [[1, 1], [2.76, 0.25]], decay: 4 }),
  tone(164.81, 0.45, { harmonics: [[1, 1], [2.76, 0.25]], decay: 4, delay: 0.24 }),
)));

// Bank payout: quick ascending coin arpeggio (C6 E6 G6).
writeFileSync(join(outDir, 'bank.wav'), toWav(mix(
  tone(1046.5, 0.14, { harmonics: [[1, 1], [3, 0.15]], decay: 9 }),
  tone(1318.5, 0.14, { harmonics: [[1, 1], [3, 0.15]], decay: 9, delay: 0.09 }),
  tone(1568, 0.28, { harmonics: [[1, 1], [3, 0.15]], decay: 9, delay: 0.18 }),
)));

console.log('wrote turn.wav, jail.wav, bank.wav to', outDir);
