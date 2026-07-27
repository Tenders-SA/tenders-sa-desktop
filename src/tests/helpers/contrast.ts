/**
 * WCAG 2.x relative-luminance / contrast-ratio maths.
 * Formulae: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
}

export function relativeLuminance(hsl: Hsl): number {
  const linear = hslToRgb(hsl).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parses `--token: H S% L%;` declarations out of the real tokens.css.
 * Reading the shipped file (rather than restating values in the test)
 * is the point: a token edited in CSS without re-checking contrast
 * must fail the test.
 */
export function parseTokens(css: string): Record<string, Hsl> {
  const tokens: Record<string, Hsl> = {};
  const declaration =
    /--([\w-]+)\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*(?:\/[^;]*)?;/g;

  for (const match of css.matchAll(declaration)) {
    tokens[match[1]] = {
      h: Number(match[2]),
      s: Number(match[3]),
      l: Number(match[4]),
    };
  }
  return tokens;
}
