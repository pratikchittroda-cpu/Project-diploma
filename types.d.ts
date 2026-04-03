/// <reference types="react" />
/// <reference types="react-native" />

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
    [key: string]: any;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module 'react-native-dotenv' {
  interface Env {
    API_KEY: string;
    AUTH_DOMAIN: string;
    PROJECT_ID: string;
    STORAGE_BUCKET: string;
    MESSAGING_SENDER_ID: string;
    APP_ID: string;
    [key: string]: string | undefined;
  }
  const env: Env;
  export = env;
}