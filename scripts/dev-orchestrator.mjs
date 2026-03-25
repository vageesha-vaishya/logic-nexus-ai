import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(process.cwd());

function spawnProc(command) {
  const shell = process.platform === "win32" ? "cmd.exe" : "bash";
  const args = process.platform === "win32" ? ["/c", command] : ["-lc", command];
  const child = spawn(shell, args, { cwd: rootDir, stdio: "inherit", env: process.env });
  return child;
}

const child = spawnProc("node scripts/service-orchestrator.mjs");

process.on("SIGINT", () => {
  try {
    child.kill("SIGTERM");
  } catch {}
  process.exit(0);
});
process.on("SIGTERM", () => {
  try {
    child.kill("SIGTERM");
  } catch {}
  process.exit(0);
});
