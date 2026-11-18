import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const designSystemDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(designSystemDir, '../..');

const [css, mobileColors] = await Promise.all([
  readFile(path.join(designSystemDir, 'tokens.css'), 'utf8'),
  readFile(
    path.join(workspaceRoot, 'artifacts/gosie-mobile/constants/colors.ts'),
    'utf8',
  ),
]);

const cssTokens = new Map(
  [...css.matchAll(/--(gosie-[\w-]+):\s*(#[\da-f]{3,8}|[\d.]+(?:px|rem));/gi)]
    .map(([, token, value]) => [`--${token}`, value.toLowerCase()]),
);
const lightBlock = mobileColors.match(
  /light:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*dark:/,
)?.[1];

assert.ok(lightBlock, 'Could not find the mobile light palette.');
const mobilePalette = new Map(
  [...lightBlock.matchAll(/^\s*([\w]+):\s*'(#[\da-f]{3,8})',?$/gim)]
    .map(([, token, value]) => [token, value.toLowerCase()]),
);

const sharedRoles = {
  '--gosie-forest': [
    'tint',
    'primary',
    'secondaryForeground',
    'forest',
  ],
  '--gosie-sage': ['sage'],
  '--gosie-cream': [
    'background',
    'primaryForeground',
    'destructiveForeground',
    'cream',
  ],
  '--gosie-peach': ['accent', 'peach'],
  '--gosie-ink': [
    'text',
    'foreground',
    'cardForeground',
    'accentForeground',
    'ink',
  ],
  '--gosie-midnight': ['midnight'],
  '--gosie-espresso': ['espresso'],
  '--gosie-gold': ['gold'],
  '--gosie-bronze': ['destructive', 'bronze'],
  '--gosie-surface': ['card'],
  '--gosie-line': ['border', 'input'],
  '--gosie-text-muted': ['mutedForeground'],
  '--gosie-surface-sage': ['secondary'],
  '--gosie-surface-control': ['muted'],
};

for (const [cssToken, mobileRoles] of Object.entries(sharedRoles)) {
  const expected = cssTokens.get(cssToken);
  assert.ok(expected, `Missing ${cssToken} in tokens.css.`);

  for (const mobileRole of mobileRoles) {
    assert.equal(
      mobilePalette.get(mobileRole),
      expected,
      `Mobile light palette ${mobileRole} must match ${cssToken}.`,
    );
  }
}

const cssRadius = cssTokens.get('--gosie-radius-base');
const mobileRadius = mobileColors.match(/^\s*radius:\s*(\d+),?$/m)?.[1];
assert.ok(cssRadius, 'Missing --gosie-radius-base in tokens.css.');
const radiusMatch = cssRadius.match(/^([\d.]+)(px|rem)$/);
assert.ok(
  radiusMatch,
  'The shared base radius must use px or rem units.',
);
const radiusInPixels = Number(radiusMatch[1]) * (radiusMatch[2] === 'rem' ? 16 : 1);
assert.equal(
  Number(mobileRadius),
  radiusInPixels,
  'The mobile base radius must match --gosie-radius-base.',
);

console.log('Mobile shared colors and base radius match tokens.css.');
