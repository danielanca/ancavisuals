const RESET   = "\x1b[0m";
const BOLD    = "\x1b[1m";
const DIM     = "\x1b[2m";
const GREEN   = "\x1b[32m";
const YELLOW  = "\x1b[33m";
const CYAN    = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const WHITE   = "\x1b[97m";
const RED     = "\x1b[31m";

const CLEAR_LINE = "\x1b[2K\x1b[0G";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class DevStartupLogger {
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private spinnerFrame = 0;
  private spinnerLabel = "";
  private spinnerStartTime = 0;

  header(): void {
    const line = "─".repeat(44);
    process.stdout.write(`\n  ${MAGENTA}${BOLD}ancavisuals${RESET}  ${DIM}dev server${RESET}\n`);
    process.stdout.write(`  ${DIM}${line}${RESET}\n\n`);
  }

  step(label: string, detail?: string): void {
    this.stopSpinner();
    const detailStr = detail ? `  ${DIM}${detail}${RESET}` : "";
    process.stdout.write(`  ${GREEN}✓${RESET}  ${WHITE}${label}${RESET}${detailStr}\n`);
  }

  startSpinner(label: string): void {
    this.stopSpinner();
    this.spinnerLabel = label;
    this.spinnerStartTime = Date.now();
    this.spinnerFrame = 0;

    this.spinnerTimer = setInterval(() => {
      const frame = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
      process.stdout.write(`${CLEAR_LINE}  ${YELLOW}${frame}${RESET}  ${WHITE}${this.spinnerLabel}${RESET}`);
      this.spinnerFrame++;
    }, 80);
  }

  stopSpinner(completedLabel?: string): void {
    if (!this.spinnerTimer) return;
    clearInterval(this.spinnerTimer);
    this.spinnerTimer = null;
    process.stdout.write(CLEAR_LINE);

    if (completedLabel) {
      const elapsed = ((Date.now() - this.spinnerStartTime) / 1000).toFixed(1);
      process.stdout.write(`  ${GREEN}✓${RESET}  ${WHITE}${completedLabel}${RESET}  ${DIM}${elapsed}s${RESET}\n`);
    }
  }

  ready(port: number, totalMs: number): void {
    this.stopSpinner();
    const totalSeconds = (totalMs / 1000).toFixed(1);
    process.stdout.write(`\n  ${CYAN}${BOLD}◆${RESET}  ${BOLD}${WHITE}http://127.0.0.1:${port}${RESET}  ${DIM}ready in ${totalSeconds}s${RESET}\n\n`);
  }

  error(label: string): void {
    this.stopSpinner();
    process.stdout.write(`  ${RED}✗${RESET}  ${WHITE}${label}${RESET}\n`);
  }
}

export const devLogger = new DevStartupLogger();
