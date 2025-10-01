import React from "react";

// Pure ESM stub to completely neutralize @radix-ui/react-tooltip during debugging.
// No hooks, no context – avoids invalid hook calls and React duplication traps.
// Keep until we confirm single React instance across app and deps.

export const Provider = ({ children, ..._props }) => children ?? null;
export const Root = ({ children, ..._props }) => children ?? null;
export const Trigger = ({ children, ...props }) => React.createElement("span", { ...props }, children);
export const Content = ({ children, ...props }) => React.createElement("div", { ...props }, children);
export const Arrow = () => null;
export const Portal = ({ children }) => children ?? null;

// Common shorthands
export const Tooltip = Root;
export const TooltipTrigger = Trigger;
export const TooltipContent = Content;
