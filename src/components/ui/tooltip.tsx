import * as React from "react";
import { cn } from "@/lib/utils";

// Safe no-op Tooltip components to avoid runtime hook issues in dev.
// They preserve the API used across the app but do not render any portal content.

type ProviderProps = React.PropsWithChildren<{ delayDuration?: number; disableHoverableContent?: boolean }>; 
export const TooltipProvider: React.FC<ProviderProps> = ({ children }) => <>{children}</>;

export const Tooltip: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;

type TriggerProps = React.ComponentPropsWithoutRef<'button'> & { asChild?: boolean };
export const TooltipTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      // Pass props to child directly
      return React.cloneElement(children as React.ReactElement, {
        ref,
        ...props,
        className: cn((children as any).props?.className, className),
      });
    }
    return (
      <button ref={ref} {...props} className={className}>
        {children}
      </button>
    );
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

type ContentProps = React.ComponentPropsWithoutRef<'div'> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};
export const TooltipContent = React.forwardRef<HTMLDivElement, ContentProps>((_props, _ref) => null);
TooltipContent.displayName = 'TooltipContent';

