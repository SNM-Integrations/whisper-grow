import * as React from "react";

// No-op tooltip components to fully remove Radix Tooltip usage
// This prevents any provider/hooks from running and avoids runtime crashes
const TooltipProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
const Tooltip: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
const TooltipTrigger = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <span ref={ref as any} {...props}>{children}</span>
));
TooltipTrigger.displayName = "TooltipTriggerStub";
const TooltipContent = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
TooltipContent.displayName = "TooltipContentStub";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
