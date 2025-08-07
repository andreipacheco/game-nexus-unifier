import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
   host: "0.0.0.0",
   port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:10000', // Backend server
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
      '/auth': {
        target: 'http://backend:10000', // Backend server
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
