import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../..");
const htmlPath = path.join(here, "render.html");
const outputDir = path.join(workspace, "generated-artifacts/gosie-video-frames");
const outputPath = path.join(workspace, "generated-artifacts/gosie-promo.mp4");
const fps = 24;
const duration = 17;
const frameCount = Math.round(fps * duration);
const port = 9227;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(path.dirname(outputPath), { recursive: true });

const chrome = spawn(
  "/repl/tools/bin/chromium",
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    "--user-data-dir=/tmp/gosie-promo-chrome",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let socket;
let nextId = 0;
const pending = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollJson(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Chromium at ${url}`);
}

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`DevTools command timed out: ${method}`));
    }, 30000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  const targets = await pollJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("Chromium did not expose a page target.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: `file://${htmlPath}` });
  await sleep(1200);

  const fontResult = await send("Runtime.evaluate", {
    expression: `document.fonts.ready.then(() => ({
      fraunces: document.fonts.check('400 48px Fraunces'),
      manrope: document.fonts.check('500 16px Manrope')
    }))`,
    awaitPromise: true,
    returnByValue: true,
  });
  const fontStatus = fontResult.result?.value;
  if (!fontStatus?.fraunces || !fontStatus?.manrope) {
    throw new Error(`Required Gosie fonts did not load: ${JSON.stringify(fontStatus)}`);
  }
  console.log(`Loaded brand fonts: ${JSON.stringify(fontStatus)}`);

  for (let frame = 0; frame < frameCount; frame++) {
    const seconds = frame / fps;
    await send("Runtime.evaluate", {
      expression: `window.renderAt(${seconds.toFixed(4)})`,
      returnByValue: true,
    });
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    const filename = path.join(outputDir, `frame-${String(frame).padStart(4, "0")}.png`);
    await writeFile(filename, Buffer.from(screenshot.data, "base64"));
    if (frame % 48 === 0 || frame === frameCount - 1) {
      console.log(`Rendered ${frame + 1}/${frameCount} frames`);
    }
  }
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  chrome.kill("SIGTERM");
}

const ffmpegArgs = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-framerate",
  String(fps),
  "-i",
  path.join(outputDir, "frame-%04d.png"),
  "-frames:v",
  String(frameCount),
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  outputPath,
];
await new Promise((resolve, reject) => {
  const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: "inherit" });
  ffmpeg.once("error", reject);
  ffmpeg.once("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)),
  );
});
console.log(`Exported ${outputPath} (${duration}s, 1280x720, ${fps}fps)`);
