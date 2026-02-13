import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SetupData {
  platforms: { discord: boolean; line: boolean };
  discord: { token: string; userId: string } | null;
  line: { token: string; secret: string; userId: string; port: string } | null;
  cli: string;
  workingDir: string;
}

interface SetupResult {
  cliName: string;
  workingDir: string;
}

/**
 * Starts a local web server for the setup page.
 * Returns a promise that resolves when the user completes setup.
 */
export function startSetupServer(port = 5000): Promise<SetupResult> {
  return new Promise((resolve, reject) => {
    let setupComplete = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);

      // Serve the setup page
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const htmlPath = path.join(__dirname, "setupPage.html");
        try {
          const html = fs.readFileSync(htmlPath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to load setup page");
        }
        return;
      }

      // Handle API endpoint
      if (url.pathname === "/api/setup" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data: SetupData = JSON.parse(body);
            const result = saveSetup(data);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));

            setupComplete = true;

            // Close server after response is sent
            setTimeout(() => {
              server.close();
              resolve(result);
            }, 500);
          } catch (err: any) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // 404 for other paths
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.listen(port, () => {
      console.log();
      console.log("=".repeat(48));
      console.log("  AI CLI Gateway Bot - Setup");
      console.log("=".repeat(48));
      console.log();
      console.log(`  Setup page: http://localhost:${port}`);
      console.log();
      console.log("  Opening browser...");
      console.log();

      // Open browser
      openBrowser(`http://localhost:${port}`);
    });

    server.on("error", (err) => {
      reject(err);
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      if (!setupComplete) {
        server.close();
        reject(new Error("Setup timed out"));
      }
    }, 10 * 60 * 1000);
  });
}

/**
 * Save the setup data to .env file
 */
function saveSetup(data: SetupData): SetupResult {
  const envPath = path.join(process.cwd(), ".env");
  const lines: string[] = [];

  // Discord settings
  if (data.discord) {
    lines.push("# Discord 설정");
    lines.push(`DISCORD_BOT_TOKEN=${data.discord.token}`);
    lines.push(`ALLOWED_USER_IDS=${data.discord.userId}`);
    lines.push("");
  }

  // LINE settings
  if (data.line) {
    lines.push("# LINE 설정");
    lines.push(`LINE_CHANNEL_ACCESS_TOKEN=${data.line.token}`);
    lines.push(`LINE_CHANNEL_SECRET=${data.line.secret}`);
    lines.push(`ALLOWED_LINE_USER_IDS=${data.line.userId}`);
    lines.push(`LINE_WEBHOOK_PORT=${data.line.port}`);
    lines.push("");
  }

  // Common settings
  lines.push("# 공통 설정");
  lines.push("COMMAND_PREFIX=!");
  lines.push("COMMAND_TIMEOUT=30");
  lines.push("AI_CLI_TIMEOUT=300");

  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");

  return {
    cliName: data.cli || "claude",
    workingDir: data.workingDir || process.cwd(),
  };
}

/**
 * Open the default browser with the given URL
 */
function openBrowser(url: string): void {
  const platform = process.platform;

  let command: string;
  let args: string[];

  if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", '""', url];
  } else if (platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32",
  });
  child.unref();
}

/**
 * Check if .env file exists
 */
export function envExists(): boolean {
  return fs.existsSync(path.join(process.cwd(), ".env"));
}
