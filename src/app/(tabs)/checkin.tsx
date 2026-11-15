import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AlertSource } from "../../../convex/lib/demoMachine";
import { useApp } from "../../state/AppState";
import { useSessionSnapshot } from "../../state/useSessionSnapshot";
import { Badge, BigButton, Body, Caption, Card, IconTile, Note, Row, Screen, SectionHeader, Title } from "../../ui/components";
import { CountdownRing } from "../../ui/CountdownRing";
import { ALERT_STATE_TEXT, formatTime } from "../../ui/format";
import { Timeline } from "../../ui/Timeline";
import { Icon } from "../../ui/Icon";
import { colors, radius, space, type } from "../../ui/theme";

const COUNTDOWNS = [10, 30, 60];

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function CloudStatusCard() {
  const { cloud, recheckCloud } = useApp();
  const connected = cloud.state === "connected";
  return (
    <Card testID="cloud-status-card" style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <IconTile name="cloud" tone={connected ? "mint" : "muted"} size={38} />
        <View style={{ flex: 1 }}>
          {connected ? (
            <Row label="Cloud sync" value="Connected (Convex dev)" tone="mint" testID="cloud-status" last />
          ) : cloud.state === "checking" ? (
            <Row label="Cloud sync" value="Checking…" testID="cloud-status" last />
          ) : (
            <Row label="Cloud sync" value="Unavailable" tone="coral" testID="cloud-status" last />
          )}
        </View>
      </View>
      {cloud.state === "unavailable" ? (
        <>
          <Caption style={{ color: colors.textMuted }} testID="cloud-status-detail">
            Cloud sync is not connected yet. Demo history is saved on this iPhone.
          </Caption>
          <BigButton label="Check again" variant="ghost" compact testID="cloud-recheck" onPress={recheckCloud} />
        </>
      ) : null}
    </Card>
  );
}

export default function CheckIn() {
  const { mode, setMode, credentials, startDemoSession } = useApp();
  const current = credentials[0] ?? null;
  const { snapshot, error, repository } = useSessionSnapshot(current);
  const [countdown, setCountdown] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const openAlert = snapshot?.alerts.find((a) => a.open) ?? null;
  const now = useNow(openAlert?.state === "countdown");
  const sessionActive = snapshot?.session.status === "active";

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function trigger(source: AlertSource) {
    if (!current || !repository) return;
    void run(source, async () => {
      await repository.triggerAlert(current, countdown, source);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
  }

  if (mode !== "demo") {
    return (
      <Screen testID="checkin-screen">
        <Title subtitle="Demonstration only — synthetic data">Check-in</Title>
        <Card tone="amber" style={{ alignItems: "flex-start" }}>
          <IconTile name="bell" tone="amber" />
          <Text style={[type.heading, { color: colors.text }]}>Test alerts live in Demonstration mode</Text>
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
            That keeps them from ever being confused with live sensor readings. Nobody is contacted.
          </Body>
          <BigButton label="Switch to Demonstration mode" variant="demo" testID="switch-to-demo" onPress={() => setMode("demo")} />
        </Card>
        <CloudStatusCard />
      </Screen>
    );
  }

  return (
    <Screen testID="checkin-screen">
      <Title subtitle="Synthetic test alerts. Nobody is contacted.">Check-in</Title>
      <Badge label="DEMONSTRATION MODE" tone="amber" testID="demo-mode-badge" />

      {actionError ? (
        <Card tone="coral" testID="action-error" style={{ flexDirection: "row", gap: space.md }}>
          <Icon name="alert" color={colors.coral} />
          <Body style={{ flex: 1 }}>{actionError}</Body>
        </Card>
      ) : null}
      {error ? (
        <Card tone="coral" testID="session-error" style={{ flexDirection: "row", gap: space.md }}>
          <Icon name="alert" color={colors.coral} />
          <Body style={{ flex: 1 }}>{error}</Body>
        </Card>
      ) : null}

      {!snapshot || !sessionActive ? (
        <Card testID="no-session-card" style={{ alignItems: "flex-start" }}>
          <IconTile name="play" tone="amber" />
          <Text style={[type.heading, { color: colors.text }]}>Try the test-alert flow</Text>
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
            Start a demonstration session. Everything inside it is synthetic and stays labelled that way.
          </Body>
          <BigButton
            label="Start demonstration session"
            variant="demo"
            busy={busy === "start"}
            testID="start-demo-session"
            onPress={() => void run("start", () => startDemoSession(`Demo ${new Date().toLocaleTimeString()}`))}
          />
        </Card>
      ) : openAlert?.state === "countdown" ? (
        <Card tone="amber" testID="countdown-card" style={{ alignItems: "stretch", gap: space.lg }}>
          <Badge label={openAlert.source === "simulated_distress" ? "SIMULATED DISTRESS EVENT" : "TEST ALERT"} tone="amber" />
          <CountdownRing remainingMs={openAlert.deadlineAt - now} totalMs={openAlert.countdownSeconds * 1000} />
          <Body muted style={{ textAlign: "center", fontSize: 15 }}>
            If nobody responds, this becomes an unacknowledged test event.
          </Body>
          <BigButton label="I'm okay — cancel" icon="check" testID="im-okay" busy={busy === "okay"} onPress={() => void run("okay", () => repository!.imOkay(current!, openAlert.id))} />
          <Note>No one will be contacted. A contact pathway is not configured in this prototype.</Note>
          <Pressable
            testID="optional-fingertip-check"
            accessibilityRole="link"
            onPress={() => router.push("/sensor/fingertip")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={[type.callout, { color: colors.mint, textDecorationLine: "underline" }]}>
              Optional awake fingertip experiment (does not cancel this alert)
            </Text>
          </Pressable>
        </Card>
      ) : openAlert?.state === "expired_unacknowledged" ? (
        <Card tone="coral" testID="unacknowledged-card" style={{ alignItems: "flex-start" }}>
          <Badge label="UNACKNOWLEDGED TEST EVENT" tone="coral" />
          <Text style={[type.heading, { color: colors.text }]}>The countdown expired</Text>
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
            Nobody responded in time. This is a demonstration event; nobody was notified.
          </Body>
          <BigButton label="Acknowledge test event" variant="danger" testID="acknowledge" busy={busy === "ack"} onPress={() => void run("ack", () => repository!.acknowledge(current!, openAlert.id))} />
        </Card>
      ) : (
        <Card testID="session-card">
          <Row label="Session" value={snapshot.session.label} tone="amber" testID="session-label" />
          <Caption style={{ color: colors.textMuted }}>COUNTDOWN LENGTH</Caption>
          <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} accessibilityRole="radiogroup">
            {COUNTDOWNS.map((seconds) => {
              const selected = countdown === seconds;
              return (
                <Pressable
                  key={seconds}
                  testID={`countdown-${seconds}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${seconds} second countdown`}
                  onPress={() => setCountdown(seconds)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: radius.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? colors.surfaceRaised : "transparent",
                    borderWidth: 1,
                    borderColor: selected ? colors.amber + "66" : "transparent",
                  }}
                >
                  <Text style={{ color: selected ? colors.amber : colors.textMuted, fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{seconds}s</Text>
                </Pressable>
              );
            })}
          </View>
          <BigButton label="Trigger test alert" variant="demo" icon="bell" testID="trigger-test-alert" busy={busy === "manual_test"} onPress={() => trigger("manual_test")} />
          <BigButton
            label="Simulate distress event (synthetic)"
            variant="secondary"
            testID="simulate-distress"
            busy={busy === "simulated_distress"}
            onPress={() => trigger("simulated_distress")}
          />
          <BigButton label="End session" variant="ghost" compact testID="end-session" busy={busy === "end"} onPress={() => void run("end", () => repository!.endSession(current!))} />
        </Card>
      )}

      <CloudStatusCard />

      {snapshot ? (
        <>
          <SectionHeader title="Session timeline" />
          <Card testID="timeline">
            <Timeline events={snapshot.events} limit={12} />
            {snapshot.alerts[0] && !snapshot.alerts[0].open ? (
              <Caption testID="last-outcome">
                Last test alert: {ALERT_STATE_TEXT[snapshot.alerts[0].state]} · {formatTime(snapshot.alerts[0].triggeredAt)}
              </Caption>
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
