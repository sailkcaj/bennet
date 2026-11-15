import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, type } from "./theme";

export function CountdownRing({ remainingMs, totalMs, size = 216 }: { remainingMs: number; totalMs: number; size?: number }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignSelf: "center", alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceSunken} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.amber}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </Svg>
      <Text
        testID="countdown-seconds"
        accessibilityLabel={`${seconds} seconds remaining`}
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={1.2}
        style={[type.readout, { color: colors.text, fontSize: 72, lineHeight: 80 }]}
      >
        {seconds}
      </Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>seconds left</Text>
    </View>
  );
}
