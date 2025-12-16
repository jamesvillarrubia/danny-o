/**
 * Labels Hook
 * 
 * Fetches and manages label data from the API.
 */

import { useState, useEffect, useCallback } from 'react';

export interface Label {
  id: string;
  name: string;
  color?: string;
}

export interface ListLabelsResponse {
  labels: Label[];
}

export const useLabels = () => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem('danny_api_key');
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/v1/labels`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: ListLabelsResponse = await response.json();
      setLabels(data.labels);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch labels');
      setLabels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Get just the label names for easy lookup
  const labelNames = labels.map(l => l.name);

  return { labels, labelNames, isLoading, error, refetch: fetchLabels };
};
