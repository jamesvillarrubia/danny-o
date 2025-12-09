/**
 * DonutChart Component
 * 
 * A donut/pie chart component built on Recharts with proper Tailwind v4 support.
 * Uses hex colors directly instead of CSS class-based fills.
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cx } from '../../lib/utils';
import { 
  type AvailableChartColorsKeys, 
  colorValues,
} from '../../lib/chartUtils';

// Custom tooltip component
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    payload: {
      fill: string;
      name: string;
      value: number;
    };
  }>;
  valueFormatter?: (value: number) => string;
}

function ChartTooltip({ active, payload, valueFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  
  const item = payload[0];
  
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 min-w-[120px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.payload.fill }}
          />
          <span className="text-sm text-zinc-600">{item.name}</span>
        </div>
        <span className="text-sm font-semibold text-zinc-900">
          {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString()}
        </span>
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

export interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    [key: string]: unknown;
  }>;
  category?: string;
  value?: string;
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
  variant?: 'donut' | 'pie';
  label?: string;
  customTooltip?: React.ComponentType<TooltipProps>;
}

const defaultColors: AvailableChartColorsKeys[] = [
  'blue', 'cyan', 'emerald', 'violet', 'amber', 'rose', 'indigo', 'lime',
  'pink', 'teal', 'orange', 'purple'
];

export function DonutChart({
  data,
  category = 'name',
  value = 'value',
  colors = defaultColors,
  valueFormatter,
  showLegend = true,
  showLabel = false,
  showTooltip = true,
  className,
  variant = 'donut',
  label,
  customTooltip: CustomTooltip,
}: DonutChartProps) {
  // Map data to include fill colors
  const chartData = data.map((item, index) => ({
    ...item,
    name: String(item[category]),
    value: Number(item[value]),
    fill: colorValues[colors[index % colors.length]],
  }));
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Reduce radius when showing labels to make room for them
  const innerRadius = variant === 'donut' ? (showLabel ? '40%' : '60%') : 0;
  const outerRadius = showLabel ? '55%' : '80%';
  
  // Custom label renderer for smaller, cleaner labels
  const renderLabel = showLabel 
    ? ({ name, percent }: { name: string; percent: number }) => {
        // Only show label if segment is large enough (>5%)
        if (percent < 0.05) return null;
        return `${name} ${(percent * 100).toFixed(0)}%`;
      }
    : undefined;
  
  return (
    <div className={cx('w-full h-64 relative', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            label={renderLabel}
            labelLine={showLabel ? { stroke: '#a1a1aa', strokeWidth: 1 } : false}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.fill}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              content={
                CustomTooltip 
                  ? <CustomTooltip valueFormatter={valueFormatter} />
                  : <ChartTooltip valueFormatter={valueFormatter} />
              }
            />
          )}
          {showLegend && (
            <Legend content={<ChartLegend />} />
          )}
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center label for donut */}
      {variant === 'donut' && label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-zinc-900">
            {valueFormatter ? valueFormatter(total) : total.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-500">{label}</span>
        </div>
      )}
    </div>
  );
}

export default DonutChart;
