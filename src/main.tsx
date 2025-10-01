import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/debug/early-react-check";

// Enable dark mode by default
document.documentElement.classList.add('dark');

// Disable service worker and clear any existing caches to avoid stale prebundled chunks
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
    console.log('Service workers unregistered and caches cleared');
  });
}


createRoot(document.getElementById("root")!).render(<App />);
