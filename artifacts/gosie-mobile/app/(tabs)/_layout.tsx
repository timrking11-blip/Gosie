import React from 'react';
import { StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: { fontFamily: 'Manrope_700Bold', fontSize: 10, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: 72,
          paddingTop: 8,
          paddingBottom: 9,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Week Ahead',
          tabBarIcon: ({ focused }) => <Feather name="calendar" size={20} color={focused ? colors.primary : colors.mutedForeground} />,
        }}
      />
      <Tabs.Screen
        name="weekend"
        options={{
          title: 'Weekend Ahead',
          tabBarIcon: ({ focused }) => <Feather name="sun" size={20} color={focused ? colors.primary : colors.mutedForeground} />,
        }}
      />
    </Tabs>
  );
}
