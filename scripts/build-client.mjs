import { build } from "vite";
import config from "../vite.config.ts";

const buildToken = Date.now().toString(36);

await build({
  ...config,
  build: {
    ...config.build,
    copyPublicDir: false,
    emptyOutDir: false,
    rollupOptions: {
      ...config.build?.rollupOptions,
      output: {
        ...(
          typeof config.build?.rollupOptions?.output === "object" && !Array.isArray(config.build.rollupOptions.output)
            ? config.build.rollupOptions.output
            : {}
        ),
        assetFileNames: `assets/[name]-[hash]-${buildToken}[extname]`,
        chunkFileNames: `assets/[name]-[hash]-${buildToken}.js`,
        entryFileNames: `assets/[name]-[hash]-${buildToken}.js`,
      },
    },
  },
});
