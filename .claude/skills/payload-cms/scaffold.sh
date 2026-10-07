#!/usr/bin/env bash
# Copy one or more CMS kits from templates/ into the project, stripping `.tmpl`.
#
#   bash .claude/skills/payload-cms/scaffold.sh core admin analytics guide
#   bash .claude/skills/payload-cms/scaffold.sh --dry-run core
#   bash .claude/skills/payload-cms/scaffold.sh --force admin      # overwrite existing files
#
# Kits (see SKILL.md for what each one is and the order they go in):
#   core       payload.config, cms/{text-schema,content,globals,seo,seo-pages,seed},
#              collections users + media, share preview, /llms.txt, migrate-direct
#   admin      the skin (custom.css), brand marks, welcome card, row labels
#   analytics  page-views collection, /api/track, the beacon, the Analytics view + card
#   guide      the editor's guide at /admin/guide
#   legal      legal pages as rich text — ADAPT, never copy blind (refused without --force)
#
# Never overwrites an existing file without --force; prints every path it
# wrote or skipped, so the run is the checklist of what to fill in next.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
FORCE=0; DRY=0; KITS=()
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) KITS+=("$arg") ;;
  esac
done
[ "${#KITS[@]}" -eq 0 ] && { sed -n '2,18p' "$0"; exit 2; }

wrote=0; skipped=0
for kit in "${KITS[@]}"; do
  src="$HERE/templates/$kit"
  [ -d "$src" ] || { echo "✖ unknown kit: $kit (core admin analytics guide legal)"; exit 2; }
  if [ "$kit" = legal ] && [ "$FORCE" -eq 0 ]; then
    echo "✖ legal is an adapt-kit: read references/legal-rich-text.md, then re-run with --force"; exit 2
  fi
  echo "── $kit"
  while IFS= read -r -d '' file; do
    rel="${file#"$src"/}"; rel="${rel%.tmpl}"
    dest="$ROOT/$rel"
    if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
      echo "  · exists, kept   $rel"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" -eq 0 ]; then
      mkdir -p "$(dirname "$dest")"; cp "$file" "$dest"
    fi
    echo "  + $rel"; wrote=$((wrote+1))
  done < <(find "$src" -type f -name '*.tmpl' -print0 | sort -z)
done
echo
[ "$DRY" -eq 1 ] && echo "dry run — nothing written."
echo "$wrote written, $skipped kept. Next: grep -rn 'TODO\|PROJECT CONFIG' src/cms src/app/\(payload\) — fill each one."
