// eslint-disable-next-line @typescript-eslint/no-require-imports
const diff2htmlModule = require("diff2html") as { html: (diff: string, config?: object) => string };
const { html: diff2html } = diff2htmlModule;
import puppeteer, { type Browser } from "puppeteer";
import { ensureChromium, isChromiumInstalled } from "./puppeteerSetup.js";

export interface RenderOptions {
  theme?: "light" | "dark";
  maxLines?: number;
  outputFormat?: "side-by-side" | "line-by-line";
  fontSize?: number;
}

// Singleton browser instance for performance
let browserInstance: Browser | null = null;
let chromiumPath: string | null = null;

/**
 * Initialize Chromium (downloads if needed)
 * Call this early to avoid delay on first diff render
 */
export async function initializePuppeteer(): Promise<void> {
  if (!chromiumPath) {
    chromiumPath = await ensureChromium();
  }
}

/**
 * Check if Chromium is ready
 */
export function isPuppeteerReady(): boolean {
  return isChromiumInstalled();
}

/**
 * Get or create puppeteer browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    // Chromium이 없으면 다운로드
    if (!chromiumPath) {
      chromiumPath = await ensureChromium();
    }

    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserInstance;
}

/**
 * Close browser instance (call on shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Convert git diff to PNG image
 */
export async function diffToImage(
  diffString: string,
  options: RenderOptions = {},
): Promise<Buffer> {
  const {
    theme = "dark",
    outputFormat = "line-by-line",
    fontSize = 12,
    maxLines = 100,
  } = options;

  // Truncate diff if too long
  const truncatedDiff = truncateDiff(diffString, maxLines);

  // Generate HTML from diff
  const diffHtml = diff2html(truncatedDiff, {
    drawFileList: true,
    matching: "lines",
    outputFormat: outputFormat === "side-by-side" ? "side-by-side" : "line-by-line",
  });

  // Create full HTML page with styling
  const fullHtml = createHtmlPage(diffHtml, theme, fontSize);

  // Render to image
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    // Get content dimensions
    const bodyHandle = await page.$("body");
    const boundingBox = await bodyHandle?.boundingBox();

    if (!boundingBox) {
      throw new Error("Failed to get page dimensions");
    }

    // Set viewport to content size (with max width)
    const width = Math.min(Math.ceil(boundingBox.width) + 40, 1200);
    const height = Math.min(Math.ceil(boundingBox.height) + 40, 4000);

    await page.setViewport({ width, height });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width,
        height,
      },
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/**
 * Truncate diff to max lines
 */
function truncateDiff(diff: string, maxLines: number): string {
  const lines = diff.split("\n");
  if (lines.length <= maxLines) {
    return diff;
  }

  const truncated = lines.slice(0, maxLines);
  truncated.push("");
  truncated.push(`... (${lines.length - maxLines} more lines truncated)`);
  return truncated.join("\n");
}

/**
 * Create full HTML page with diff2html styling
 */
function createHtmlPage(diffHtml: string, theme: "light" | "dark", fontSize: number): string {
  const isDark = theme === "dark";

  const colors = isDark
    ? {
        bg: "#1e1e1e",
        fg: "#d4d4d4",
        headerBg: "#2d2d2d",
        addBg: "#1e3a1e",
        addFg: "#4ec94e",
        delBg: "#3a1e1e",
        delFg: "#f14c4c",
        lineBg: "#252526",
        lineFg: "#858585",
        border: "#404040",
      }
    : {
        bg: "#ffffff",
        fg: "#24292e",
        headerBg: "#f6f8fa",
        addBg: "#e6ffed",
        addFg: "#22863a",
        delBg: "#ffeef0",
        delFg: "#cb2431",
        lineBg: "#fafbfc",
        lineFg: "#6a737d",
        border: "#e1e4e8",
      };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: ${fontSize}px;
      background: ${colors.bg};
      color: ${colors.fg};
      padding: 16px;
      line-height: 1.4;
    }

    .d2h-wrapper {
      background: ${colors.bg};
    }

    .d2h-file-header {
      background: ${colors.headerBg};
      border: 1px solid ${colors.border};
      border-bottom: none;
      padding: 8px 12px;
      font-weight: bold;
      border-radius: 6px 6px 0 0;
    }

    .d2h-file-wrapper {
      border: 1px solid ${colors.border};
      border-radius: 6px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .d2h-diff-table {
      width: 100%;
      border-collapse: collapse;
    }

    .d2h-diff-tbody tr {
      border-bottom: 1px solid ${colors.border};
    }

    .d2h-code-line {
      padding: 2px 8px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .d2h-code-line-ctn {
      padding: 2px 8px;
    }

    .d2h-info {
      background: ${colors.headerBg};
      color: ${colors.lineFg};
      padding: 4px 8px;
    }

    .d2h-ins {
      background: ${colors.addBg} !important;
    }

    .d2h-ins .d2h-code-line-ctn {
      color: ${colors.addFg};
    }

    .d2h-del {
      background: ${colors.delBg} !important;
    }

    .d2h-del .d2h-code-line-ctn {
      color: ${colors.delFg};
    }

    .d2h-code-linenumber {
      background: ${colors.lineBg};
      color: ${colors.lineFg};
      border-right: 1px solid ${colors.border};
      padding: 2px 8px;
      text-align: right;
      min-width: 40px;
      user-select: none;
    }

    .d2h-file-diff {
      overflow-x: auto;
    }

    .d2h-file-list-wrapper {
      margin-bottom: 16px;
    }

    .d2h-file-list {
      list-style: none;
      background: ${colors.headerBg};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      padding: 8px 12px;
    }

    .d2h-file-list-line {
      padding: 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .d2h-icon {
      width: 16px;
      height: 16px;
    }

    .d2h-file-name {
      flex: 1;
    }

    .d2h-lines-added {
      color: ${colors.addFg};
    }

    .d2h-lines-deleted {
      color: ${colors.delFg};
    }

    /* Truncation notice */
    .truncated-notice {
      background: ${colors.headerBg};
      color: ${colors.lineFg};
      padding: 8px 12px;
      text-align: center;
      border-radius: 6px;
      margin-top: 8px;
      font-style: italic;
    }
  </style>
</head>
<body>
  ${diffHtml}
</body>
</html>`;
}

/**
 * Create a simple text-based diff summary (fallback when image fails)
 */
export function createTextDiffSummary(
  files: Array<{ path: string; additions: number; deletions: number }>,
  totalAdded: number,
  totalRemoved: number,
): string {
  const lines: string[] = [
    "📊 **Git Changes**",
    "━".repeat(30),
    "",
  ];

  for (const file of files.slice(0, 10)) {
    const addStr = file.additions > 0 ? `+${file.additions}` : "";
    const delStr = file.deletions > 0 ? `-${file.deletions}` : "";
    const stats = [addStr, delStr].filter(Boolean).join(", ");
    lines.push(`📄 \`${file.path}\` (${stats})`);
  }

  if (files.length > 10) {
    lines.push(`... and ${files.length - 10} more files`);
  }

  lines.push("");
  lines.push(`**Total:** +${totalAdded}, -${totalRemoved} lines`);

  return lines.join("\n");
}
