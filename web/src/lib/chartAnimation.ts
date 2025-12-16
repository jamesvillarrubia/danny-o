/**
 * Chart Animation Utilities
 *
 * Manages animation state for charts to avoid repetitive animations
 * when switching between tabs/views.
 */

/**
 * Track which chart instances have animated (by a unique key).
 * This persists for the session so charts only animate once.
 */
const animatedCharts = new Set<string>();

/**
 * Check if a chart should animate.
 *
 * @param animate - Explicit animation control (true/false/undefined)
 * @param chartKey - Unique identifier for the chart
 * @returns Whether the chart should animate
 */
export function shouldChartAnimate(
  animate: boolean | undefined,
  chartKey: string
): boolean {
  // Explicit control
  if (animate === true) return true;
  if (animate === false) return false;

  // Default behavior: animate only on first render
  return !animatedCharts.has(chartKey);
}

/**
 * Mark a chart as having animated.
 *
 * @param chartKey - Unique identifier for the chart
 */
export function markChartAnimated(chartKey: string): void {
  animatedCharts.add(chartKey);
}

/**
 * Generate a unique key for a chart based on its data.
 *
 * @param prefix - Chart type prefix (e.g., 'donut', 'bar', 'area')
 * @param data - Chart data array
 * @returns Unique string key
 */
export function generateChartKey(
  prefix: string,
  data: Array<{ name?: string; value?: number; [key: string]: unknown }>
): string {
  const dataSignature = data
    .map((d) => `${d.name ?? ''}:${d.value ?? ''}`)
    .join(',');
  return `${prefix}-${dataSignature}`;
}

/**
 * Clear all animation tracking (useful for testing).
 */
export function resetAnimationTracking(): void {
  animatedCharts.clear();
}
