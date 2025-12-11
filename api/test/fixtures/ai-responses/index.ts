/**
 * Static AI Response Fixtures
 * 
 * These fixtures provide deterministic responses for AI operations in tests.
 * Used by MockClaudeService to return consistent results without per-test setup.
 */

import classifyFixture from './classify.json';
import estimateFixture from './estimate.json';
import prioritizeFixture from './prioritize.json';
import breakdownFixture from './breakdown.json';
import insightsFixture from './insights.json';
import dailyPlanFixture from './daily-plan.json';
import searchFixture from './search.json';

export type AIPromptType = 
  | 'classify'
  | 'estimate'
  | 'prioritize'
  | 'breakdown'
  | 'insights'
  | 'daily-plan'
  | 'search';

export interface AIFixture {
  description: string;
  promptType: AIPromptType;
  response: any;
}

/**
 * All static AI response fixtures
 */
export const aiFixtures: Record<AIPromptType, AIFixture> = {
  classify: classifyFixture as AIFixture,
  estimate: estimateFixture as AIFixture,
  prioritize: prioritizeFixture as AIFixture,
  breakdown: breakdownFixture as AIFixture,
  insights: insightsFixture as AIFixture,
  'daily-plan': dailyPlanFixture as AIFixture,
  search: searchFixture as AIFixture,
};

/**
 * Get the response for a specific prompt type
 */
export function getAIResponse<T = any>(promptType: AIPromptType): T {
  const fixture = aiFixtures[promptType];
  if (!fixture) {
    throw new Error(`No fixture found for prompt type: ${promptType}`);
  }
  return fixture.response as T;
}

/**
 * Detect prompt type from prompt content
 */
export function detectPromptType(prompt: string): AIPromptType | null {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('classify') || lowerPrompt.includes('categorize')) {
    return 'classify';
  }
  if (lowerPrompt.includes('estimate') || lowerPrompt.includes('duration') || lowerPrompt.includes('how long')) {
    return 'estimate';
  }
  if (lowerPrompt.includes('prioritize') || lowerPrompt.includes('priority') || lowerPrompt.includes('order')) {
    return 'prioritize';
  }
  if (lowerPrompt.includes('subtask') || lowerPrompt.includes('break down') || lowerPrompt.includes('breakdown')) {
    return 'breakdown';
  }
  if (lowerPrompt.includes('insight') || lowerPrompt.includes('productivity') || lowerPrompt.includes('analyze patterns')) {
    return 'insights';
  }
  if (lowerPrompt.includes('plan') || lowerPrompt.includes('schedule') || lowerPrompt.includes('daily plan')) {
    return 'daily-plan';
  }
  if (lowerPrompt.includes('filter') || lowerPrompt.includes('search') || lowerPrompt.includes('find')) {
    return 'search';
  }
  
  return null;
}

export default aiFixtures;
