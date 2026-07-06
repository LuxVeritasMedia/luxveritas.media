import { execFile } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "assets/apps/cr8";

function svg({ width, height, mode }) {
  const isIcon = mode === "icon";
  const markSize = isIcon ? width * 0.23 : 96;
  const signalSize = isIcon ? width * 0.026 : 20;
  const markY = isIcon ? height * 0.54 : height * 0.38;
  const signalY = isIcon ? height * 0.66 : height * 0.48;
  const align = isIcon ? "middle" : "start";
  const markX = isIcon ? width / 2 : width * 0.075;
  const signalX = isIcon ? width / 2 : width * 0.077;
  const frame = isIcon
    ? `<rect x="${width * 0.08}" y="${height * 0.08}" width="${width * 0.84}" height="${height * 0.84}" fill="none" stroke="#c8a86a" stroke-opacity=".62" stroke-width="${Math.max(2, width * 0.004)}"/>`
    : `<rect x="${width * 0.07}" y="${height * 0.09}" width="${width * 0.86}" height="${height * 0.82}" fill="none" stroke="#c8a86a" stroke-opacity=".52" stroke-width="1.3"/>`;
  const featurePanel = isIcon ? "" : `
    <text x="${width * 0.077}" y="${height * 0.6}" fill="#f3eee4" fill-opacity=".72" font-family="Arial, sans-serif" font-size="18">Capture ideas. Shape packets. Move only what is ready.</text>
    <rect x="${width * 0.598}" y="${height * 0.145}" width="${width * 0.31}" height="${height * 0.71}" rx="14" fill="#09100f" fill-opacity=".94" stroke="#c8a86a" stroke-opacity=".28"/>
    ${[0.22, 0.4, 0.58, 0.76].map((y) => `<line x1="${width * 0.625}" x2="${width * 0.88}" y1="${height * y}" y2="${height * y}" stroke="#f3eee4" stroke-opacity=".13"/>`).join("")}
    <text x="${width * 0.625}" y="${height * 0.205}" fill="#c8a86a" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">CAPTURE</text>
    <text x="${width * 0.625}" y="${height * 0.385}" fill="#c8a86a" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">SHAPE</text>
    <text x="${width * 0.625}" y="${height * 0.565}" fill="#c8a86a" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">REVIEW</text>
    <text x="${width * 0.625}" y="${height * 0.745}" fill="#c8a86a" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">SEND</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">CR8 ${isIcon ? "icon" : "feature graphic"} candidate</title>
  <desc id="desc">Quiet luxury CR8 candidate artwork using obsidian, emerald, bone, and restrained gold.</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#060807"/>
      <stop offset=".54" stop-color="#0d1210"/>
      <stop offset="1" stop-color="#101323"/>
    </linearGradient>
    <radialGradient id="gold" cx="54%" cy="38%" r="36%">
      <stop offset="0" stop-color="#c8a86a" stop-opacity=".3"/>
      <stop offset="1" stop-color="#060807" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="green" cx="78%" cy="18%" r="38%">
      <stop offset="0" stop-color="#0d5a49" stop-opacity=".34"/>
      <stop offset="1" stop-color="#060807" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#060807"/>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#gold)"/>
  <rect width="${width}" height="${height}" fill="url(#green)"/>
  ${frame}
  <line x1="${isIcon ? width * 0.5 : width * 0.56}" x2="${isIcon ? width * 0.5 : width * 0.56}" y1="${height * 0.18}" y2="${height * 0.84}" stroke="#0d5a49" stroke-opacity=".72" stroke-width="${isIcon ? Math.max(3, width * 0.005) : 2}"/>
  <text x="${markX}" y="${markY}" fill="#f3eee4" font-family="Georgia, 'Times New Roman', serif" font-size="${markSize}" letter-spacing="${isIcon ? width * 0.017 : 7}" text-anchor="${align}">CR8</text>
  <text x="${signalX}" y="${signalY}" fill="#c8a86a" font-family="Arial, sans-serif" font-size="${signalSize}" letter-spacing="${isIcon ? width * 0.006 : 4}" text-anchor="${align}">CREATE FROM THE SOURCE</text>
  ${featurePanel}
</svg>
`;
}

async function render({ sourceName, targetName, size, width, height, mode }) {
  const source = join(outputDir, sourceName);
  const target = join(outputDir, targetName);
  const thumb = `${source}.png`;
  await writeFile(source, svg({ width, height, mode }));
  await rm(target, { force: true });
  await rm(thumb, { force: true });
  await run("qlmanage", ["-t", "-s", String(size), "-o", outputDir, source]);
  await rename(thumb, target);
  if (mode === "feature") {
    await run("sips", [
      "--cropToHeightWidth",
      String(height),
      String(width),
      "--cropOffset",
      "-60",
      "0",
      target,
      "--out",
      target
    ]);
  }
}

await mkdir(outputDir, { recursive: true });
await render({
  sourceName: "cr8-icon-1024-source.svg",
  targetName: "cr8-icon-1024.png",
  size: 1024,
  width: 1024,
  height: 1024,
  mode: "icon"
});
await render({
  sourceName: "cr8-google-play-icon-512-source.svg",
  targetName: "cr8-google-play-icon-512.png",
  size: 512,
  width: 512,
  height: 512,
  mode: "icon"
});
await render({
  sourceName: "cr8-google-play-feature-1024x500-source.svg",
  targetName: "cr8-google-play-feature-1024x500.png",
  size: 1024,
  width: 1024,
  height: 500,
  mode: "feature"
});

console.log(`Generated CR8 store asset candidates in ${resolve(outputDir)}.`);
