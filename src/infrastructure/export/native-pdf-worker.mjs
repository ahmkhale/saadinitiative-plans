import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import {
  installLogicalTextOrder,
  patchPdfKitFontBidi,
  pdfSemanticText,
} from "./pdf-bidi.mjs";
import { createPdfSemanticLayer } from "./pdf-semantic-layer.mjs";

const FONT_FILES = Object.freeze({
  Regular: "IBMPlexSansArabic-Regular.ttf",
  Medium: "IBMPlexSansArabic-Medium.ttf",
  SemiBold: "IBMPlexSansArabic-SemiBold.ttf",
  Bold: "IBMPlexSansArabic-Bold.ttf",
});

function pdfFontStyle(weight) {
  const numeric = Number(weight);
  if (numeric >= 700) return "Bold";
  if (numeric >= 600) return "SemiBold";
  if (numeric >= 500) return "Medium";
  return "Regular";
}

function prepareSvg(svg) {
  return String(svg)
    .replace(/(<svg\b[^>]*\bwidth="[^"]+)pt"/u, '$1"')
    .replace(/(<svg\b[^>]*\bheight="[^"]+)pt"/u, '$1"')
    // SVG-to-PDFKit implements clip paths as transparency Form XObjects.
    // Course names are already measured to fit their fixed card geometry, so
    // these defensive SVG clips are unnecessary in the native PDF.
    .replace(
      /<defs><clipPath\b[^>]*\bid="[^"]*course-name-clip-[^"]*"[^>]*><rect\b[^>]*\/><\/clipPath><\/defs>/gu,
      "",
    )
    .replace(/\sclip-path="url\(#(?:[^"]*course-name-clip-[^"]*)\)"/gu, "")
    .replace(/<text\b[^>]*>/gu, (tag) => {
      const weight = tag.match(/\bfont-weight="([^"]+)"/u)?.[1] ?? "400";
      const style = pdfFontStyle(weight);
      return tag
        .replace(/\bfont-family="[^"]*"/u, `font-family="SaadPdf-${style}"`)
        .replace(/\bfont-weight="[^"]*"/u, 'font-weight="400"');
    });
}

function registerFonts(document, fontDir, encodingQueue) {
  const fonts = [];
  for (const [style, file] of Object.entries(FONT_FILES)) {
    const name = `SaadPdf-${style}`;
    document.registerFont(name, path.join(fontDir, file));
    document.font(name);
    patchPdfKitFontBidi(document._font, (encoding) => encodingQueue.push(encoding));
    fonts.push(document._font);
  }
  return fonts;
}

export async function renderNativePdf({ pages, pageLayouts, fontDir, outputPath }) {
  const document = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Producer: "PDFKit",
      Creator: "Saad Plan Generator native PDF",
      Author: "Saad Initiative",
    },
  });
  const encodingQueue = [];
  const visualFonts = registerFonts(document, fontDir, encodingQueue);
  const semanticLayer = createPdfSemanticLayer(document, {
    encodeText: pdfSemanticText,
  });
  const output = fs.createWriteStream(outputPath, { flags: "wx" });
  document.pipe(output);

  for (let index = 0; index < pages.length; index += 1) {
    const layout = pageLayouts[index];
    document.addPage({ size: [layout.width, layout.height], margin: 0 });
    const restoreTextOrder = installLogicalTextOrder(document, encodingQueue, semanticLayer);
    try {
      SVGtoPDF(document, prepareSvg(pages[index]), 0, 0, {
        width: layout.width,
        height: layout.height,
        assumePt: true,
        precision: 4,
        fontCallback: (family) => String(family).split(",")[0].trim(),
        warningCallback: (message) => {
          throw new Error(`Native PDF could not render the generated SVG: ${message}`);
        },
      });
    } finally {
      restoreTextOrder();
      encodingQueue.length = 0;
    }
  }
  for (const font of visualFonts) {
    font.unicode = font.unicode.map(() => [0x2060]);
  }
  semanticLayer.finish();
  document.end();
  await new Promise((resolve, reject) => {
    output.on("finish", resolve);
    output.on("error", reject);
    document.on("error", reject);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const descriptorPath = process.argv[2];
  if (!descriptorPath) throw new Error("Native PDF descriptor path is required.");
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
  await renderNativePdf(descriptor);
}
