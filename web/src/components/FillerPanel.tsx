/**
 * Filler Panel Component
 * 
 * Shows task suggestions based on available time buckets.
 * Helps answer: "I have X minutes, what should I do?"
 * 
 * Features:
 * - Time-bucketed suggestions (15min, 30min, 45min, 1hr)
 * - Priority-sorted within buckets
 * - Combination suggestions (e.g., 2x 15min tasks for 30min slot)
 * - "Brain Break" mode for creative/research tasks
 * - Prompt to generate estimates for tasks without them
 */

import { useState, useMemo, useCallback } from 'react';
import { 
  Clock, 
  Zap, 
  Coffee, 
  Lightbulb, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../types';

interface FillerPanelProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskSelect: (task: Task) => void;
  onGenerateEstimates?: () => void;
  isGeneratingEstimates?: boolean;
}

interface TimeBucket {
  label: string;
  minutes: number;
  icon: React.ReactNode;
  description: string;
}

interface TaskSuggestion {
  tasks: Task[];
  totalMinutes: number;
  isCombination: boolean;
}

const TIME_BUCKETS: TimeBucket[] = [
  { label: '15 minutes', minutes: 15, icon: <Zap className="w-4 h-4" />, description: 'Quick wins' },
  { label: '30 minutes', minutes: 30, icon: <Clock className="w-4 h-4" />, description: 'Focused work' },
  { label: '45 minutes', minutes: 45, icon: <Coffee className="w-4 h-4" />, description: 'Deep dive' },
  { label: '1 hour', minutes: 60, icon: <Lightbulb className="w-4 h-4" />, description: 'Major progress' },
];

/**
 * Get suggestions for a time bucket, including combinations
 */
function getSuggestionsForBucket(
  tasks: Task[], 
  targetMinutes: number, 
  maxSuggestions: number = 3
): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];
  const tolerance = 5; // Allow 5 minute variance
  
  // Sort tasks by priority (4 = highest) then by estimate (smaller first for combinations)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aMin = a.metadata?.timeEstimateMinutes || 0;
    const bMin = b.metadata?.timeEstimateMinutes || 0;
    return aMin - bMin;
  });
  
  // First, find exact matches (single tasks that fit the bucket)
  const exactMatches = sortedTasks.filter(t => {
    const est = t.metadata?.timeEstimateMinutes || 0;
    return est > 0 && est >= targetMinutes - tolerance && est <= targetMinutes + tolerance;
  });
  
  for (const task of exactMatches.slice(0, maxSuggestions)) {
    suggestions.push({
      tasks: [task],
      totalMinutes: task.metadata?.timeEstimateMinutes || 0,
      isCombination: false,
    });
  }
  
  // If we don't have enough suggestions, look for combinations
  if (suggestions.length < maxSuggestions && targetMinutes >= 30) {
    const usedTaskIds = new Set(suggestions.flatMap(s => s.tasks.map(t => t.id)));
    const availableTasks = sortedTasks.filter(t => 
      !usedTaskIds.has(t.id) && 
      (t.metadata?.timeEstimateMinutes || 0) > 0 &&
      (t.metadata?.timeEstimateMinutes || 0) < targetMinutes
    );
    
    // Try to find pairs that sum to target
    for (let i = 0; i < availableTasks.length && suggestions.length < maxSuggestions; i++) {
      const task1 = availableTasks[i];
      const time1 = task1.metadata?.timeEstimateMinutes || 0;
      
      for (let j = i + 1; j < availableTasks.length && suggestions.length < maxSuggestions; j++) {
        const task2 = availableTasks[j];
        const time2 = task2.metadata?.timeEstimateMinutes || 0;
        const total = time1 + time2;
        
        if (total >= targetMinutes - tolerance && total <= targetMinutes + tolerance) {
          // Check if this combination hasn't been added yet
          const combo = [task1, task2];
          const comboIds = combo.map(t => t.id).sort().join(',');
          const isDuplicate = suggestions.some(s => 
            s.tasks.map(t => t.id).sort().join(',') === comboIds
          );
          
          if (!isDuplicate) {
            suggestions.push({
              tasks: combo,
              totalMinutes: total,
              isCombination: true,
            });
          }
        }
      }
    }
  }
  
  return suggestions.slice(0, maxSuggestions);
}

/**
 * Find "brain break" tasks - creative, research, or inspirational tasks
 */
function getBrainBreakTasks(tasks: Task[], limit: number = 5): Task[] {
  const brainBreakKeywords = [
    'research', 'explore', 'learn', 'read', 'watch', 'listen',
    'brainstorm', 'idea', 'think about', 'plan', 'design',
    'experiment', 'try', 'discover', 'investigate', 'review'
  ];
  
  const brainBreakTasks = tasks.filter(t => {
    const content = t.content.toLowerCase();
    const description = (t.description || '').toLowerCase();
    const combined = content + ' ' + description;
    
    return brainBreakKeywords.some(keyword => combined.includes(keyword));
  });
  
  // Sort by priority and return top results
  return brainBreakTasks
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

export function FillerPanel({ 
  tasks, 
  isLoading, 
  onTaskSelect, 
  onGenerateEstimates,
  isGeneratingEstimates 
}: FillerPanelProps) {
  const [expandedBuckets, setExpandedBuckets] = useState<Set<number>>(new Set([15, 30]));
  const [showBrainBreak, setShowBrainBreak] = useState(false);

  // Separate tasks with and without estimates
  const { tasksWithEstimates, tasksWithoutEstimates } = useMemo(() => {
    const withEstimates: Task[] = [];
    const withoutEstimates: Task[] = [];
    
    for (const task of tasks) {
      if (!task.isCompleted) {
        if (task.metadata?.timeEstimateMinutes && task.metadata.timeEstimateMinutes > 0) {
          withEstimates.push(task);
        } else {
          withoutEstimates.push(task);
        }
      }
    }
    
    return { tasksWithEstimates: withEstimates, tasksWithoutEstimates: withoutEstimates };
  }, [tasks]);

  // Get suggestions for each bucket
  const bucketSuggestions = useMemo(() => {
    const result: Map<number, TaskSuggestion[]> = new Map();
    
    for (const bucket of TIME_BUCKETS) {
      result.set(bucket.minutes, getSuggestionsForBucket(tasksWithEstimates, bucket.minutes));
    }
    
    return result;
  }, [tasksWithEstimates]);

  // Get brain break tasks
  const brainBreakTasks = useMemo(() => {
    return getBrainBreakTasks(tasks);
  }, [tasks]);

  const toggleBucket = useCallback((minutes: number) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(minutes)) {
        next.delete(minutes);
      } else {
        next.add(minutes);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-danny-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 bg-gradient-to-r from-danny-50 to-orange-50">
        <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-danny-500" />
          Time Filler
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Got a few minutes? Here's what you could tackle.
        </p>
      </div>

      {/* Missing Estimates Warning */}
      {tasksWithoutEstimates.length > 0 && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800">
                {tasksWithoutEstimates.length} task{tasksWithoutEstimates.length !== 1 ? 's' : ''} without time estimates
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Generate estimates to get better suggestions.
              </p>
              {onGenerateEstimates && (
                <button
                  onClick={onGenerateEstimates}
                  disabled={isGeneratingEstimates}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingEstimates ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Generate Estimates
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Buckets */}
      <div className="px-4 py-3 space-y-2">
        {TIME_BUCKETS.map((bucket) => {
          const suggestions = bucketSuggestions.get(bucket.minutes) || [];
          const isExpanded = expandedBuckets.has(bucket.minutes);
          const hasSuggestions = suggestions.length > 0;

          return (
            <div 
              key={bucket.minutes}
              className={clsx(
                'border rounded-lg transition-all',
                hasSuggestions ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50'
              )}
            >
              {/* Bucket Header */}
              <button
                onClick={() => toggleBucket(bucket.minutes)}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer rounded-lg"
              >
                <span className={clsx(
                  'p-1.5 rounded-md',
                  hasSuggestions ? 'bg-danny-100 text-danny-600' : 'bg-zinc-100 text-zinc-400'
                )}>
                  {bucket.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'text-sm font-medium',
                      hasSuggestions ? 'text-zinc-900' : 'text-zinc-500'
                    )}>
                      {bucket.label}
                    </span>
                    {hasSuggestions && (
                      <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{bucket.description}</p>
                </div>
                {hasSuggestions && (
                  isExpanded 
                    ? <ChevronDown className="w-4 h-4 text-zinc-400" />
                    : <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {/* Suggestions */}
              {isExpanded && hasSuggestions && (
                <div className="px-3 pb-3 space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <SuggestionCard
                      key={idx}
                      suggestion={suggestion}
                      onTaskSelect={onTaskSelect}
                    />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {isExpanded && !hasSuggestions && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-zinc-400 italic">
                    No tasks fit this time slot yet.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Brain Break Section */}
      {brainBreakTasks.length > 0 && (
        <div className="px-4 pb-4">
          <div className="border border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
            {/* Brain Break Header */}
            <button
              onClick={() => setShowBrainBreak(!showBrainBreak)}
              className="w-full px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer rounded-lg"
            >
              <span className="p-1.5 rounded-md bg-purple-100 text-purple-600">
                <Coffee className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-purple-900">
                    Brain Break
                  </span>
                  <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                    {brainBreakTasks.length} task{brainBreakTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-purple-600">
                  Creative, research, or exploratory tasks
                </p>
              </div>
              {showBrainBreak 
                ? <ChevronDown className="w-4 h-4 text-purple-400" />
                : <ChevronRight className="w-4 h-4 text-purple-400" />
              }
            </button>

            {/* Brain Break Tasks */}
            {showBrainBreak && (
              <div className="px-3 pb-3 space-y-1.5">
                {brainBreakTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskSelect(task)}
                    className="w-full px-3 py-2 text-left bg-white border border-purple-100 rounded-md hover:bg-purple-50 transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-zinc-800 line-clamp-1">{task.content}</p>
                    {task.metadata?.timeEstimate && (
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.metadata.timeEstimate}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasksWithEstimates.length === 0 && tasksWithoutEstimates.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 px-4">
          <Clock className="w-12 h-12 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-center">No tasks available</p>
          <p className="text-xs mt-1 text-center">
            Add some tasks to get time-based suggestions
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Suggestion Card - displays a single suggestion (possibly with multiple tasks)
 */
interface SuggestionCardProps {
  suggestion: TaskSuggestion;
  onTaskSelect: (task: Task) => void;
}

function SuggestionCard({ suggestion, onTaskSelect }: SuggestionCardProps) {
  const { tasks, totalMinutes } = suggestion;

  if (tasks.length === 1) {
    const task = tasks[0];
    return (
      <button
        onClick={() => onTaskSelect(task)}
        className="w-full px-3 py-2 text-left bg-zinc-50 border border-zinc-100 rounded-md hover:bg-danny-50 hover:border-danny-200 transition-colors cursor-pointer"
      >
        <p className="text-sm text-zinc-800 line-clamp-2">{task.content}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.metadata?.timeEstimate || `${task.metadata?.timeEstimateMinutes}min`}
          </span>
          {task.priority >= 3 && (
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded',
              task.priority === 4 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
            )}>
              {task.priority === 4 ? 'Urgent' : 'High'}
            </span>
          )}
        </div>
      </button>
    );
  }

  // Combination suggestion
  return (
    <div className="px-3 py-2 bg-gradient-to-r from-zinc-50 to-blue-50 border border-zinc-200 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3 h-3 text-blue-500" />
        <span className="text-xs font-medium text-blue-700">
          Combo: {totalMinutes}min total
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onTaskSelect(task)}
            className="w-full px-2 py-1.5 text-left bg-white border border-zinc-100 rounded hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <p className="text-xs text-zinc-800 line-clamp-1">{task.content}</p>
            <span className="text-xs text-zinc-500">
              {task.metadata?.timeEstimate || `${task.metadata?.timeEstimateMinutes}min`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
