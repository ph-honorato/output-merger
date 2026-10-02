import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './resources/en-US.json';
import ptBR from './resources/pt-BR.json';

// Get language from localStorage or default to en-US
const getStoredLanguage = (): 'en-US' | 'pt-BR' => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('language');
    if (stored === 'en-US' || stored === 'pt-BR') {
      return stored;
    }
  }
  return 'en-US';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enUS
      },
      pt: {
        translation: ptBR
      }
    },
    lng: getStoredLanguage(),
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;