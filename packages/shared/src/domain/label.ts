/**
 * Label Domain Types
 */

/**
 * Label interface
 */
export interface Label {
  id: string;
  name: string;
  color?: string;
  order?: number;
  isFavorite?: boolean;
}
