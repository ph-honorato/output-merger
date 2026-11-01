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
  const { mode, setTheme } = useThemeContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);

  const handleConfigMenuToggle = useCallback(() => {
    setIsConfigMenuOpen((prev) => !prev);
  }, []);

  const handleConfigMenuClose = useCallback(() => {
    setIsConfigMenuOpen(false);
  }, []);

  const handleLanguageChange = useCallback(
    (language: LanguageCode) => {
      changeLanguage(language);
      // Don't close config menu when language changes
    },
    [changeLanguage],
  );

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleThemeChange = useCallback(
    (isDark: boolean) => {
      setTheme(isDark ? "dark" : "light");
      // Don't close config menu when theme changes
    },
    [setTheme],
  );

  return {
    t,
    currentLanguage,
    availableLanguages,
    isConfigMenuOpen,
    mobileMenuOpen,
    isDarkMode: mode === "dark",
    handleConfigMenuToggle,
    handleConfigMenuClose,
    handleLanguageChange,
    handleMobileMenuToggle,
    handleMobileMenuClose,
    handleThemeChange,
  };
};