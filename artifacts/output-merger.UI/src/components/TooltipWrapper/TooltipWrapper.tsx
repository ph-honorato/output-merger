import * as React from "react";
import Tooltip from "@mui/material/Tooltip";
import type { TooltipProps } from "@mui/material/Tooltip";

interface TooltipWrapperProps extends Omit<TooltipProps, "children"> {
  children: React.ReactElement;
}

/**
 * Wrapper around MUI Tooltip that prevents prop forwarding to the child element
 * by using a span wrapper with the necessary accessibility props.
 */
export function TooltipWrapper({
  children,
  title,
  placement = "right",
  disableHoverListener = false,
  disableFocusListener = false,
  ...otherProps
}: TooltipWrapperProps) {
  return (
    <Tooltip
      title={title}
      placement={placement}
      disableHoverListener={disableHoverListener}
      disableFocusListener={disableFocusListener}
      {...otherProps}
    >
      {children}
    </Tooltip>
  );
}
