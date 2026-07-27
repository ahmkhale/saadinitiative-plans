import { COLORS, PAGE_LAYOUT } from "../layout/page-layout.mjs";

export function createRenderContext(prefix) {
  let sequence = 0;
  return Object.freeze({
    nextId(kind) {
      sequence += 1;
      return `${prefix}-${kind}-${sequence}`;
    },
  });
}

export function esc(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function displayNumber(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function clipped(value, max) {
  const characters = Array.from(String(value ?? ""));
  return characters.length <= max
    ? characters.join("")
    : `${characters.slice(0, Math.max(1, max - 1)).join("")}…`;
}

export function text({
  x,
  y,
  value,
  size,
  weight = 400,
  anchor = "middle",
  fill = COLORS.black,
  direction = "rtl",
  opacity,
  transform,
  dominantBaseline = "middle",
  letterSpacing = 0,
  dataPart,
}) {
  const attributes = [
    `x="${x}"`,
    `y="${y}"`,
    `text-anchor="${anchor}"`,
    `fill="${fill}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `font-family="IBM Plex Sans Arabic, Noto Sans Arabic, Noto Sans, sans-serif"`,
    `direction="${direction}"`,
    `unicode-bidi="plaintext"`,
    `dominant-baseline="${dominantBaseline}"`,
    `letter-spacing="${letterSpacing}"`,
    `font-kerning="normal"`,
  ];
  if (dataPart) attributes.push(`data-part="${dataPart}"`);
  if (opacity !== undefined) attributes.push(`opacity="${opacity}"`);
  if (transform) attributes.push(`transform="${transform}"`);
  return `<text ${attributes.join(" ")}>${esc(value)}</text>`;
}

export function textLines({
  x,
  y,
  lines,
  lineHeight,
  size,
  weight = 400,
  anchor = "middle",
  fill = COLORS.black,
  direction = "rtl",
}) {
  return lines.map((value, index) => text({
    x,
    y: y + index * lineHeight,
    value,
    size,
    weight,
    anchor,
    fill,
    direction,
  })).join("");
}

export function roundedRectPath(x, y, width, height, radii) {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii;
  return [
    `M${x + topLeft} ${y}`,
    `H${x + width - topRight}`,
    topRight ? `A${topRight} ${topRight} 0 0 1 ${x + width} ${y + topRight}` : "",
    `V${y + height - bottomRight}`,
    bottomRight ? `A${bottomRight} ${bottomRight} 0 0 1 ${x + width - bottomRight} ${y + height}` : "",
    `H${x + bottomLeft}`,
    bottomLeft ? `A${bottomLeft} ${bottomLeft} 0 0 1 ${x} ${y + height - bottomLeft}` : "",
    `V${y + topLeft}`,
    topLeft ? `A${topLeft} ${topLeft} 0 0 1 ${x + topLeft} ${y}` : "",
    "Z",
  ].filter(Boolean).join(" ");
}

export function line(x1, y1, x2, y2, stroke = COLORS.line, width = 0.8) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;
}

export function pageSvg(parts, layout) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.width}pt" height="${layout.height}pt" viewBox="0 0 ${layout.width} ${layout.height}" data-page-width="${layout.width}" data-page-height="${layout.height}">`,
    ...parts,
    "</svg>",
  ].join("\n");
}

export function pageInner(svg) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/u);
  if (!match) throw new Error("Could not combine generated SVG pages.");
  return match[1];
}

