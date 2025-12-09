/**
 * Select Component
 * 
 * Reusable styled select/dropdown with consistent appearance across browsers.
 * Uses appearance-none with a custom chevron icon for consistent styling.
 */

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Size variant - 'sm' for compact inline editing, 'default' for forms */
  size?: 'sm' | 'default';
}

/**
 * Styled select component with custom dropdown arrow
 * 
 * @example
 * // Default size (for forms)
 * <Select value={priority} onChange={handleChange}>
 *   <option value="1">Low</option>
 *   <option value="2">Medium</option>
 * </Select>
 * 
 * @example
 * // Small size (for inline editing)
 * <Select size="sm" value={project} onChange={handleChange}>
 *   <option value="">No Project</option>
 *   <option value="proj1">Project 1</option>
 * </Select>
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = 'default', className, children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-2 py-1 pr-7 text-sm rounded',
      default: 'px-3 py-2 pr-10 rounded-lg',
    };

    const iconSizeClasses = {
      sm: 'right-2 w-3.5 h-3.5',
      default: 'right-3 w-4 h-4',
    };

    return (
      <div className="relative">
        <select
          ref={ref}
          className={clsx(
            'w-full border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-danny-500 focus:border-transparent cursor-pointer appearance-none bg-white',
            sizeClasses[size],
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown 
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none',
            iconSizeClasses[size]
          )} 
        />
      </div>
    );
  }
);

Select.displayName = 'Select';
