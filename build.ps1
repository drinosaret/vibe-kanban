# Build Vibe Kanban for local use
# Run this after making changes, then use 'vk' from anywhere to launch

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Building frontend..." -ForegroundColor Cyan
Push-Location "$root\packages\local-web"
pnpm run build
Pop-Location

Write-Host "Building Rust server (release)..." -ForegroundColor Cyan
cargo build --release --manifest-path "$root\Cargo.toml" --bin server --bin vibe-kanban-mcp --bin review

Write-Host "Done! Run 'vk' from any terminal to launch." -ForegroundColor Green
