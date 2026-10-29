import { useState, useCallback } from "react";
import { useLanguage, type LanguageCode } from "../../hooks/useLanguage";
import { useThemeContext } from "../../context/ThemeContext";

/**
 * Hook for managing the Header component logic
 * @returns {Object} Object containing header state and handlers
 */
export const useHeader = () => {
  const { t, currentLanguage, availableLanguages, changeLanguage } =
    useLanguage();
  console.log("currentLanguage: ", currentLanguage);
  const { mode, toggleTheme } = useThemeContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);

  const handleConfigMenuOpen = useCallback(() => {
    setIsConfigMenuOpen(true);
  }, []);

  const handleConfigMenuClose = useCallback(() => {
    setIsConfigMenuOpen(false);
  }, []);

  const handleLanguageChange = useCallback(
    (language: LanguageCode) => {
      changeLanguage(language);
      handleConfigMenuClose();
    },
    [changeLanguage, handleConfigMenuClose],
  );

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    handleConfigMenuClose();
  }, [toggleTheme, handleConfigMenuClose]);

  return {
    t,
    currentLanguage,
    availableLanguages,
    isConfigMenuOpen,
    mobileMenuOpen,
    isDarkMode: mode === "dark",
    handleConfigMenuOpen,
    handleConfigMenuClose,
    handleLanguageChange,
    handleMobileMenuToggle,
    handleMobileMenuClose,
    handleThemeToggle,
  };
};
