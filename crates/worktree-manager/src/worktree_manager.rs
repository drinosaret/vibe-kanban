use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use thiserror::Error;
use tracing::debug;

// Keep the override mechanism for workspace base dir
static WORKSPACE_DIR_OVERRIDE: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Clone)]
pub struct WorktreeCleanup {
    pub worktree_path: PathBuf,
    pub git_repo_path: Option<PathBuf>,
}

impl WorktreeCleanup {
    pub fn new(worktree_path: PathBuf, git_repo_path: Option<PathBuf>) -> Self {
        Self {
            worktree_path,
            git_repo_path,
        }
    }
}

#[derive(Debug, Error)]
pub enum WorktreeError {
    #[error(transparent)]
    Git(#[from] git2::Error),
    #[error(transparent)]
    GitService(#[from] git::GitServiceError),
    #[error("Git CLI error: {0}")]
    GitCli(String),
    #[error("Task join error: {0}")]
    TaskJoin(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Branch not found: {0}")]
    BranchNotFound(String),
    #[error("Repository error: {0}")]
    Repository(String),
}

pub struct WorktreeManager;

impl WorktreeManager {
    pub fn set_workspace_dir_override(path: PathBuf) {
        let _ = WORKSPACE_DIR_OVERRIDE.set(path);
    }

    /// No-op: worktree creation disabled in this fork.
    /// All agents work directly in the real repo.
    pub async fn create_worktree(
        _repo_path: &Path,
        _branch_name: &str,
        _worktree_path: &Path,
        _base_branch: &str,
        _create_branch: bool,
    ) -> Result<(), WorktreeError> {
        debug!("create_worktree: no-op (isolation disabled)");
        Ok(())
    }

    /// No-op: worktree existence check disabled in this fork.
    pub async fn ensure_worktree_exists(
        _repo_path: &Path,
        _branch_name: &str,
        _worktree_path: &Path,
    ) -> Result<(), WorktreeError> {
        debug!("ensure_worktree_exists: no-op (isolation disabled)");
        Ok(())
    }

    /// No-op: worktree cleanup disabled in this fork.
    pub async fn batch_cleanup_worktrees(_data: &[WorktreeCleanup]) -> Result<(), WorktreeError> {
        debug!("batch_cleanup_worktrees: no-op (isolation disabled)");
        Ok(())
    }

    /// No-op: worktree cleanup disabled in this fork.
    pub async fn cleanup_worktree(_worktree: &WorktreeCleanup) -> Result<(), WorktreeError> {
        debug!("cleanup_worktree: no-op (isolation disabled)");
        Ok(())
    }

    /// No-op: worktree move disabled in this fork.
    pub async fn move_worktree(
        _repo_path: &Path,
        _old_path: &Path,
        _new_path: &Path,
    ) -> Result<(), WorktreeError> {
        debug!("move_worktree: no-op (isolation disabled)");
        Ok(())
    }

    /// Get the base directory for workspace symlink directories.
    pub fn get_worktree_base_dir() -> PathBuf {
        if let Some(override_path) = WORKSPACE_DIR_OVERRIDE.get() {
            return override_path.join(".vibe-kanban-workspaces");
        }
        Self::get_default_worktree_base_dir()
    }

    /// Get the default base directory (ignoring any override).
    pub fn get_default_worktree_base_dir() -> PathBuf {
        utils::path::get_vibe_kanban_temp_dir().join("worktrees")
    }

    /// No-op: no worktrees to suspect or clean.
    pub async fn cleanup_suspected_worktree(_path: &Path) -> Result<bool, WorktreeError> {
        debug!("cleanup_suspected_worktree: no-op (isolation disabled)");
        Ok(false)
    }
}
