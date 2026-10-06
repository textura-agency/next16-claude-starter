// Browsers, user agents and device profiles shared by every QA tool.
//
// Three lessons from measuring ~50 production sites live in this file:
//  1. Drive the REAL Google Chrome with the GPU on. A software-GL fallback
//     (--disable-gpu, SwiftShader) bills the GPU's work to the page, and a
//     WebGL scene may never build at all under it.
//  2. Always send a plain browser UA for "people" runs. Puppeteer's default UA
//     says "HeadlessChrome", which a robot-form proxy (src/proxy.ts) treats as
//     a bot: no scene, no loader, springs at rest — a probe then "proves" a bug
//     gone that a person still sees.
//  3. The robot form is checked on purpose, with crawler UAs (Googlebot,
//     GPTBot, PageSpeed's Chrome-Lighthouse) — never by accident.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { puppeteer } from "./deps.mjs";

const CANDIDATES = {
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  win32: ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"],
};

export function chromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return (CANDIDATES[process.platform] || []).find(existsSync) || null;
}
export function requireChrome() {
  const p = chromePath();
  if (!p) { console.error("✖ Google Chrome not found — install it or set CHROME_PATH=/path/to/chrome"); process.exit(2); }
  return p;
}

// Real GPU in headless and headed Chrome. Metal is the macOS backend.
export const GPU_FLAGS = [
  ...(process.platform === "darwin" ? ["--use-angle=metal"] : []),
  "--enable-gpu", "--ignore-gpu-blocklist",
];
// A visible window the OS thinks is covered gets its frames throttled.
export const NO_THROTTLE_FLAGS = ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"];
export const QUIET_FLAGS = ["--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-crash-restore-bubble"];

export const UA = {
  // People.
  desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  // Robots.
  googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
};
/** PageSpeed Insights' view: Lighthouse's own UA with Chrome-Lighthouse appended. */
export const asLighthouseBot = (ua) => `${ua} Chrome-Lighthouse`;

// The interactive devices (scroll test, probes). Lighthouse keeps its own
// profiles in lighthouse.mjs — those are Lighthouse's numbers, not these.
export const DEVICES = {
  // A Retina laptop on wifi with a wheel/trackpad. No CPU throttle.
  desktop: { viewport: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false }, cpu: 1, net: "wifi", input: "wheel", ua: UA.desktop },
  // A mid-range phone on 4G: touch flings, 4× CPU. The GPU cannot be throttled.
  mobile: { viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, cpu: 4, net: "4g", input: "touch", ua: UA.android },
};
// Throughput in bytes/s, latency in ms. Localhost delivers every file at once,
// which hides the classic freeze (a lazy image decoding in its revealing frame).
export const NET = {
  wifi: { latency: 20, downloadThroughput: 30e6 / 8, uploadThroughput: 10e6 / 8 },
  "4g": { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 },
};

/** Launch the installed Chrome via puppeteer. headless: true | false. */
export async function launch({ headless = true, args = [], window } = {}) {
  const pp = await puppeteer();
  return pp.launch({
    executablePath: requireChrome(), headless, defaultViewport: null,
    args: [...QUIET_FLAGS, ...GPU_FLAGS, ...NO_THROTTLE_FLAGS, ...(window ? [`--window-size=${window.w},${window.h}`, "--window-position=40,40"] : []), ...args],
  });
}

/** Emulate a device on a page: viewport, UA (always a people UA unless given), CPU, network. */
export async function emulate(page, name, { ua, cpu = true, net = true } = {}) {
  const d = DEVICES[name];
  if (!d) throw new Error(`unknown device "${name}" — one of ${Object.keys(DEVICES).join(", ")}`);
  await page.setViewport(d.viewport);
  await page.setUserAgent(ua || d.ua);
  const cdp = await page.createCDPSession();
  if (cpu && d.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: d.cpu });
  if (net) { await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, ...NET[d.net] }); }
  return { device: d, cdp };
}

/** Chrome processes a hung Lighthouse left behind (their user-data-dir is lighthouse.XXXXXX). */
export function orphanLighthouseChromes() {
  try {
    return execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).split("\n")
      .filter((l) => /user-data-dir=\S*lighthouse\.[A-Za-z0-9]+/.test(l) && !/--type=/.test(l))
      .map((l) => Number(l.trim().split(/\s+/)[0])).filter(Boolean);
  } catch { return []; }
}
