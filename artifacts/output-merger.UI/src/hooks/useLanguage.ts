import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

export type LanguageCode = 'en-US' | 'pt-BR';

interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export const useLanguage = () => {
  const { t } = useTranslation();

  const changeLanguage = (language: LanguageCode) => {
    try {
      // Update i18next language
      i18n.changeLanguage(language === 'en-US' ? 'en' : 'pt');
      
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('language', language);
      }
    } catch (error) {
      console.error('Error changing language:', error);
      // Fallback to default language
      i18n.changeLanguage('en');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('language', 'en-US');
      }
    }
  };

  const getCurrentLanguage = (): LanguageCode => {
    const lng = i18n.language;
    return lng === 'en' ? 'en-US' : 'pt-BR';
  };

  const getAvailableLanguages = (): LanguageOption[] => [
    { code: 'en-US', label: t('language.english') },
    { code: 'pt-BR', label: t('language.portuguese') }
  ];

  return {
    t,
    currentLanguage: getCurrentLanguage(),
    availableLanguages: getAvailableLanguages(),
    changeLanguage
  };
};