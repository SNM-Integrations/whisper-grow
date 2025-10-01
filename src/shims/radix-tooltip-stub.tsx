import React from "react";

// Lightweight, hook-free stubs to isolate runtime issues with Radix Tooltip Provider
// This temporarily disables real tooltip behavior to prevent invalid hook calls
// while we diagnose React duplication. Safe to remove once fixed.

export const Provider: React.FC<{ children?: React.ReactNode } & Record<string, any>> = ({ children }) => (
  <>{children}</>
);

export const Root: React.FC<{ children?: React.ReactNode } & Record<string, any>> = ({ children, ..._props }) => (
  <>{children}</>
);

export const Trigger = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <span ref={ref as any} {...props}>{children}</span>
));
Trigger.displayName = "TooltipTriggerStub";

export const Content = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Content.displayName = "TooltipContentStub";

export const Arrow: React.FC = () => null;
export const Portal: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;

// Re-export typical named exports signatures as no-ops
export const Tooltip = Root;
export const TooltipTrigger = Trigger;
export const TooltipContent = Content;
