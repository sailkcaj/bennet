// SYNTHETIC test fixtures: deterministic generated signals, not recordings of any person.
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: () => number) {
  return () => {
    const u = Math.max(1e-12, random());
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export function frameTimes(seconds: number, fps: number, random: () => number): number[] {
  const times: number[] = [];
  for (let i = 0; i < seconds * fps; i++) times.push(100 + i / fps + (random() - 0.5) * 0.004);
  return times;
}
