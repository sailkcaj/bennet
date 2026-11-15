import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SessionCredential } from "../../data/types";
import { useApp } from "../../state/AppState";
import { useSessionSnapshot } from "../../state/useSessionSnapshot";
import { Badge, BigButton, Body, Caption, Card, Divider, IconTile, Note, Screen, Title, type Tone } from "../../ui/components";
import { ALERT_STATE_TEXT } from "../../ui/format";
import { Icon } from "../../ui/Icon";
import { Timeline } from "../../ui/Timeline";
import { colors, space, type } from "../../ui/theme";

const STATE_TONE: Record<string, Tone> = { countdown: "amber", cancelled: "mint", expired_unacknowledged: "coral", acknowledged: "muted" };

function SessionHistory({ cred, index }: { cred: SessionCredential; index: number }) {
  const { snapshot, error } = useSessionSnapshot(cred);
  const [expanded, setExpanded] = useState(index === 0);
  const started = snapshot ? new Date(snapshot.session.startedAt) : null;
  return (
    <Card testID={`history-session-${index}`}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${snapshot?.session.label ?? "Session"}, synthetic demo, ${cred.storage === "cloud" ? "cloud" : "this device only"}, ${snapshot?.alerts.length ?? 0} test alerts`}
        testID={`history-toggle-${index}`}
        style={{ gap: space.md }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          <View style={{ alignItems: "center", minWidth: 52, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.surfaceSunken }}>
            <Text style={[type.caption, { color: colors.textFaint }]}>{started ? started.toLocaleDateString([], { month: "short" }).toUpperCase() : "—"}</Text>
            <Text style={[type.heading, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{started ? started.getDate() : ""}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.heading, { color: colors.text, fontSize: 18 }]}>{snapshot?.session.label ?? "Loading…"}</Text>
            {snapshot ? (
              <Caption style={{ color: colors.textMuted }}>
                {snapshot.session.status === "active" ? "Active" : "Ended"} · {snapshot.alerts.length} test alert{snapshot.alerts.length === 1 ? "" : "s"}
              </Caption>
            ) : null}
          </View>
          <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }], marginTop: 4 }}>
            <Icon name="chevronDown" color={colors.textMuted} size={20} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <Badge label="SYNTHETIC DEMO" tone="amber" />
          <Badge label={cred.storage === "cloud" ? "CLOUD (CONVEX)" : "THIS DEVICE ONLY"} tone={cred.storage === "cloud" ? "mint" : "muted"} />
        </View>
      </Pressable>
      {error ? <Body muted>{error}</Body> : null}
      {expanded && snapshot ? (
        <View testID={`history-detail-${index}`} style={{ gap: space.md }}>
          {snapshot.alerts.length ? <Divider /> : null}
          {snapshot.alerts.map((alert) => (
            <View
              key={alert.id}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}
              accessible
              accessibilityLabel={`${alert.source === "simulated_distress" ? "Simulated distress" : "Test alert"}, ${alert.countdownSeconds} seconds: ${ALERT_STATE_TEXT[alert.state]}`}
            >
              <Text style={[type.callout, { color: colors.text, flex: 1 }]}>
                {alert.source === "simulated_distress" ? "Simulated distress" : "Test alert"} · {alert.countdownSeconds}s
              </Text>
              <Badge label={ALERT_STATE_TEXT[alert.state].toUpperCase()} tone={STATE_TONE[alert.state] ?? "muted"} dot={false} />
            </View>
          ))}
          <Divider />
          <Timeline events={snapshot.events} testIDPrefix="history-event" />
        </View>
      ) : null}
    </Card>
  );
}

export default function History() {
  const { credentials } = useApp();
  return (
    <Screen testID="history-screen">
      <Title subtitle="Demonstration sessions only. No sensor data is stored.">History</Title>
      {credentials.length === 0 ? (
        <Card testID="history-empty" style={{ alignItems: "center", paddingVertical: space.xxxl }}>
          <IconTile name="history" tone="muted" size={56} />
          <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>No sessions yet</Text>
          <Body muted style={{ textAlign: "center", fontSize: 15 }}>
            Start a demonstration session from Check-in to see its test alerts and timeline here.
          </Body>
          <BigButton label="Go to Check-in" variant="ghost" compact testID="history-go-checkin" onPress={() => router.push("/(tabs)/checkin")} />
        </Card>
      ) : (
        credentials.map((cred, index) => <SessionHistory key={cred.id} cred={cred} index={index} />)
      )}
      <Note icon="lock">History persists across relaunch. Each session is readable only with its own access token, kept in the iOS Keychain on this device.</Note>
    </Screen>
  );
}
