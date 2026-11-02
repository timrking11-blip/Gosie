import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../..");
const htmlPath = path.join(here, "render.html");
const outputDir = path.join(workspace, "generated-artifacts/gosie-video-frames");
const silentOutputPath = path.join(workspace, "generated-artifacts/gosie-promo.mp4");
const narratedOutputPath = path.join(workspace, "generated-artifacts/gosie-promo-narrated.mp4");
const fps = 24;
const duration = 18.5;
const frameCount = Math.round(fps * duration);
const port = 9227;
const narration = [
  { start: 0.15, text: "A little help for everything ahead." },
  { start: 2.95, text: "Week Ahead shows a fictional week of plans and sample priorities." },
  { start: 7.4, text: "Weekend Ahead shifts sample ideas with the social context you choose." },
  { start: 11.8, text: "Sample interests, not personal history." },
  { start: 15, text: "Private prototype. Release date to be announced." },
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(path.dirname(silentOutputPath), { recursive: true });

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

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args, { stdio: "inherit" });
    ffmpeg.once("error", reject);
    ffmpeg.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)),
    );
  });
}

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
  silentOutputPath,
];
await runFfmpeg(ffmpegArgs);
console.log(`Exported silent promo ${silentOutputPath} (${duration}s, 1280x720, ${fps}fps)`);

const narrationDir = await mkdtemp(path.join(tmpdir(), "gosie-promo-narration-"));
try {
  const narrationArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    silentOutputPath,
  ];
  const narrationFilters = [];
  const voiceInputs = [];

  for (const [index, line] of narration.entries()) {
    const textPath = path.join(narrationDir, `line-${index}.txt`);
    await writeFile(textPath, line.text, "utf8");
    narrationArgs.push("-f", "lavfi", "-i", `flite=textfile=${textPath}:voice=slt`);
    const inputIndex = index + 1;
    const delayMs = Math.round(line.start * 1000);
    narrationFilters.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[voice${index}]`);
    voiceInputs.push(`[voice${index}]`);
  }

  narrationFilters.push(
    `${voiceInputs.join("")}amix=inputs=${narration.length}:duration=longest:dropout_transition=0,volume=1.1,alimiter=limit=0.95,apad=whole_dur=${duration},atrim=duration=${duration}[narration]`,
  );
  narrationArgs.push(
    "-filter_complex",
    narrationFilters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[narration]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    narratedOutputPath,
  );

  await runFfmpeg(narrationArgs);
  console.log(`Exported narrated promo ${narratedOutputPath} (${duration}s)`);
} finally {
  await rm(narrationDir, { recursive: true, force: true });
}
