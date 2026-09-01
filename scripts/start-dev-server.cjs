const { spawn, exec } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const port = 1994;
const tsxBinary = path.join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const child = spawn(tsxBinary, ["watch", "--exclude", "**/*.timestamp-*.mjs", "server.ts"], {
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    NODE_OPTIONS: "--no-deprecation --require ./scripts/polyfill-slowbuffer.cjs",
  },
  stdio: "inherit",
});

let browserOpened = false;
const poll = setInterval(() => {
  if (browserOpened) return;
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.once("connect", () => {
    socket.destroy();
    browserOpened = true;
    clearInterval(poll);
    const url = `http://localhost:${port}`;
    const command = process.platform === "darwin" ? `open ${url}` : process.platform === "win32" ? `start ${url}` : `xdg-open ${url}`;
    exec(command, error => {
      if (error) console.warn(`[dev] Nu am putut deschide browserul: ${error.message}`);
    });
  });
  socket.once("error", () => socket.destroy());
}, 250);

function stop() {
  clearInterval(poll);
  if (!child.killed) child.kill("SIGINT");
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("exit", (code, signal) => {
  clearInterval(poll);
  process.exitCode = code ?? (signal ? 1 : 0);
});
