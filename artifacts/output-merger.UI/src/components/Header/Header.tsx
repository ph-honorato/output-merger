import { useTranslation } from "react-i18next";
import { useRef, useEffect } from "react";
import { Menu as MenuIcon, Public } from "@mui/icons-material";
import { Container } from "@mui/material";
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
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const {
    currentLanguage,
    availableLanguages,
    isLanguageMenuOpen,
    mobileMenuOpen,
    handleLanguageMenuOpen,
    handleLanguageMenuClose,
    handleLanguageChange,
    handleMobileMenuToggle,
    handleMobileMenuClose,
  } = useHeader();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(event.target as Node)
      ) {
        handleLanguageMenuClose();
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        handleMobileMenuClose();
      }
    };

    if (isLanguageMenuOpen || mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isLanguageMenuOpen,
    mobileMenuOpen,
    handleLanguageMenuClose,
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
            <S.LanguageSelectorContainer ref={languageMenuRef}>
              <S.LanguageMenuButton
                onClick={handleLanguageMenuOpen}
                aria-label={t("language.selector")}
                aria-expanded={isLanguageMenuOpen}
                aria-haspopup="true"
                data-testid="language-selector-button"
              >
                <Public fontSize="large" color="action" />
              </S.LanguageMenuButton>

              {isLanguageMenuOpen && (
                <S.LanguageMenu
                  id="language-menu"
                  role="menu"
                  aria-label={t("language.selector")}
                  data-testid="language-menu"
                >
                  {availableLanguages.map((lang) => (
                    <S.LanguageMenuItem
                      key={lang.code}
                      className={
                        currentLanguage === lang.code ? "selected" : ""
                      }
                      onClick={() => handleLanguageChange(lang.code)}
                      onKeyDown={(e) => handleKeyDown(e, lang.code)}
                      role="menuitem"
                      tabIndex={-1}
                      data-testid={`language-option-${lang.code}`}
                    >
                      <S.LanguageFlag>
                        {LANGUAGE_FLAGS[lang.code]}
                      </S.LanguageFlag>
                      <S.LanguageName>{lang.label}</S.LanguageName>
                    </S.LanguageMenuItem>
                  ))}
                </S.LanguageMenu>
              )}
            </S.LanguageSelectorContainer>
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
              aria-label={t("language.selector")}
              data-testid="mobile-menu"
            >
              <div style={{ padding: "8px 16px" }}>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--mui-palette-text-secondary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  {t("language.selector")}
                </p>
                {availableLanguages.map((lang) => (
                  <S.LanguageMenuItem
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
                  </S.LanguageMenuItem>
                ))}
              </div>
            </S.MobileMenu>
          )}
        </S.MobileActions>
      </Container>
    </S.StyledHeader>
  );
}

export default Header;
