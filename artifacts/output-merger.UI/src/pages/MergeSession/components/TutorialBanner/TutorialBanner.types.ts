/**
 * Props for the TutorialBanner component
 * @interface TutorialBannerProps
 */
export interface TutorialBannerProps {
  /**
   * Called when the dismiss control is clicked; the page owns
   * hiding the banner and persisting the dismissal
   */
  onDismiss: () => void;
  /**
   * Optional class name applied to the root element
   */
  className?: string;
}
