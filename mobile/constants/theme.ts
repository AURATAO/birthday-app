export const Colors = {
  // backgrounds
  background: '#0A0A0F',
  surface: '#13131F',
  surfaceHigh: '#1C1C2E',

  // brand
  primary: '#7C3AED',
  primaryLight: 'rgba(124, 58, 237, 0.15)',
  primaryRing: 'rgba(124, 58, 237, 0.08)',

  // text
  textPrimary: '#E8E8F0',
  textSecondary: '#6B6B80',
  textMuted: '#3D3D50',

  // channels
  whatsapp: '#25D366',
  imessage: '#1C7AEF',
  email: '#4A4A5A',

  // status
  success: '#1D9E75',
  warning: '#BA7517',
  danger: '#E24B4A',
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

export const Typography = {
  h1: { fontSize: 28, fontWeight: '600' as const, color: Colors.textPrimary },
  h2: { fontSize: 22, fontWeight: '500' as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '500' as const, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary },
  small: { fontSize: 11, fontWeight: '400' as const, color: Colors.textMuted },
}
