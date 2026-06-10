import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sampleRate = 44100;
const assetsDir = "assets";
const bundledPlaywrightPath = "/Users/frederickparent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

function int16(value) {
  const clipped = Math.max(-1, Math.min(1, value));
  return Math.round(clipped * 32767);
}

function wavBuffer({ seconds, toneHz, pulseHz, gain }) {
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t / 0.35, (seconds - t) / 0.8);
    const pulse = 0.72 + 0.28 * Math.sin(2 * Math.PI * pulseHz * t);
    const tone = Math.sin(2 * Math.PI * toneHz * t) * 0.7
      + Math.sin(2 * Math.PI * toneHz * 1.5 * t) * 0.2
      + Math.sin(2 * Math.PI * toneHz * 0.5 * t) * 0.1;
    buffer.writeInt16LE(int16(tone * envelope * pulse * gain), 44 + i * 2);
  }

  return buffer;
}

const poster = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc">
  <title id="title">Lux Veritas signal preview</title>
  <desc id="desc">Obsidian, emerald, and restrained gold preview art for Lux Veritas media playback.</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#070909"/>
      <stop offset="0.54" stop-color="#12181a"/>
      <stop offset="1" stop-color="#1d2138"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="52%">
      <stop offset="0" stop-color="#c8a86a" stop-opacity="0.28"/>
      <stop offset="0.58" stop-color="#143c36" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#070909" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#glow)"/>
  <path d="M190 505h900" stroke="#c8a86a" stroke-width="2" stroke-opacity="0.42"/>
  <path d="M338 500V230h56v224h156v46H338Zm360-270h66L632 500h-58l124-270Z" fill="#d8c391"/>
  <g fill="#1f8c72" opacity="0.52">
    <rect x="196" y="318" width="22" height="94" rx="11"/>
    <rect x="236" y="285" width="22" height="160" rx="11"/>
    <rect x="276" y="342" width="22" height="84" rx="11"/>
    <rect x="1010" y="294" width="22" height="152" rx="11"/>
    <rect x="1050" y="336" width="22" height="92" rx="11"/>
  </g>
  <text x="640" y="580" fill="#f2ead7" font-family="Georgia, serif" font-size="42" text-anchor="middle" letter-spacing="4">LUX VERITAS</text>
  <text x="640" y="626" fill="#c8a86a" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" letter-spacing="5">NOT NOISE. SIGNAL.</text>
</svg>
`;

async function generateVideoPreview() {
  const { chromium } = await import(bundledPlaywrightPath);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm;codecs=vp8";
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2400000 });
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      function draw(frame) {
        const width = canvas.width;
        const height = canvas.height;
        const phase = frame / 180;
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, "#070909");
        bg.addColorStop(0.56, "#12181a");
        bg.addColorStop(1, "#1d2138");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(width * 0.5, height * 0.44, 20, width * 0.5, height * 0.44, width * 0.56);
        glow.addColorStop(0, `rgba(200,168,106,${0.23 + Math.sin(phase * Math.PI * 2) * 0.05})`);
        glow.addColorStop(0.62, "rgba(31,140,114,0.13)");
        glow.addColorStop(1, "rgba(7,9,9,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(200,168,106,0.34)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(190, 505);
        ctx.lineTo(1090, 505);
        ctx.stroke();

        const bars = [196, 236, 276, 1010, 1050, 1090];
        bars.forEach((x, index) => {
          const h = 70 + Math.sin(phase * Math.PI * 2 + index) * 34 + (index % 2 ? 70 : 22);
          ctx.fillStyle = "rgba(31,140,114,0.5)";
          roundRect(ctx, x, 370 - h / 2, 22, h, 11);
          ctx.fill();
        });

        ctx.fillStyle = "#d8c391";
        ctx.fillRect(338, 230, 56, 270);
        ctx.fillRect(338, 454, 212, 46);
        ctx.beginPath();
        ctx.moveTo(698, 230);
        ctx.lineTo(764, 230);
        ctx.lineTo(632, 500);
        ctx.lineTo(574, 500);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#f2ead7";
        ctx.font = "42px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("LUX VERITAS", 640, 580);
        ctx.fillStyle = "#c8a86a";
        ctx.font = "18px Arial, sans-serif";
        ctx.fillText("NOT NOISE. SIGNAL.", 640, 626);
      }

      function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }

      recorder.start();
      for (let frame = 0; frame < 180; frame += 1) {
        draw(frame);
        await new Promise((resolve) => setTimeout(resolve, 1000 / 30));
      }
      await new Promise((resolve) => {
        recorder.onstop = resolve;
        recorder.stop();
      });

      const blob = new Blob(chunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    });

    await writeFile(join(assetsDir, "luxveritas-visual-preview.webm"), Buffer.from(base64, "base64"));
  } finally {
    await browser.close();
  }
}

await mkdir(assetsDir, { recursive: true });
await writeFile(join(assetsDir, "luxveritas-spmvp-preview.wav"), wavBuffer({
  seconds: 9,
  toneHz: 174,
  pulseHz: 0.8,
  gain: 0.22
}));
await writeFile(join(assetsDir, "luxveritas-radio-preview.wav"), wavBuffer({
  seconds: 12,
  toneHz: 110,
  pulseHz: 0.45,
  gain: 0.18
}));
await writeFile(join(assetsDir, "luxveritas-signal-poster.svg"), poster);
await generateVideoPreview();

console.log("Generated MVP audio, video, and poster assets.");
