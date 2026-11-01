import type { ActionsBarAlign } from './ActionsBar.types';

/**
 * Hook for managing the ActionsBar component logic
 * @returns {Object} Object containing the derived layout value
 */
export const useActionsBar = (align: ActionsBarAlign = 'right') => {
  const justifyContent: 'flex-start' | 'flex-end' =
    align === 'left' ? 'flex-start' : 'flex-end';

  return { justifyContent };
};
