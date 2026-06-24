// vite.config.mjs
import { fileURLToPath, URL } from "node:url";
import { PrimeVueResolver } from "file:///C:/Users/AnasBELKADI/EMS_MAIN/Frontend-vivo/node_modules/@primevue/auto-import-resolver/index.mjs";
import vue from "file:///C:/Users/AnasBELKADI/EMS_MAIN/Frontend-vivo/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import Components from "file:///C:/Users/AnasBELKADI/EMS_MAIN/Frontend-vivo/node_modules/unplugin-vue-components/dist/vite.js";
import { defineConfig } from "file:///C:/Users/AnasBELKADI/EMS_MAIN/Frontend-vivo/node_modules/vitest/dist/config.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/AnasBELKADI/EMS_MAIN/Frontend-vivo/vite.config.mjs";
var vite_config_default = defineConfig({
  optimizeDeps: {
    noDiscovery: true
  },
  plugins: [
    vue(),
    Components({
      resolvers: [PrimeVueResolver()]
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/websocket": {
        target: "ws://localhost:8082",
        ws: true,
        rewrite: (path) => path.replace(/^\/websocket/, "")
      }
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "src/**/*.test.ts"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQW5hc0JFTEtBRElcXFxcRU1TX01BSU5cXFxcRnJvbnRlbmQtdml2b1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQW5hc0JFTEtBRElcXFxcRU1TX01BSU5cXFxcRnJvbnRlbmQtdml2b1xcXFx2aXRlLmNvbmZpZy5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0FuYXNCRUxLQURJL0VNU19NQUlOL0Zyb250ZW5kLXZpdm8vdml0ZS5jb25maWcubWpzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xyXG5cclxuaW1wb3J0IHsgUHJpbWVWdWVSZXNvbHZlciB9IGZyb20gJ0BwcmltZXZ1ZS9hdXRvLWltcG9ydC1yZXNvbHZlcic7XHJcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJztcclxuaW1wb3J0IENvbXBvbmVudHMgZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZSc7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIG9wdGltaXplRGVwczoge1xyXG4gICAgICAgIG5vRGlzY292ZXJ5OiB0cnVlXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAgIHZ1ZSgpLFxyXG4gICAgICAgIENvbXBvbmVudHMoe1xyXG4gICAgICAgICAgICByZXNvbHZlcnM6IFtQcmltZVZ1ZVJlc29sdmVyKCldXHJcbiAgICAgICAgfSlcclxuICAgIF0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgICAgYWxpYXM6IHtcclxuICAgICAgICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSlcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgICAgcHJveHk6IHtcclxuICAgICAgICAgICAgJy9hcGknOiAnaHR0cDovL2xvY2FsaG9zdDo1MDAwJyxcclxuICAgICAgICAgICAgJy93ZWJzb2NrZXQnOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICd3czovL2xvY2FsaG9zdDo4MDgyJyxcclxuICAgICAgICAgICAgICAgIHdzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL3dlYnNvY2tldC8sICcnKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHRlc3Q6IHtcclxuICAgICAgICBlbnZpcm9ubWVudDogJ25vZGUnLFxyXG4gICAgICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoudGVzdC5qcycsICdzcmMvKiovKi50ZXN0LnRzJ11cclxuICAgIH1cclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1QsU0FBUyxlQUFlLFdBQVc7QUFFbFcsU0FBUyx3QkFBd0I7QUFDakMsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsb0JBQW9CO0FBTDJLLElBQU0sMkNBQTJDO0FBUXpQLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLGNBQWM7QUFBQSxJQUNWLGFBQWE7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ0wsSUFBSTtBQUFBLElBQ0osV0FBVztBQUFBLE1BQ1AsV0FBVyxDQUFDLGlCQUFpQixDQUFDO0FBQUEsSUFDbEMsQ0FBQztBQUFBLEVBQ0w7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDeEQ7QUFBQSxFQUNKO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDSixPQUFPO0FBQUEsTUFDSCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsUUFDVixRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsZ0JBQWdCLEVBQUU7QUFBQSxNQUN0RDtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDRixhQUFhO0FBQUEsSUFDYixTQUFTLENBQUMsb0JBQW9CLGtCQUFrQjtBQUFBLEVBQ3BEO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
