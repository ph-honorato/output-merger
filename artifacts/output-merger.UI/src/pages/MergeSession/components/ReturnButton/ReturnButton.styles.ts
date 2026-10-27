import styled from "styled-components";
import Button from "@mui/material/Button";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

/**
 * The Return button: the Start Merge visual (contained, primary
 * blue, rounded) so the ActionsBar slot keeps one look across the
 * swap.
 */
export const ReturnButtonRoot = styled(Button)`
  background-color: #0080ff;
  color: #ffffff;
  font-weight: 600;
  border-radius: 0.75rem;
  padding: 12px;
  box-shadow: none;

  &:hover {
    background-color: #0073e6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &.Mui-disabled {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.disabledBackground};
    color: ${({ theme }) => (theme as StyledTheme).palette.action.disabled};
  }
`;
