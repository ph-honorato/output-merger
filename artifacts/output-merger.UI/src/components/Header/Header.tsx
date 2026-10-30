import { useTranslation } from "react-i18next";
import { useRef, useEffect } from "react";
import { Menu as MenuIcon, Settings, Brightness4, LightMode } from "@mui/icons-material";
import { Container } from "@mui/material";
import Switch from "@mui/material/Switch";
import { useHeader } from "./Header.hook";
import { type HeaderProps } from "./Header.types";
import * as S from "./Header.styles";

const LANGUAGE_FLAGS: Record<"en-US" | "pt-BR", string> = {
  "en-US": "🇺🇸",
  "pt-BR": "🇧🇷",
};

function Header(props: HeaderProps) {
  const { className } = props;
  const { t } = useTranslation();
  const configMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const {
    currentLanguage,
    availableLanguages,
    isConfigMenuOpen,
    mobileMenuOpen,
    isDarkMode,
    handleConfigMenuToggle,
    handleConfigMenuClose,
    handleLanguageChange,
    handleMobileMenuToggle,
    handleMobileMenuClose,
    handleThemeChange,
  } = useHeader();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        configMenuRef.current &&
        !configMenuRef.current.contains(event.target as Node)
      ) {
        handleConfigMenuClose();
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        handleMobileMenuClose();
      }
    };

    if (isConfigMenuOpen || mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isConfigMenuOpen,
    mobileMenuOpen,
    handleConfigMenuClose,
    handleMobileMenuClose,
  ]);

  const handleKeyDown = (
    event: React.KeyboardEvent,
    language: "en-US" | "pt-BR",
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleLanguageChange(language);
    }
  };

  const handleThemeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleThemeChange(!isDarkMode);
    }
  };

  return (
    <S.StyledHeader className={className}>
      <Container maxWidth="xl">
        <S.StyledToolbar>
          {/* Logo Section */}
          <S.LogoContainer>
            <S.LogoIcon alt={t("app.title")} />
          </S.LogoContainer>

          {/* Desktop Actions */}
          <S.DesktopActions>
            <S.ConfigSelectorContainer ref={configMenuRef}>
              <S.ConfigMenuButton
                onClick={handleConfigMenuToggle}
                aria-label={t("config.selector")}
                aria-expanded={isConfigMenuOpen}
                aria-haspopup="true"
                data-testid="config-selector-button"
              >
                <Settings fontSize="large" color="action" />
              </S.ConfigMenuButton>

              {isConfigMenuOpen && (
                <S.ConfigMenu
                  id="config-menu"
                  role="menu"
                  aria-label={t("config.selector")}
                  data-testid="config-menu"
                >
                  {/* Language Section */}
                  <div style={{ padding: "8px 0" }}>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--mui-palette-text-secondary)",
                        margin: "0 0 8px 16px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {t("language.selector")}
                    </p>
                    {availableLanguages.map((lang) => (
                      <S.ConfigMenuItem
                        key={lang.code}
                        className={currentLanguage === lang.code ? "selected" : ""}
                        onClick={() => handleLanguageChange(lang.code)}
                        onKeyDown={(e) => handleKeyDown(e, lang.code)}
                        role="menuitem"
                        tabIndex={-1}
                        data-testid={`config-language-option-${lang.code}`}
                      >
                        <S.LanguageFlag>
                          {LANGUAGE_FLAGS[lang.code]}
                        </S.LanguageFlag>
                        <S.LanguageName>{lang.label}</S.LanguageName>
                      </S.ConfigMenuItem>
                    ))}
                  </div>

                  <S.ConfigMenuDivider />

                  {/* Dark Mode Toggle with Switch */}
                  <S.ConfigMenuItem
                    role="menuitem"
                    tabIndex={-1}
                    data-testid="config-darkmode-toggle"
                    style={{ padding: "8px 16px" }}
                    onClick={(e) => e.stopPropagation()} // Prevent menu item click from triggering
                  >
                    <S.ConfigMenuIcon>
                      {isDarkMode ? <LightMode fontSize="small" /> : <Brightness4 fontSize="small" />}
                    </S.ConfigMenuIcon>
                    <S.ConfigMenuLabel>{t("config.darkMode")}</S.ConfigMenuLabel>
                    <S.ConfigSwitchWrapper>
                      <Switch
                        checked={isDarkMode}
                        onChange={(e) => handleThemeChange(e.target.checked)}
                        onKeyDown={handleThemeKeyDown}
                        tabIndex={0}
                        aria-label={t("config.darkMode")}
                        data-testid="config-darkmode-switch"
                        color="primary"
                      />
                    </S.ConfigSwitchWrapper>
                  </S.ConfigMenuItem>
                </S.ConfigMenu>
              )}
            </S.ConfigSelectorContainer>
          </S.DesktopActions>

          {/* Mobile Menu Button */}
          <S.MobileMenuButton
            onClick={handleMobileMenuToggle}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            data-testid="mobile-menu-button"
          >
            <MenuIcon fontSize="large" />
          </S.MobileMenuButton>
        </S.StyledToolbar>

        {/* Mobile Menu */}
        <S.MobileActions
          role="navigation"
          aria-label="Mobile menu"
          ref={mobileMenuRef}
        >
          {mobileMenuOpen && (
            <S.MobileMenu
              role="menu"
              aria-label={t("config.selector")}
              data-testid="mobile-menu"
            >
              <div style={{ padding: "8px 16px" }}>
                {/* Language Section */}
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--mui-palette-text-secondary)",
                    margin: "0 0 8px 0",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t("language.selector")}
                </p>
                {availableLanguages.map((lang) => (
                  <S.ConfigMenuItem
                    key={lang.code}
                    className={currentLanguage === lang.code ? "selected" : ""}
                    onClick={() => handleLanguageChange(lang.code)}
                    onKeyDown={(e) => handleKeyDown(e, lang.code)}
                    role="menuitem"
                    tabIndex={-1}
                    data-testid={`mobile-language-option-${lang.code}`}
                  >
                    <S.LanguageFlag>{LANGUAGE_FLAGS[lang.code]}</S.LanguageFlag>
                    <S.LanguageName>{lang.label}</S.LanguageName>
                  </S.ConfigMenuItem>
                ))}

                <S.ConfigMenuDivider style={{ margin: "12px 0" }} />

                {/* Dark Mode Toggle with Switch */}
                <S.ConfigMenuItem
                  role="menuitem"
                  tabIndex={-1}
                  data-testid="mobile-darkmode-toggle"
                  style={{ padding: "8px 16px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <S.ConfigMenuIcon>
                    {isDarkMode ? <LightMode fontSize="small" /> : <Brightness4 fontSize="small" />}
                  </S.ConfigMenuIcon>
                  <S.ConfigMenuLabel>{t("config.darkMode")}</S.ConfigMenuLabel>
                  <S.ConfigSwitchWrapper>
                    <Switch
                      checked={isDarkMode}
                      onChange={(e) => handleThemeChange(e.target.checked)}
                      onKeyDown={handleThemeKeyDown}
                      tabIndex={0}
                      aria-label={t("config.darkMode")}
                      data-testid="mobile-darkmode-switch"
                      color="primary"
                    />
                  </S.ConfigSwitchWrapper>
                </S.ConfigMenuItem>
              </div>
            </S.MobileMenu>
          )}
        </S.MobileActions>
      </Container>
    </S.StyledHeader>
  );
}

export default Header;