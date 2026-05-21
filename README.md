# next16-claude-starter

A **Next.js 16 starter template** for animation-heavy marketing & landing sites,
built by [Textura](https://textura.agency). Package: `next16-claude-starter`.

Every motion is spring-based (`@react-spring/web`), text animation runs through
`spring-text-engine`, scrolling is smoothed with Lenis, and styling uses Tailwind
CSS v4. Frontend-only — no backend yet.

## Getting started

```bash
yarn install
yarn dev      # http://localhost:3000
```

| Script | Purpose |
|--------|---------|
| `yarn dev` | Development server |
| `yarn build` | Production build |
| `yarn start` | Serve the production build |
| `yarn lint` | ESLint |

## 📖 Documentation

Full project documentation lives in the **`obsidian/`** Obsidian vault — open
that folder in [Obsidian](https://obsidian.md) for a linked, navigable second brain
covering architecture, the animation system, conventions, and workflows.

Start at [`obsidian/README.md`](./obsidian/README.md).

## For AI agents

> ⚠️ This is **not** the Next.js you may know — APIs and conventions differ from
> older versions. Read `AGENTS.md` and the `obsidian/` vault before writing code.

Entry points `AGENTS.md` · `CLAUDE.md` · `.cursorrules` all lead into the
`obsidian/` vault — the single source of truth for this project.

### Automated workflow

`.claude/settings.json` ships Claude Code hooks that enforce the documentation
workflow automatically — no need to prompt for it:

- **`SessionStart`** — points the agent at the vault at the start of every chat.
- **`UserPromptSubmit`** — reminds the agent to follow the relevant guide each request.
- **`Stop`** — checks the vault was updated to match any change made that turn.

New hooks take effect on the next Claude Code session (or after running `/hooks`).
Review or disable them anytime with `/hooks`. See
[`obsidian/workflows/ai-agent-guide.md`](./obsidian/workflows/ai-agent-guide.md).
