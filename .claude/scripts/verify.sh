#!/usr/bin/env bash
# Mechanical verification of the hard rules in AGENTS.md / obsidian/workflows/ai-agent-guide.md.
#
# Only rules that are objectively decidable from the source live here. Judgement
# calls (visual fidelity, "is this token named well") belong to the qa-verify
# skill, which a model runs. This script is the floor, not the ceiling.
#
# Every check below either guards a hard rule or a defect that was measured on
# several production sites built from this starter (the numbers live in each
# check's "why" line). Checks are anchored and skip comment lines: a doc comment
# that FORBIDS a pattern, or prose like "as soon as any", once failed a clean
# project — test a new check against a correct line too.
#
# Usage:  .claude/scripts/verify.sh [path ...]      (default scope: src)
# Exit:   0 = no FAILs, 1 = one or more FAILs. WARNs never fail the run.

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

SCOPE=("$@"); [ "$#" -eq 0 ] && SCOPE=("src")

RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
[ -t 1 ] || { RED=""; YEL=""; GRN=""; DIM=""; OFF=""; }

fails=0; warns=0

# report LEVEL "rule" "why" "output"   — output empty means the check passed
report() {
  local level="$1" rule="$2" why="$3" out="${4:-}"
  [ -z "$out" ] && return 0
  if [ "$level" = FAIL ]; then
    fails=$((fails+1)); printf '%s\n' "${RED}FAIL${OFF}  ${rule}"
  else
    warns=$((warns+1)); printf '%s\n' "${YEL}WARN${OFF}  ${rule}"
  fi
  printf '%s\n' "${DIM}      ${why}${OFF}"
  printf '%s\n' "$out" | head -20 | sed 's/^/      /'
  echo
}

# All source, including the vendored engine. Comment lines don't count.
SRC() { grep -rEn --include='*.tsx' --include='*.ts' "$1" "${SCOPE[@]}" 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)'; }
# App source only — excludes the vendored animation engine (#do-not-modify) and,
# once a project adds Payload, its generated types (rich text types its nodes
# `any`, and `generate:types` rewrites the file).
APP() { SRC "$1" | grep -v 'components/animation/springs/' | grep -v 'hooks/animation/' | grep -v 'src/payload-types.ts'; }
CSS() { grep -rEn --include='*.css' "$1" "${SCOPE[@]}" 2>/dev/null; }

echo "── Motion (hard rules #1–#3) ─────────────────────────────────"

report FAIL "CSS keyframes are banned" \
  "All motion is spring-based. Long enough to need keyframes = long enough to deserve a spring." \
  "$(SRC '@keyframes'; CSS '@keyframes')"

report FAIL "third-party animation library" \
  "Only @react-spring/web + spring-text-engine. No framer-motion, no GSAP." \
  "$(SRC "from ['\"](framer-motion|gsap|motion/react|@motionone|animejs)")"

report FAIL 'TextEngine mode="manual"' \
  "Use always / once / forward / progress — see obsidian/frontend/text-engine.md." \
  "$(SRC 'mode=["'"'"']manual["'"'"']')"

report FAIL "leading-none combined with overflow" \
  "overflow clips to the line-height box; leading must stay >= 1.1 (leading-display) or glyphs get shaved." \
  "$(SRC 'leading-none' | grep -E 'overflow')"

report FAIL "duration-fast / duration-normal used as a utility" \
  "Tailwind v4 has no --duration-* namespace — the class compiles to nothing. Use duration-[var(--duration-fast)]." \
  "$(SRC '(^|[^-[:alnum:]])duration-(fast|normal)\b')"

report WARN "CSS transition without token-backed timing (ADR-0014)" \
  "The narrow CSS-transition exception requires duration-[var(--duration-*)] and a token ease." \
  "$(APP 'transition-(colors|opacity|all|transform|shadow)' | grep -vE 'duration-\[var\(--duration-')"

echo "── Tokens (hard rule #4) ─────────────────────────────────────"

report FAIL "hardcoded colour inside className or style" \
  "Add a --raw-* primitive + a semantic token in globals.css, then use the generated utility." \
  "$(APP '(className|style)=[^>]*#[0-9a-fA-F]{3,8}' | grep -vE '^[^:]*app/(opengraph-image|twitter-image|icon|apple-icon)[^/:]*\.tsx:')"
# ↑ Image routes render through satori (ImageResponse), which cannot read CSS
#   custom properties — a literal colour is the only kind it takes.

report WARN "hex literal in source (outside globals.css)" \
  "Config values like siteConfig.themeColor are acceptable; anything visual must be a token." \
  "$(APP '#[0-9a-fA-F]{3,8}\b' | grep -vE '(className|style)=' | grep -vE '\s*(//|/\*|\*)')"

report WARN "arbitrary px/rem value in a class name" \
  "Prefer a spacing token; arbitrary values are for var() references and genuine one-offs." \
  "$(APP 'className=[^>]*\[[0-9.]+(px|rem)\]')"

if [ -f src/app/globals.css ]; then
  report FAIL "literal bound directly in @theme inline" \
    "Every entry must be --<namespace>-<role>: var(--<role>), or theming freezes at build time." \
    "$(awk '/^@theme inline/,/^}/ { print FILENAME ":" FNR ": " $0 }' src/app/globals.css \
       | grep -E ': \s*--[a-z-]+:\s*(#|[0-9]|cubic-bezier|calc)' \
       | grep -vE '(--leading-|--ease-|--text-|--spacing-|--radius-|--breakpoint-)')"

  report FAIL "literal in a Tier 2 semantic token" \
    "Only Tier 1 (--raw-*) may contain literals — see obsidian/frontend/design-system.md." \
    "$(awk '/TIER 2/,/THEME BINDINGS/ { print FILENAME ":" FNR ": " $0 }' src/app/globals.css \
       | grep -E ': \s*--[a-z][a-z0-9-]*:\s*(#[0-9a-fA-F]|[0-9]+(px|ms|rem))' \
       | grep -vE ': \s*--raw-')"
fi

echo "── Architecture (hard rules #5–#9) ───────────────────────────"

route_violations=""
while IFS= read -r p; do
  [ -z "$p" ] && continue
  bad="$(grep -nE "^import " "$p" | grep -vE "from ['\"](@/views/|next(/|\")|react(/|\"))" || true)"
  [ -n "$bad" ] && route_violations="${route_violations}${p}: ${bad}"$'\n'
# `(payload)` is Payload's generated admin plumbing, not a site route.
done < <(find src/app -name 'page.tsx' -not -path 'src/app/(payload)/*' 2>/dev/null)
report FAIL "route imports something other than a view" \
  "app/**/page.tsx delegates only — import from @/views (ADR-0003)." "$route_violations"

report WARN '"use client" on a layout, page or view' \
  "Server Components by default — push the boundary down to a leaf component." \
  "$(grep -rln '"use client"' src/app/layout.tsx src/app/page.tsx src/views 2>/dev/null)"

report FAIL "explicit any" \
  "Type it. If the shape is genuinely unknown use unknown + a zod parse." \
  "$(APP '(:[[:space:]]*any([^[:alnum:]_]|$)|<any>|[^[:alnum:]_]as any([[:space:]]*[]),;.}>]|$)|(^|[^[:alnum:]_])any\[\])')"

report FAIL "next/router (Pages Router API)" \
  "Use next/navigation — see obsidian/frontend/routing.md." \
  "$(APP "from ['\"]next/router['\"]")"

report FAIL "middleware.ts — Next.js 16 renamed it to proxy.ts" \
  "Rename the file AND the exported function (middleware -> proxy). Edge runtime is gone; proxy runs on Node." \
  "$(ls src/middleware.ts middleware.ts 2>/dev/null)"

report FAIL "secret read outside the server env accessor" \
  "Secrets are server-only via getServerEnv() — never NEXT_PUBLIC_, never process.env in a component." \
  "$(APP 'process\.env\.' | grep -v 'src/env.ts' | grep -vE 'NEXT_PUBLIC_|NODE_ENV')"

echo "── Markup & a11y (hard rule #10) ─────────────────────────────"

report WARN "raw <img> instead of next/image" \
  "next/image with explicit width/height prevents CLS." "$(APP '<img\s')"

report WARN "image without alt" \
  "Every image needs alt; decorative images take alt=\"\"." \
  "$(APP '<(Image|img)\s[^>]*/?>' | grep -v 'alt=')"

report WARN "raw <a> for an internal link" \
  "Use <Link> from next/link." "$(APP '<a\s+href=["'"'"']/')"

report WARN "click handler on a non-interactive element" \
  "Use a real <button>." "$(APP '<(div|span)[^>]*onClick=')"

report WARN "more than one <h1> in a view" \
  "Exactly one <h1> per page; never skip heading levels." \
  "$(grep -rc '<h1' src/views/*.tsx 2>/dev/null | awk -F: '$2>1')"

report WARN 'animation component with tag="div"' \
  "Pass the semantically correct element — section, h2, p, li …" \
  "$(APP 'tag=["'"'"']div["'"'"']')"

echo "── Crawlers, caching & metadata ──────────────────────────────"

# An app/loading.tsx that renders nothing still wraps the route in Suspense:
# the page streams into <div hidden> and a script reveals it. Crawlers that run
# no JavaScript (GPTBot, ClaudeBot, PerplexityBot…) read a page whose h1 is
# hidden. Measured: hidden text 394 → 0 and 1,619 → 0 chars after deleting it.
empty_loading=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if grep -qE 'return[[:space:]]+null|=>[[:space:]]*null' "$f" && ! grep -qE '<[A-Za-z]' "$f"; then empty_loading="${empty_loading}${f}"$'\n'; fi
done < <(find "${SCOPE[@]}" -name 'loading.tsx' -path '*app*' 2>/dev/null)
report FAIL "app/loading.tsx renders nothing" \
  "It hides the streamed page from crawlers that run no JS (check: node tools/qa/check-motion.mjs). Delete it; keep a loading file only when it renders a real skeleton." \
  "$empty_loading"

# Reading the request in the home route makes / render per request:
# cache-control private/no-store, a CDN MISS on every visit. The robot form is
# decided in src/proxy.ts instead, and the site origin is known at build time.
report FAIL "request headers read on a prerenderable route (makes / dynamic)" \
  "await headers() / cookies() / isBot() in a page, view, layout, site config or metadata helper turns the route dynamic for everyone. Decide bots in src/proxy.ts; take the origin from the build env." \
  "$(SRC '(await[[:space:]]+(headers|cookies|isBot)\(\)|(^|[^.[:alnum:]_])(headers|cookies)\(\)\.)' | grep -E '(app/(page|layout)\.tsx|views/|lib/site|utils/seo/)' )"

site_ts="src/lib/site.ts"
site_filled=1
if [ -f "$site_ts" ] && grep -qE '`\$\{TODO\}|"TODO:|TODO:' "$site_ts" && grep -qE 'name:[[:space:]]*`\$\{TODO\}' "$site_ts"; then site_filled=0; fi
# Before the brand is filled in, leftovers are expected (WARN); once it is,
# any leftover ships to production (FAIL).
PLACEHOLDER=WARN; [ "$site_filled" -eq 1 ] && PLACEHOLDER=FAIL

[ "$site_filled" -eq 0 ] && report WARN "siteConfig still holds TODO placeholders" \
  "Fill src/lib/site.ts before launch — a production build refuses them. Sites shipped 'New Project' as title, OG card and JSON-LD name while Lighthouse SEO said 100." \
  "$(grep -nE '\$\{TODO\}' "$site_ts" | head -8)"

placeholder_hits="$( { SRC '"New Project"|@newproject|width:[[:space:]]*900,[[:space:]]*height:[[:space:]]*600'; \
  grep -HnE '"name":[[:space:]]*"App"' public/manifest.json public/site.webmanifest 2>/dev/null; } )"
report "$PLACEHOLDER" "placeholder metadata (starter leftovers)" \
  "\"New Project\", @newproject, a 900×600 share card, a manifest named \"App\" — each reached production on many sites. Brand it (node tools/qa/brand-kit.mjs)." \
  "$placeholder_hits"

og_path="$( [ -f "$site_ts" ] && grep -oE 'ogImage:[[:space:]]*"[^"]+"' "$site_ts" | head -1 | sed -E 's/.*"([^"]+)"/\1/' )"
if [ -n "$og_path" ] && [ -f "public${og_path}" ] && command -v sips >/dev/null 2>&1; then
  og_size="$(sips -g pixelWidth -g pixelHeight "public${og_path}" 2>/dev/null | awk '/pixel(Width|Height)/{printf "%s ", $2}')"
  [ "$og_size" != "1200 630 " ] && report "$PLACEHOLDER" "share image is not 1200×630" \
    "Scrapers crop or letterbox anything else. public${og_path} is ${og_size% }." "public${og_path}: ${og_size% }"
fi

echo "── Phone & iOS (measured on production sites) ─────────────────"

# A `t - last <= 1000/30` budget on a 60 Hz loop draws every 3rd frame (20 fps),
# on 120 Hz every 5th (26 fps). Lifting it: 26 → 120 fps, phone scroll the same
# or better, on 5 sites. Rule: no fixed phone frame cap.
report WARN "fixed frame cap (reads as 'low fps' on phones)" \
  "Pay for smoothness with a cheaper frame (DPR, samples, particles) — measure with node tools/qa/fps-probe.mjs. If a cap is truly needed, skip alternate frames (frame % 2), never a time budget." \
  "$(APP '1000[[:space:]]*/[[:space:]]*(20|24|25|30|35|40)([^0-9]|$)|MOBILE_FRAME|FRAME_CAP|MAX_FPS|targetFps|TARGET_FPS')"

# A full-screen menu sized inset-0 / h-lvh hides its foot under Safari's bottom
# toolbar (4 sites). Menus: top-0 h-dvh + bottom padding with
# env(safe-area-inset-bottom). (Canvases are the opposite: large viewport.)
menu_hits="$( { grep -rlEi --include='*.tsx' '(role=["'"'"']dialog|aria-modal|menu|drawer|sheet)' "${SCOPE[@]}" 2>/dev/null \
  | grep -iE '(menu|nav|drawer|sheet)[^/]*$' \
  | xargs -I{} grep -HnE '(^|[^-[:alnum:]])(h-lvh|h-screen|inset-0)([^-[:alnum:]]|$)|100lvh|100vh' {} 2>/dev/null; } | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)')"
report WARN "menu / dialog sized to the large viewport" \
  "On iOS its foot sits under the bottom toolbar. Use top-0 h-dvh and pad the bottom with max(pad, env(safe-area-inset-bottom) + pad). Ignore hits that are backdrops or canvases." \
  "$menu_hits"

# A looping spring under skipAnimation (reduced motion, the robot form)
# completes in 0 ms and restarts in the same tick — the tab hangs. Live on
# several production sites.
report WARN "looping spring without the motion-off gate" \
  "loop: true freezes the page for reduced-motion visitors and on the robot form. Use loop: !useMotionOff() (src/hooks/use-motion-off.ts); verify with node tools/qa/check-motion.mjs." \
  "$(APP 'loop:[[:space:]]*(true|\{)' )"

# iOS drops WebGL contexts under memory pressure; a scene that never rebuilds
# is a permanent blank (scroll away and back → the hero is gone).
ctx_files="$(grep -rlE --include='*.ts' --include='*.tsx' 'getContext\(["'"'"']webgl|new (THREE\.)?WebGLRenderer|<Canvas[[:space:]>]' "${SCOPE[@]}" 2>/dev/null | grep -v 'lib/scene/webgl-context')"
ctx_unhandled=""
for f in $ctx_files; do grep -qE 'webglcontextlost|keepSceneAlive|watchContext' "$f" || ctx_unhandled="${ctx_unhandled}${f}"$'\n'; done
report WARN "WebGL scene without context-loss recovery" \
  "Wire it through keepSceneAlive / watchContext (src/lib/scene/webgl-context.ts); verify with node tools/qa/context-loss-probe.mjs and webkit-probe.mjs --faults." \
  "$ctx_unhandled"

# A variable on <html> written every frame restyles the whole page (571
# elements, 10–22 ms a frame at 4× CPU on one site): scope it, write on change.
report WARN "CSS variable written on <html> / <body>" \
  "Inside a frame loop this restyles every element each frame. Write it on the smallest element that reads it, and only when the value changes." \
  "$(APP '(documentElement|document\.body)\.style\.setProperty\([[:space:]]*["'"'"'`]--')"

echo "── Hygiene ───────────────────────────────────────────────────"

report WARN "console.log in source" "Remove before committing." "$(APP 'console\.(log|debug)')"
report WARN "TODO / FIXME marker" "Resolve, or move it to an issue." "$(APP '(TODO|FIXME)')"

if git rev-parse --git-dir >/dev/null 2>&1; then
  report FAIL "vendored animation engine modified (hard rule #2)" \
    "src/components/animation/springs/ and src/hooks/animation/ need explicit sign-off (ADR-0009)." \
    "$(git diff --name-only HEAD -- src/components/animation/springs src/hooks/animation 2>/dev/null)"
fi

echo "──────────────────────────────────────────────────────────────"
if [ "$fails" -gt 0 ]; then
  printf '%s\n' "${RED}${fails} FAIL${OFF} / ${YEL}${warns} WARN${OFF} — every FAIL must be fixed."
  echo "Also required: yarn lint, yarn build, and the judgement checks in the qa-verify skill."
  exit 1
fi
printf '%s\n' "${GRN}0 FAIL${OFF} / ${YEL}${warns} WARN${OFF} — mechanical rules pass."
echo "Also required: yarn lint, yarn build, and the judgement checks in the qa-verify skill."
exit 0
