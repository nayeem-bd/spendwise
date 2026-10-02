import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme as NavTheme } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const brand = { primary: '#2E7D32', income: '#2E7D32', expense: '#C62828' };

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: brand.primary },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, primary: '#81C784' },
};

export const moneyColors = (dark: boolean) => ({
  income: dark ? '#81C784' : brand.income,
  expense: dark ? '#EF9A9A' : brand.expense,
});

/** Navigation (headers, tab bar) colours derived from the Paper theme. */
export function navTheme(paper: MD3Theme, dark: boolean): NavTheme {
  const base = dark ? NavDark : NavLight;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.surface,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
    },
  };
}
