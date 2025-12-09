/**
 * BarChart Component
 * 
 * A bar chart component built on Recharts with proper Tailwind v4 support.
 * Uses hex colors directly instead of CSS class-based fills.
 */

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
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
    <div className="flex flex-wrap justify-center gap-3 mt-3">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
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

export interface BarChartProps {
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
  barCategoryGap?: string | number;
  layout?: 'horizontal' | 'vertical';
  type?: 'default' | 'stacked' | 'percent';
  customTooltip?: React.ComponentType<TooltipProps>;
}

const defaultColors: AvailableChartColorsKeys[] = [
  'blue', 'cyan', 'emerald', 'violet', 'amber', 'rose', 'indigo', 'lime'
];

export function BarChart({
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
  barCategoryGap = '10%',
  layout = 'horizontal',
  type = 'default',
  customTooltip: CustomTooltip,
}: BarChartProps) {
  const categoryColors = constructCategoryColors(categories, colors);
  
  const stacked = type === 'stacked' || type === 'percent';
  
  return (
    <div className={cx('w-full h-64', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          barCategoryGap={barCategoryGap}
          stackOffset={type === 'percent' ? 'expand' : undefined}
        >
          {showGridLines && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f4f4f5"
              vertical={false}
            />
          )}
          {showXAxis && (
            <XAxis
              dataKey={layout === 'horizontal' ? index : undefined}
              type={layout === 'horizontal' ? 'category' : 'number'}
              tick={{ fill: '#71717a', fontSize: 12 }}
              axisLine={{ stroke: '#e4e4e7' }}
              tickLine={false}
            />
          )}
          {showYAxis && (
            <YAxis
              dataKey={layout === 'vertical' ? index : undefined}
              type={layout === 'vertical' ? 'category' : 'number'}
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
            cursor={{ fill: '#f4f4f5', opacity: 0.5 }}
          />
          {showLegend && (
            <Legend content={<ChartLegend />} />
          )}
          {categories.map((category) => {
            const color = categoryColors.get(category) || 'blue';
            return (
              <Bar
                key={category}
                dataKey={category}
                name={category}
                fill={colorValues[color]}
                stackId={stacked ? 'stack' : undefined}
                radius={[4, 4, 0, 0]}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;
