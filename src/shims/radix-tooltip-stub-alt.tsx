import React from "react";

// Alt stub: ensure no hooks/context inside, neutralize Radix Tooltip completely
export const Provider: React.FC<{ children?: React.ReactNode } & Record<string, any>> = ({ children }) => (
  <>{children}</>
);
export const Root: React.FC<{ children?: React.ReactNode } & Record<string, any>> = ({ children }) => (
  <>{children}</>
);
export const Trigger = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <span ref={ref as any} {...props}>{children}</span>
));
Trigger.displayName = "TooltipTriggerStubAlt";
export const Content = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Content.displayName = "TooltipContentStubAlt";
export const Arrow: React.FC = () => null;
export const Portal: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const Tooltip = Root;
export const TooltipTrigger = Trigger;
export const TooltipContent = Content;
