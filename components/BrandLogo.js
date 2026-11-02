import React from 'react';
import { Image } from 'react-native';

export default function BrandLogo({ size = 48 }) {
  return <Image source={require('../assets/logo.png')} style={{ width: size, height: size }} resizeMode="contain"
    accessible accessibilityRole="image" accessibilityLabel="Expenzo logo" accessibilityIgnoresInvertColors />;
}
