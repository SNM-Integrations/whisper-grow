// Early runtime check to diagnose duplicate React copies and renderer mismatch BEFORE React renders
// Runs on module import from main.tsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

(() => {
  const w = window as any;
  try {
    const prevReact = w.__REACT_PKG__;
    w.__REACT_PKG__ = React;
    const prevReactDOM = w.__REACT_DOM__;
    w.__REACT_DOM__ = ReactDOM;
    const info = {
      react: {
        version: (React as any).version,
        identityStable: prevReact ? prevReact === React : true,
      },
      reactDom: {
        version: (ReactDOM as any).version,
        hasCreateRoot: typeof (ReactDOMClient as any).createRoot === "function",
        identityStable: prevReactDOM ? prevReactDOM === ReactDOM : true,
      },
    };
    // Synchronous logs before App renders
    console.group("[EarlyReactCheck]");
    console.log("Static react version:", info.react.version, "identityStable:", info.react.identityStable);
    console.log("Static react-dom version:", info.reactDom.version, "hasCreateRoot:", info.reactDom.hasCreateRoot, "identityStable:", info.reactDom.identityStable);
    console.groupEnd();

    // Dynamic import comparison
    Promise.all([import("react"), import("react-dom"), import("react-dom/client")]).then(([dynReact, dynDom, dynDomClient]) => {
      console.log("[EarlyReactCheck] dynamic react identical:", dynReact === React, "version:", (dynReact as any).version);
      console.log("[EarlyReactCheck] dynamic react-dom identical:", dynDom === ReactDOM, "version:", (dynDom as any).version);
      console.log("[EarlyReactCheck] dynamic react-dom/client has createRoot:", typeof (dynDomClient as any).createRoot === "function");
    }).catch((e) => console.warn("[EarlyReactCheck] dynamic import check failed", e));
  } catch (e) {
    console.warn("[EarlyReactCheck] failed", e);
  }
})();