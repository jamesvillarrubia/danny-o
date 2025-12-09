/**
 * Insights View Component
 * 
 * Comprehensive dashboard showing productivity statistics, behavioral patterns,
 * and AI-generated recommendations using Tremor charts.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Title,
  Text,
  Metric,
  Flex,
  Grid,
  ProgressBar,
  BarChart,
  DonutChart,
  AreaChart,
  Badge,
  BadgeDelta,
  List,
  ListItem,
  Bold,
  Callout,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@tremor/react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Target,
  Flame,
  RefreshCw,
  Loader2,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { getComprehensiveInsights, type ComprehensiveInsightsResponse } from '../api/client';

interface InsightsViewProps {
  onTaskClick?: (taskId: string) => void;
}

/**
 * Main Insights View component
 */
export function InsightsView({ onTaskClick }: InsightsViewProps) {
  const [insights, setInsights] = useState<ComprehensiveInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getComprehensiveInsights();
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-danny-500 mx-auto mb-3" />
          <Text>Analyzing your productivity patterns...</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Callout title="Failed to load insights" icon={AlertCircle} color="red">
        {error}
        <button
          onClick={loadInsights}
          className="mt-2 text-sm text-danny-600 hover:text-danny-700 underline"
        >
          Try again
        </button>
      </Callout>
    );
  }

  if (!insights) return null;

  const { stats, aiAnalysis } = insights;

  // Prepare chart data
  const categoryData = Object.entries(stats.activeByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const dayOfWeekData = Object.entries(stats.completionsByDayOfWeek)
    .map(([name, completed]) => ({ name, completed }));

  const dailyCompletionsData = stats.dailyCompletions.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Completed: d.count,
  }));

  const ageDistributionData = [
    { name: 'Recent (<7d)', value: stats.taskAgeBuckets.recent, color: 'emerald' },
    { name: '7-30 days', value: stats.taskAgeBuckets.week, color: 'yellow' },
    { name: '30-90 days', value: stats.taskAgeBuckets.month, color: 'orange' },
    { name: 'Stale (90+)', value: stats.taskAgeBuckets.stale, color: 'red' },
  ];

  const procrastinationData = [
    { name: 'On Time', value: stats.procrastinationStats.completedOnTime, color: 'emerald' },
    { name: 'Last Minute', value: stats.procrastinationStats.completedLastMinute, color: 'yellow' },
    { name: 'Late', value: stats.procrastinationStats.completedLate, color: 'red' },
  ];

  // Find peak day
  const peakDay = Object.entries(stats.completionsByDayOfWeek)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title>Productivity Insights</Title>
          <Text>Last 30 days of task management data</Text>
        </div>
        <button
          onClick={loadInsights}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* AI Summary */}
      {aiAnalysis.summary && (
        <Callout title="AI Analysis" icon={Lightbulb} color="blue">
          {aiAnalysis.summary}
        </Callout>
      )}

      {/* Key Metrics */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <div>
              <Text>Productivity Score</Text>
              <Metric>{stats.productivityScore}</Metric>
            </div>
            <Badge color={stats.productivityScore >= 70 ? 'emerald' : stats.productivityScore >= 40 ? 'yellow' : 'red'}>
              /100
            </Badge>
          </Flex>
          <ProgressBar value={stats.productivityScore} color="blue" className="mt-3" />
        </Card>

        <Card decoration="top" decorationColor="orange">
          <Flex alignItems="start">
            <div>
              <Text>Current Streak</Text>
              <Metric className="flex items-center gap-2">
                {stats.currentStreak}
                <Flame className="w-6 h-6 text-orange-500" />
              </Metric>
            </div>
            <Badge color="orange">days</Badge>
          </Flex>
          <Text className="mt-2">Best: {stats.longestStreak} days</Text>
        </Card>

        <Card decoration="top" decorationColor="emerald">
          <Flex alignItems="start">
            <div>
              <Text>Completed (30d)</Text>
              <Metric>{stats.totalCompletedLast30Days}</Metric>
            </div>
            <BadgeDelta
              deltaType={stats.completionRateLast30Days >= 0.5 ? 'increase' : 'decrease'}
            >
              {(stats.completionRateLast30Days * 100).toFixed(0)}%
            </BadgeDelta>
          </Flex>
          <Text className="mt-2">completion rate</Text>
        </Card>

        <Card decoration="top" decorationColor="violet">
          <Flex alignItems="start">
            <div>
              <Text>Active Tasks</Text>
              <Metric>{stats.totalActive}</Metric>
            </div>
            {stats.overdueTasks > 0 && (
              <Badge color="red">{stats.overdueTasks} overdue</Badge>
            )}
          </Flex>
          <Text className="mt-2">{stats.dueSoon} due soon</Text>
        </Card>
      </Grid>

      {/* Tabs for different insight views */}
      <TabGroup>
        <TabList>
          <Tab icon={TrendingUp}>Trends</Tab>
          <Tab icon={Target}>Categories</Tab>
          <Tab icon={Clock}>Habits</Tab>
          <Tab icon={Lightbulb}>Recommendations</Tab>
        </TabList>
        <TabPanels>
          {/* Trends Panel */}
          <TabPanel>
            <div className="mt-4 space-y-6">
              <Card>
                <Title>Daily Completions</Title>
                <Text>Tasks completed per day over the last 30 days</Text>
                <AreaChart
                  className="h-72 mt-4"
                  data={dailyCompletionsData}
                  index="date"
                  categories={['Completed']}
                  colors={['blue']}
                  showLegend={false}
                  showAnimation={true}
                />
              </Card>

              <Grid numItemsSm={2} className="gap-4">
                <Card>
                  <Title>Completions by Day of Week</Title>
                  <Text>When do you get the most done?</Text>
                  <BarChart
                    className="h-48 mt-4"
                    data={dayOfWeekData}
                    index="name"
                    categories={['completed']}
                    colors={['violet']}
                    showLegend={false}
                    showAnimation={true}
                  />
                  {peakDay && (
                    <Callout title="Peak Day" icon={Zap} color="violet" className="mt-4">
                      You're most productive on <Bold>{peakDay[0]}s</Bold> with {peakDay[1]} completions
                    </Callout>
                  )}
                </Card>

                <Card>
                  <Title>Task Age Distribution</Title>
                  <Text>How old are your active tasks?</Text>
                  <DonutChart
                    className="h-48 mt-4"
                    data={ageDistributionData}
                    index="name"
                    category="value"
                    colors={['emerald', 'yellow', 'orange', 'red']}
                    showAnimation={true}
                  />
                  {stats.taskAgeBuckets.stale > 10 && (
                    <Callout title="Stale Tasks" icon={AlertTriangle} color="amber" className="mt-4">
                      You have {stats.taskAgeBuckets.stale} tasks over 90 days old. Consider archiving some.
                    </Callout>
                  )}
                </Card>
              </Grid>
            </div>
          </TabPanel>

          {/* Categories Panel */}
          <TabPanel>
            <div className="mt-4 space-y-6">
              <Grid numItemsSm={2} className="gap-4">
                <Card>
                  <Title>Active Tasks by Category</Title>
                  <DonutChart
                    className="h-64 mt-4"
                    data={categoryData}
                    index="name"
                    category="value"
                    showAnimation={true}
                  />
                </Card>

                <Card>
                  <Title>Category Velocity</Title>
                  <Text>How fast tasks get completed per category</Text>
                  <List className="mt-4">
                    {Object.entries(stats.categoryVelocity)
                      .sort((a, b) => b[1].completed - a[1].completed)
                      .slice(0, 8)
                      .map(([category, data]) => (
                        <ListItem key={category}>
                          <span>{category}</span>
                          <span className="text-zinc-500">
                            {data.completed} done
                            {data.avgDaysToComplete !== null && (
                              <> · avg {data.avgDaysToComplete}d</>
                            )}
                          </span>
                        </ListItem>
                      ))}
                  </List>
                </Card>
              </Grid>

              <Card>
                <Title>Estimate Coverage</Title>
                <Flex className="mt-4">
                  <Text>Tasks with time estimates</Text>
                  <Text>
                    {stats.tasksWithEstimates} / {stats.totalActive} (
                    {stats.totalActive > 0
                      ? ((stats.tasksWithEstimates / stats.totalActive) * 100).toFixed(0)
                      : 0}
                    %)
                  </Text>
                </Flex>
                <ProgressBar
                  value={stats.totalActive > 0 ? (stats.tasksWithEstimates / stats.totalActive) * 100 : 0}
                  color="blue"
                  className="mt-2"
                />
              </Card>
            </div>
          </TabPanel>

          {/* Habits Panel */}
          <TabPanel>
            <div className="mt-4 space-y-6">
              <Grid numItemsSm={2} className="gap-4">
                <Card>
                  <Title>Procrastination Analysis</Title>
                  <Text>Completion timing relative to due dates</Text>
                  <DonutChart
                    className="h-48 mt-4"
                    data={procrastinationData}
                    index="name"
                    category="value"
                    colors={['emerald', 'yellow', 'red']}
                    showAnimation={true}
                  />
                </Card>

                <Card>
                  <div className="space-y-4">
                    <div>
                      <Title className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        Good Habits
                      </Title>
                      {aiAnalysis.habits?.good?.length > 0 ? (
                        <List className="mt-2">
                          {aiAnalysis.habits.good.map((habit, i) => (
                            <ListItem key={i}>
                              <span className="text-emerald-700">{habit}</span>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Text className="mt-2 text-zinc-500">Analyzing patterns...</Text>
                      )}
                    </div>

                    <div>
                      <Title className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Needs Work
                      </Title>
                      {aiAnalysis.habits?.needsWork?.length > 0 ? (
                        <List className="mt-2">
                          {aiAnalysis.habits.needsWork.map((habit, i) => (
                            <ListItem key={i}>
                              <span className="text-amber-700">{habit}</span>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Text className="mt-2 text-zinc-500">No issues identified</Text>
                      )}
                    </div>
                  </div>
                </Card>
              </Grid>

              {/* Key Findings */}
              {aiAnalysis.keyFindings?.length > 0 && (
                <Card>
                  <Title>Key Findings</Title>
                  <div className="mt-4 space-y-3">
                    {aiAnalysis.keyFindings.map((finding, i) => (
                      <Callout
                        key={i}
                        title={finding.title}
                        icon={
                          finding.type === 'positive' ? CheckCircle :
                          finding.type === 'warning' ? AlertTriangle : Lightbulb
                        }
                        color={
                          finding.type === 'positive' ? 'emerald' :
                          finding.type === 'warning' ? 'amber' : 'blue'
                        }
                      >
                        {finding.description}
                      </Callout>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </TabPanel>

          {/* Recommendations Panel */}
          <TabPanel>
            <div className="mt-4 space-y-4">
              {aiAnalysis.recommendations?.length > 0 ? (
                aiAnalysis.recommendations.map((rec, i) => (
                  <Card key={i} className="relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      rec.priority === 'now' ? 'bg-red-500' :
                      rec.priority === 'soon' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div className="pl-3">
                      <Flex>
                        <Title className="text-base">{rec.action}</Title>
                        <Badge color={
                          rec.priority === 'now' ? 'red' :
                          rec.priority === 'soon' ? 'amber' : 'blue'
                        }>
                          {rec.priority}
                        </Badge>
                      </Flex>
                      <Text className="mt-1">{rec.reasoning}</Text>
                    </div>
                  </Card>
                ))
              ) : (
                <Callout title="No specific recommendations" icon={CheckCircle} color="emerald">
                  Your task management looks healthy! Keep up the good work.
                </Callout>
              )}

              {/* Stale Tasks for Archival */}
              {stats.stalestTasks.length > 0 && (
                <Card>
                  <Title className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Consider Archiving
                  </Title>
                  <Text>These tasks have been sitting for over 90 days</Text>
                  <List className="mt-4">
                    {stats.stalestTasks.map((task) => (
                      <ListItem key={task.id}>
                        <button
                          onClick={() => onTaskClick?.(task.id)}
                          className="text-left hover:text-danny-600 transition-colors flex items-center gap-2 group"
                        >
                          <span className="truncate max-w-md">{task.content}</span>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <Badge color="red">{task.ageInDays}d old</Badge>
                      </ListItem>
                    ))}
                  </List>
                </Card>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Footer */}
      <Text className="text-center text-zinc-400 text-sm">
        Generated {new Date(insights.generatedAt).toLocaleString()}
      </Text>
    </div>
  );
}

export default InsightsView;
