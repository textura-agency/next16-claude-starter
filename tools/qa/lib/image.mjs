// Pixel helpers: blankness of a region, PSNR between two shots, and a strip of
// shots side by side — in plain JS (pngjs from the QA cache), no ffmpeg.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG as loadPNG } from "./deps.mjs";

const PNG = await loadPNG();
export const decode = (buf) => PNG.sync.read(Buffer.isBuffer(buf) ? buf : readFileSync(buf));

/**
 * Luminance mean / stddev inside a CSS-px rect of a screenshot taken at `dpr`.
 * A blank canvas region has a tiny stddev; compare against the same region's
 * own reference shot (< 35 % of it = blank).
 */
export function regionStats(buf, rect, dpr = 1) {
  const { width, height, data } = decode(buf);
  const x0 = Math.max(0, Math.round(rect.x * dpr)), y0 = Math.max(0, Math.round(rect.y * dpr));
  const x1 = Math.min(width, Math.round((rect.x + rect.w) * dpr)), y1 = Math.min(height, Math.round((rect.y + rect.h) * dpr));
  const step = Math.max(1, Math.round(dpr));
  let n = 0, sum = 0, sq = 0, lit = 0;
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * width + x) * 4;
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++; sum += l; sq += l * l; if (l > 60) lit++;
  }
  const mean = sum / Math.max(1, n);
  return { mean: +mean.toFixed(1), std: +Math.sqrt(Math.max(0, sq / Math.max(1, n) - mean * mean)).toFixed(2), lit: +(lit / Math.max(1, n)).toFixed(4), px: n };
}

/** PSNR (dB) between two same-size PNGs; Infinity when identical, null when sizes differ. */
export function psnr(a, b) {
  const A = decode(a), B = decode(b);
  if (A.width !== B.width || A.height !== B.height) return null;
  let se = 0, n = 0;
  for (let i = 0; i < A.data.length; i += 4) for (let c = 0; c < 3; c++) { const d = A.data[i + c] - B.data[i + c]; se += d * d; n++; }
  const mse = se / n;
  return mse === 0 ? Infinity : +(10 * Math.log10((255 * 255) / mse)).toFixed(2);
}

/** Shots side by side, each scaled to `height` px tall (nearest neighbour), written as PNG. */
export function strip(files, out, height = 600, gap = 8) {
  const imgs = files.map((f) => decode(f));
  const scaled = imgs.map((im) => ({ im, s: height / im.height, w: Math.round(im.width * (height / im.height)) }));
  const W = scaled.reduce((x, e) => x + e.w, 0) + gap * (scaled.length - 1);
  const outPng = new PNG({ width: W, height });
  outPng.data.fill(255);
  let ox = 0;
  for (const { im, s, w } of scaled) {
    for (let y = 0; y < height; y++) {
      const sy = Math.min(im.height - 1, Math.floor(y / s));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(im.width - 1, Math.floor(x / s));
        const si = (sy * im.width + sx) * 4, di = (y * W + ox + x) * 4;
        outPng.data[di] = im.data[si]; outPng.data[di + 1] = im.data[si + 1]; outPng.data[di + 2] = im.data[si + 2]; outPng.data[di + 3] = 255;
      }
    }
    ox += w + gap;
  }
  writeFileSync(out, PNG.sync.write(outPng));
}
