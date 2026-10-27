import styled from "styled-components";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

export const Title = styled(DialogTitle)`
  text-align: left;
`;

export const Content = styled(DialogContent)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(2)};
`;

export const Message = styled.p`
  margin: 0;
  text-align: left;
`;

export const Actions = styled(DialogActions)`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
`;

export const CancelButton = styled(Button)``;

export const ConfirmButton = styled(Button)`
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
