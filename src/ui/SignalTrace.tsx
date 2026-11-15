import { useId, useState } from "react";
import { View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, radius } from "./theme";

export function SignalTrace({
  values,
  color = colors.mint,
  height = 128,
  testID,
  label,
}: {
  values: number[];
  color?: string;
  height?: number;
  testID?: string;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const gradientId = `trace${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const finite = values.filter(Number.isFinite);
  let line = "";
  let area = "";
  if (width > 0 && finite.length > 1) {
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const span = max - min || 1;
    const pad = 14;
    const points = finite.map((v, i) => [(i / (finite.length - 1)) * width, height - pad - ((v - min) / span) * (height - pad * 2)]);
    line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    area = `${line} L${width} ${height} L0 ${height} Z`;
  }
  return (
    <View
      style={{ height, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, overflow: "hidden" }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID={testID}
      accessible
      accessibilityLabel={label}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} y1={height * f} x2={width} y2={height * f} stroke={colors.hairline} strokeWidth={0.6} />
          ))}
          {area ? <Path d={area} fill={`url(#${gradientId})`} /> : null}
          {line ? <Path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
