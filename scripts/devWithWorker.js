import { spawn } from "node:child_process";
import { startScheduler, stopScheduler } from "../worker/scheduler.js";

const nextProcess = spawn("node_modules\\.bin\\next.cmd", ["dev"], {
  cwd: process.cwd(),
  shell: true,
  stdio: "inherit"
});

startScheduler();

function shutdown(signal) {
  stopScheduler();

  if (!nextProcess.killed) {
    nextProcess.kill(signal);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

nextProcess.on("exit", (code) => {
  stopScheduler();
  process.exit(code || 0);
});
