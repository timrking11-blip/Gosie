import { execFile as execFileCallback } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../..");
const defaultDuration = 18.5;
const defaultFps = 24;

function parseFrameRate(value) {
  if (typeof value !== "string") return Number.NaN;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return Number.NaN;
  }
  return numerator / denominator;
}

async function probe(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} export is missing: ${filePath}`);
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile() || fileInfo.size === 0) {
      throw new Error("file is empty or is not a regular file");
    }
    const { stdout } = await execFile("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate,duration",
      "-of",
      "json",
      filePath,
    ]);
    return JSON.parse(stdout);
  } catch (error) {
    const detail = error.stderr?.trim() || error.message || String(error);
    throw new Error(`${label} export is malformed or unreadable (${filePath}): ${detail}`);
  }
}

function checkNear(value, expected, tolerance, label, errors) {
  if (!Number.isFinite(value)) {
    errors.push(`${label} is unavailable`);
  } else if (Math.abs(value - expected) > tolerance) {
    errors.push(`${label} is ${value.toFixed(3)}, expected ${expected.toFixed(3)} (±${tolerance.toFixed(3)})`);
  }
}

function validateFile(metadata, label, { hasAudio, width, height, fps, duration }) {
  const errors = [];
  const streams = metadata.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  const tolerance = 1 / fps + 0.01;

  if (videoStreams.length === 0) {
    errors.push("no video stream found");
  }

  if (hasAudio && audioStreams.length === 0) {
    errors.push("no audio stream found");
  } else if (!hasAudio && audioStreams.length > 0) {
    errors.push(`expected no audio stream, found ${audioStreams.length}`);
  }

  for (const [index, stream] of videoStreams.entries()) {
    const streamLabel = videoStreams.length > 1 ? `video stream ${index + 1}` : "video";
    if (stream.width !== width || stream.height !== height) {
      errors.push(`${streamLabel} is ${stream.width}x${stream.height}, expected ${width}x${height}`);
    }
    const averageFps = parseFrameRate(stream.avg_frame_rate);
    const nominalFps = parseFrameRate(stream.r_frame_rate);
    checkNear(averageFps, fps, 0.01, `${streamLabel} average frame rate`, errors);
    checkNear(nominalFps, fps, 0.01, `${streamLabel} frame rate`, errors);
    checkNear(Number(stream.duration), duration, tolerance, `${streamLabel} duration`, errors);
  }

  checkNear(Number(metadata.format?.duration), duration, tolerance, "file duration", errors);
  for (const [index, stream] of audioStreams.entries()) {
    checkNear(
      Number(stream.duration),
      duration,
      tolerance,
      audioStreams.length > 1 ? `audio stream ${index + 1} duration` : "audio duration",
      errors,
    );
  }

  if (errors.length > 0) {
    throw new Error(`${label} export failed validation:\n- ${errors.join("\n- ")}`);
  }

  return Number(metadata.format.duration);
}

export async function validatePromoExports({
  silentPath = path.join(workspace, "generated-artifacts/gosie-promo.mp4"),
  narratedPath = path.join(workspace, "generated-artifacts/gosie-promo-narrated.mp4"),
  width = 1280,
  height = 720,
  fps = defaultFps,
  duration = defaultDuration,
} = {}) {
  const [silentMetadata, narratedMetadata] = await Promise.all([
    probe(silentPath, "Silent"),
    probe(narratedPath, "Narrated"),
  ]);
  const silentDuration = validateFile(silentMetadata, "Silent", {
    hasAudio: false,
    width,
    height,
    fps,
    duration,
  });
  const narratedDuration = validateFile(narratedMetadata, "Narrated", {
    hasAudio: true,
    width,
    height,
    fps,
    duration,
  });
  const tolerance = 1 / fps + 0.01;
  if (Math.abs(silentDuration - narratedDuration) > tolerance) {
    throw new Error(
      `Promo export durations do not match: silent ${silentDuration.toFixed(3)}s, narrated ${narratedDuration.toFixed(3)}s`,
    );
  }

  console.log(
    `Promo exports passed validation: silent video/no audio; narrated video/audio; ${width}x${height} at ${fps} fps; both ${silentDuration.toFixed(3)}s.`,
  );
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const portrait = process.argv.includes("--portrait");
  validatePromoExports({
    silentPath: path.join(
      workspace,
      `generated-artifacts/gosie-promo${portrait ? "-portrait" : ""}.mp4`,
    ),
    narratedPath: path.join(
      workspace,
      `generated-artifacts/gosie-promo${portrait ? "-portrait" : ""}-narrated.mp4`,
    ),
    width: portrait ? 1080 : 1280,
    height: portrait ? 1920 : 720,
  }).catch((error) => {
    console.error(`Promo export validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
