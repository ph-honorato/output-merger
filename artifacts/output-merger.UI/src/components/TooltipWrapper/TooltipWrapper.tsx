import * as React from "react";
import Tooltip from "@mui/material/Tooltip";
import type { TooltipProps } from "@mui/material/Tooltip";

interface TooltipWrapperProps extends Omit<TooltipProps, "children"> {
  children: React.ReactElement;
  anchorOrigin?: {
    vertical: "top" | "center" | "bottom";
    horizontal: "left" | "center" | "right";
  };
  transformOrigin?: {
    vertical: "top" | "center" | "bottom";
    horizontal: "left" | "center" | "right";
  };
}

/**
 * Wrapper around MUI Tooltip that prevents prop forwarding to the child element
 * by using a span wrapper with the necessary accessibility props.
 */
export function TooltipWrapper({
  children,
  title,
  placement = "right",
  anchorOrigin = { vertical: "center", horizontal: "right" },
  transformOrigin = { vertical: "center", horizontal: "left" },
  disableHoverListener = false,
  disableFocusListener = false,
  ...otherProps
}: TooltipWrapperProps) {
  return (
    <Tooltip
      title={title}
      placement={placement}
      PopperProps={{
        anchorOrigin,
        transformOrigin,
      }}
      disableHoverListener={disableHoverListener}
      disableFocusListener={disableFocusListener}
      {...otherProps}
    >
      {children}
    </Tooltip>
  );
}
