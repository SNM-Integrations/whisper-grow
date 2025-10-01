import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";



// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Temporarily disabled to resolve TooltipProvider invalid hook crash; re-enable after fix
    // mode === 'development' && componentTagger(),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: [
      '@radix-ui/react-tooltip',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@radix-ui/react-tooltip": path.resolve(__dirname, "./src/shims/radix-tooltip-stub-alt.tsx"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
}));
