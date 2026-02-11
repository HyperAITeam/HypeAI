import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { execSync } from "node:child_process";

const NODE_VERSION = "v22.14.0";
const NODE_DOWNLOAD_URL = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;

/** 캐시: 한 번 resolve하면 이후 즉시 반환 */
let cachedNodePath: string | null = null;

/**
 * Node.js 실행 파일 경로를 탐색/확보한다.
 *
 * 1. exe 옆 node.exe 확인
 * 2. 시스템 PATH의 node 확인
 * 3. 둘 다 없으면 nodejs.org에서 자동 다운로드
 */
export async function resolveNodeExecutable(): Promise<string> {
  if (cachedNodePath) return cachedNodePath;

  // 1) exe 옆 node.exe
  const exeDir = path.dirname(process.execPath);
  const localNode = path.join(exeDir, "node.exe");
  if (fs.existsSync(localNode)) {
    console.log(`  [Node] Found bundled: ${localNode}`);
    cachedNodePath = localNode;
    return localNode;
  }

  // 2) 시스템 PATH
  try {
    execSync("node --version", { stdio: "ignore" });
    console.log("  [Node] Using system node");
    cachedNodePath = "node";
    return "node";
  } catch {
    // not found
  }

  // 3) 자동 다운로드
  console.log();
  console.log(`  [Node] Node.js가 없습니다. 자동 다운로드를 시작합니다...`);
  console.log(`  [Node] URL: ${NODE_DOWNLOAD_URL}`);
  console.log(`  [Node] 저장: ${localNode}`);
  console.log();

  await downloadFile(NODE_DOWNLOAD_URL, localNode);

  console.log(`  [Node] 다운로드 완료!`);
  console.log();

  cachedNodePath = localNode;
  return localNode;
}

/**
 * HTTPS로 파일 다운로드 (리다이렉트 지원, 진행률 표시)
 */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpDest = dest + ".tmp";

    const request = (targetUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(targetUrl, (res) => {
        // 리다이렉트 처리
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
              process.stdout.write(`\r  [Node] 다운로드 중... ${mb}MB / ${totalMb}MB (${percent}%)`);
            }
          }
        });

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            process.stdout.write("\n");
            // tmp → 최종 파일 (원자적 이동)
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
