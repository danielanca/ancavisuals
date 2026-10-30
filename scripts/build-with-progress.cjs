// `npm run build` with visible progress: each step is announced with its number, a "still running"
// line every 5 s (tsc prints nothing until it finishes) and its duration; a failing step stops the
// build and says which one it was.
const { spawn } = require("node:child_process");
const path = require("node:path");

const STEPS = [
  ["Instalare pachete", "npm install"],
  ["Ștergere dist", "npm run clean"],
  ["Verificare TypeScript (tsc, nu afișează nimic până termină)", "NODE_OPTIONS=--max-old-space-size=2048 tsc -p tsconfig.json"],
  ["Build client (vite)", "npm run build:client"],
  ["Build server SSR (vite)", "npm run build:server"],
  ["Copiere fișiere", "npm run copy-files"],
  ["Corectare extensii", "node fix-extensions.js"],
];
const HEARTBEAT_MS = 5_000;

const duration = (ms) => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
};
const clock = () => new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function run(index) {
  const [label, command] = STEPS[index];
  const tag = `[${index + 1}/${STEPS.length}]`;
  const started = Date.now();
  console.log(`\n▶ ${tag} ${label} — pornit la ${clock()}`);
  const heartbeat = setInterval(() => console.log(`⏳ ${tag} ${label} — rulează de ${duration(Date.now() - started)}…`), HEARTBEAT_MS);
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: "inherit", cwd: path.join(__dirname, "..") });
    child.on("exit", (code) => {
      clearInterval(heartbeat);
      if (code === 0) {
        console.log(`✓ ${tag} ${label} — gata în ${duration(Date.now() - started)}`);
        resolve();
      } else {
        reject(new Error(`${tag} ${label} a eșuat (cod ${code}) după ${duration(Date.now() - started)}`));
      }
    });
  });
}

(async () => {
  const started = Date.now();
  try {
    for (let index = 0; index < STEPS.length; index++) await run(index);
    console.log(`\n✅ Build complet în ${duration(Date.now() - started)}`);
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    process.exit(1);
  }
})();
