import { COLORS, PAGE_LAYOUT } from "../layout/page-layout.mjs";
import { esc, text } from "./primitives.mjs";

export function telegramIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(1)"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09" fill="${COLORS.black}"/></g>`;
}

export function globeIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.6667)" fill="none" stroke="${COLORS.black}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></g>`;
}

export function xIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.0533)"><path d="m236 0h46l-101 115 118 156h-92.6l-72.5-94.8-83 94.8h-46l107-123-113-148h94.9l65.5 86.6zm-16.1 244h25.5l-165-218h-27.4z" fill="${COLORS.black}"/></g>`;
}

export function helpIcon(x, y) {
  return `<g transform="translate(${x} ${y}) scale(.6667)" fill="none" stroke="${COLORS.black}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></g>`;
}

export function footerItem({ x, width, icon, title, value, href }) {
  const iconX = x + width - 16;
  return [
    `<a href="${esc(href)}" xlink:href="${esc(href)}" target="_blank" rel="noopener noreferrer" pointer-events="all" style="cursor:pointer">`,
    `<title>${esc(`${title}: ${value}`)}</title>`,
    `<rect data-part="footer-hit-area" x="${x}" y="-5" width="${width}" height="27" fill="${COLORS.white}" fill-opacity="0" pointer-events="all"/>`,
    icon(iconX, 1.5),
    text({ x: iconX - 4, y: 4.2, value: title, size: 8.457, weight: 700, anchor: "start" }),
    text({ x: iconX - 4, y: 14.1, value, size: 8.457, weight: 400, anchor: "end", direction: "ltr" }),
    "</a>",
  ].join("");
}

export function renderFooter(plan, y) {
  const copyright = plan.footer?.copyright || "مبادرة صاد. جميع الحقوق محفوظة للتصميم والهوية البصرية.";
  return [
    `<g data-component="footer">`,
    `<g transform="translate(0 ${y + 16})">`,
    footerItem({ x: 62.5, width: 119, icon: helpIcon, title: "للاستفسارات", value: "t.me/SaadInitiative?direct", href: "https://t.me/SaadInitiative?direct" }),
    footerItem({ x: 205.5, width: 97, icon: xIcon, title: "حساب مبادرة صاد", value: "x.com/saadinitiative", href: "https://x.com/saadinitiative" }),
    footerItem({ x: 326.5, width: 89, icon: globeIcon, title: "موقع مبادرة صاد", value: "saadinitiative.com", href: "https://saadinitiative.com" }),
    footerItem({ x: 439.5, width: 92, icon: telegramIcon, title: "قناة مبادرة صاد", value: "t.me/saadinitiative", href: "https://t.me/saadinitiative" }),
    "</g>",
    text({ x: PAGE_LAYOUT.width / 2, y: y + 56, value: copyright, size: 8.457, weight: 400, fill: COLORS.copyright }),
    `<rect x="0" y="${y + 78}" width="${PAGE_LAYOUT.width}" height="6" fill="${COLORS.saad}"/>`,
    "</g>",
  ].join("");
}
