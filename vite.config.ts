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
  cacheDir: "node_modules/.vite-no-radix", // bust old prebundle cache aggressively
  plugins: [
    // Forcefully stub any attempt to load @radix-ui/react-tooltip, even from prebundled deps
    {
      name: 'no-radix-tooltip',
      enforce: 'pre',
      resolveId(source) {
        if (source === '@radix-ui/react-tooltip' || source.startsWith('@radix-ui/react-tooltip/')) {
          return path.resolve(__dirname, './src/shims/radix-tooltip-stub-alt.tsx');
        }
        return null;
      },
      load(id) {
        if (id.includes('@radix-ui_react-tooltip')) {
          return `export const Provider=({children})=>children;export const Root=({children})=>children;export const Trigger=(props)=>null;export const Content=(props)=>null;export const Arrow=()=>null;export const Portal=({children})=>children;export const Tooltip=Root;export const TooltipTrigger=Trigger;export const TooltipContent=Content;`;
        }
        return null;
      },
    },
    react(),
    // Temporarily disabled to resolve TooltipProvider invalid hook crash; re-enable after fix
    // mode === 'development' && componentTagger(),
  ].filter(Boolean),
  optimizeDeps: {
    disabled: true, // fully disable prebundling to avoid stale @radix-ui/react-tooltip chunks
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
