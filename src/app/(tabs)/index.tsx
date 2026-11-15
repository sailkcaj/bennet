import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Sensors, type Availability } from "../../../modules/night-signal-sensors";
import { unavailableReason } from "../../sensors/useSensorSession";
import { useApp } from "../../state/AppState";
import { Badge, BigButton, Body, Card, Caption, Eyebrow, IconTile, Note, Row, Screen, SectionHeader, Title } from "../../ui/components";
import { PLACEMENTS, type Placement as DemoPlacement } from "../../demo/bedside";
import { EXPERIMENTS, type Experiment, type Placement } from "../../ui/experiments";
import { Icon, type IconName } from "../../ui/Icon";
import { ModeSwitch } from "../../ui/ModeSwitch";
import { Orbit } from "../../ui/Orbit";
import { colors, radius, space, type } from "../../ui/theme";

function permissionText(state: Availability["cameraPermission"]) {
  return state === "granted" ? "Allowed" : state === "denied" ? "Denied" : "Not asked yet";
}

const LIVE_GROUPS: { placement: Placement; title: string; caption: string }[] = [
  {
    placement: "nightstand",
    title: "On the nightstand",
    caption: "Sound level shows how loud the room is right now. It's the live microphone level only: nothing is recorded or uploaded, and it doesn't recognise breathing.",
  },
  {
    placement: "propped",
    title: "Propped up, facing you",
    caption:
      "Run one at a time. Face pulse reads skin colour with the front camera and needs steady light. Breathing movement uses the TrueDepth infrared distance map to follow chest motion. It isn't airflow or pulse, and it can't see through blankets.",
  },
  { placement: "hand", title: "In your hand", caption: "Fingertip over the rear camera and flash." },
];

const DEMO_ICON: Record<DemoPlacement, IconName> = { nightstand: "moon", propped: "face" };

function ExperimentTile({ experiment, availability, width }: { experiment: Experiment; availability: Availability; width: number }) {
  const missing = unavailableReason(experiment.kind, availability);
  return (
    <View testID={`experiment-${experiment.route}`} style={{ width }}>
      <Pressable
        testID={`open-${experiment.route}`}
        accessibilityRole="button"
        accessibilityLabel={`${experiment.title}. ${missing ? "Unavailable: " + missing : "Experimental. " + experiment.short}. Opens details.`}
        onPress={() => router.push(`/sensor/${experiment.route}`)}
        style={({ pressed }) => ({
          minHeight: 168,
          borderRadius: radius.lg,
          padding: space.lg,
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
          justifyContent: "space-between",
          gap: space.md,
        })}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <IconTile name={experiment.icon} tone={missing ? "muted" : "mint"} />
          <Icon name="chevronRight" color={colors.textFaint} size={18} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[type.heading, { color: colors.text, fontSize: 17, lineHeight: 22 }]}>{experiment.title}</Text>
          <Caption style={{ color: colors.textMuted }}>{experiment.short}</Caption>
          <Badge label={missing ? "UNAVAILABLE" : "EXPERIMENTAL"} tone={missing ? "coral" : "mint"} singleLine />
        </View>
      </Pressable>
    </View>
  );
}

function DevicePermissions({ availability }: { availability: Availability }) {
  const denied = availability.cameraPermission === "denied" || availability.microphonePermission === "denied";
  const [open, setOpen] = useState(false);
  const expanded = open || denied;
  const sensorCount = [availability.backCamera && availability.torch, availability.frontCamera, availability.trueDepth, availability.microphone].filter(Boolean).length;
  const rows: { label: string; value: string; ok: boolean; testID: string; warn?: boolean }[] = [
    { label: "Rear camera + flash", value: availability.backCamera && availability.torch ? "Available" : "Unavailable", ok: availability.backCamera && availability.torch, testID: "avail-rear" },
    { label: "Front camera", value: availability.frontCamera ? "Available" : "Unavailable", ok: availability.frontCamera, testID: "avail-front" },
    { label: "TrueDepth depth", value: availability.trueDepth ? "Available" : "Unsupported", ok: availability.trueDepth, testID: "avail-truedepth" },
    { label: "Microphone", value: availability.microphone ? "Available" : "Unavailable", ok: availability.microphone, testID: "avail-mic" },
  ];
  return (
    <Card testID="availability-card" style={{ paddingVertical: space.md }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        testID="device-permissions-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Device and permissions, ${sensorCount} of 4 sensor inputs available`}
        style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 }}
      >
        <IconTile name="sliders" tone={denied ? "coral" : "muted"} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: colors.text, fontSize: 17 }]}>Device & permissions</Text>
          <Caption>{denied ? "A permission was denied — tap to fix" : `${sensorCount} of 4 sensor inputs available`}</Caption>
        </View>
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" color={colors.textMuted} size={20} />
        </View>
      </Pressable>
      {expanded ? (
        <View>
          {!availability.nativeModule ? <Body muted>Native sensor module missing from this build.</Body> : null}
          {availability.isSimulator ? (
            <View style={{ marginVertical: space.sm }}>
              <Badge label="IOS SIMULATOR — NO CAMERA HARDWARE" tone="muted" testID="simulator-badge" />
            </View>
          ) : null}
          {rows.map((row) => (
            <Row key={row.testID} label={row.label} value={row.value} tone={row.ok ? "mint" : "coral"} testID={row.testID} />
          ))}
          <Row label="Camera permission" value={permissionText(availability.cameraPermission)} tone={availability.cameraPermission === "denied" ? "coral" : undefined} testID="perm-camera" />
          <Row
            label="Microphone permission"
            value={permissionText(availability.microphonePermission)}
            tone={availability.microphonePermission === "denied" ? "coral" : undefined}
            testID="perm-mic"
            last
          />
          {denied ? (
            <View style={{ marginTop: space.md }}>
              <BigButton label="Open Settings to allow access" variant="secondary" icon="sliders" testID="open-settings" onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function Monitor() {
  const { mode, setMode } = useApp();
  const { width } = useWindowDimensions();
  const [availability, setAvailability] = useState<Availability>(() => Sensors.getAvailability());
  const tileWidth = width < 360 ? width - 40 : (width - 40 - 12) / 2;

  useFocusEffect(
    useCallback(() => {
      if (mode === "live") setAvailability(Sensors.getAvailability());
    }, [mode]),
  );

  return (
    <Screen testID="monitor-screen">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow icon="moon">BENNET</Eyebrow>
        <Pressable
          onPress={() => router.push("/guide")}
          testID="open-guide"
          accessibilityRole="button"
          accessibilityLabel="How it works"
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, opacity: pressed ? 0.75 : 1 })}
        >
          <Icon name="book" color={colors.mint} size={16} strokeWidth={2} />
          <Text style={[type.caption, { color: colors.text }]}>How it works</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Title size="hero" subtitle="Experimental, on-device. Not a medical device.">
            Explore your signals.
          </Title>
        </View>
        {width >= 360 ? <Orbit size={104} /> : null}
      </View>

      <ModeSwitch mode={mode} onChange={setMode} />

      {mode === "live" ? (
        <>
          {LIVE_GROUPS.map((group) => (
            <View key={group.placement} style={{ gap: space.md }} testID={`live-group-${group.placement}`}>
              <SectionHeader title={group.title} />
              <Caption style={{ color: colors.textMuted, marginTop: -space.xs }}>{group.caption}</Caption>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {EXPERIMENTS.filter((experiment) => experiment.placement === group.placement).map((experiment) => (
                  <ExperimentTile key={experiment.kind} experiment={experiment} availability={availability} width={tileWidth} />
                ))}
              </View>
            </View>
          ))}

          <DevicePermissions availability={availability} />
          <Note icon="lock">{"Each experiment runs for up to 30 seconds while Bennet is open on screen, and leaving the app stops it. Overnight or background listening isn't part of this prototype."}</Note>
        </>
      ) : (
        <>
          <Card tone="amber" testID="demo-banner">
            <Badge label="SIMULATED DATA" tone="amber" />
            <Text style={[type.heading, { color: colors.text }]}>Bedside demo</Text>
            <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
              A 30-second walkthrough of Bennet on a nightstand. Every trace and number is generated by the app. No camera, microphone or depth sensor is used.
            </Body>
            {(Object.keys(PLACEMENTS) as DemoPlacement[]).map((key) => (
              <Pressable
                key={key}
                testID={`demo-placement-${key}`}
                accessibilityRole="button"
                accessibilityLabel={`${PLACEMENTS[key].title} bedside demo. ${PLACEMENTS[key].short} Opens setup.`}
                onPress={() => router.push({ pathname: "/bedside", params: { placement: key } })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  minHeight: 72,
                  padding: space.md,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.surfaceRaised : colors.surfaceSunken,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                })}
              >
                <IconTile name={DEMO_ICON[key]} tone="amber" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.heading, { color: colors.text, fontSize: 17, lineHeight: 22 }]}>{PLACEMENTS[key].title}</Text>
                  <Caption style={{ color: colors.textMuted }}>{PLACEMENTS[key].short}</Caption>
                </View>
                <Icon name="chevronRight" color={colors.textFaint} size={18} />
              </Pressable>
            ))}
          </Card>
          <BigButton label="Go to test alert check-in" variant="demo" icon="bell" testID="go-checkin" onPress={() => router.push("/(tabs)/checkin")} />
          <Note>Test alerts contact no one. Any future contact pathway is not configured.</Note>
        </>
      )}
    </Screen>
  );
}
