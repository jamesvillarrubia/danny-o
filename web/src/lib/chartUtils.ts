/**
 * Chart utility functions for Tremor Raw
 * 
 * Defines available chart colors and utility functions for
 * constructing color class names.
 */

// Available chart colors - maps to Tailwind color palette
export const chartColors = {
  blue: {
    bg: "bg-blue-500",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500",
    text: "text-blue-500",
  },
  sky: {
    bg: "bg-sky-500",
    stroke: "stroke-sky-500",
    fill: "fill-sky-500",
    text: "text-sky-500",
  },
  cyan: {
    bg: "bg-cyan-500",
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    text: "text-cyan-500",
  },
  teal: {
    bg: "bg-teal-500",
    stroke: "stroke-teal-500",
    fill: "fill-teal-500",
    text: "text-teal-500",
  },
  emerald: {
    bg: "bg-emerald-500",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    text: "text-emerald-500",
  },
  green: {
    bg: "bg-green-500",
    stroke: "stroke-green-500",
    fill: "fill-green-500",
    text: "text-green-500",
  },
  lime: {
    bg: "bg-lime-500",
    stroke: "stroke-lime-500",
    fill: "fill-lime-500",
    text: "text-lime-500",
  },
  yellow: {
    bg: "bg-yellow-500",
    stroke: "stroke-yellow-500",
    fill: "fill-yellow-500",
    text: "text-yellow-500",
  },
  amber: {
    bg: "bg-amber-500",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    text: "text-amber-500",
  },
  orange: {
    bg: "bg-orange-500",
    stroke: "stroke-orange-500",
    fill: "fill-orange-500",
    text: "text-orange-500",
  },
  red: {
    bg: "bg-red-500",
    stroke: "stroke-red-500",
    fill: "fill-red-500",
    text: "text-red-500",
  },
  rose: {
    bg: "bg-rose-500",
    stroke: "stroke-rose-500",
    fill: "fill-rose-500",
    text: "text-rose-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    stroke: "stroke-fuchsia-500",
    fill: "fill-fuchsia-500",
    text: "text-fuchsia-500",
  },
  purple: {
    bg: "bg-purple-500",
    stroke: "stroke-purple-500",
    fill: "fill-purple-500",
    text: "text-purple-500",
  },
  violet: {
    bg: "bg-violet-500",
    stroke: "stroke-violet-500",
    fill: "fill-violet-500",
    text: "text-violet-500",
  },
  indigo: {
    bg: "bg-indigo-500",
    stroke: "stroke-indigo-500",
    fill: "fill-indigo-500",
    text: "text-indigo-500",
  },
  slate: {
    bg: "bg-slate-500",
    stroke: "stroke-slate-500",
    fill: "fill-slate-500",
    text: "text-slate-500",
  },
  gray: {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  },
  zinc: {
    bg: "bg-zinc-500",
    stroke: "stroke-zinc-500",
    fill: "fill-zinc-500",
    text: "text-zinc-500",
  },
  neutral: {
    bg: "bg-neutral-500",
    stroke: "stroke-neutral-500",
    fill: "fill-neutral-500",
    text: "text-neutral-500",
  },
} as const;

// Hex color values for direct SVG use
export const colorValues: Record<AvailableChartColorsKeys, string> = {
  blue: "#3b82f6",
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  yellow: "#eab308",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  rose: "#f43f5e",
  pink: "#ec4899",
  fuchsia: "#d946ef",
  purple: "#a855f7",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  slate: "#64748b",
  gray: "#6b7280",
  zinc: "#71717a",
  neutral: "#737373",
};

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as AvailableChartColorsKeys[];

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: "bg" | "stroke" | "fill" | "text",
): string => {
  const colorConfig = chartColors[color];
  return colorConfig ? colorConfig[type] : "";
};

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
): [number | "auto", number | "auto"] => {
  const minDomain = autoMinValue ? "auto" : minValue ?? 0;
  const maxDomain = maxValue ?? "auto";
  return [minDomain, maxDomain];
};

export function hasOnlyOneValueForKey(
  array: Record<string, unknown>[],
  keyToCheck: string,
): boolean {
  const firstValue = array[0]?.[keyToCheck];
  return array.every((item) => item[keyToCheck] === firstValue);
}
