/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#0a1016',
    tint: '#17382b',
    background: '#f5f0e5',
    foreground: '#0a1016',
    card: '#faf6ef',
    cardForeground: '#0a1016',
    primary: '#17382b',
    primaryForeground: '#f5f0e5',
    secondary: '#e3e7d8',
    secondaryForeground: '#17382b',
    muted: '#e9e4da',
    mutedForeground: '#59635e',
    accent: '#ebaf86',
    accentForeground: '#0a1016',
    destructive: '#946640',
    destructiveForeground: '#f5f0e5',
    border: '#d4d2c3',
    input: '#d4d2c3',
    forest: '#17382b',
    sage: '#99b6a5',
    cream: '#f5f0e5',
    peach: '#ebaf86',
    ink: '#0a1016',
    midnight: '#0f141d',
    slate: '#1b222b',
    mist: '#a6c3d4',
    gold: '#d5ac7c',
    espresso: '#2b1b12',
    bronze: '#946640',
  },
  dark: {
    text: '#f5f0e5',
    tint: '#99b6a5',
    background: '#0f141d',
    foreground: '#f5f0e5',
    card: '#1b222b',
    cardForeground: '#f5f0e5',
    primary: '#99b6a5',
    primaryForeground: '#0f141d',
    secondary: '#2b1b12',
    secondaryForeground: '#f5f0e5',
    muted: '#1b222b',
    mutedForeground: '#a6c3d4',
    accent: '#ebaf86',
    accentForeground: '#0a1016',
    destructive: '#946640',
    destructiveForeground: '#f5f0e5',
    border: '#1b222b',
    input: '#1b222b',
    forest: '#17382b',
    sage: '#99b6a5',
    cream: '#f5f0e5',
    peach: '#ebaf86',
    ink: '#0a1016',
    midnight: '#0f141d',
    slate: '#1b222b',
    mist: '#a6c3d4',
    gold: '#d5ac7c',
    espresso: '#2b1b12',
    bronze: '#946640',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
