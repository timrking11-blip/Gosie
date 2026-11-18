import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const source = path.join(root, "artifacts/gosie/public/media/gosie-promo.mp4");
const output = path.join(root, "generated-artifacts/gosie-website-promo-subtitled.mp4");
const subtitles = "artifacts/gosie-video/website-promo.en.srt";
mkdirSync(path.dirname(output), { recursive: true });

// SRT timestamps were transcribed from the existing website narration, then
// aligned to its speech boundaries. Preserve source frames, duration, and audio.
if (!readFileSync(path.join(root, subtitles), "utf8").includes("On the roadmap:")) {
  throw new Error("Captions must retain the roadmap qualification.");
}
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y", "-i", source,
  "-map", "0:v:0", "-map", "0:a:0",
  "-vf", `subtitles=${subtitles}:original_size=1280x720:force_style='FontName=DejaVu Sans,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H30000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=1,MarginL=12,MarginR=12'`,
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart",
  output,
], { cwd: root, stdio: "inherit" });
console.log(`Exported website clip with subtitles only: ${output}`);
