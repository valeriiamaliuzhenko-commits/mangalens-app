// src/theme/index.js

export const Colors = {
  // Background layers
  bg: '#0F0F14',
  bgCard: '#1A1A24',
  bgElevated: '#22222F',
  bgInput: '#2A2A38',

  // Accent — violet/indigo manga vibe
  accent: '#7C6AF7',
  accentLight: '#9D8FFF',
  accentDark: '#5A4FCC',
  accentGlow: 'rgba(124, 106, 247, 0.25)',

  // Text
  textPrimary: '#F0EEFF',
  textSecondary: '#9994B8',
  textMuted: '#5C5878',
  textInverse: '#0F0F14',

  // State colours
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  // Borders
  border: '#2E2E40',
  borderFocus: '#7C6AF7',

  // Overlay
  overlay: 'rgba(15, 15, 20, 0.85)',
};

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,

  // Weights (React Native uses string weights)
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  accent: {
    shadowColor: '#7C6AF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
};
