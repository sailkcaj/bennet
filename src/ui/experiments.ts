import type { SensorKind } from "../../modules/night-signal-sensors";
import type { IconName } from "./Icon";

export type Placement = "nightstand" | "propped" | "hand";

export type Experiment = { kind: SensorKind; route: string; title: string; short: string; icon: IconName; placement: Placement };

export const EXPERIMENTS: Experiment[] = [
  { kind: "ppg", route: "fingertip", title: "Fingertip pulse", short: "Rear camera + flash", icon: "fingertip", placement: "hand" },
  { kind: "face", route: "face", title: "Face pulse", short: "Front camera colour", icon: "face", placement: "propped" },
  { kind: "audio", route: "sound", title: "Sound level", short: "Live mic level only", icon: "sound", placement: "nightstand" },
  { kind: "depth", route: "depth", title: "Breathing movement", short: "TrueDepth chest motion", icon: "depth", placement: "propped" },
];
