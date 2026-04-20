import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const allDeps = Object.keys(pkg.dependencies || {});
const allDevDeps = Object.keys(pkg.devDependencies || {});

// Bundle drizzle-orm into the CJS output so pkg doesn't have to resolve it from node_modules
const externals = [
  ...allDeps.filter((d) => d !== "drizzle-orm"),
  ...allDevDeps,
  // Also externalize sub-dependencies that are problematic/huge
  "vite",
  "pdfjs-dist",
  "vite.config.ts",
  "@babel/preset-typescript",
  "@tailwindcss/oxide-win32-x64-msvc",
  "@tailwindcss/oxide",
  "lightningcss",
  "vite-plugin-manus-runtime",
  "@tailwindcss/vite",
  "@vitejs/plugin-react",
];

const require = createRequire(import.meta.url);
const esbuildBin = require.resolve("esbuild/bin/esbuild");

execFileSync(
  process.execPath,
  [
    esbuildBin,
    "server/_core/index.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--outfile=dist/index.cjs",
    "--log-level=info",
    ...[...new Set(externals)].map(external => `--external:${external}`),
  ],
  { stdio: "inherit" },
);
