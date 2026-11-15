import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { getPreviewView, Sensors, type SensorKind } from "../../../modules/night-signal-sensors";
import { SESSION_LIMITS, useSensorSession } from "../../sensors/useSensorSession";
import { REASON_TEXT } from "../../signal/types";
import { BackButton, Badge, BigButton, Body, Caption, Card, IconTile, Note, Screen, SectionHeader } from "../../ui/components";
import type { IconName } from "../../ui/Icon";
import { SignalTrace } from "../../ui/SignalTrace";
import { StatusPill } from "../../ui/StatusPill";
import { colors, radius, space, type } from "../../ui/theme";

type Config = {
  kind: SensorKind;
  title: string;
  icon: IconName;
  unit: string;
  valueLabel: string;
  instructions: string[];
  limitation: string;
};

const CONFIGS: Record<string, Config> = {
  fingertip: {
    kind: "ppg",
    title: "Fingertip pulse",
    icon: "fingertip",
    unit: "BPM",
    valueLabel: "Experimental pulse estimate",
    instructions: [
      "Rest a fingertip lightly over the rear camera AND the flash.",
      "Don't press hard. Keep your hand and phone still on a table.",
      "The flash runs at reduced brightness and stops after 30 seconds.",
    ],
    limitation:
      "Experimental pulse estimate only. It does not diagnose anything and cannot rule out a heart attack or any emergency. No oxygen or blood-pressure estimates.",
  },
  face: {
    kind: "face",
    title: "Face pulse (rPPG)",
    icon: "face",
    unit: "BPM",
    valueLabel: "Experimental face-colour pulse estimate",
    instructions: [
      "Prop the phone up and face the front camera, about an arm's length away.",
      "Use steady, even light on your face. It will not work in the dark.",
      "Keep still for at least 20 seconds. The session stops after 30 seconds.",
    ],
    limitation:
      "Uses tiny colour changes in forehead/cheek areas, processed on this phone; frames are never uploaded. Lighting changes, movement or no face are not medical events.",
  },
  sound: {
    kind: "audio",
    title: "Sound level",
    icon: "sound",
    unit: "dBFS",
    valueLabel: "Relative microphone input level",
    instructions: [
      "Place the phone on the nightstand near the bed.",
      "Shows the live microphone level and envelope. Nothing is recorded, stored or uploaded.",
      "The session stops after 30 seconds.",
    ],
    limitation:
      "Microphone level only. There is no breathing-sound recording or classifier, and it can't listen overnight or in the background. Loud sounds do not indicate distress and quiet does not indicate safety.",
  },
  depth: {
    kind: "depth",
    title: "Breathing movement",
    icon: "depth",
    unit: "/min",
    valueLabel: "Movement cadence estimate",
    instructions: [
      "Prop the phone 40–100 cm away with the front (TrueDepth) camera facing the chest.",
      "Choose the chest band below. Stay still for at least 20 seconds. The session stops after 30 seconds.",
    ],
    limitation:
      "TrueDepth's infrared distance map follows chest/bedding surface movement. It is not airflow or pulse. Depth cannot see through blankets and cannot prove someone is breathing normally. Infrared depth in the dark does not make face pulse work in the dark.",
  },
};

const ROI_BANDS = [
  { label: "Upper", y: 0.3 },
  { label: "Middle", y: 0.45 },
  { label: "Lower", y: 0.6 },
];

const NativePreview = getPreviewView();

function Preview({ kind, roiY }: { kind: SensorKind; roiY: number }) {
  return (
    <View style={{ height: 240, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: colors.hairline }} testID="camera-preview">
      {NativePreview ? <NativePreview style={{ flex: 1 }} cornerRadius={0} /> : null}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
        {kind === "face" ? <View style={{ width: 150, height: 196, borderRadius: 100, borderWidth: 1.5, borderColor: colors.mint, borderStyle: "dashed" }} /> : null}
        {kind === "ppg" ? <View style={{ width: 116, height: 116, borderRadius: 58, borderWidth: 1.5, borderColor: colors.mint }} /> : null}
      </View>
      {kind === "depth" ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: "30%", width: "40%", top: `${roiY * 100}%`, height: "25%", borderWidth: 1.5, borderColor: colors.mint, borderRadius: 12 }}
        />
      ) : null}
    </View>
  );
}

export default function SensorScreen() {
  const { kind: route } = useLocalSearchParams<{ kind: string }>();
  const config = CONFIGS[route ?? ""] ?? CONFIGS.fingertip;
  const { state, start, stop } = useSensorSession(config.kind);
  const [roiY, setRoiY] = useState(0.45);
  const active = ["acquiring", "usable", "poor_signal", "running", "checking"].includes(state.status);
  const value = !active ? null : config.kind === "audio" ? state.level : state.estimate?.status === "usable" ? state.estimate.value : null;
  const showValue = value !== null && Number.isFinite(value);
  const reasons = Array.from(new Set(state.estimate?.reasons.map((r) => REASON_TEXT[r] ?? r) ?? []));
  const limit = SESSION_LIMITS[config.kind];
  const progress = Math.max(0, Math.min(1, state.elapsed / limit));

  return (
    <Screen testID={`sensor-screen-${route}`} edges={["top", "bottom"]}>
      <BackButton label="Monitor" testID="sensor-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <IconTile name={config.icon} size={56} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
            {config.title}
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Badge label="LIVE SENSOR" tone="mint" />
            <Badge label="EXPERIMENTAL" tone="muted" />
          </View>
        </View>
      </View>

      <StatusPill status={state.status} />
      {state.detail ? <Body muted testID="sensor-detail">{state.detail}</Body> : null}
      {state.status === "permission_denied" ? (
        <BigButton label="Open Settings" variant="secondary" icon="sliders" testID="sensor-open-settings" onPress={() => void Linking.openSettings()} />
      ) : null}

      {config.kind !== "audio" && active ? <Preview kind={config.kind} roiY={roiY} /> : null}

      {config.kind === "depth" ? (
        <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} accessibilityRole="radiogroup">
          {ROI_BANDS.map((band) => (
            <Pressable
              key={band.label}
              testID={`roi-${band.label.toLowerCase()}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: roiY === band.y }}
              accessibilityLabel={`${band.label} chest area`}
              onPress={() => {
                setRoiY(band.y);
                Sensors.setChestRoi(0.3, band.y, 0.4, 0.25);
              }}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: roiY === band.y ? colors.surfaceRaised : "transparent",
              }}
            >
              <Text style={{ color: roiY === band.y ? colors.mint : colors.textMuted, fontSize: 15, fontWeight: "700" }}>{band.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Card testID="estimate-card" raised>
        <Caption style={{ color: colors.textMuted }}>{config.valueLabel.toUpperCase()}</Caption>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
          <Text
            testID="estimate-value"
            maxFontSizeMultiplier={1.3}
            style={showValue ? { color: colors.text, flexShrink: 1 } : [type.heading, { color: colors.textMuted, paddingVertical: space.sm }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={showValue ? `${Math.round(value!)} ${config.unit}` : active ? "No number yet" : "No reading"}
          >
            {showValue ? (
              <>
                <Text style={[type.readout, { color: colors.text }]}>{Math.round(value!)}</Text>
                <Text style={[type.heading, { color: colors.textMuted, fontWeight: "500" }]}>{` ${config.unit}`}</Text>
              </>
            ) : active ? (
              "No number yet"
            ) : (
              "—"
            )}
          </Text>
        </View>
        {config.kind !== "audio" && active && !showValue ? (
          <View testID="estimate-reasons" style={{ gap: space.sm }}>
            <Caption>A number appears only after enough stable, good-quality samples.</Caption>
            {reasons.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {reasons.map((reason) => (
                  <Badge key={reason} label={reason} tone="muted" dot={false} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {active ? <SignalTrace values={state.trace} label={`${config.title} live trace`} testID="live-trace" /> : null}
        {active ? (
          <View style={{ gap: 6 }} accessible accessibilityLabel={`${Math.floor(state.elapsed)} of ${limit} seconds used`}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceSunken, overflow: "hidden" }}>
              <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: colors.mintDim }} />
            </View>
            <Caption>{`${Math.floor(state.elapsed)} s of ${limit} s session cap`}</Caption>
          </View>
        ) : null}
      </Card>

      {active ? (
        <BigButton label="Stop" variant="danger" icon="stop" testID="sensor-stop" onPress={stop} />
      ) : (
        <BigButton label={state.status === "idle" ? "Start" : "Start again"} icon="play" testID="sensor-start" onPress={() => void start()} />
      )}

      <SectionHeader title="Positioning" />
      <Card>
        {config.instructions.map((line, i) => (
          <View key={line} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mintSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.mint, fontSize: 13, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <Body muted style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
              {line}
            </Body>
          </View>
        ))}
      </Card>
      <Note testID="sensor-limitation">{config.limitation}</Note>
    </Screen>
  );
}
