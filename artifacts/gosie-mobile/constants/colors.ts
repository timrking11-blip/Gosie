/**
 * Mobile semantic tokens. Shared light palette values and the base radius
 * mirror design-system/gosie-week-ahead/tokens.css; run the mobile-token-sync
 * check when either file changes. Mobile-only colors and dark-mode roles stay
 * local to this app.
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
    secondary: '#e5eadf',
    secondaryForeground: '#17382b',
    muted: '#f2eee4',
    mutedForeground: '#59635e',
    accent: '#ebaf86',
    accentForeground: '#0a1016',
    destructive: '#946640',
    destructiveForeground: '#f5f0e5',
    border: '#d8d7c9',
    input: '#d8d7c9',
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

  // Shared base radius from --gosie-radius-base.
  radius: 16,
};

export default colors;
