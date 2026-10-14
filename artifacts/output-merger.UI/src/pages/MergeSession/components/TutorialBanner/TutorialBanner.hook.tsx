import { useTranslation } from 'react-i18next';

export const TUTORIAL_DISMISSED_STORAGE_KEY = 'output-merger.tutorial.dismissed';

export const readTutorialDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(TUTORIAL_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeTutorialDismissed = (): void => {
  try {
    window.localStorage.setItem(TUTORIAL_DISMISSED_STORAGE_KEY, 'true');
  } catch {
    // Storage unavailable (privacy mode, embedded context): dismissal stays session-only.
  }
};

export const useTutorialBanner = () => {
  const { t } = useTranslation();
  return { t };
};
