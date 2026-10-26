import styled from "styled-components";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

export const StyledHeader = styled.header`
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-bottom: 1px solid
    ${({ theme }) => (theme as StyledTheme).palette.divider};
  box-shadow: ${({ theme }) => (theme as StyledTheme).shadows[1]};
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => (theme as StyledTheme).zIndex.appBar};
`;

export const StyledToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  flex-wrap: wrap;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(0, 2)};
  min-height: 64px;
`;

export const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1.5)};
  flex-shrink: 0;
`;

export const LogoIcon = styled.img.attrs({
  src: "/om-logo.svg",
  alt: "Logo",
})`
  width: 30px;
  height: auto;
  object-fit: contain;
`;

export const LogoText = styled.h1`
  font-weight: 700;
  font-size: 1.5rem;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: nowrap;
  margin: 0;

  @media (max-width: 600px) {
    font-size: 1.25rem;
  }
`;

export const LanguageSelectorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  flex-shrink: 0;
  position: relative;
`;

export const LanguageMenuButton = styled.button`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => (theme as StyledTheme).shape.borderRadius}px;
  color: ${({ theme }) => (theme as StyledTheme).palette.action.active};

  &:hover {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.hover};
  }
`;

export const LanguageMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-radius: ${({ theme }) => (theme as StyledTheme).shape.borderRadius}px;
  box-shadow: ${({ theme }) => (theme as StyledTheme).shadows[4]};
  min-width: 180px;
  z-index: 1000;
`;

export const LanguageMenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1.5)};
  padding: ${({ theme }) => (theme as StyledTheme).spacing(1, 2)};
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 0.875rem;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};

  &:hover {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.hover};
  }

  &.selected {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.selected};
    font-weight: 600;
  }
`;

export const LanguageFlag = styled.span`
  font-size: 1.25rem;
  line-height: 1;
`;

export const LanguageName = styled.span`
  font-weight: 500;
`;

export const MobileMenuButton = styled.button`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => (theme as StyledTheme).shape.borderRadius}px;
  color: ${({ theme }) => (theme as StyledTheme).palette.action.active};

  &:hover {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.hover};
  }

  @media (min-width: 600px) {
    display: none;
  }
`;

export const DesktopActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};

  @media (max-width: 599px) {
    display: none;
  }
`;

export const MobileActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};

  @media (min-width: 600px) {
    display: none;
  }
`;

export const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-radius: ${({ theme }) => (theme as StyledTheme).shape.borderRadius}px;
  box-shadow: ${({ theme }) => (theme as StyledTheme).shadows[4]};
  min-width: 180px;
  z-index: 1000;
`;
