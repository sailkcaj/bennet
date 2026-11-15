import { Text, View } from "react-native";
import type { SessionStatus } from "../sensors/useSensorSession";
import { colors, radius, space } from "./theme";

const STATUS: Record<SessionStatus, { label: string; color: string; hollow?: boolean }> = {
  idle: { label: "Not running", color: colors.textFaint, hollow: true },
  checking: { label: "Checking sensor…", color: colors.textMuted, hollow: true },
  permission_denied: { label: "Permission denied", color: colors.coral },
  unavailable: { label: "Unavailable", color: colors.coral },
  acquiring: { label: "Acquiring signal…", color: colors.mint, hollow: true },
  usable: { label: "Usable estimate", color: colors.mint },
  poor_signal: { label: "Poor signal", color: colors.textMuted, hollow: true },
  running: { label: "Capturing", color: colors.mint },
  interrupted: { label: "Interrupted — paused", color: colors.coral },
  session_limit: { label: "Session limit reached", color: colors.textMuted, hollow: true },
  stopped: { label: "Stopped", color: colors.textMuted, hollow: true },
};

export function StatusPill({ status }: { status: SessionStatus }) {
  const { label, color, hollow } = STATUS[status];
  return (
    <View
      testID="sensor-status"
      accessible
      accessibilityLabel={`Status: ${label}`}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        borderRadius: radius.pill,
        backgroundColor: color + "18",
        paddingHorizontal: space.md,
        paddingVertical: 7,
        alignSelf: "flex-start",
      }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: color, backgroundColor: hollow ? "transparent" : color }} />
      <Text style={{ color, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
