export type Sample = { t: number; v: number };

export function isFiniteSample(sample: Sample): boolean {
  return Number.isFinite(sample.t) && Number.isFinite(sample.v);
}

export function resampleUniform(samples: Sample[], rateHz: number): number[] {
  if (samples.length < 2) return [];
  const start = samples[0].t;
  const end = samples[samples.length - 1].t;
  const count = Math.floor((end - start) * rateHz) + 1;
  const out = new Array<number>(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = start + i / rateHz;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const span = b.t - a.t;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    out[i] = a.v + (b.v - a.v) * f;
  }
  return out;
}

export function mean(x: number[]): number {
  if (x.length === 0) return 0;
  let sum = 0;
  for (const value of x) sum += value;
  return sum / x.length;
}

export function std(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  let sum = 0;
  for (const value of x) sum += (value - m) * (value - m);
  return Math.sqrt(sum / (x.length - 1));
}

export function movingAverage(x: number[], window: number): number[] {
  const half = Math.max(1, Math.floor(window / 2));
  const prefix = new Array<number>(x.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < x.length; i++) prefix[i + 1] = prefix[i] + x[i];
  return x.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(x.length, i + half + 1);
    return (prefix[hi] - prefix[lo]) / (hi - lo);
  });
}

export function detrend(x: number[], window: number): number[] {
  const trend = movingAverage(x, window);
  return x.map((value, i) => value - trend[i]);
}

export function bandLimit(x: number[], fs: number, lowHz: number, highHz: number): number[] {
  const highPassed = detrend(x, Math.round(fs / lowHz));
  const smoothWindow = Math.max(1, Math.round(fs / (highHz * 2)));
  return smoothWindow > 1 ? movingAverage(highPassed, smoothWindow) : highPassed;
}

export function powerAt(x: number[], fs: number, freqHz: number): number {
  let re = 0;
  let im = 0;
  const w = (2 * Math.PI * freqHz) / fs;
  for (let n = 0; n < x.length; n++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / Math.max(1, x.length - 1));
    re += x[n] * hann * Math.cos(w * n);
    im -= x[n] * hann * Math.sin(w * n);
  }
  return re * re + im * im;
}

export type SpectrumPeak = { freqHz: number; concentration: number };

export function spectralPeak(x: number[], fs: number, minHz: number, maxHz: number, stepHz = 0.01): SpectrumPeak | null {
  const freqs: number[] = [];
  const powers: number[] = [];
  for (let f = minHz; f <= maxHz + 1e-9; f += stepHz) {
    freqs.push(f);
    powers.push(powerAt(x, fs, f));
  }
  let total = 0;
  let best = 0;
  for (let i = 0; i < powers.length; i++) {
    total += powers[i];
    if (powers[i] > powers[best]) best = i;
  }
  if (!(total > 0) || !Number.isFinite(total)) return null;
  const bandHalfWidth = Math.max(0.06, 1.5 / (x.length / fs));
  let peakBand = 0;
  for (let i = 0; i < powers.length; i++) {
    if (Math.abs(freqs[i] - freqs[best]) <= bandHalfWidth) peakBand += powers[i];
  }
  return { freqHz: freqs[best], concentration: peakBand / total };
}

export function autocorrelationAt(x: number[], lag: number): number {
  if (lag <= 0 || lag >= x.length) return 0;
  const m = mean(x);
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - m;
    den += d * d;
    if (i + lag < x.length) num += d * (x[i + lag] - m);
  }
  return den > 0 ? num / den : 0;
}

export type PeriodicStatus = "acquiring" | "usable" | "poor_signal";

export type PeriodicOptions = {
  rateHz: number;
  minHz: number;
  maxHz: number;
  minSeconds: number;
  minEffectiveRateHz: number;
  maxGapSeconds: number;
  minConcentration: number;
  minAutocorrelation: number;
  maxHalfDisagreementHz: number;
  minRelativeVariation: number;
};

export type PeriodicResult = {
  status: PeriodicStatus;
  freqHz: number | null;
  quality: number;
  reasons: string[];
  seconds: number;
};

export function estimatePeriodic(input: Sample[], options: PeriodicOptions): PeriodicResult {
  const samples = input.filter(isFiniteSample).sort((a, b) => a.t - b.t);
  const seconds = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  if (seconds < options.minSeconds) {
    return { status: "acquiring", freqHz: null, quality: 0, reasons: ["insufficient_samples"], seconds };
  }
  const reasons: string[] = [];
  if (samples.length / seconds < options.minEffectiveRateHz) reasons.push("low_sample_rate");
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].t - samples[i - 1].t > options.maxGapSeconds) {
      reasons.push("sample_gap");
      break;
    }
  }
  const values = samples.map((s) => s.v);
  const level = Math.abs(mean(values));
  const uniform = resampleUniform(samples, options.rateHz);
  const filtered = bandLimit(uniform, options.rateHz, options.minHz, options.maxHz);
  const variation = std(filtered);
  if (!(variation > 0) || (level > 0 && variation / level < options.minRelativeVariation)) reasons.push("flat_signal");
  if (reasons.length > 0) return { status: "poor_signal", freqHz: null, quality: 0, reasons, seconds };

  const peak = spectralPeak(filtered, options.rateHz, options.minHz, options.maxHz);
  if (!peak) return { status: "poor_signal", freqHz: null, quality: 0, reasons: ["flat_signal"], seconds };
  const lag = Math.round(options.rateHz / peak.freqHz);
  const autocorr = autocorrelationAt(filtered, lag);
  const half = Math.floor(filtered.length / 2);
  const firstHalf = spectralPeak(filtered.slice(0, half), options.rateHz, options.minHz, options.maxHz);
  const secondHalf = spectralPeak(filtered.slice(half), options.rateHz, options.minHz, options.maxHz);
  const quality = Math.max(0, Math.min(1, Math.min(peak.concentration / options.minConcentration, autocorr / options.minAutocorrelation) / 2));

  if (peak.concentration < options.minConcentration) reasons.push("weak_periodicity");
  if (autocorr < options.minAutocorrelation) reasons.push("weak_periodicity");
  if (!firstHalf || !secondHalf || Math.abs(firstHalf.freqHz - secondHalf.freqHz) > options.maxHalfDisagreementHz) {
    reasons.push("unstable_rhythm");
  }
  if (reasons.length > 0) {
    return { status: "poor_signal", freqHz: null, quality, reasons: Array.from(new Set(reasons)), seconds };
  }
  return { status: "usable", freqHz: peak.freqHz, quality, reasons: [], seconds };
}
