/**
 * Project Domain Types
 */

/**
 * Project interface
 */
export interface Project {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  order?: number;
  commentCount?: number;
  isShared?: boolean;
  isFavorite?: boolean;
  isInboxProject?: boolean;
  isTeamInbox?: boolean;
  url?: string;
}
