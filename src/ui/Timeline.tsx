import { Text, View } from "react-native";
import type { EventView } from "../data/types";
import { EVENT_TEXT } from "./format";
import { colors, space, type } from "./theme";

export function Timeline({ events, limit, testIDPrefix = "event" }: { events: EventView[]; limit?: number; testIDPrefix?: string }) {
  const shown = limit ? events.slice(0, limit) : events;
  return (
    <View>
      {shown.map((event, i) => {
        const tone =
          event.kind === "alert_expired" ? colors.coral : event.kind === "alert_triggered" ? colors.amber : event.kind === "session_ended" ? colors.textFaint : colors.mint;
        return (
          <View
            key={event.id}
            style={{ flexDirection: "row", gap: space.md }}
            testID={`${testIDPrefix}-${event.kind}`}
            accessible
            accessibilityLabel={`${EVENT_TEXT[event.kind]}: ${new Date(event.at).toLocaleTimeString()}`}
          >
            <View style={{ alignItems: "center", width: 14 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone, marginTop: 6 }} />
              {i < shown.length - 1 ? <View style={{ flex: 1, width: 1, backgroundColor: colors.hairline, marginTop: 4 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: space.lg, flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <Text style={[type.callout, { color: colors.text, flex: 1 }]}>{EVENT_TEXT[event.kind]}</Text>
              <Text style={[type.caption, { color: colors.textFaint, fontVariant: ["tabular-nums"], marginTop: 2 }]}>
                {new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
