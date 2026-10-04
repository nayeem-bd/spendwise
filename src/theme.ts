import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme as NavTheme } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const brand = { primary: '#2E7D32', income: '#2E7D32', expense: '#C62828' };

// Tonal palette generated from the brand green with Material Color Utilities
// (SchemeTonalSpot). Laid out like iOS grouped screens: a tinted background
// with cards one step lighter (`elevation.level1`) and tiles inside cards one
// step further (`level2`).
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#BCF0B4',
    onPrimaryContainer: '#245024',
    secondary: '#52634F',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#D6E8CE',
    onSecondaryContainer: '#3B4B38',
    tertiary: '#38656A',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#BCEBF0',
    onTertiaryContainer: '#1F4D52',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#93000A',
    background: '#F1F5EB',
    onBackground: '#191D17',
    surface: '#FFFFFF',
    onSurface: '#191D17',
    surfaceVariant: '#DEE5D8',
    onSurfaceVariant: '#424940',
    outline: '#72796F',
    outlineVariant: '#C2C9BD',
    inverseSurface: '#2D322C',
    inverseOnSurface: '#EFF2E9',
    inversePrimary: '#A1D39A',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#ECEFE6',
      level3: '#E6E9E0',
      level4: '#E3E7DE',
      level5: '#E0E4DB',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#81C784',
    onPrimary: '#0A390F',
    primaryContainer: '#245024',
    onPrimaryContainer: '#BCF0B4',
    secondary: '#BACCB3',
    onSecondary: '#253423',
    secondaryContainer: '#3B4B38',
    onSecondaryContainer: '#D6E8CE',
    tertiary: '#A0CFD4',
    onTertiary: '#00363B',
    tertiaryContainer: '#1F4D52',
    onTertiaryContainer: '#BCEBF0',
    error: '#FFB4AB',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    background: '#0B0F0A',
    onBackground: '#E0E4DB',
    surface: '#1D211B',
    onSurface: '#E0E4DB',
    surfaceVariant: '#424940',
    onSurfaceVariant: '#C2C9BD',
    outline: '#8C9388',
    outlineVariant: '#424940',
    inverseSurface: '#E0E4DB',
    inverseOnSurface: '#2D322C',
    inversePrimary: '#3C6939',
    elevation: {
      level0: 'transparent',
      level1: '#1D211B',
      level2: '#272B25',
      level3: '#2D312B',
      level4: '#323630',
      level5: '#363A34',
    },
  },
};

export const moneyColors = (dark: boolean) => ({
  income: dark ? '#81C784' : brand.income,
  expense: dark ? '#EF9A9A' : brand.expense,
});

/**
 * Navigation (headers, tab bar) colours derived from the Paper theme. Headers
 * and the tab bar share the screen background so they blend in like native
 * iOS bars; screens turn off the header shadow.
 */
export function navTheme(paper: MD3Theme, dark: boolean): NavTheme {
  const base = dark ? NavDark : NavLight;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.background,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
    },
  };
}
