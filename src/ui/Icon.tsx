import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName =
  | "pulse"
  | "fingertip"
  | "face"
  | "sound"
  | "depth"
  | "bell"
  | "history"
  | "back"
  | "chevronDown"
  | "chevronRight"
  | "info"
  | "sliders"
  | "lock"
  | "cloud"
  | "moon"
  | "book"
  | "check"
  | "alert"
  | "play"
  | "stop";

const PATHS: Record<IconName, (color: ColorValue) => React.ReactNode> = {
  pulse: () => <Path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22" />,
  fingertip: () => (
    <>
      <Path d="M8 21v-8.5a4 4 0 0 1 8 0V21" />
      <Path d="M11 12.5a1 1 0 0 1 2 0V16" />
      <Path d="M5 8.5a7.5 7.5 0 0 1 14 0" />
    </>
  ),
  face: (c) => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={9} cy={10} r={0.9} fill={c} />
      <Circle cx={15} cy={10} r={0.9} fill={c} />
      <Path d="M8.8 14.6a4.2 4.2 0 0 0 6.4 0" />
    </>
  ),
  sound: () => <Path d="M4 10.5v3M8 7.5v9M12 4.5v15M16 8.5v7M20 11v2" />,
  depth: () => (
    <>
      <Path d="M3 9c2.5-2.5 5 2.5 9 0s6.5 2.5 9 0" />
      <Path d="M3 15c2.5-2.5 5 2.5 9 0s6.5 2.5 9 0" />
    </>
  ),
  bell: () => (
    <>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  history: () => (
    <>
      <Path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <Path d="M3.5 4v4h4" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  back: () => <Path d="M15 5l-7 7 7 7" />,
  chevronDown: () => <Path d="M6 9l6 6 6-6" />,
  chevronRight: () => <Path d="M9 6l6 6-6 6" />,
  info: (c) => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5.5" />
      <Circle cx={12} cy={7.8} r={0.8} fill={c} />
    </>
  ),
  sliders: () => (
    <>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </>
  ),
  lock: () => (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  cloud: () => <Path d="M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11.6 3.5 3.5 0 0 0 7 18.5z" />,
  moon: () => <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />,
  book: () => (
    <>
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <Path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H19" />
    </>
  ),
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: (c) => (
    <>
      <Path d="M12 3.5l9.5 16.5h-19z" />
      <Path d="M12 10v4.5" />
      <Circle cx={12} cy={17.3} r={0.8} fill={c} />
    </>
  ),
  play: () => <Path d="M8 5.5v13l10-6.5z" />,
  stop: () => <Rect x={6.5} y={6.5} width={11} height={11} rx={2} />,
};

export function Icon({ name, color, size = 22, strokeWidth = 1.7 }: { name: IconName; color: ColorValue; size?: number; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name](color)}
    </Svg>
  );
}
