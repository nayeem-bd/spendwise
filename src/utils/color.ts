const luminance = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

/**
 * Icon colour for a coloured badge: white, unless white is below the WCAG 3:1
 * non-text contrast on that background (yellow, cyan, light grey), then dark.
 */
export function iconColorOn(background: string): string {
  const hex = background.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#FFFFFF';
  return 1.05 / (luminance(hex) + 0.05) >= 3 ? '#FFFFFF' : '#212121';
}
