/**
 * Insights View Component
 * 
 * Comprehensive dashboard showing productivity statistics, behavioral patterns,
 * and AI-generated recommendations using Tremor charts.
 * 
 * Styled to match the app's design system (rounded-lg borders, zinc colors).
 * 
 * Data is managed at App level to persist across tab switches.
 */

import { useState } from 'react';
import {
  BarChart,
  AreaChart,
  DonutChart,
} from '@tremor/react';
import type { CustomTooltipProps } from '@tremor/react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Flame,
  RefreshCw,
  Loader2,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { type ComprehensiveInsightsResponse } from '../api/client';

/**
 * Custom tooltip component for Tremor charts
 * Styled to match the app's design system
 */
function ChartTooltip({ payload, active, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 min-w-[120px]">
      {label && (
        <p className="text-sm font-medium text-zinc-900 mb-2 pb-2 border-b border-zinc-100">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: item.color || '#3b82f6' }}
              />
              <span className="text-xs text-zinc-500">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="text-sm font-semibold text-zinc-900">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface InsightsViewProps {
  /** Pre-loaded insights data (managed at App level) */
  data: ComprehensiveInsightsResponse | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Callback to refresh data */
  onRefresh: () => void;
  /** Callback when a task is clicked */
  onTaskClick?: (taskId: string) => void;
}

// Custom card component matching app design
function InsightCard({ 
  children, 
  className,
  accentColor,
}: { 
  children: React.ReactNode; 
  className?: string;
  accentColor?: 'blue' | 'orange' | 'emerald' | 'violet' | 'red' | 'amber';
}) {
  return (
    <div className={clsx(
      'bg-white rounded-lg border border-zinc-200 p-4',
      accentColor && `border-t-2 border-t-${accentColor}-500`,
      className
    )}>
      {children}
    </div>
  );
}

// Badge component matching app design
function InsightBadge({ 
  children, 
  color = 'zinc' 
}: { 
  children: React.ReactNode;
  color?: 'emerald' | 'red' | 'orange' | 'amber' | 'blue' | 'violet' | 'zinc';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    zinc: 'bg-zinc-100 text-zinc-700',
  };
  
  return (
    <span className={clsx('px-2 py-0.5 rounded-md text-xs font-medium', colorClasses[color])}>
      {children}
    </span>
  );
}

// Callout component matching app design
function InsightCallout({ 
  title, 
  children, 
  type = 'info',
  icon: Icon,
}: { 
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'warning' | 'success';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const iconStyles = {
    info: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
  };
  
  return (
    <div className={clsx('rounded-lg border p-3', styles[type])}>
      <div className="flex items-start gap-2">
        {Icon && <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', iconStyles[type])} />}
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-sm mt-1 opacity-90">{children}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Insights View component
 */
export function InsightsView({ data, isLoading, error, onRefresh, onTaskClick }: InsightsViewProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'categories' | 'habits' | 'recommendations'>('trends');

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-danny-500 mx-auto mb-3" />
          <p className="text-zinc-500">Analyzing your productivity patterns...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <InsightCallout title="Failed to load insights" type="warning" icon={AlertCircle}>
          {error}
          <button
            onClick={onRefresh}
            className="block mt-2 text-sm text-danny-600 hover:text-danny-700 underline"
          >
            Try again
          </button>
        </InsightCallout>
      </div>
    );
  }

  if (!data) return null;

  const { stats, aiAnalysis } = data;

  // Prepare chart data
  const categoryData = Object.entries(stats.activeByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const dayOfWeekData = Object.entries(stats.completionsByDayOfWeek)
    .map(([name, completed]) => ({ name: name.slice(0, 3), completed }));

  const dailyCompletionsData = stats.dailyCompletions.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Completed: d.count,
  }));

  // Age distribution as bar chart data
  const ageDistributionData = [
    { name: '<7d', tasks: stats.taskAgeBuckets.recent },
    { name: '7-30d', tasks: stats.taskAgeBuckets.week },
    { name: '30-90d', tasks: stats.taskAgeBuckets.month },
    { name: '90d+', tasks: stats.taskAgeBuckets.stale },
  ];

  const procrastinationData = [
    { name: 'On Time', value: stats.procrastinationStats.completedOnTime },
    { name: 'Last Minute', value: stats.procrastinationStats.completedLastMinute },
    { name: 'Late', value: stats.procrastinationStats.completedLate },
  ];

  // Find peak day
  const peakDay = Object.entries(stats.completionsByDayOfWeek)
    .sort((a, b) => b[1] - a[1])[0];

  const tabs = [
    { id: 'trends' as const, label: 'Trends', icon: TrendingUp },
    { id: 'categories' as const, label: 'Categories', icon: Target },
    { id: 'habits' as const, label: 'Habits', icon: Clock },
    { id: 'recommendations' as const, label: 'Recommendations', icon: Lightbulb },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Productivity Insights</h1>
          <p className="text-sm text-zinc-500">Last 30 days of task management data</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors text-zinc-700"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* AI Summary */}
      {aiAnalysis.summary && (
        <InsightCallout title="AI Analysis" type="info" icon={Lightbulb}>
          {aiAnalysis.summary}
        </InsightCallout>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightCard className="border-t-2 border-t-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">Productivity Score</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.productivityScore}</p>
            </div>
            <InsightBadge color={stats.productivityScore >= 70 ? 'emerald' : stats.productivityScore >= 40 ? 'amber' : 'red'}>
              /100
            </InsightBadge>
          </div>
          <div className="mt-3 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${stats.productivityScore}%` }}
            />
          </div>
        </InsightCard>

        <InsightCard className="border-t-2 border-t-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">Current Streak</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1 flex items-center gap-1">
                {stats.currentStreak}
                <Flame className="w-5 h-5 text-orange-500" />
              </p>
            </div>
            <InsightBadge color="orange">days</InsightBadge>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Best: {stats.longestStreak} days</p>
        </InsightCard>

        <InsightCard className="border-t-2 border-t-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">Completed (30d)</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.totalCompletedLast30Days}</p>
            </div>
            <InsightBadge color={stats.completionRateLast30Days >= 0.5 ? 'emerald' : 'amber'}>
              {(stats.completionRateLast30Days * 100).toFixed(0)}% rate
            </InsightBadge>
          </div>
          <p className="text-xs text-zinc-500 mt-2">completion rate</p>
        </InsightCard>

        <InsightCard className="border-t-2 border-t-violet-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">Active Tasks</p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.totalActive}</p>
            </div>
            {stats.overdueTasks > 0 && (
              <InsightBadge color="red">{stats.overdueTasks} overdue</InsightBadge>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2">{stats.dueSoon} due soon</p>
        </InsightCard>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-danny-500 text-danny-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'trends' && (
          <>
            <InsightCard>
              <h3 className="font-medium text-zinc-900">Daily Completions</h3>
              <p className="text-sm text-zinc-500">Tasks completed per day over the last 30 days</p>
              <div className="tremor-chart-wrapper mt-4">
                <AreaChart
                  className="h-64"
                  data={dailyCompletionsData}
                  index="date"
                  categories={['Completed']}
                  colors={['blue']}
                  showLegend={false}
                  showAnimation={true}
                  curveType="monotone"
                  valueFormatter={(value) => `${value} tasks`}
                />
              </div>
            </InsightCard>

            <div className="grid sm:grid-cols-2 gap-4">
              <InsightCard>
                <h3 className="font-medium text-zinc-900">Completions by Day</h3>
                <p className="text-sm text-zinc-500">When do you get the most done?</p>
                <div className="tremor-chart-wrapper mt-4">
                  <BarChart
                    className="h-40"
                    data={dayOfWeekData}
                    index="name"
                    categories={['completed']}
                    colors={['violet']}
                    showLegend={false}
                    showAnimation={true}
                    valueFormatter={(value) => `${value}`}
                  />
                </div>
                {peakDay && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-violet-500" />
                    <span className="text-zinc-600">
                      Peak: <span className="font-medium text-zinc-900">{peakDay[0]}s</span> ({peakDay[1]} tasks)
                    </span>
                  </div>
                )}
              </InsightCard>

              <InsightCard>
                <h3 className="font-medium text-zinc-900">Task Age Distribution</h3>
                <p className="text-sm text-zinc-500">How old are your active tasks?</p>
                <div className="tremor-chart-wrapper mt-4">
                  <BarChart
                    className="h-40"
                    data={ageDistributionData}
                    index="name"
                    categories={['tasks']}
                    colors={['cyan']}
                    showLegend={false}
                    showAnimation={true}
                    valueFormatter={(value) => `${value}`}
                  />
                </div>
                {stats.taskAgeBuckets.stale > 5 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{stats.taskAgeBuckets.stale} tasks are over 90 days old</span>
                  </div>
                )}
              </InsightCard>
            </div>
          </>
        )}

        {activeTab === 'categories' && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <InsightCard>
                <h3 className="font-medium text-zinc-900">Active Tasks by Category</h3>
                <div className="tremor-chart-wrapper mt-4">
                  <DonutChart
                    className="h-52"
                    data={categoryData}
                    index="name"
                    category="value"
                    showAnimation={true}
                    showLabel={true}
                    valueFormatter={(value) => `${value}`}
                  />
                </div>
              </InsightCard>

              <InsightCard>
                <h3 className="font-medium text-zinc-900">Category Velocity</h3>
                <p className="text-sm text-zinc-500 mb-3">How fast tasks get completed</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {Object.entries(stats.categoryVelocity)
                    .sort((a, b) => b[1].completed - a[1].completed)
                    .slice(0, 8)
                    .map(([category, data]) => (
                      <div key={category} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
                        <span className="text-sm text-zinc-700 truncate">{category}</span>
                        <span className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                          {data.completed} done
                          {data.avgDaysToComplete !== null && (
                            <span className="text-zinc-400"> · {data.avgDaysToComplete}d avg</span>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </InsightCard>
            </div>

            <InsightCard>
              <h3 className="font-medium text-zinc-900">Estimate Coverage</h3>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-zinc-600">Tasks with time estimates</span>
                <span className="text-sm font-medium text-zinc-900">
                  {stats.tasksWithEstimates} / {stats.totalActive} (
                  {stats.totalActive > 0
                    ? ((stats.tasksWithEstimates / stats.totalActive) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${stats.totalActive > 0 ? (stats.tasksWithEstimates / stats.totalActive) * 100 : 0}%` }}
                />
              </div>
            </InsightCard>
          </>
        )}

        {activeTab === 'habits' && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <InsightCard>
                <h3 className="font-medium text-zinc-900">Procrastination Analysis</h3>
                <p className="text-sm text-zinc-500">Completion timing vs due dates</p>
                <div className="tremor-chart-wrapper mt-4">
                  <DonutChart
                    className="h-44"
                    data={procrastinationData}
                    index="name"
                    category="value"
                    colors={['emerald', 'yellow', 'red']}
                    showAnimation={true}
                    valueFormatter={(value) => `${value}`}
                  />
                </div>
              </InsightCard>

              <InsightCard>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Good Habits
                    </h3>
                    {aiAnalysis.habits?.good?.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {aiAnalysis.habits.good.map((habit, i) => (
                          <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                            <span className="text-emerald-400 mt-1">•</span>
                            {habit}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">Analyzing patterns...</p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Needs Work
                    </h3>
                    {aiAnalysis.habits?.needsWork?.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {aiAnalysis.habits.needsWork.map((habit, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                            <span className="text-amber-400 mt-1">•</span>
                            {habit}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">No issues identified</p>
                    )}
                  </div>
                </div>
              </InsightCard>
            </div>

            {/* Key Findings */}
            {aiAnalysis.keyFindings?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-zinc-900">Key Findings</h3>
                {aiAnalysis.keyFindings.map((finding, i) => (
                  <InsightCallout
                    key={i}
                    title={finding.title}
                    type={finding.type === 'positive' ? 'success' : finding.type === 'warning' ? 'warning' : 'info'}
                    icon={finding.type === 'positive' ? CheckCircle : finding.type === 'warning' ? AlertTriangle : Lightbulb}
                  >
                    {finding.description}
                  </InsightCallout>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'recommendations' && (
          <>
            {aiAnalysis.recommendations?.length > 0 ? (
              <div className="space-y-3">
                {aiAnalysis.recommendations.map((rec, i) => (
                  <InsightCard key={i} className="relative overflow-hidden">
                    <div className={clsx(
                      'absolute left-0 top-0 bottom-0 w-1',
                      rec.priority === 'now' ? 'bg-red-500' :
                      rec.priority === 'soon' ? 'bg-amber-500' : 'bg-blue-500'
                    )} />
                    <div className="pl-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-zinc-900">{rec.action}</h4>
                        <InsightBadge color={
                          rec.priority === 'now' ? 'red' :
                          rec.priority === 'soon' ? 'amber' : 'blue'
                        }>
                          {rec.priority}
                        </InsightBadge>
                      </div>
                      <p className="text-sm text-zinc-600 mt-1">{rec.reasoning}</p>
                    </div>
                  </InsightCard>
                ))}
              </div>
            ) : (
              <InsightCallout title="No specific recommendations" type="success" icon={CheckCircle}>
                Your task management looks healthy! Keep up the good work.
              </InsightCallout>
            )}

            {/* Stale Tasks for Archival */}
            {stats.stalestTasks.length > 0 && (
              <InsightCard>
                <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Consider Archiving
                </h3>
                <p className="text-sm text-zinc-500 mb-3">These tasks have been sitting for over 90 days</p>
                <div className="space-y-2">
                  {stats.stalestTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0"
                    >
                      <button
                        onClick={() => onTaskClick?.(task.id)}
                        className="text-sm text-zinc-700 hover:text-danny-600 transition-colors text-left truncate max-w-[70%] flex items-center gap-1 group"
                      >
                        {task.content}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <InsightBadge color="red">{task.ageInDays}d</InsightBadge>
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-zinc-400 text-xs pt-2">
        Generated {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

export default InsightsView;
