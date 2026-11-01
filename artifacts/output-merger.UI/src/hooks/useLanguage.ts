import { useTranslation } from 'react-i18next';
import { i18n } from '@translation';
import { useState, useCallback } from 'react';

export type LanguageCode = 'en-US' | 'pt-BR';

interface LanguageOption {
  code: LanguageCode;
  label: string;
}

// Read language directly from localStorage for reliable initial state
const getInitialLanguage = (): LanguageCode => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('language');
    if (stored === 'en-US' || stored === 'pt-BR') {
      return stored;
    }
  }
  return 'en-US';
};

export const useLanguage = () => {
  const { t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(getInitialLanguage);

  const changeLanguage = useCallback((language: LanguageCode) => {
    try {
      // Update i18next language
      i18n.changeLanguage(language === 'en-US' ? 'en' : 'pt');
      
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('language', language);
      }
      
      // Update local state immediately for responsive UI
      setCurrentLanguage(language);
    } catch (error) {
      console.error('Error changing language:', error);
      // Fallback to default language
      i18n.changeLanguage('en');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('language', 'en-US');
      }
      setCurrentLanguage('en-US');
    }
  }, []);

  const getAvailableLanguages = useCallback((): LanguageOption[] => [
    { code: 'en-US', label: t('language.english') },
    { code: 'pt-BR', label: t('language.portuguese') }
  ], [t]);

  return {
    t,
    currentLanguage,
    availableLanguages: getAvailableLanguages(),
    changeLanguage
  };
};