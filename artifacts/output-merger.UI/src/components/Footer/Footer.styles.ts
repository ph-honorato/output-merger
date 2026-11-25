import styled from "styled-components";
import { type StyledTheme, MOBILE_MAX_WIDTH } from "@theme";

export const StyledFooter = styled.footer`
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-top: 1px solid
    ${({ theme }) => (theme as StyledTheme).palette.divider};
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)} 0;
  margin-top: auto;
`;

export const FooterContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const GitHubLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  }

  @media (max-width: ${MOBILE_MAX_WIDTH}px) {
    /* keep centered */
  }
`;

export const GitHubLabel = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
`;