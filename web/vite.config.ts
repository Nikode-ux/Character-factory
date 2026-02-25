import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_DEV_API_PROXY || "http://localhost:4000";
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": apiProxyTarget,
      "/me": apiProxyTarget,
      "/characters": apiProxyTarget,
      "/chats": apiProxyTarget,
      "/admin": apiProxyTarget,
      "/health": apiProxyTarget,
      "/lorebooks": apiProxyTarget,
      "/memories": apiProxyTarget
    }
  }
});
