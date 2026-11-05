import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Syne_400Regular } from '@expo-google-fonts/syne/400Regular';
import { Syne_500Medium } from '@expo-google-fonts/syne/500Medium';
import { Syne_600SemiBold } from '@expo-google-fonts/syne/600SemiBold';
import { Syne_700Bold } from '@expo-google-fonts/syne/700Bold';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne/800ExtraBold';

// Brand typography from the Expenzo splash design: Manrope for UI text, Syne for display text.
export const APP_FONTS = {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold,
};

// Text at or above this size (titles, hero figures) uses the display face.
export const DISPLAY_FONT_SIZE = 24;
export const DEFAULT_FONT_SIZE = 14;
// Accent for every letter x: the logo blue in dark text, and a light brand blue in light text
// (white text on dark or coloured pages), where logo blue would disappear into the page.
export const X_ACCENT = '#3157FF';
export const X_ACCENT_ON_DARK = '#AFC2FF';

const FACES = {
  Manrope: { 400: 'Manrope_400Regular', 500: 'Manrope_500Medium', 600: 'Manrope_600SemiBold', 700: 'Manrope_700Bold', 800: 'Manrope_800ExtraBold' },
  Syne: { 400: 'Syne_400Regular', 500: 'Syne_500Medium', 600: 'Syne_600SemiBold', 700: 'Syne_700Bold', 800: 'Syne_800ExtraBold' },
};

export function normalizeWeight(weight) {
  if (weight === 'bold') return 700;
  const value = Number(weight);
  if (!Number.isFinite(value)) return 400;
  return Math.min(800, Math.max(400, Math.round(value / 100) * 100));
}

// Custom fonts ignore fontWeight, so each weight maps to its own font file. Large text uses the
// display face, except anything with numbers (amounts, percentages, dates), which stays Manrope.
export function brandFontFamily({ fontSize = DEFAULT_FONT_SIZE, fontWeight, numeric = false } = {}) {
  const faces = fontSize >= DISPLAY_FONT_SIZE && !numeric ? FACES.Syne : FACES.Manrope;
  return faces[normalizeWeight(fontWeight)];
}

const FONT_WAIT_MS = 2500;
let brandFontsLoaded = false;
// Text only switches to the brand faces once they are registered; until then (or if loading
// fails) it keeps the system font instead of naming a family the platform does not know.
export const brandFontsReady = () => brandFontsLoaded;

// True once the brand fonts are registered, or after a short wait / load error so the app
// never stalls on fonts (text then falls back to the system face).
export function useAppFonts() {
  const [loaded, error] = useFonts(APP_FONTS);
  if (loaded) brandFontsLoaded = true;
  const [waitOver, setWaitOver] = useState(false);
  useEffect(() => {
    if (loaded || error) return undefined;
    const timer = setTimeout(() => setWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [loaded, error]);
  return loaded || !!error || waitOver;
}
