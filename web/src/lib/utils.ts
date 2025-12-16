/**
 * Utility functions for Tremor Raw components
 * 
 * Provides class merging and other common utilities.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes intelligently
 * Handles conflicts by letting later values override earlier ones
 */
export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
