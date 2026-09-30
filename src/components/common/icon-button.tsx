import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface IconButtonProps extends ButtonProps {
  label: string;
  tooltip?: boolean;
}

/** Icon-only button with a mandatory accessible label and optional tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip = true, size = "icon-sm", variant = "ghost", children, ...props }, ref) => {
    const button = (
      <Button ref={ref} size={size} variant={variant} aria-label={label} {...props}>
        {children}
      </Button>
    );
    if (!tooltip) return button;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }
);
IconButton.displayName = "IconButton";
