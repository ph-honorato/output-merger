import { useState } from "react";

/**
 * Hook for managing the Example component logic
 * @returns {Object} Object containing clickCount and handleClick
 * @returns {number} clickCount - The current count of button clicks
 * @returns {() => void} handleClick - Function to handle button click events
 */
export const useExample = () => {
  const [clickCount, setClickCount] = useState<number>(0);

  /**
   * Handles button click event and increments the counter
   */
  const handleClick = () => {
    setClickCount((prev) => prev + 1);
  };

  return {
    clickCount,
    handleClick,
  };
};
