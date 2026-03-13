# Vibe Kanban (Fork)

> Fork of [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) with sandboxing removed and a local-first kanban system.

## What's different in this fork

- **No worktree isolation** — workspaces operate directly in the repo instead of creating isolated git worktrees per workspace. Simpler setup, no symlink juggling.
- **Local kanban** — SQLite-backed projects, issues, statuses, and tags that work without any cloud/remote infrastructure.
- **Windows dev support** — `.npmrc` configured with `script-shell=bash` so pnpm scripts work on Windows.

## Upstream

This fork tracks [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban). To pull upstream changes:

```bash
git fetch upstream
git merge upstream/main
```

---

For upstream documentation, supported agents, and self-hosting guides, see the [original project](https://github.com/BloopAI/vibe-kanban).

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (>=20)
- [pnpm](https://pnpm.io/) (>=8)
- [cargo-watch](https://crates.io/crates/cargo-watch) (`cargo install cargo-watch`)

### Dev server

Use Git Bash (not PowerShell) — the dev script uses `export`:

```bash
pnpm i
pnpm run dev
```

First build takes several minutes (Rust compilation). Subsequent runs use cached builds.

### Building for daily use

```powershell
.\build.ps1
```

This builds the frontend and a release binary. Add a PowerShell alias to launch it from anywhere:

```powershell
# Add to $PROFILE
function vk { & "C:\path\to\vibe-kanban\target\release\server.exe" }
```
