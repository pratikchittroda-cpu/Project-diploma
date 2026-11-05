import React, { createContext, forwardRef, useContext } from 'react';
// This directory is excluded from the Metro alias in metro.config.js, so this is the real react-native.
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet } from 'react-native';
import { brandFontFamily, brandFontsReady, DEFAULT_FONT_SIZE, X_ACCENT, X_ACCENT_ON_DARK } from '../fonts';

// App code imports Text/TextInput from 'react-native' as usual; Metro routes those imports here
// (see metro.config.js and ./react-native.js) so every screen gets the brand fonts and blue x without per-file changes.

const FontContext = createContext(null);
const ACCENT = { color: X_ACCENT };
const ACCENT_ON_DARK = { color: X_ACCENT_ON_DARK };
const HAS_X = /[xX]/;

// True for light text colours (white text on dark or coloured pages).
export function isLightColor(color) {
  if (typeof color !== 'string') return false;
  const value = color.trim().toLowerCase();
  if (value === 'white') return true;
  let rgb = value.match(/^#([\da-f]{3}|[\da-f]{6})(?:[\da-f]{2})?$/)?.[1];
  if (rgb) {
    if (rgb.length === 3) rgb = rgb.split('').map(ch => ch + ch).join('');
    rgb = [0, 2, 4].map(i => parseInt(rgb.slice(i, i + 2), 16));
  } else {
    rgb = value.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').slice(0, 3).map(Number);
  }
  if (!rgb || rgb.some(Number.isNaN)) return false;
  const [r, g, b] = rgb.map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// Wrap each letter x in a nested span in the accent blue that reads on this text's colour;
// everything else is untouched.
export function accentX(children, accent = ACCENT) {
  if (typeof children === 'string') {
    if (!HAS_X.test(children)) return children;
    return children.split(/([xX])/).filter(Boolean)
      .map((part, i) => (HAS_X.test(part) ? <NativeText key={`x${i}`} style={accent}>{part}</NativeText> : part));
  }
  if (Array.isArray(children)) return children.map(child => accentX(child, accent));
  return children;
}

// Plain text of a Text's children (strings, numbers and nested Text), to spot numbers.
function textOf(children) {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textOf).join('');
  return children?.props ? textOf(children.props.children) : '';
}
const HAS_DIGIT = /\d/;

// Nested Text inherits its parent's face unless it changes size or weight itself.
function resolveFont(style, parent, numeric = false) {
  const flat = StyleSheet.flatten(style) || {};
  const font = {
    fontSize: flat.fontSize ?? parent?.fontSize ?? DEFAULT_FONT_SIZE,
    fontWeight: flat.fontWeight ?? parent?.fontWeight,
    custom: !!flat.fontFamily || (!!parent?.custom && flat.fontFamily == null),
    numeric,
    color: flat.color ?? parent?.color,
  };
  const changesFont = flat.fontSize != null || flat.fontWeight != null;
  const family = !font.custom && brandFontsReady() && (!parent || changesFont) ? brandFontFamily(font) : null;
  return { font, style: family ? [style, { fontFamily: family, fontWeight: 'normal' }] : style };
}

export const Text = forwardRef(function Text({ style, children, ...props }, ref) {
  const resolved = resolveFont(style, useContext(FontContext), HAS_DIGIT.test(textOf(children)));
  return <FontContext.Provider value={resolved.font}>
    <NativeText ref={ref} {...props} style={resolved.style}>{accentX(children, isLightColor(resolved.font.color) ? ACCENT_ON_DARK : ACCENT)}</NativeText>
  </FontContext.Provider>;
});

export const TextInput = forwardRef(function TextInput({ style, ...props }, ref) {
  // Inputs showing numbers (amounts, dates) keep the number face, like Text.
  const numeric = HAS_DIGIT.test(`${props.value ?? props.defaultValue ?? ''}${props.placeholder ?? ''}`)
    || /numeric|decimal|number|phone/.test(props.keyboardType || '');
  return <NativeTextInput ref={ref} {...props} style={resolveFont(style, null, numeric).style} />;
});
