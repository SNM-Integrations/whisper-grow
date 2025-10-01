import React from "react";

// No-op Radix Toast shim to eliminate runtime hooks and bundle imports
export const Provider: React.FC<{ children?: React.ReactNode } & Record<string, any>> = ({ children }) => (
  <>{children}</>
);

export const Viewport = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Viewport.displayName = "ToastViewportStub";

export const Root = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Root.displayName = "ToastRootStub";

export const Title = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Title.displayName = "ToastTitleStub";

export const Description = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref as any} {...props}>{children}</div>
));
Description.displayName = "ToastDescriptionStub";

export const Action = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <button ref={ref as any} type="button" {...props}>{children}</button>
));
Action.displayName = "ToastActionStub";

export const Close = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <button ref={ref as any} type="button" {...props}>{children}</button>
));
Close.displayName = "ToastCloseStub";
