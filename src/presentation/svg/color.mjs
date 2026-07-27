function parseHexColor(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(String(value ?? "").trim());
  if (!match) throw new Error(`Expected an RGB hex color, received: ${value}`);
  const digits = match[1].length === 3
    ? Array.from(match[1], (character) => `${character}${character}`).join("")
    : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
}

function byteToHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Pre-composes a foreground color over an opaque background in sRGB space.
 *
 * Inkscape otherwise emits a transparency Form XObject for every semi-transparent
 * card badge and metric. A plan can contain hundreds of these identical groups,
 * which makes a vector-only PDF more than ten times larger than the equivalent
 * pre-composed artwork. Course-card backgrounds are fully opaque, so replacing
 * the transparency with its exact displayed solid color preserves the visual
 * contract while keeping the exported PDF compact.
 */
export function compositeHexColor(background, foreground, alpha) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError(`Alpha must be between 0 and 1, received: ${alpha}`);
  }
  const bottom = parseHexColor(background);
  const top = parseHexColor(foreground);
  return `#${bottom.map((channel, index) => byteToHex(channel * (1 - alpha) + top[index] * alpha)).join("")}`;
}
