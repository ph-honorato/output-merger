import { useState, useCallback } from 'react';
import { useLanguage, type LanguageCode } from '../../hooks/useLanguage';

/**
 * Hook for managing the Header component logic
 * @returns {Object} Object containing header state and handlers
 */
export const useHeader = () => {
  const { t, currentLanguage, availableLanguages, changeLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  const handleLanguageMenuOpen = useCallback(() => {
    setIsLanguageMenuOpen(true);
  }, []);

  const handleLanguageMenuClose = useCallback(() => {
    setIsLanguageMenuOpen(false);
  }, []);

  const handleLanguageChange = useCallback((language: LanguageCode) => {
    changeLanguage(language);
    handleLanguageMenuClose();
  }, [changeLanguage, handleLanguageMenuClose]);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return {
    t,
    currentLanguage,
    availableLanguages,
    isLanguageMenuOpen,
    mobileMenuOpen,
    handleLanguageMenuOpen,
    handleLanguageMenuClose,
    handleLanguageChange,
    handleMobileMenuToggle,
    handleMobileMenuClose,
  };
};