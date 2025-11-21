declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
}

declare module 'react-native' {
  export * from 'react-native';
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  export default class Icon extends Component<any> {}
}

declare module 'expo-linear-gradient' {
  export const LinearGradient: any;
}

declare module '@react-navigation/bottom-tabs' {
  export function createBottomTabNavigator(): any;
}

declare module '@react-navigation/native' {
  export * from '@react-navigation/native';
}