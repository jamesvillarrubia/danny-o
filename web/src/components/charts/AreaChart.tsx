/**
 * AreaChart Component
 * 
 * An area chart component built on Recharts with proper Tailwind v4 support.
 * Uses hex colors directly instead of CSS class-based fills.
 * 
 * Animation behavior:
 * - By default, animates only on first render (per session) to avoid
 *   repetitive animations when switching tabs.
 * - Use `animate={false}` to disable animation entirely.
 * - Use `animate={true}` to force animation on every render.
 */

import React, { useRef, useEffect } from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cx } from '../../lib/utils';
import { 
  type AvailableChartColorsKeys, 
  colorValues,
  constructCategoryColors,
} from '../../lib/chartUtils';
import {
  shouldChartAnimate,
  markChartAnimated,
} from '../../lib/chartAnimation';

// Custom tooltip component
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  valueFormatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, label, valueFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 min-w-[140px]">
      {label && (
        <p className="text-sm font-medium text-zinc-900 mb-2 pb-2 border-b border-zinc-100">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-zinc-600">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-900">
              {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Custom legend component
interface LegendProps {
  payload?: Array<{
    value: string;
    color: string;
  }>;
}

function ChartLegend({ payload }: LegendProps) {
  if (!payload?.length) return null;
  
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-zinc-500">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface AreaChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGridLines?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  yAxisWidth?: number;
  className?: string;
  type?: 'default' | 'stacked' | 'percent';
  curveType?: 'linear' | 'natural' | 'monotone' | 'step';
  connectNulls?: boolean;
  customTooltip?: React.ComponentType<TooltipProps>;
  /** 
   * Control animation behavior:
   * - `undefined` (default): Animate only on first render per session
   * - `true`: Always animate
   * - `false`: Never animate
   */
  animate?: boolean;
  /**
   * Unique key to identify this chart for animation tracking.
   * If not provided, uses a hash of the categories.
   */
  animationKey?: string;
  /** Animation duration in milliseconds. Default: 400 */
  animationDuration?: number;
}

const defaultColors: AvailableChartColorsKeys[] = [
  'blue', 'cyan', 'emerald', 'violet', 'amber', 'rose', 'indigo', 'lime'
];

export function AreaChart({
  data,
  index,
  categories,
  colors = defaultColors,
  valueFormatter,
  showLegend = true,
  showGridLines = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 56,
  className,
  type = 'default',
  curveType = 'monotone',
  connectNulls = false,
  customTooltip: CustomTooltip,
  animate,
  animationKey,
  animationDuration = 400,
}: AreaChartProps) {
  const categoryColors = constructCategoryColors(categories, colors);
  const hasAnimatedRef = useRef(false);
  
  const stacked = type === 'stacked' || type === 'percent';
  
  // Determine the chart's unique key for animation tracking
  const chartKey = animationKey ?? `area-${categories.join(',')}-${data.length}`;
  
  // Determine if we should animate
  const shouldAnimate = shouldChartAnimate(animate, chartKey);
  
  // Mark as animated after first render
  useEffect(() => {
    if (shouldAnimate && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      markChartAnimated(chartKey);
    }
  }, [shouldAnimate, chartKey]);
  
  return (
    <div className={cx('w-full h-64', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          stackOffset={type === 'percent' ? 'expand' : undefined}
        >
          <defs>
            {categories.map((category) => {
              const color = categoryColors.get(category) || 'blue';
              const hexColor = colorValues[color];
              return (
                <linearGradient
                  key={category}
                  id={`gradient-${category}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={hexColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={hexColor} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>
          {showGridLines && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f4f4f5"
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tick={{ fill: '#71717a', fontSize: 12 }}
              axisLine={{ stroke: '#e4e4e7' }}
              tickLine={false}
            />
          )}
          {showYAxis && (
            <YAxis
              width={yAxisWidth}
              tick={{ fill: '#71717a', fontSize: 12 }}
              axisLine={{ stroke: '#e4e4e7' }}
              tickLine={false}
              tickFormatter={
                type === 'percent' 
                  ? (value) => `${(value * 100).toFixed(0)}%`
                  : valueFormatter
              }
            />
          )}
          <Tooltip
            content={
              CustomTooltip 
                ? <CustomTooltip valueFormatter={valueFormatter} />
                : <ChartTooltip valueFormatter={valueFormatter} />
            }
          />
          {showLegend && (
            <Legend content={<ChartLegend />} />
          )}
          {categories.map((category) => {
            const color = categoryColors.get(category) || 'blue';
            const hexColor = colorValues[color];
            return (
              <Area
                key={category}
                type={curveType}
                dataKey={category}
                name={category}
                stroke={hexColor}
                strokeWidth={2}
                fill={`url(#gradient-${category})`}
                stackId={stacked ? 'stack' : undefined}
                connectNulls={connectNulls}
                isAnimationActive={shouldAnimate}
                animationDuration={animationDuration}
                animationEasing="ease-out"
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AreaChart;
