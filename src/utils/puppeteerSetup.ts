import path from "node:path";
import fs from "node:fs";
import { execSync, spawn } from "node:child_process";

// pkg 환경인지 확인
declare const process: NodeJS.Process & { pkg?: unknown };

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
  const chromiumDir = getChromiumPath();

  // 1. 이미 우리 폴더에 설치되어 있으면 사용
  let executable = findChromiumExecutable(chromiumDir);
  if (executable) {
    console.log(`[Puppeteer] Chromium found: ${executable}`);
    return executable;
  }

  // 2. Puppeteer 캐시에서 찾기
  const cachedChrome = tryPuppeteerCache();
  if (cachedChrome) {
    console.log(`[Puppeteer] Using cached Chromium: ${cachedChrome}`);
    return cachedChrome;
  }

  // 3. 다운로드 필요
  console.log(`[Puppeteer] Chromium not found. Downloading to ${chromiumDir}...`);
  console.log("[Puppeteer] This may take a few minutes on first run.");

  // chromium 폴더 생성
  if (!fs.existsSync(chromiumDir)) {
    fs.mkdirSync(chromiumDir, { recursive: true });
  }

  try {
    await downloadWithNpx(chromiumDir);
    console.log("[Puppeteer] Download complete!");

    // 다운로드 후 다시 찾기
    executable = findChromiumExecutable(chromiumDir);
    if (executable) {
      return executable;
    }

    throw new Error("Chromium download completed but executable not found");
  } catch (error) {
    console.error("[Puppeteer] Failed to download Chromium:", error);
    console.log("[Puppeteer] Trying fallback: manual puppeteer install...");

    // Fallback: puppeteer browsers 직접 설치 시도
    try {
      execSync("npx puppeteer browsers install chrome-headless-shell", {
        stdio: "inherit",
        cwd: path.dirname(chromiumDir),
      });

      const fallbackExe = tryPuppeteerCache();
      if (fallbackExe) {
        return fallbackExe;
      }
    } catch (fallbackError) {
      console.error("[Puppeteer] Fallback also failed:", fallbackError);
    }

    throw error;
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
