import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { colors, radius, space, type } from "./theme";

export function Screen({ children, testID, edges }: { children: ReactNode; testID?: string; edges?: ("top" | "bottom")[] }) {
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} testID={testID} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children, color = colors.mint, icon }: { children: ReactNode; color?: string; icon?: IconName }) {
  return (
    <View style={styles.eyebrowRow}>
      {icon ? <Icon name={icon} color={color} size={16} strokeWidth={2} /> : null}
      <Text style={[type.eyebrow, { color }]}>{children}</Text>
    </View>
  );
}

export function Title({ children, subtitle, size = "title" }: { children: ReactNode; subtitle?: string; size?: "hero" | "title" }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type[size], { color: colors.text }]} accessibilityRole="header">
        {children}
      </Text>
      {subtitle ? <Text style={[type.callout, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.eyebrow, { color: colors.textFaint }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {action}
    </View>
  );
}

export type Tone = "mint" | "amber" | "coral" | "muted";

const TONE_COLOR: Record<Tone, string> = { mint: colors.mint, amber: colors.amber, coral: colors.coral, muted: colors.textMuted };
const TONE_SOFT: Record<Tone, string> = { mint: colors.mintSoft, amber: colors.amberSoft, coral: colors.coralSoft, muted: "#A3B8AE14" };

export function Card({
  children,
  style,
  testID,
  tone,
  raised,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: Tone;
  raised?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        raised && { backgroundColor: colors.surfaceRaised },
        tone && tone !== "muted" && { borderColor: TONE_COLOR[tone] + "55", backgroundColor: colors.surface },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function Body({ children, muted, style, testID }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; testID?: string }) {
  return (
    <Text style={[type.body, { color: muted ? colors.textMuted : colors.text }, style]} testID={testID}>
      {children}
    </Text>
  );
}

export function Caption({ children, style, testID }: { children: ReactNode; style?: StyleProp<TextStyle>; testID?: string }) {
  return (
    <Text style={[type.caption, { color: colors.textFaint }, style]} testID={testID}>
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "demo";

const BUTTON: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.mint, fg: colors.onAccent },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.hairlineStrong },
  ghost: { bg: "transparent", fg: colors.mint, border: colors.hairlineStrong },
  danger: { bg: colors.coral, fg: colors.onAccent },
  demo: { bg: colors.amber, fg: colors.onAccent },
};

export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
  testID,
  hint,
  icon,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  hint?: string;
  icon?: IconName;
  compact?: boolean;
}) {
  const style = BUTTON[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: style.bg, opacity: disabled ? 0.4 : pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style.border ? { borderWidth: 1, borderColor: style.border } : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={style.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} color={style.fg} size={20} strokeWidth={2} /> : null}
          <Text style={[styles.buttonText, compact && { fontSize: 16 }, { color: style.fg }]} maxFontSizeMultiplier={1.6}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone, testID, dot = true, singleLine }: { label: string; tone: Tone; testID?: string; dot?: boolean; singleLine?: boolean }) {
  const color = TONE_COLOR[tone];
  return (
    <View style={[styles.chip, { backgroundColor: TONE_SOFT[tone], borderColor: color + "44" }]} testID={testID} accessible accessibilityLabel={label}>
      {dot ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text
        style={[styles.chipText, { color }]}
        maxFontSizeMultiplier={1.4}
        numberOfLines={singleLine ? 1 : undefined}
        adjustsFontSizeToFit={singleLine}
        minimumFontScale={singleLine ? 0.75 : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

export function IconTile({ name, tone = "mint", size = 44 }: { name: IconName; tone?: Tone; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: TONE_SOFT[tone] }]}>
      <Icon name={name} color={TONE_COLOR[tone]} size={size * 0.52} />
    </View>
  );
}

export function Note({ children, testID, icon = "info" }: { children: ReactNode; testID?: string; icon?: IconName }) {
  return (
    <View style={styles.note} testID={testID} accessible>
      <Icon name={icon} color={colors.textFaint} size={18} />
      <Text style={[type.caption, { color: colors.textMuted, flex: 1, fontWeight: "400" }]}>{children}</Text>
    </View>
  );
}

export function Row({
  label,
  value,
  tone,
  testID,
  last,
}: {
  label: string;
  value: string;
  tone?: Tone;
  testID?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]} testID={testID} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.callout, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      <Text style={[type.callout, { color: tone ? TONE_COLOR[tone] : colors.textMuted, fontWeight: "600", textAlign: "right", flexShrink: 1 }]}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }} />;
}

export function BackButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={10}
      style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name="back" color={colors.text} size={20} strokeWidth={2} />
      <Text style={[type.callout, { color: colors.text, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxxl * 2, gap: space.lg },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.xl,
    gap: space.md,
  },
  button: {
    alignSelf: "stretch",
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  buttonCompact: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: space.lg },
  buttonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, maxWidth: "100%", flexShrink: 1 },
  buttonText: { fontSize: 17, fontWeight: "700", textAlign: "center", letterSpacing: 0.1, flexShrink: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.9, flexShrink: 1 },
  iconTile: { alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", paddingHorizontal: space.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, gap: space.md, minHeight: 44 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 44, paddingRight: space.md },
});
