-- Local kanban tables for offline mode (no remote API)
CREATE TABLE IF NOT EXISTS local_projects (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL DEFAULT 'local-org',
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '220 70% 50%',
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_project_statuses (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '220 70% 50%',
    sort_order REAL NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_issues (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    issue_number INTEGER NOT NULL DEFAULT 0,
    simple_id TEXT NOT NULL DEFAULT '',
    status_id TEXT NOT NULL REFERENCES local_project_statuses(id),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    sort_order REAL NOT NULL DEFAULT 0,
    parent_issue_id TEXT,
    parent_issue_sort_order REAL,
    creator_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_tags (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '220 70% 50%'
);

CREATE TABLE IF NOT EXISTS local_issue_tags (
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES local_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_id, tag_id)
);

CREATE TABLE IF NOT EXISTS local_issue_relationships (
    id TEXT PRIMARY KEY NOT NULL,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    related_issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocking', 'related', 'has_duplicate')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_issue_comments (
    id TEXT PRIMARY KEY NOT NULL,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    author_id TEXT,
    parent_id TEXT,
    message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_workspace_issues (
    workspace_id TEXT NOT NULL,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    PRIMARY KEY (workspace_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_local_issues_project ON local_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_local_issues_status ON local_issues(status_id);
CREATE INDEX IF NOT EXISTS idx_local_project_statuses_project ON local_project_statuses(project_id);
CREATE INDEX IF NOT EXISTS idx_local_tags_project ON local_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_local_issue_relationships_issue ON local_issue_relationships(issue_id);
CREATE INDEX IF NOT EXISTS idx_local_issue_relationships_related ON local_issue_relationships(related_issue_id);
CREATE INDEX IF NOT EXISTS idx_local_issue_comments_issue ON local_issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_local_workspace_issues_issue ON local_workspace_issues(issue_id);
CREATE INDEX IF NOT EXISTS idx_local_workspace_issues_project ON local_workspace_issues(project_id);
