use std::path::{Path, PathBuf};

use db::{
    DBService,
    models::{
        image::WorkspaceImage,
        repo::{Repo, RepoError},
        requests::WorkspaceRepoInput,
        session::Session,
        workspace::Workspace as DbWorkspace,
        workspace_repo::{CreateWorkspaceRepo, RepoWithTargetBranch, WorkspaceRepo},
    },
};
use git::{GitService, GitServiceError};
use thiserror::Error;
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use worktree_manager::{WorktreeCleanup, WorktreeError, WorktreeManager};

#[derive(Debug, Clone)]
pub struct RepoWorkspaceInput {
    pub repo: Repo,
    pub target_branch: String,
}

impl RepoWorkspaceInput {
    pub fn new(repo: Repo, target_branch: String) -> Self {
        Self {
            repo,
            target_branch,
        }
    }
}

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Repo(#[from] RepoError),
    #[error(transparent)]
    Worktree(#[from] WorktreeError),
    #[error(transparent)]
    GitService(#[from] GitServiceError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Workspace not found")]
    WorkspaceNotFound,
    #[error("Repository already attached to workspace")]
    RepoAlreadyAttached,
    #[error("Branch '{branch}' does not exist in repository '{repo_name}'")]
    BranchNotFound { repo_name: String, branch: String },
    #[error("No repositories provided")]
    NoRepositories,
    #[error("Partial workspace creation failed: {0}")]
    PartialCreation(String),
}

/// Info about a single repo's worktree within a workspace
#[derive(Debug, Clone)]
pub struct RepoWorktree {
    pub repo_id: Uuid,
    pub repo_name: String,
    pub source_repo_path: PathBuf,
    pub worktree_path: PathBuf,
}

/// A container directory holding worktrees for all project repos
#[derive(Debug, Clone)]
pub struct WorktreeContainer {
    pub workspace_dir: PathBuf,
    pub worktrees: Vec<RepoWorktree>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceDeletionContext {
    pub workspace_id: Uuid,
    pub branch_name: String,
    pub workspace_dir: Option<PathBuf>,
    pub repositories: Vec<Repo>,
    pub repo_paths: Vec<PathBuf>,
    pub session_ids: Vec<Uuid>,
}

#[derive(Clone)]
pub struct ManagedWorkspace {
    pub workspace: DbWorkspace,
    pub repos: Vec<RepoWithTargetBranch>,
    db: DBService,
}

impl ManagedWorkspace {
    fn new(db: DBService, workspace: DbWorkspace, repos: Vec<RepoWithTargetBranch>) -> Self {
        Self {
            workspace,
            repos,
            db,
        }
    }

    async fn attach_repository(&self, repo: &WorkspaceRepoInput) -> Result<(), sqlx::Error> {
        let create_repo = CreateWorkspaceRepo {
            repo_id: repo.repo_id,
            target_branch: repo.target_branch.clone(),
        };

        WorkspaceRepo::create_many(
            &self.db.pool,
            self.workspace.id,
            std::slice::from_ref(&create_repo),
        )
        .await
        .map(|_| ())
    }

    async fn refresh(&mut self) -> Result<(), WorkspaceError> {
        self.workspace = DbWorkspace::find_by_id(&self.db.pool, self.workspace.id)
            .await?
            .ok_or(WorkspaceError::WorkspaceNotFound)?;
        self.repos = WorkspaceRepo::find_repos_with_target_branch_for_workspace(
            &self.db.pool,
            self.workspace.id,
        )
        .await?;
        Ok(())
    }

    pub async fn add_repository(
        &mut self,
        repo_ref: &WorkspaceRepoInput,
        git: &GitService,
    ) -> Result<(), WorkspaceError> {
        let repo = Repo::find_by_id(&self.db.pool, repo_ref.repo_id)
            .await?
            .ok_or(RepoError::NotFound)?;

        if !git.check_branch_exists(&repo.path, &repo_ref.target_branch)? {
            return Err(WorkspaceError::BranchNotFound {
                repo_name: repo.name,
                branch: repo_ref.target_branch.clone(),
            });
        }

        if WorkspaceRepo::find_by_workspace_and_repo_id(
            &self.db.pool,
            self.workspace.id,
            repo_ref.repo_id,
        )
        .await?
        .is_some()
        {
            return Err(WorkspaceError::RepoAlreadyAttached);
        }

        self.attach_repository(repo_ref).await?;
        self.refresh().await?;
        Ok(())
    }

    pub async fn associate_images(&self, image_ids: &[Uuid]) -> Result<(), sqlx::Error> {
        if image_ids.is_empty() {
            return Ok(());
        }

        WorkspaceImage::associate_many_dedup(&self.db.pool, self.workspace.id, image_ids).await
    }

    pub async fn prepare_deletion_context(&self) -> Result<WorkspaceDeletionContext, sqlx::Error> {
        let repositories =
            WorkspaceRepo::find_repos_for_workspace(&self.db.pool, self.workspace.id).await?;
        let session_ids = Session::find_by_workspace_id(&self.db.pool, self.workspace.id)
            .await?
            .into_iter()
            .map(|session| session.id)
            .collect::<Vec<_>>();
        let repo_paths = repositories
            .iter()
            .map(|repo| repo.path.clone())
            .collect::<Vec<_>>();

        Ok(WorkspaceDeletionContext {
            workspace_id: self.workspace.id,
            branch_name: self.workspace.branch.clone(),
            workspace_dir: self.workspace.container_ref.clone().map(PathBuf::from),
            repositories,
            repo_paths,
            session_ids,
        })
    }

    pub async fn delete_record(&self) -> Result<u64, sqlx::Error> {
        DbWorkspace::delete(&self.db.pool, self.workspace.id).await
    }
}

#[derive(Clone)]
pub struct WorkspaceManager {
    db: DBService,
}

impl WorkspaceManager {
    pub fn new(db: DBService) -> Self {
        Self { db }
    }

    pub async fn load_managed_workspace(
        &self,
        workspace: DbWorkspace,
    ) -> Result<ManagedWorkspace, sqlx::Error> {
        let repos =
            WorkspaceRepo::find_repos_with_target_branch_for_workspace(&self.db.pool, workspace.id)
                .await?;
        Ok(ManagedWorkspace::new(self.db.clone(), workspace, repos))
    }

    pub fn spawn_workspace_deletion_cleanup(
        context: WorkspaceDeletionContext,
        delete_branches: bool,
    ) {
        tokio::spawn(async move {
            let WorkspaceDeletionContext {
                workspace_id,
                branch_name: _branch_name,
                workspace_dir,
                repositories,
                repo_paths: _repo_paths,
                session_ids,
            } = context;

            for session_id in session_ids {
                if let Err(e) = Self::remove_session_process_logs(session_id).await {
                    warn!(
                        "Failed to remove filesystem process logs for session {}: {}",
                        session_id, e
                    );
                }
            }

            if let Some(workspace_dir) = workspace_dir {
                info!(
                    "Starting background cleanup for workspace {} at {}",
                    workspace_id,
                    workspace_dir.display()
                );

                if let Err(e) = Self::cleanup_workspace(&workspace_dir, &repositories).await {
                    error!(
                        "Background workspace cleanup failed for {} at {}: {}",
                        workspace_id,
                        workspace_dir.display(),
                        e
                    );
                } else {
                    info!(
                        "Background cleanup completed for workspace {}",
                        workspace_id
                    );
                }
            }

            // Branch deletion disabled in this fork.
            // All workspaces share the same branch — deleting it would
            // destroy the active working branch.
            if delete_branches {
                debug!("Branch deletion requested but disabled in no-isolation fork");
            }
        });
    }

    async fn remove_session_process_logs(session_id: Uuid) -> Result<(), std::io::Error> {
        let dir = utils::execution_logs::process_logs_session_dir(session_id);
        match tokio::fs::remove_dir_all(&dir).await {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e),
        }
    }

    /// Create a workspace with worktrees for all repositories.
    /// On failure, rolls back any already-created worktrees.
    pub async fn create_workspace(
        workspace_dir: &Path,
        repos: &[RepoWorkspaceInput],
        _branch_name: &str,
    ) -> Result<WorktreeContainer, WorkspaceError> {
        if repos.is_empty() {
            return Err(WorkspaceError::NoRepositories);
        }

        info!(
            "Creating workspace at {} with {} repositories",
            workspace_dir.display(),
            repos.len()
        );

        tokio::fs::create_dir_all(workspace_dir).await?;

        let mut created_worktrees: Vec<RepoWorktree> = Vec::new();

        for input in repos {
            let worktree_path = workspace_dir.join(&input.repo.name);

            debug!(
                "Creating symlink for repo '{}': {} -> {}",
                input.repo.name,
                worktree_path.display(),
                input.repo.path.display()
            );

            // Create symlink: workspace_dir/<repo-name> -> actual repo path
            match create_repo_symlink(&input.repo.path, &worktree_path).await {
                Ok(()) => {
                    created_worktrees.push(RepoWorktree {
                        repo_id: input.repo.id,
                        repo_name: input.repo.name.clone(),
                        source_repo_path: input.repo.path.clone(),
                        worktree_path,
                    });
                }
                Err(e) => {
                    error!(
                        "Failed to create symlink for repo '{}': {}. Rolling back...",
                        input.repo.name, e
                    );

                    // Rollback: remove symlinks we've created so far
                    for wt in &created_worktrees {
                        if let Err(cleanup_err) = remove_symlink(&wt.worktree_path).await {
                            debug!(
                                "Could not remove symlink during rollback: {}",
                                cleanup_err
                            );
                        }
                    }

                    if let Err(cleanup_err) = tokio::fs::remove_dir(workspace_dir).await {
                        debug!(
                            "Could not remove workspace dir during rollback: {}",
                            cleanup_err
                        );
                    }

                    return Err(WorkspaceError::PartialCreation(format!(
                        "Failed to create symlink for repo '{}': {}",
                        input.repo.name, e
                    )));
                }
            }
        }

        info!(
            "Successfully created workspace with {} worktrees",
            created_worktrees.len()
        );

        Ok(WorktreeContainer {
            workspace_dir: workspace_dir.to_path_buf(),
            worktrees: created_worktrees,
        })
    }

    /// Ensure all symlinks in a workspace exist and point to valid targets.
    pub async fn ensure_workspace_exists(
        workspace_dir: &Path,
        repos: &[RepoWorkspaceInput],
        _branch_name: &str,
    ) -> Result<(), WorkspaceError> {
        if repos.is_empty() {
            return Err(WorkspaceError::NoRepositories);
        }

        if !workspace_dir.exists() {
            tokio::fs::create_dir_all(workspace_dir).await?;
        }

        for input in repos {
            let repo = &input.repo;
            let link_path = workspace_dir.join(&repo.name);

            // Check if symlink exists and points to the right place
            let needs_creation = if link_path.symlink_metadata().is_ok() {
                match tokio::fs::read_link(&link_path).await {
                    Ok(target) => target != repo.path,
                    Err(_) => true,
                }
            } else {
                true
            };

            if needs_creation {
                debug!(
                    "Recreating symlink for repo '{}': {} -> {}",
                    repo.name,
                    link_path.display(),
                    repo.path.display()
                );
                create_repo_symlink(&repo.path, &link_path).await?;
            }
        }

        Ok(())
    }

    /// Clean up a workspace's symlink directory.
    /// Safety: only deletes if directory contains only symlinks/config files.
    pub async fn cleanup_workspace(
        workspace_dir: &Path,
        repos: &[Repo],
    ) -> Result<(), WorkspaceError> {
        info!("Cleaning up workspace at {}", workspace_dir.display());

        // WorktreeManager::batch_cleanup_worktrees is a no-op, but call it
        // to maintain the same call flow for upstream compatibility
        let cleanup_data: Vec<WorktreeCleanup> = repos
            .iter()
            .map(|repo| {
                let worktree_path = workspace_dir.join(&repo.name);
                WorktreeCleanup::new(worktree_path, Some(repo.path.clone()))
            })
            .collect();
        WorktreeManager::batch_cleanup_worktrees(&cleanup_data).await?;

        // Guard: only delete if workspace dir contains only symlinks
        if workspace_dir.exists() {
            let workspace_dir_owned = workspace_dir.to_path_buf();
            let safe = tokio::task::spawn_blocking(move || is_safe_to_delete(&workspace_dir_owned))
                .await
                .unwrap_or(false);

            if safe {
                if let Err(e) = tokio::fs::remove_dir_all(workspace_dir).await {
                    debug!(
                        "Could not remove workspace directory {}: {}",
                        workspace_dir.display(),
                        e
                    );
                }
            } else {
                warn!(
                    "Skipping deletion of workspace dir {} — contains non-symlink entries",
                    workspace_dir.display()
                );
            }
        }

        Ok(())
    }

    /// Get the base directory for workspaces (same as worktree base dir)
    pub fn get_workspace_base_dir() -> PathBuf {
        WorktreeManager::get_worktree_base_dir()
    }

    /// Legacy migration disabled in no-isolation fork.
    /// No worktrees exist to migrate.
    pub async fn migrate_legacy_worktree(
        _workspace_dir: &Path,
        _repo: &Repo,
    ) -> Result<bool, WorkspaceError> {
        Ok(false)
    }

    pub async fn cleanup_orphan_workspaces(&self) {
        if std::env::var("DISABLE_WORKTREE_CLEANUP").is_ok() {
            info!(
                "Orphan workspace cleanup is disabled via DISABLE_WORKTREE_CLEANUP environment variable"
            );
            return;
        }

        // Always clean up the default directory
        let default_dir = WorktreeManager::get_default_worktree_base_dir();
        self.cleanup_orphans_in_directory(&default_dir).await;

        // Also clean up custom directory if it's different from the default
        let current_dir = Self::get_workspace_base_dir();
        if current_dir != default_dir {
            self.cleanup_orphans_in_directory(&current_dir).await;
        }
    }

    async fn cleanup_orphans_in_directory(&self, workspace_base_dir: &Path) {
        if !workspace_base_dir.exists() {
            debug!(
                "Workspace base directory {} does not exist, skipping orphan cleanup",
                workspace_base_dir.display()
            );
            return;
        }

        let entries = match std::fs::read_dir(workspace_base_dir) {
            Ok(entries) => entries,
            Err(e) => {
                error!(
                    "Failed to read workspace base directory {}: {}",
                    workspace_base_dir.display(),
                    e
                );
                return;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(e) => {
                    warn!("Failed to read directory entry: {}", e);
                    continue;
                }
            };

            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let workspace_path_str = path.to_string_lossy().to_string();
            if let Ok(false) =
                DbWorkspace::container_ref_exists(&self.db.pool, &workspace_path_str).await
            {
                info!("Found orphaned workspace: {}", workspace_path_str);
                if let Err(e) = Self::cleanup_workspace_without_repos(&path).await {
                    error!(
                        "Failed to remove orphaned workspace {}: {}",
                        workspace_path_str, e
                    );
                } else {
                    info!(
                        "Successfully removed orphaned workspace: {}",
                        workspace_path_str
                    );
                }
            }
        }
    }

    async fn cleanup_workspace_without_repos(workspace_dir: &Path) -> Result<(), WorkspaceError> {
        info!(
            "Cleaning up orphaned workspace at {}",
            workspace_dir.display()
        );

        // Guard: only delete if workspace dir is safe (contains only symlinks)
        if workspace_dir.exists() {
            let workspace_dir_owned = workspace_dir.to_path_buf();
            let safe = tokio::task::spawn_blocking(move || is_safe_to_delete(&workspace_dir_owned))
                .await
                .unwrap_or(false);

            if safe {
                if let Err(e) = tokio::fs::remove_dir_all(workspace_dir).await {
                    debug!(
                        "Could not remove workspace directory {}: {}",
                        workspace_dir.display(),
                        e
                    );
                }
            } else {
                warn!(
                    "Skipping deletion of orphaned workspace dir {} — contains non-symlink entries",
                    workspace_dir.display()
                );
            }
        }

        Ok(())
    }
}

/// Create a symlink from `link_path` to `repo_path`.
/// On Unix: std::os::unix::fs::symlink
/// On Windows: std::os::windows::fs::symlink_dir (requires Developer Mode)
async fn create_repo_symlink(repo_path: &Path, link_path: &Path) -> Result<(), WorkspaceError> {
    let repo_path = repo_path.to_path_buf();
    let link_path = link_path.to_path_buf();

    tokio::task::spawn_blocking(move || {
        // Remove existing link/dir if present
        if link_path.exists() || link_path.symlink_metadata().is_ok() {
            if link_path.is_dir() && !link_path.symlink_metadata()
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false)
            {
                // Real directory — don't delete it
                return Err(WorkspaceError::Io(std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    format!("Real directory exists at {}, refusing to overwrite", link_path.display()),
                )));
            }
            // Remove existing symlink
            #[cfg(unix)]
            std::fs::remove_file(&link_path)?;
            #[cfg(windows)]
            std::fs::remove_dir(&link_path)?;
        }

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&repo_path, &link_path)?;
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(&repo_path, &link_path)?;
        }

        Ok(())
    })
    .await
    .map_err(|e| WorkspaceError::Io(std::io::Error::new(
        std::io::ErrorKind::Other,
        format!("Task join error: {e}"),
    )))?
}

/// Remove a symlink (cross-platform).
async fn remove_symlink(link_path: &Path) -> Result<(), std::io::Error> {
    let link_path = link_path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        if link_path.symlink_metadata().is_ok() {
            #[cfg(unix)]
            std::fs::remove_file(&link_path)?;
            #[cfg(windows)]
            std::fs::remove_dir(&link_path)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("{e}")))?
}

/// Check that a directory only contains symlinks (safe to delete).
/// Returns false if any entry is a real file or directory.
fn is_safe_to_delete(dir: &Path) -> bool {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return false,
    };

    for entry in entries.flatten() {
        let metadata = match entry.path().symlink_metadata() {
            Ok(m) => m,
            Err(_) => return false,
        };
        // Allow symlinks and regular files (like CLAUDE.md config files written to workspace dir)
        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            // Real subdirectory — not safe
            tracing::warn!(
                "Refusing to delete workspace dir: found real directory at {}",
                entry.path().display()
            );
            return false;
        }
    }
    true
}
