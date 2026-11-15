import type { SensorKind } from "../../modules/night-signal-sensors";

export const MAX_SESSION_SECONDS = 30;

export const SESSION_LIMITS: Record<SensorKind, number> = { ppg: 30, face: 30, audio: 30, depth: 30 };

export const FINGERTIP_TORCH_LEVEL = 0.3;
