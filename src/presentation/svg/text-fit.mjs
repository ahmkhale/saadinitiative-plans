import { fitMeasuredText } from "../../infrastructure/export/font-metrics.mjs";

export function courseNameFit(value) {
  return fitMeasuredText(value, {
    baseSize: 5,
    minimumSize: 2.75,
    maxWidth: 68,
    style: "semibold",
  });
}

export function prerequisiteFit(value, maxWidth) {
  return fitMeasuredText(value, {
    baseSize: 4.5,
    minimumSize: 3.5,
    maxWidth,
    style: "bold",
  });
}
