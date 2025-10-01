import React from "react";

// No-op shadcn toast primitives to eliminate Radix Toast at runtime
// This preserves the API surface used across the app without importing @radix-ui/react-toast

type Variant = "default" | "destructive";
export type ToastProps = React.ComponentProps<"div"> & { variant?: Variant; open?: boolean; onOpenChange?: (open: boolean) => void };
export type ToastActionElement = React.ReactElement<any>;

const withRef = (Comp: React.ComponentType<any>) =>
  React.forwardRef<any, any>((props, ref) => <Comp ref={ref as any} {...props} />);

const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
const ToastViewport = withRef((props: any) => <div {...props} />);
const Toast = withRef((props: ToastProps) => <div {...props} />);
const ToastTitle = withRef((props: any) => <div {...props} />);
const ToastDescription = withRef((props: any) => <div {...props} />);
const ToastClose = withRef((props: any) => <button type="button" {...props} />);
const ToastAction = withRef((props: any) => <button type="button" {...props} />);

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction };
