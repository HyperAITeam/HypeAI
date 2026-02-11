import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const distDir = "dist";

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log("Building with esbuild...");

await build({
  entryPoints: ["src/bot.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/bot.cjs",
  sourcemap: false,
  minify: false,
  // Node.js built-in modules are external
  external: [
    // Native modules that can't be bundled
    "bufferutil",
    "utf-8-validate",
    "zlib-sync",
    "erlpack",
  ],
  // Define for proper environment
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  // Handle dynamic requires
  banner: {
    js: `
// pkg compatibility banner
const __require = require;
const __dirname_pkg = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
`,
  },
});

console.log("Bundle created: dist/bot.cjs");

// Copy cli.js for Claude Agent SDK
const cliSrc = "node_modules/@anthropic-ai/claude-agent-sdk/cli.js";
const cliDest = path.join(distDir, "cli.js");

if (fs.existsSync(cliSrc)) {
  fs.copyFileSync(cliSrc, cliDest);
  console.log("Copied: cli.js");
}

// Copy .env.example
const envSrc = ".env.example";
const envDest = path.join(distDir, ".env.example");

if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDest);
  console.log("Copied: .env.example");
}

console.log("\nBuild complete!");
console.log("Next: run 'pkg dist/bot.cjs --targets node18-win-x64 --output dist/aidevelop-bot.exe'");
