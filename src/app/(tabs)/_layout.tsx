import { Tabs } from "expo-router";
import { View } from "react-native";
import { Icon, type IconName } from "../../ui/Icon";
import { colors } from "../../ui/theme";

function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 52, height: 30, borderRadius: 15, backgroundColor: focused ? colors.mintSoft : "transparent" }}>
      <Icon name={name} color={color} size={22} strokeWidth={focused ? 2 : 1.7} />
    </View>
  );
}

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Monitor", icon: "pulse" },
  { name: "checkin", title: "Check-in", icon: "bell" },
  { name: "history", title: "History", icon: "history" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.backgroundDeep, borderTopColor: colors.hairline, height: 90, paddingTop: 8 },
        tabBarActiveTintColor: colors.mint,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 4 },
        tabBarItemStyle: { minHeight: 52 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarButtonTestID: `tab-${tab.name === "index" ? "monitor" : tab.name}`,
            tabBarAccessibilityLabel: `${tab.title} tab`,
            tabBarIcon: ({ color, focused }) => <TabIcon name={tab.icon} color={String(color)} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
