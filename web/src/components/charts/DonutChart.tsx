/**
 * DonutChart Component
 * 
 * A responsive donut/pie chart component built on Recharts.
 * Uses hex colors directly instead of CSS class-based fills.
 * Automatically adjusts sizing and label display based on container width.
 */

import React, { useState, useCallback } from 'react';
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
  // Track container width for responsive adjustments
  const [containerWidth, setContainerWidth] = useState(0);
  
  const handleResize = useCallback((width: number) => {
    setContainerWidth(width);
  }, []);
  
  // Map data to include fill colors
  const chartData = data.map((item, index) => ({
    ...item,
    name: String(item[category]),
    value: Number(item[value]),
    fill: colorValues[colors[index % colors.length]],
  }));
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Responsive sizing based on container width
  const isSmall = containerWidth > 0 && containerWidth < 250;
  const isMedium = containerWidth >= 250 && containerWidth < 350;
  
  // Adjust radius based on size and whether labels are shown
  const getRadius = () => {
    if (showLabel) {
      // Labels need more room
      if (isSmall) return { inner: '35%', outer: '45%' };
      if (isMedium) return { inner: '38%', outer: '50%' };
      return { inner: '40%', outer: '55%' };
    }
    // No labels - can use more space
    if (isSmall) return { inner: '50%', outer: '75%' };
    return { inner: '60%', outer: '80%' };
  };
  
  const radius = getRadius();
  const innerRadius = variant === 'donut' ? radius.inner : 0;
  const outerRadius = radius.outer;
  
  // Responsive margins
  const margin = isSmall 
    ? { top: 10, right: 10, bottom: 10, left: 10 }
    : isMedium
    ? { top: 15, right: 15, bottom: 15, left: 15 }
    : { top: 20, right: 30, bottom: 20, left: 30 };
  
  // Custom label renderer - shorter format on small screens
  const renderLabel = showLabel 
    ? ({ name, percent }: { name: string; percent: number }) => {
        const pct = (percent * 100).toFixed(0);
        // On small screens, just show percentage
        if (isSmall) return `${pct}%`;
        // On medium, truncate long names
        if (isMedium && name.length > 10) {
          return `${name.slice(0, 8)}… ${pct}%`;
        }
        return `${name} ${pct}%`;
      }
    : undefined;
  
  return (
    <div className={cx('w-full h-64 relative', className)}>
      <ResponsiveContainer 
        width="100%" 
        height="100%"
        onResize={(width) => handleResize(width)}
      >
        <PieChart margin={margin}>
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
          <span className={cx(
            'font-bold text-zinc-900',
            isSmall ? 'text-lg' : 'text-2xl'
          )}>
            {valueFormatter ? valueFormatter(total) : total.toLocaleString()}
          </span>
          <span className={cx(
            'text-zinc-500',
            isSmall ? 'text-xs' : 'text-sm'
          )}>{label}</span>
        </div>
      )}
    </div>
  );
}

export default DonutChart;
