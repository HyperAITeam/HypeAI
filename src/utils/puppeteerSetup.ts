import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { execSync, spawn } from "node:child_process";

// pkg 환경인지 확인
declare const process: NodeJS.Process & { pkg?: unknown };

const CHROME_FOR_TESTING_JSON =
  "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json";

// Chromium 설치 경로 (exe와 같은 폴더의 .chromium)
function getChromiumPath(): string {
  // pkg로 빌드된 exe인 경우 process.execPath가 exe 경로
  const baseDir = process.pkg
    ? path.dirname(process.execPath)
    : path.resolve(process.cwd());

  return path.join(baseDir, ".chromium");
}

// 설치된 Chromium 실행 파일 경로 찾기
function findChromiumExecutable(chromiumDir: string): string | null {
  if (!fs.existsSync(chromiumDir)) {
    return null;
  }

  try {
    // chrome-headless-shell 또는 chrome 폴더 찾기
    const dirs = fs.readdirSync(chromiumDir);

    for (const dir of dirs) {
      const fullPath = path.join(chromiumDir, dir);
      if (!fs.statSync(fullPath).isDirectory()) continue;

      // chrome-headless-shell-win64/chrome-headless-shell.exe
      if (dir.startsWith("chrome-headless-shell")) {
        const exePath = path.join(fullPath, "chrome-headless-shell.exe");
        if (fs.existsSync(exePath)) {
          return exePath;
        }
      }

      // chrome-win64/chrome.exe 또는 chrome-win/chrome.exe
      if (dir.startsWith("chrome-win")) {
        const exePath = path.join(fullPath, "chrome.exe");
        if (fs.existsSync(exePath)) {
          return exePath;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// Chromium이 설치되어 있는지 확인
export function isChromiumInstalled(): boolean {
  const chromiumDir = getChromiumPath();
  const executable = findChromiumExecutable(chromiumDir);
  return executable !== null;
}

// 시스템에 설치된 Chrome 찾기
function findSystemChrome(): string | null {
  const candidates = [
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// npx를 사용하여 Chromium 다운로드
async function downloadWithNpx(chromiumDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("[Puppeteer] Downloading Chromium using @puppeteer/browsers...");

    const args = [
      "@puppeteer/browsers",
      "install",
      "chrome-headless-shell@stable",
      "--path",
      chromiumDir,
    ];

    const child = spawn("npx", args, {
      shell: true,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npx exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

// HTTPS JSON 가져오기
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }).on("error", reject);
    };

    request(url);
  });
}

// HTTPS 파일 다운로드 (진행률 표시)
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpDest = dest + ".tmp";

    const request = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] ?? "0", 10);
        let downloaded = 0;
        let lastPercent = -1;

        const file = fs.createWriteStream(tmpDest);

        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.floor((downloaded / totalBytes) * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              lastPercent = percent;
              const mb = (downloaded / 1024 / 1024).toFixed(1);
              const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
              process.stdout.write(`\r[Puppeteer] Downloading... ${mb}MB / ${totalMb}MB (${percent}%)`);
            }
          }
        });

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            process.stdout.write("\n");
            try {
              if (fs.existsSync(dest)) fs.unlinkSync(dest);
              fs.renameSync(tmpDest, dest);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });

        file.on("error", (err) => {
          fs.unlink(tmpDest, () => {});
          reject(err);
        });
      }).on("error", (err) => {
        fs.unlink(tmpDest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

// Chrome for Testing API에서 chrome-headless-shell 직접 다운로드
async function downloadDirect(chromiumDir: string): Promise<void> {
  console.log("[Puppeteer] Fetching Chrome for Testing download URL...");

  const json = await fetchJson(CHROME_FOR_TESTING_JSON) as {
    channels: {
      Stable: {
        version: string;
        downloads: {
          "chrome-headless-shell"?: Array<{ platform: string; url: string }>;
        };
      };
    };
  };

  const downloads = json.channels.Stable.downloads["chrome-headless-shell"];
  if (!downloads) {
    throw new Error("chrome-headless-shell downloads not found in API response");
  }

  const win64 = downloads.find((d) => d.platform === "win64");
  if (!win64) {
    throw new Error("win64 platform not found in chrome-headless-shell downloads");
  }

  const version = json.channels.Stable.version;
  console.log(`[Puppeteer] Downloading chrome-headless-shell v${version} (win64)...`);

  const zipPath = path.join(chromiumDir, "chrome-headless-shell.zip");

  // chromium 폴더 생성
  if (!fs.existsSync(chromiumDir)) {
    fs.mkdirSync(chromiumDir, { recursive: true });
  }

  await downloadFile(win64.url, zipPath);
  console.log("[Puppeteer] Download complete. Extracting...");

  // PowerShell Expand-Archive로 ZIP 해제
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${chromiumDir}' -Force"`,
    { stdio: "inherit" },
  );

  // ZIP 파일 정리
  try {
    fs.unlinkSync(zipPath);
  } catch {
    // ignore
  }

  console.log("[Puppeteer] Extraction complete!");
}

// Puppeteer 내장 브라우저 사용 시도
function tryPuppeteerCache(): string | null {
  // Puppeteer가 설치한 기본 경로 확인
  const puppeteerCachePaths = [
    path.join(process.env.USERPROFILE || "", ".cache", "puppeteer"),
    path.join(process.env.LOCALAPPDATA || "", "puppeteer"),
  ];

  for (const cachePath of puppeteerCachePaths) {
    if (fs.existsSync(cachePath)) {
      try {
        // chrome-headless-shell 또는 chrome 폴더 찾기
        const chromeDirs = fs.readdirSync(cachePath);
        for (const dir of chromeDirs) {
          if (dir.startsWith("chrome")) {
            const versionDir = path.join(cachePath, dir);
            const versions = fs.readdirSync(versionDir);
            for (const version of versions) {
              const winDir = path.join(versionDir, version, "chrome-headless-shell-win64");
              const exePath = path.join(winDir, "chrome-headless-shell.exe");
              if (fs.existsSync(exePath)) {
                return exePath;
              }
              // 일반 chrome도 확인
              const chromeWinDir = path.join(versionDir, version, "chrome-win64");
              const chromeExePath = path.join(chromeWinDir, "chrome.exe");
              if (fs.existsSync(chromeExePath)) {
                return chromeExePath;
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

// Chromium 다운로드 및 설치
export async function ensureChromium(): Promise<string> {
  // 1. CHROMIUM_PATH 환경변수
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) {
    console.log(`[Puppeteer] Using CHROMIUM_PATH: ${envPath}`);
    return envPath;
  }

  const chromiumDir = getChromiumPath();

  // 2. 이미 .chromium 폴더에 설치되어 있으면 사용
  let executable = findChromiumExecutable(chromiumDir);
  if (executable) {
    console.log(`[Puppeteer] Chromium found: ${executable}`);
    return executable;
  }

  // 3. Puppeteer 캐시에서 찾기
  const cachedChrome = tryPuppeteerCache();
  if (cachedChrome) {
    console.log(`[Puppeteer] Using cached Chromium: ${cachedChrome}`);
    return cachedChrome;
  }

  // 4. 시스템 Chrome 설치 경로 탐색
  const systemChrome = findSystemChrome();
  if (systemChrome) {
    console.log(`[Puppeteer] Using system Chrome: ${systemChrome}`);
    return systemChrome;
  }

  // 5. HTTPS 직접 다운로드 (npx 불필요)
  console.log(`[Puppeteer] Chromium not found. Downloading to ${chromiumDir}...`);
  console.log("[Puppeteer] This may take a few minutes on first run.");

  try {
    await downloadDirect(chromiumDir);
    console.log("[Puppeteer] Direct download complete!");

    executable = findChromiumExecutable(chromiumDir);
    if (executable) {
      return executable;
    }

    throw new Error("Direct download completed but executable not found");
  } catch (directError) {
    console.warn("[Puppeteer] Direct download failed:", directError);
    console.log("[Puppeteer] Falling back to npx...");
  }

  // 6. npx fallback (최후 수단)
  if (!fs.existsSync(chromiumDir)) {
    fs.mkdirSync(chromiumDir, { recursive: true });
  }

  try {
    await downloadWithNpx(chromiumDir);
    console.log("[Puppeteer] npx download complete!");

    executable = findChromiumExecutable(chromiumDir);
    if (executable) {
      return executable;
    }

    throw new Error("npx download completed but executable not found");
  } catch (npxError) {
    console.error("[Puppeteer] npx fallback also failed:", npxError);
    throw npxError;
  }
}

// 설치 경로 정보 가져오기
export function getChromiumInfo(): { dir: string; executable: string | null } {
  const dir = getChromiumPath();
  return {
    dir,
    executable: findChromiumExecutable(dir),
  };
}
