import { router } from "expo-router";
import { Text, View } from "react-native";
import { useApp } from "../state/AppState";
import { BigButton, Body, Card, Eyebrow, IconTile, Screen, Title } from "../ui/components";
import type { IconName } from "../ui/Icon";
import { Orbit } from "../ui/Orbit";
import { colors, space, type } from "../ui/theme";

const POINTS: { title: string; body: string; icon: IconName; tone: "mint" | "coral" | "amber" }[] = [
  {
    title: "Experimental, on-device signals",
    body: "Camera, microphone and depth experiments run only while Bennet is open on screen. Readings are rough estimates.",
    icon: "pulse",
    tone: "mint",
  },
  {
    title: "Not a medical device",
    body: "Bennet cannot detect a heart attack or cardiac arrest, and a normal-looking pulse or breathing pattern never rules one out.",
    icon: "info",
    tone: "coral",
  },
  {
    title: "Test alerts are demonstrations",
    body: "The check-in flow uses synthetic data and contacts no one. In an emergency, call your local emergency number.",
    icon: "bell",
    tone: "amber",
  },
];

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  return (
    <Screen testID="onboarding-screen" edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: space.xl }}>
        <Eyebrow icon="moon">BENNET</Eyebrow>
        <Orbit size={96} />
      </View>
      <Title size="hero" subtitle="A prototype for exploring signals your phone can sense — honestly labelled.">
        Before you start
      </Title>
      {POINTS.map((point, i) => (
        <Card key={point.title} testID={`onboarding-point-${i}`} style={{ flexDirection: "row", gap: space.lg, alignItems: "flex-start" }}>
          <IconTile name={point.icon} tone={point.tone} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.heading, { color: colors.text }]}>{point.title}</Text>
            <Body muted style={{ fontSize: 15, lineHeight: 21 }}>
              {point.body}
            </Body>
          </View>
        </Card>
      ))}
      <View style={{ marginTop: space.sm }}>
        <BigButton
          label="I understand — continue"
          testID="onboarding-continue"
          onPress={async () => {
            await completeOnboarding();
            router.replace("/(tabs)");
          }}
        />
      </View>
    </Screen>
  );
}
