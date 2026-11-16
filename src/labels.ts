export const trelloLabelColors: Record<string, string> = {
  green_light: "#baf3db", yellow_light: "#f5e989", orange_light: "#fce4a6", red_light: "#ffd5d2", purple_light: "#eed7fc",
  green: "#4bce97", yellow: "#eed12b", orange: "#fca700", red: "#f87168", purple: "#c97cf4",
  green_dark: "#1f845a", yellow_dark: "#946f00", orange_dark: "#9e4c00", red_dark: "#c9372c", purple_dark: "#964ac0",
  blue_light: "#cfe1fd", sky_light: "#c6edfb", lime_light: "#d3f1a7", pink_light: "#fdd0ec", black_light: "#dddee1",
  blue: "#669df1", sky: "#6cc3e0", lime: "#94c748", pink: "#e774bb", black: "#8c8f97",
  blue_dark: "#1868db", sky_dark: "#227d9b", lime_dark: "#5b7f24", pink_dark: "#ae4787", black_dark: "#6b6e76",
};

const names: Record<string, string> = { green: "green", yellow: "yellow", orange: "orange", red: "red", purple: "purple", blue: "blue", sky: "sky", lime: "lime", pink: "pink", black: "black" };

export const labelColorOptions = [
  { color: "", name: "No color" },
  ...Object.entries(trelloLabelColors).map(([key, color]) => {
    const [base, variant] = key.split("_");
    return { color, name: `${variant === "light" ? "Light " : variant === "dark" ? "Dark " : ""}${names[base]}` };
  }),
];

/** Black or white, whichever reads better on the given #rrggbb background. */
export function readableTextColor(hex: string): string {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!match) return "#172b4d";
  const [r, g, b] = match.slice(1).map((part) => { const value = parseInt(part, 16) / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#172b4d" : "#ffffff";
}
