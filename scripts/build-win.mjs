import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const WIN_UNPACKED = path.join(ROOT_DIR, "release", "win-unpacked");

// Kill any running Judge AI.exe to release file locks
try {
  execSync('taskkill /F /IM "Judge AI.exe" /T', { stdio: "ignore" });
  console.log("[build-win] Killed running Judge AI.exe");
} catch {
  // ignore if not running
}

// Remove win-unpacked to avoid locked file errors
if (fs.existsSync(WIN_UNPACKED)) {
  fs.rmSync(WIN_UNPACKED, { recursive: true, force: true });
  console.log("[build-win] Cleaned release/win-unpacked");
}

try {
  const output = execSync("electron-builder --win --x64", { encoding: "utf-8", stdio: "pipe" });
  process.stdout.write(output);
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  process.exit(error.status || 1);
}
