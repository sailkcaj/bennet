import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "./theme";
import { useReducedMotion } from "./useReducedMotion";

/** Purely decorative motif. It is hidden from VoiceOver and never reflects a measurement. */
export function Orbit({ size = 132 }: { size?: number }) {
  const reduced = useReducedMotion();
  const [spin] = useState(() => new Animated.Value(0));
  const [rotate] = useState(() => spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }));
  useEffect(() => {
    if (reduced) {
      spin.stopAnimation();
      return;
    }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, spin]);
  const c = size / 2;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {[0.46, 0.34, 0.22].map((r, i) => (
          <Circle key={r} cx={c} cy={c} r={size * r} stroke={colors.mint} strokeOpacity={0.12 + i * 0.06} strokeWidth={1} fill="none" />
        ))}
        <Circle cx={c} cy={c} r={size * 0.07} fill={colors.mint} fillOpacity={0.18} />
        <Circle cx={c} cy={c} r={size * 0.03} fill={colors.mint} fillOpacity={0.7} />
      </Svg>
      <Animated.View style={{ position: "absolute", width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c + size * 0.46} cy={c} r={3} fill={colors.mint} fillOpacity={0.8} />
          <Circle cx={c} cy={c - size * 0.34} r={2.4} fill={colors.text} fillOpacity={0.55} />
          <Circle cx={c - size * 0.16} cy={c + size * 0.16} r={2} fill={colors.mint} fillOpacity={0.6} />
        </Svg>
      </Animated.View>
    </View>
  );
}
