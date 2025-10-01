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
      '@radix-ui/react-toast',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^@radix-ui\/react-tooltip(\/.*)?$/, replacement: path.resolve(__dirname, './src/shims/radix-tooltip-stub-alt.tsx') },
      { find: /^@radix-ui\/react-toast(\/.*)?$/, replacement: path.resolve(__dirname, './src/shims/radix-noop-react-toast.tsx') },
    ],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
}));
