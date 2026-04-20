import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esbuildBin = require.resolve("esbuild/bin/esbuild");

execFileSync(
  process.execPath,
  [
    esbuildBin,
    "server/_core/index.ts",
    "--bundle",
    "--platform=node",
    "--packages=external",
    "--format=esm",
    "--outdir=dist",
    "--log-level=info",
  ],
  { stdio: "inherit" },
);
