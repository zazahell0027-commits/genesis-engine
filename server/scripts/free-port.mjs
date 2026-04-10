import { execSync } from "node:child_process";

const port = Number.parseInt(process.env.SERVER_PORT ?? "4000", 10);

function readCommand(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function freeWindowsPort(targetPort) {
  const rawPids = readCommand(
    `powershell -NoProfile -Command "& { $connections = Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue; if ($connections) { $connections | Select-Object -ExpandProperty OwningProcess -Unique } }"`
  );

  const pids = rawPids
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  for (const pid of pids) {
    const processName = readCommand(
      `powershell -NoProfile -Command "& { (Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName }"`
    ).toLowerCase();

    if (!processName.includes("node")) {
      console.log(`Port ${targetPort} is in use by process ${pid} (${processName || "unknown"}).`);
      continue;
    }

    try {
      execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, {
        stdio: ["ignore", "ignore", "ignore"]
      });
      console.log(`Freed port ${targetPort} by stopping node process ${pid}.`);
    } catch {
      console.log(`Unable to stop node process ${pid} on port ${targetPort}.`);
    }
  }
}

function freePosixPort(targetPort) {
  const rawPids = readCommand(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`);
  const pids = rawPids
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Freed port ${targetPort} by stopping process ${pid}.`);
    } catch {
      console.log(`Unable to stop process ${pid} on port ${targetPort}.`);
    }
  }
}

if (Number.isFinite(port) && port > 0) {
  if (process.platform === "win32") {
    freeWindowsPort(port);
  } else {
    freePosixPort(port);
  }
}
