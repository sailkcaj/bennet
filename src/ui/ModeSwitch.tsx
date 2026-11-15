import { Pressable, Text, View } from "react-native";
import type { AppMode } from "../state/AppState";
import { Icon } from "./Icon";
import { colors, radius, space } from "./theme";

const OPTIONS: { mode: AppMode; label: string; caption: string; color: string; icon: "pulse" | "play" }[] = [
  { mode: "live", label: "LIVE SENSOR", caption: "Real camera / mic", color: colors.mint, icon: "pulse" },
  { mode: "demo", label: "DEMONSTRATION", caption: "Synthetic data only", color: colors.amber, icon: "play" },
];

export function ModeSwitch({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  return (
    <View
      style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md + 4, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.hairline }}
      accessibilityRole="radiogroup"
    >
      {OPTIONS.map((option) => {
        const selected = option.mode === mode;
        return (
          <Pressable
            key={option.mode}
            testID={`mode-${option.mode}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} mode, ${option.caption}`}
            onPress={() => onChange(option.mode)}
            style={{
              flex: 1,
              minHeight: 64,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              justifyContent: "center",
              backgroundColor: selected ? colors.surfaceRaised : "transparent",
              borderWidth: 1,
              borderColor: selected ? option.color + "66" : "transparent",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={option.icon} color={selected ? option.color : colors.textFaint} size={16} strokeWidth={2} />
              <Text
                style={{ color: selected ? option.color : colors.textMuted, fontSize: 13, fontWeight: "800", letterSpacing: 0.8, flexShrink: 1 }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {option.label}
              </Text>
            </View>
            <Text style={{ color: selected ? colors.textMuted : colors.textFaint, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {option.caption}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
