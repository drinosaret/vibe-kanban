-- Local workspace-issue link table for tracking which workspaces are linked to which issues
CREATE TABLE IF NOT EXISTS local_workspace_issues (
    workspace_id TEXT NOT NULL,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    PRIMARY KEY (workspace_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_local_workspace_issues_issue ON local_workspace_issues(issue_id);
CREATE INDEX IF NOT EXISTS idx_local_workspace_issues_project ON local_workspace_issues(project_id);
