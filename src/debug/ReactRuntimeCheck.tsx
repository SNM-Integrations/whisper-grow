import React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

// Minimal runtime check to diagnose duplicate React copies and renderer mismatch
const ReactRuntimeCheck: React.FC = () => {
  React.useEffect(() => {
    const w = window as any;

    // Track and compare React instance identity across reloads/entries
    const prevReact = w.__REACT_PKG__;
    w.__REACT_PKG__ = React;
    const sameReactIdentity = prevReact ? prevReact === React : true;

    const prevReactDOM = w.__REACT_DOM__;
    w.__REACT_DOM__ = ReactDOM;
    const sameReactDOMIdentity = prevReactDOM ? prevReactDOM === ReactDOM : true;

    const info = {
      env: {
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV,
        prod: import.meta.env.PROD,
      },
      react: {
        version: (React as any).version,
        keys: Object.keys(React),
        useRefSig: String(React.useRef).slice(0, 80) + "…",
        identityStable: sameReactIdentity,
      },
      reactDom: {
        version: (ReactDOM as any).version,
        hasCreateRoot: typeof (ReactDOMClient as any).createRoot === "function",
        identityStable: sameReactDOMIdentity,
      },
    };

    console.groupCollapsed("[ReactRuntimeCheck]");
    console.table(info);

    if (prevReact && prevReact !== React) {
      console.error("[ReactRuntimeCheck] Multiple React instances detected: window.__REACT_PKG__ !== imported React", {
        prevVersion: (prevReact as any).version,
        currentVersion: (React as any).version,
      });
    }

    if (prevReactDOM && prevReactDOM !== ReactDOM) {
      console.error("[ReactRuntimeCheck] Multiple ReactDOM instances detected: window.__REACT_DOM__ !== imported ReactDOM", {
        prevVersion: (prevReactDOM as any).version,
        currentVersion: (ReactDOM as any).version,
      });
    }

    // Dynamic imports to verify module graph identity
    Promise.all([import("react"), import("react-dom"), import("react-dom/client")])
      .then(([dynReact, dynDom, dynDomClient]) => {
        console.log("[ReactRuntimeCheck] dynamic react identical:", dynReact === React, "version:", (dynReact as any).version);
        console.log("[ReactRuntimeCheck] dynamic react-dom identical:", dynDom === ReactDOM, "version:", (dynDom as any).version);
        console.log("[ReactRuntimeCheck] dynamic react-dom/client has createRoot:", typeof (dynDomClient as any).createRoot === "function");
      })
      .catch((e) => console.warn("[ReactRuntimeCheck] dynamic import check failed", e));

    // Presence of React element symbol and DevTools renderer info
    const reactElementSymbol = (Symbol as any).for?.("react.element");
    console.log("[ReactRuntimeCheck] react.element symbol present:", Boolean(reactElementSymbol));

    const hook = (w as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      try {
        const renderersArr = Array.from(hook.renderers?.values?.() || []);
        console.log("[ReactRuntimeCheck] DevTools renderers count:", renderersArr.length);
        renderersArr.forEach((r: any, i: number) => {
          console.log(`[ReactRuntimeCheck] renderer[${i}]`, {
            version: r?.version,
            packageName: r?.rendererPackageName,
          });
        });
      } catch (e) {
        console.warn("[ReactRuntimeCheck] Failed to inspect DevTools renderers", e);
      }
    } else {
      console.log("[ReactRuntimeCheck] DevTools hook not found");
    }

    console.groupEnd();
  }, []);

  return null;
};

export default ReactRuntimeCheck;
