#!/usr/bin/env node
// axe sweep: colour contrast and target size, sampled every --step ms from
// navigation, as a person (people UA, 4× CPU on the phone). Lighthouse runs
// axe at ONE moment; on an animated page that moment lands mid-fade on some
// runs and not others (A11y flipping 96 ↔ 100 between identical runs), and an
// element still at opacity 0 when Lighthouse looks is never checked at all.
// This names every element that EVER fails, and when.
//
//   node tools/qa/axe-sweep.mjs --url http://localhost:4500/
//   node tools/qa/axe-sweep.mjs --url … --device mobile --ms 12000 --step 120
//   node tools/qa/axe-sweep.mjs --url … --robot            # the robot form (Googlebot UA), at rest
//   node tools/qa/axe-sweep.mjs --url … --strict           # transient (mid-entrance) failures fail too
//
// How to read it:
//  - AT REST (fails in the last sample) = a real defect, even when Lighthouse
//    says 100 — Lighthouse can't resolve text over a <canvas> background, and
//    labels at 1.76:1 over a hero scene passed it.
//  - TRANSIENT (fails, then stops) = a fade caught mid-way. Darker text can't
//    fix it; shorten the fade, start it from a contrast-safe state, or render
//    it at rest for the robot form. Lighthouse may or may not catch it.
//  - target-size: padding a small link with a negative margin does not pass —
//    the hit box must really be 24×24 (or spaced).
// Exit 1 on any at-rest failure (with --strict: any failure).
import { readFileSync } from "node:fs";
import { cli, checkTarget, finish, sleep } from "./lib/run.mjs";
import { launch, DEVICES, UA } from "./lib/chrome.mjs";
import { resolvePath } from "./lib/deps.mjs";

const USAGE = `usage: node tools/qa/axe-sweep.mjs --url <url> [--device desktop|mobile|both] [--ms 9000] [--step 120] [--robot] [--strict] [--rules color-contrast,target-size]`;
const { o, outDir, rel } = cli("axe-sweep", USAGE, {
  device: { type: "string", default: "both" }, ms: { type: "string", default: "9000" }, step: { type: "string", default: "120" },
  robot: { type: "boolean" }, strict: { type: "boolean" }, rules: { type: "string", default: "color-contrast,target-size" }, "allow-dev": { type: "boolean" },
});
const axeSrc = readFileSync(resolvePath("axe-core/axe.min.js"), "utf8");
const total = Number(o.ms), step = Number(o.step), rules = o.rules.split(",");
await checkTarget(o.url);

async function sweep(name) {
  const d = DEVICES[name];
  const browser = await launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(d.viewport);
    await page.setUserAgent(o.robot ? UA.googlebot : d.ua);
    if (d.cpu > 1 && !o.robot) await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: d.cpu });
    await page.evaluateOnNewDocument(axeSrc);
    const t0 = Date.now();
    page.goto(o.url, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
    const seen = new Map();
    let samples = 0, lastSample = [];
    while (Date.now() - t0 < total) {
      await sleep(step);
      const res = await page.evaluate(async (rules) => {
        if (!window.axe) return null;
        const r = await window.axe.run(document, { runOnly: rules, resultTypes: ["violations"] });
        return r.violations.flatMap((v) => v.nodes.map((n) => [v.id, n.target.join(" "), (n.any[0]?.message || n.failureSummary || "").replace(/\s+/g, " ").slice(0, 140)]));
      }, rules).catch(() => null);
      if (!res) continue;
      samples++;
      const t = Date.now() - t0;
      lastSample = res.map(([id, target]) => `${id} | ${target}`);
      for (const [id, target, msg] of res) {
        const key = `${id} | ${target}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push({ t, msg });
      }
    }
    const nodes = [...seen].map(([key, hits]) => ({ key, hits: hits.length, samples, atRest: lastSample.includes(key), first: hits[0], last: hits.at(-1) }));
    const atRest = nodes.filter((n) => n.atRest), transient = nodes.filter((n) => !n.atRest);
    console.log(`  ${name}${o.robot ? " (robot form)" : ""}: ${samples} samples over ${total} ms — ${atRest.length} failing at rest, ${transient.length} transient`);
    for (const n of atRest) console.log(`    ✖ AT REST   ${n.key}\n                ${n.last.msg}`);
    for (const n of transient) console.log(`    ~ transient ${n.key}  (${n.hits}/${samples} samples, ${n.first.t}–${n.last.t} ms)\n                ${n.first.msg}`);
    return { device: name, samples, atRest, transient };
  } finally {
    await browser.close();
  }
}

const out = [];
for (const name of o.device === "both" ? ["desktop", "mobile"] : [o.device]) out.push(await sweep(name));
const rest = out.reduce((n, r) => n + r.atRest.length, 0), trans = out.reduce((n, r) => n + r.transient.length, 0);
const pass = rest === 0 && (!o.strict || trans === 0);
finish({
  outDir, rel, pass, result: { tool: "axe-sweep", url: o.url, robot: !!o.robot, rules, step, ms: total, devices: out },
  summary: `${rest} element(s) failing at rest, ${trans} only during the entrance${trans && !o.strict ? " (--strict to fail on those)" : ""}`,
});
