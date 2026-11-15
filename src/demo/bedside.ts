export type Placement = "nightstand" | "propped";

export const DEMO_SECONDS = 30;
export const BREATHING_READY_SECONDS = 8;
export const PULSE_READY_SECONDS = 12;

const BREATHING_BASE_PER_MIN = 14;
const PULSE_BASE_PER_MIN = 64;

export type DemoReadings = { breathing: number | null; pulse: number | null };
export type DemoRange = { average: number; low: number; high: number };
export type DemoSummary = { breathing: DemoRange; pulse: DemoRange | null };

export const PLACEMENTS: Record<Placement, { title: string; short: string; setup: string[]; showsPulse: boolean }> = {
  nightstand: {
    title: "Nightstand",
    short: "Phone flat beside the bed. Simulated breathing.",
    setup: [
      "Picture the phone lying flat on the nightstand, screen up, within arm's reach.",
      "The demo plays 30 seconds of simulated breathing: a generated trace and cadence.",
      "No microphone, camera or depth sensor is used. The phone doesn't listen.",
    ],
    showsPulse: false,
  },
  propped: {
    title: "Propped up",
    short: "Phone propped facing you. Simulated breathing + face pulse.",
    setup: [
      "Picture the phone propped on the nightstand, front camera facing your face and chest.",
      "The demo plays 30 seconds of simulated breathing and a simulated face-pulse reading.",
      "No camera is turned on. The real Face pulse and Breathing movement experiments run separately, one at a time.",
    ],
    showsPulse: true,
  },
};

function cyclePhase(cycles: number) {
  return ((cycles % 1) + 1) % 1;
}

function clampTime(t: number) {
  return Math.max(0, Math.min(DEMO_SECONDS, t));
}

export function breathingWave(t: number) {
  const phase = cyclePhase((t * BREATHING_BASE_PER_MIN) / 60 + 0.03 * Math.sin(t * 0.21));
  const inhale = 0.42;
  return phase < inhale ? 0.5 - 0.5 * Math.cos((Math.PI * phase) / inhale) : 0.5 + 0.5 * Math.cos((Math.PI * (phase - inhale)) / (1 - inhale));
}

export function pulseWave(t: number) {
  const phase = cyclePhase((t * PULSE_BASE_PER_MIN) / 60);
  return Math.exp(-((phase - 0.2) ** 2) / 0.004) + 0.35 * Math.exp(-((phase - 0.45) ** 2) / 0.01) + 0.04 * breathingWave(t);
}

export function waveWindow(wave: (t: number) => number, t: number, seconds: number, pointsPerSecond: number) {
  const end = clampTime(t);
  const count = Math.round(seconds * pointsPerSecond);
  return Array.from({ length: count }, (_, i) => wave(end - seconds + (i * seconds) / (count - 1)));
}

export function demoReadings(placement: Placement, t: number): DemoReadings {
  const time = clampTime(t);
  const breathing = time >= BREATHING_READY_SECONDS ? Math.round(BREATHING_BASE_PER_MIN + 0.8 * Math.sin(time / 4.5)) : null;
  const pulse = PLACEMENTS[placement].showsPulse && time >= PULSE_READY_SECONDS ? Math.round(PULSE_BASE_PER_MIN + 2.4 * Math.sin(time / 3.7 + 1)) : null;
  return { breathing, pulse };
}

function range(values: number[]): DemoRange {
  return { average: Math.round(values.reduce((a, b) => a + b, 0) / values.length), low: Math.min(...values), high: Math.max(...values) };
}

export function demoSummary(placement: Placement): DemoSummary {
  const breathing: number[] = [];
  const pulse: number[] = [];
  for (let t = 0; t <= DEMO_SECONDS; t += 0.5) {
    const readings = demoReadings(placement, t);
    if (readings.breathing !== null) breathing.push(readings.breathing);
    if (readings.pulse !== null) pulse.push(readings.pulse);
  }
  return { breathing: range(breathing), pulse: pulse.length ? range(pulse) : null };
}
