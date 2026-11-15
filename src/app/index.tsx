import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "../state/AppState";
import { colors } from "../ui/theme";

export default function Gate() {
  const { ready, onboarded } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }
  return <Redirect href={onboarded ? "/(tabs)" : "/onboarding"} />;
}
