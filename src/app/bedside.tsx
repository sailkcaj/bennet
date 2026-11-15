import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { BREATHING_READY_SECONDS, breathingWave, DEMO_SECONDS, demoReadings, demoSummary, PLACEMENTS, PULSE_READY_SECONDS, pulseWave, waveWindow, type Placement } from "../demo/bedside";
import { useApp } from "../state/AppState";
import { BackButton, Badge, BigButton, Body, Caption, Card, IconTile, Note, Screen } from "../ui/components";
import { CountdownRing } from "../ui/CountdownRing";
import type { IconName } from "../ui/Icon";
import { SignalTrace } from "../ui/SignalTrace";
import { colors, radius, space, type } from "../ui/theme";
import { useReducedMotion } from "../ui/useReducedMotion";

type Run = { phase: "ready" } | { phase: "running" } | { phase: "complete" } | { phase: "stopped"; note: string };

const PLACEMENT_ICON: Record<Placement, IconName> = { nightstand: "moon", propped: "face" };

function SimulatedMetric({ label, value, unit, waiting, testID }: { label: string; value: number | null; unit: string; waiting: string; testID: string }) {
  return (
    <View style={{ gap: 4 }} testID={testID} accessible accessibilityLabel={value === null ? `${label}: ${waiting}` : `${label}: ${value} ${unit}, simulated`}>
      <Caption style={{ color: colors.textMuted }}>{label.toUpperCase()}</Caption>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        {value === null ? (
          <Text style={[type.heading, { color: colors.textMuted }]}>{waiting}</Text>
        ) : (
          <Text maxFontSizeMultiplier={1.3}>
            <Text style={[type.readout, { color: colors.text, fontSize: 52, lineHeight: 58 }]}>{value}</Text>
            <Text style={[type.heading, { color: colors.textMuted, fontWeight: "500" }]}>{` ${unit}`}</Text>
          </Text>
        )}
        <Badge label="SIMULATED" tone="amber" dot={false} />
      </View>
    </View>
  );
}

export default function BedsideDemo() {
  const params = useLocalSearchParams<{ placement?: string }>();
  const { setMode } = useApp();
  const reduced = useReducedMotion();
  const [placement, setPlacement] = useState<Placement>(params.placement === "propped" ? "propped" : "nightstand");
  const [run, setRun] = useState<Run>({ phase: "ready" });
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const config = PLACEMENTS[placement];

  const interrupt = useCallback((note: string) => {
    setRun((current) => (current.phase === "running" ? { phase: "stopped", note } : current));
  }, []);

  useEffect(() => {
    if (run.phase !== "running") return;
    const tick = () => {
      const t = (Date.now() - startedAt.current) / 1000;
      if (t >= DEMO_SECONDS) {
        setElapsed(DEMO_SECONDS);
        setRun({ phase: "complete" });
        return;
      }
      setElapsed(t);
    };
    const timer = setInterval(tick, reduced ? 1000 : 80);
    return () => clearInterval(timer);
  }, [run.phase, reduced]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") interrupt("The demo stopped because Bennet left the screen.");
    });
    return () => subscription.remove();
  }, [interrupt]);

  useFocusEffect(useCallback(() => () => interrupt("The demo stopped because you left this screen."), [interrupt]));

  const begin = () => {
    startedAt.current = Date.now();
    setElapsed(0);
    setRun({ phase: "running" });
  };

  const running = run.phase === "running";
  const readings = demoReadings(placement, elapsed);
  const summary = demoSummary(placement);
  const shownTime = run.phase === "complete" ? DEMO_SECONDS : elapsed;

  return (
    <Screen testID="bedside-screen" edges={["top", "bottom"]}>
      <BackButton label="Monitor" testID="bedside-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <IconTile name={PLACEMENT_ICON[placement]} tone="amber" size={56} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
            Bedside demo
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Badge label="SIMULATED DATA" tone="amber" testID="bedside-simulated-badge" />
            <Badge label="NO SENSORS USED" tone="muted" />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} accessibilityRole="radiogroup">
        {(Object.keys(PLACEMENTS) as Placement[]).map((key) => {
          const selected = key === placement;
          return (
            <Pressable
              key={key}
              testID={`placement-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: running }}
              accessibilityLabel={`${PLACEMENTS[key].title} placement`}
              disabled={running}
              onPress={() => {
                setPlacement(key);
                setRun({ phase: "ready" });
                setElapsed(0);
              }}
              style={{ flex: 1, minHeight: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.surfaceRaised : "transparent", opacity: running && !selected ? 0.4 : 1 }}
            >
              <Text style={{ color: selected ? colors.amber : colors.textMuted, fontSize: 15, fontWeight: "700" }}>{PLACEMENTS[key].title}</Text>
            </Pressable>
          );
        })}
      </View>

      {run.phase === "ready" ? (
        <Card tone="amber" testID="bedside-setup">
          <Text style={[type.heading, { color: colors.text }]}>{config.title}</Text>
          {config.setup.map((line, i) => (
            <View key={line} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.amber, fontSize: 13, fontWeight: "700" }}>{i + 1}</Text>
              </View>
              <Body muted style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
                {line}
              </Body>
            </View>
          ))}
        </Card>
      ) : null}

      {running ? (
        <>
          <CountdownRing remainingMs={(DEMO_SECONDS - elapsed) * 1000} totalMs={DEMO_SECONDS * 1000} size={168} />
          <Card raised testID="bedside-live">
            <SimulatedMetric label="Simulated breathing cadence" value={readings.breathing} unit="/min" waiting="Settling…" testID="demo-breathing" />
            <SignalTrace values={waveWindow(breathingWave, elapsed, 12, 10)} color={colors.amber} height={96} label="Simulated breathing trace, not a measurement" testID="demo-breathing-trace" />
            {config.showsPulse ? (
              <>
                <SimulatedMetric label="Simulated face pulse" value={readings.pulse} unit="BPM" waiting="Settling…" testID="demo-pulse" />
                <SignalTrace values={waveWindow(pulseWave, elapsed, 4, 25)} color={colors.amber} height={96} label="Simulated face-pulse trace, not a measurement" testID="demo-pulse-trace" />
              </>
            ) : null}
            <Caption>
              {readings.breathing === null || (config.showsPulse && readings.pulse === null)
                ? `Like the real experiments, simulated numbers appear after a short settling time (${config.showsPulse ? `${BREATHING_READY_SECONDS} s and ${PULSE_READY_SECONDS} s` : `${BREATHING_READY_SECONDS} s`}).`
                : "Generated by the demo, not measured from anyone."}
            </Caption>
          </Card>
          <BigButton label="Stop demo" variant="danger" icon="stop" testID="bedside-stop" onPress={() => setRun({ phase: "stopped", note: "You stopped the demo." })} />
        </>
      ) : null}

      {run.phase === "complete" ? (
        <Card tone="amber" testID="bedside-summary">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <Text style={[type.heading, { color: colors.text }]}>Demo complete</Text>
            <Badge label="SIMULATED SUMMARY" tone="amber" />
          </View>
          <Caption>{`${config.title} · ${shownTime} seconds · generated data`}</Caption>
          <SummaryRow label="Simulated breathing cadence" unit="/min" range={summary.breathing} testID="summary-breathing" />
          {summary.pulse ? <SummaryRow label="Simulated face pulse" unit="BPM" range={summary.pulse} testID="summary-pulse" /> : null}
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
            {"These numbers were generated by the demo, not measured. Bennet doesn't judge readings as safe or unsafe, and a demo can't tell you anything about your health."}
          </Body>
        </Card>
      ) : null}

      {run.phase === "stopped" ? (
        <Card testID="bedside-stopped">
          <Text style={[type.heading, { color: colors.text }]}>Demo stopped</Text>
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>{`${run.note} Nothing was measured or saved.`}</Body>
        </Card>
      ) : null}

      {!running ? (
        <BigButton
          label={run.phase === "ready" ? "Start 30-second demo" : "Replay demo"}
          variant="demo"
          icon="play"
          testID={run.phase === "ready" ? "bedside-start" : "bedside-replay"}
          onPress={begin}
        />
      ) : null}
      {run.phase === "complete" || run.phase === "stopped" ? (
        <BigButton
          label="Try the test-alert check-in"
          variant="secondary"
          icon="bell"
          testID="bedside-go-checkin"
          onPress={() => {
            setMode("demo");
            router.push("/(tabs)/checkin");
          }}
        />
      ) : null}

      <Note icon="lock">
        {"The bedside demo is generated on this phone. It never asks for or turns on the camera, microphone or depth sensor, and Bennet can't monitor overnight or in the background."}
      </Note>
    </Screen>
  );
}

function SummaryRow({ label, unit, range, testID }: { label: string; unit: string; range: { average: number; low: number; high: number }; testID: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: average ${range.average} ${unit}, range ${range.low} to ${range.high}, simulated`}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.hairline }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.callout, { color: colors.text }]}>{label}</Text>
        <Caption>{`Range ${range.low}–${range.high} ${unit}`}</Caption>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[type.heading, { color: colors.text }]}>{`${range.average} ${unit}`}</Text>
        <Badge label="SIMULATED" tone="amber" dot={false} />
      </View>
    </View>
  );
}
