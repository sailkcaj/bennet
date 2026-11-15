export type SignalStatus = "acquiring" | "usable" | "poor_signal";

export type Estimate = {
  status: SignalStatus;
  value: number | null;
  quality: number;
  reasons: string[];
  seconds: number;
};

export type PpgFrame = {
  t: number;
  r: number;
  g: number;
  b: number;
  saturatedFraction: number;
  darkFraction: number;
  motion: number;
};

export type FaceFrame = {
  t: number;
  faceFound: boolean;
  r: number;
  g: number;
  b: number;
  luminance: number;
  faceX: number;
  faceY: number;
  faceW: number;
};

export type DepthFrame = { t: number; meanDepth: number; validFraction: number };

export const REASON_TEXT: Record<string, string> = {
  insufficient_samples: "Collecting samples — hold still",
  low_sample_rate: "Too few camera frames per second",
  sample_gap: "Frames were dropped",
  flat_signal: "No usable variation in the signal",
  weak_periodicity: "No clear repeating rhythm",
  unstable_rhythm: "Rhythm estimate is not stable",
  no_finger: "Finger not covering the camera and flash",
  saturated: "Image too bright — press more lightly or reposition",
  movement: "Too much movement",
  no_face: "Face not detected consistently",
  too_dark: "Too dark for the RGB camera",
  depth_invalid: "Depth not valid in the selected area",
  out_of_range: "Chest area too close or too far",
  large_movement: "Large body movement detected",
};
