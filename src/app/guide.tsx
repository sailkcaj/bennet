import { router } from "expo-router";
import { Text, View } from "react-native";
import { BackButton, Body, Card, IconTile, Note, Screen, SectionHeader, Title } from "../ui/components";
import type { IconName } from "../ui/Icon";
import { colors, space, type } from "../ui/theme";

const SENSORS: { icon: IconName; title: string; does: string; cannot: string }[] = [
  {
    icon: "fingertip",
    title: "Fingertip pulse",
    does: "Your fingertip covers the rear camera while the flash shines through it. Tiny brightness changes with each heartbeat become a trace, and a pulse estimate appears only once the rhythm is steady and clean.",
    cannot: "It can't diagnose anything, measure oxygen or blood pressure, or rule out an emergency.",
  },
  {
    icon: "face",
    title: "Face pulse",
    does: "Phone propped up facing you. The front colour camera finds your face and averages forehead and cheek colour over time. A colour-projection method pulls out a faint periodic signal.",
    cannot: "It needs steady light and a still face, and it does not work in the dark. Frames never leave the phone.",
  },
  {
    icon: "sound",
    title: "Sound level",
    does: "Phone on the nightstand. Shows how loud the room is right now, as a live microphone level and envelope.",
    cannot: "Nothing is recorded or uploaded. It does not recognise breathing sounds, and loud does not mean distress.",
  },
  {
    icon: "depth",
    title: "Breathing movement",
    does: "Phone propped up facing you, on iPhones with a TrueDepth camera. Its infrared distance map tracks tiny changes in a chest area you choose and looks for a regular rise and fall over about 20 seconds.",
    cannot: "This is chest surface movement, not airflow or pulse. It can't see through blankets or prove someone is breathing normally. It runs separately from Face pulse, never at the same time.",
  },
];

const BEDSIDE_STEPS = [
  "Switch to Demonstration mode and pick a placement: Nightstand (simulated breathing) or Propped up (simulated breathing and face pulse).",
  "Start the 30-second demo. A countdown runs while animated traces and numbers play, each one labelled SIMULATED.",
  "At the end you get a simulated summary, then you can replay it or move on to the test-alert check-in.",
  "The demo never asks for or turns on any sensor. It stops if you leave the screen or the app.",
];

const DEMO_STEPS = [
  "In Check-in, start a demonstration session. Everything in it is synthetic.",
  "Trigger a test alert. A countdown starts.",
  "Tap \u201CI'm okay\u201D to cancel it, or let it expire so it becomes an unacknowledged test event.",
  "Acknowledge the event. Every step is saved to History.",
];

export default function Guide() {
  return (
    <Screen testID="guide-screen" edges={["top", "bottom"]}>
      <BackButton label="Monitor" testID="guide-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
      <Title subtitle="Four 30-second on-device experiments, a simulated bedside demo and a test-alert check-in.">How it works</Title>

      <SectionHeader title="The experiments" />
      {SENSORS.map((sensor) => (
        <Card key={sensor.title}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <IconTile name={sensor.icon} />
            <Text style={[type.heading, { color: colors.text, flex: 1 }]}>{sensor.title}</Text>
          </View>
          <Body style={{ fontSize: 15, lineHeight: 21 }}>{sensor.does}</Body>
          <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
            {sensor.cannot}
          </Body>
        </Card>
      ))}
      <Note icon="lock">
        {"Experiments only run while Bennet is open on screen, and each session stops itself after 30 seconds. Bennet can't listen or measure overnight or in the background yet. That is the long-term goal, not what this prototype does."}
      </Note>

      <SectionHeader title="The bedside demo" />
      <Card tone="amber" testID="guide-bedside">
        {BEDSIDE_STEPS.map((step, i) => (
          <View key={step} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.amber, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <Body style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{step}</Body>
          </View>
        ))}
      </Card>

      <SectionHeader title="The test-alert demo" />
      <Card tone="amber">
        {DEMO_STEPS.map((step, i) => (
          <View key={step} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.amber, fontWeight: "700" }}>{i + 1}</Text>
            </View>
            <Body style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{step}</Body>
          </View>
        ))}
      </Card>
      <Note>{"Test alerts contact no one. A normal pulse reading never cancels an alert and never means there's no emergency."}</Note>
    </Screen>
  );
}
