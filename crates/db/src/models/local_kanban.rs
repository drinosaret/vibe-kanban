use serde::{Deserialize, Deserializer, Serialize};
use sqlx::{FromRow, SqlitePool};
use ts_rs::TS;

/// Deserialize a field that distinguishes between absent, explicit null, and a value.
/// - absent in JSON → None (field not provided, keep existing)
/// - null in JSON   → Some(None) (explicitly clear)
/// - "value"        → Some(Some(value))
fn deserialize_optional_nullable<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    // If serde calls this, the key was present. Deserialize the inner value.
    let value: Option<String> = Option::deserialize(deserializer)?;
    Ok(Some(value))
}

// ── Models ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalProject {
    pub id: String,
    pub organization_id: String,
    pub name: String,
    pub color: String,
    pub sort_order: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalProjectStatus {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub color: String,
    pub sort_order: f64,
    pub hidden: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalIssue {
    pub id: String,
    pub project_id: String,
    pub issue_number: i64,
    pub simple_id: String,
    pub status_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub sort_order: f64,
    pub parent_issue_id: Option<String>,
    pub parent_issue_sort_order: Option<f64>,
    pub creator_user_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalTag {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalIssueTag {
    pub issue_id: String,
    pub tag_id: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalIssueRelationship {
    pub id: String,
    pub issue_id: String,
    pub related_issue_id: String,
    pub relationship_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalIssueComment {
    pub id: String,
    pub issue_id: String,
    pub author_id: Option<String>,
    pub parent_id: Option<String>,
    pub message: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
pub struct LocalWorkspaceIssue {
    pub workspace_id: String,
    pub issue_id: String,
    pub project_id: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalWorkspaceIssue {
    pub workspace_id: String,
    pub issue_id: String,
    pub project_id: String,
}

// ── Request types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalProject {
    pub organization_id: Option<String>,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: Option<f64>,
}

#[derive(Debug, Deserialize, TS)]
pub struct UpdateLocalProject {
    pub name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<f64>,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalProjectStatus {
    pub name: String,
    pub color: Option<String>,
    pub sort_order: Option<f64>,
    pub hidden: Option<bool>,
}

#[derive(Debug, Deserialize, TS)]
pub struct UpdateLocalProjectStatus {
    pub name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<f64>,
    pub hidden: Option<bool>,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalIssue {
    pub status_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub sort_order: Option<f64>,
    pub parent_issue_id: Option<String>,
    pub parent_issue_sort_order: Option<f64>,
    pub creator_user_id: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
pub struct UpdateLocalIssue {
    pub status_id: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub priority: Option<Option<String>>,
    pub sort_order: Option<f64>,
    /// Double-Option: None = not provided (keep existing), Some(None) = explicitly clear,
    /// Some(Some(id)) = set to new parent.
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub parent_issue_id: Option<Option<String>>,
    pub parent_issue_sort_order: Option<f64>,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalTag {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
pub struct SetIssueTags {
    pub tag_ids: Vec<String>,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalIssueRelationship {
    pub issue_id: String,
    pub related_issue_id: String,
    pub relationship_type: String,
}

#[derive(Debug, Deserialize, TS)]
pub struct CreateLocalIssueComment {
    pub issue_id: String,
    pub message: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
pub struct UpdateLocalIssueComment {
    pub message: Option<String>,
}

// ── Implementations ─────────────────────────────────────────────────────────

struct DefaultStatus {
    name: &'static str,
    color: &'static str,
    sort_order: f64,
}

const DEFAULT_STATUSES: [DefaultStatus; 5] = [
    DefaultStatus {
        name: "Backlog",
        color: "210 20% 50%",
        sort_order: 0.0,
    },
    DefaultStatus {
        name: "Todo",
        color: "220 70% 50%",
        sort_order: 1.0,
    },
    DefaultStatus {
        name: "In Progress",
        color: "45 90% 50%",
        sort_order: 2.0,
    },
    DefaultStatus {
        name: "In Review",
        color: "280 70% 50%",
        sort_order: 3.0,
    },
    DefaultStatus {
        name: "Done",
        color: "142 70% 45%",
        sort_order: 4.0,
    },
];

impl LocalProject {
    pub async fn find_all(
        pool: &SqlitePool,
        organization_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalProject>(
            "SELECT id, organization_id, name, color, sort_order, created_at, updated_at
             FROM local_projects
             WHERE organization_id = ?
             ORDER BY sort_order ASC",
        )
        .bind(organization_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalProject>(
            "SELECT id, organization_id, name, color, sort_order, created_at, updated_at
             FROM local_projects
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        data: &CreateLocalProject,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let org_id = data
            .organization_id
            .as_deref()
            .unwrap_or("local-org");
        let color = data.color.as_deref().unwrap_or("220 70% 50%");
        let sort_order = data.sort_order.unwrap_or(0.0);

        let project = sqlx::query_as::<_, LocalProject>(
            "INSERT INTO local_projects (id, organization_id, name, color, sort_order)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, organization_id, name, color, sort_order, created_at, updated_at",
        )
        .bind(&id)
        .bind(org_id)
        .bind(&data.name)
        .bind(color)
        .bind(sort_order)
        .fetch_one(pool)
        .await?;

        // Create default statuses
        for status in &DEFAULT_STATUSES {
            let status_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO local_project_statuses (id, project_id, name, color, sort_order, hidden)
                 VALUES (?, ?, ?, ?, ?, 0)",
            )
            .bind(&status_id)
            .bind(&id)
            .bind(status.name)
            .bind(status.color)
            .bind(status.sort_order)
            .execute(pool)
            .await?;
        }

        Ok(project)
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        data: &UpdateLocalProject,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let name = data.name.as_deref().unwrap_or(&existing.name);
        let color = data.color.as_deref().unwrap_or(&existing.color);
        let sort_order = data.sort_order.unwrap_or(existing.sort_order);

        sqlx::query_as::<_, LocalProject>(
            "UPDATE local_projects
             SET name = ?, color = ?, sort_order = ?, updated_at = datetime('now', 'subsec')
             WHERE id = ?
             RETURNING id, organization_id, name, color, sort_order, created_at, updated_at",
        )
        .bind(name)
        .bind(color)
        .bind(sort_order)
        .bind(id)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_projects WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl LocalProjectStatus {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalProjectStatus>(
            "SELECT id, project_id, name, color, sort_order, hidden, created_at
             FROM local_project_statuses
             WHERE project_id = ?
             ORDER BY sort_order ASC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalProjectStatus>(
            "SELECT id, project_id, name, color, sort_order, hidden, created_at
             FROM local_project_statuses
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        project_id: &str,
        data: &CreateLocalProjectStatus,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let color = data.color.as_deref().unwrap_or("220 70% 50%");
        let sort_order = data.sort_order.unwrap_or(0.0);
        let hidden = data.hidden.unwrap_or(false);

        sqlx::query_as::<_, LocalProjectStatus>(
            "INSERT INTO local_project_statuses (id, project_id, name, color, sort_order, hidden)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id, project_id, name, color, sort_order, hidden, created_at",
        )
        .bind(&id)
        .bind(project_id)
        .bind(&data.name)
        .bind(color)
        .bind(sort_order)
        .bind(hidden)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        data: &UpdateLocalProjectStatus,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let name = data.name.as_deref().unwrap_or(&existing.name);
        let color = data.color.as_deref().unwrap_or(&existing.color);
        let sort_order = data.sort_order.unwrap_or(existing.sort_order);
        let hidden = data.hidden.unwrap_or(existing.hidden);

        sqlx::query_as::<_, LocalProjectStatus>(
            "UPDATE local_project_statuses
             SET name = ?, color = ?, sort_order = ?, hidden = ?
             WHERE id = ?
             RETURNING id, project_id, name, color, sort_order, hidden, created_at",
        )
        .bind(name)
        .bind(color)
        .bind(sort_order)
        .bind(hidden)
        .bind(id)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_project_statuses WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl LocalIssue {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssue>(
            "SELECT id, project_id, issue_number, simple_id, status_id, title, description,
                    priority, sort_order, parent_issue_id, parent_issue_sort_order,
                    creator_user_id, created_at, updated_at
             FROM local_issues
             WHERE project_id = ?
             ORDER BY sort_order ASC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssue>(
            "SELECT id, project_id, issue_number, simple_id, status_id, title, description,
                    priority, sort_order, parent_issue_id, parent_issue_sort_order,
                    creator_user_id, created_at, updated_at
             FROM local_issues
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        project_id: &str,
        data: &CreateLocalIssue,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let sort_order = data.sort_order.unwrap_or(0.0);

        // Auto-increment issue_number within the project
        let next_number: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COALESCE(MAX(issue_number), 0) + 1 FROM local_issues WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        let simple_id = format!("LOC-{}", next_number);

        sqlx::query_as::<_, LocalIssue>(
            "INSERT INTO local_issues (id, project_id, issue_number, simple_id, status_id, title,
                                       description, priority, sort_order, parent_issue_id,
                                       parent_issue_sort_order, creator_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, project_id, issue_number, simple_id, status_id, title, description,
                       priority, sort_order, parent_issue_id, parent_issue_sort_order,
                       creator_user_id, created_at, updated_at",
        )
        .bind(&id)
        .bind(project_id)
        .bind(next_number)
        .bind(&simple_id)
        .bind(&data.status_id)
        .bind(&data.title)
        .bind(&data.description)
        .bind(&data.priority)
        .bind(sort_order)
        .bind(&data.parent_issue_id)
        .bind(data.parent_issue_sort_order)
        .bind(&data.creator_user_id)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        data: &UpdateLocalIssue,
    ) -> Result<Self, sqlx::Error> {
        let existing = Self::find_by_id(pool, id)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let status_id = data.status_id.as_deref().unwrap_or(&existing.status_id);
        let title = data.title.as_deref().unwrap_or(&existing.title);
        let description = data
            .description
            .as_deref()
            .or(existing.description.as_deref());
        let priority = match &data.priority {
            Some(inner) => inner.as_deref(),
            None => existing.priority.as_deref(),
        };
        let sort_order = data.sort_order.unwrap_or(existing.sort_order);
        let parent_issue_id = match &data.parent_issue_id {
            Some(inner) => inner.as_deref(),   // explicitly provided (null or value)
            None => existing.parent_issue_id.as_deref(), // not provided, keep existing
        };
        let parent_issue_sort_order = data
            .parent_issue_sort_order
            .or(existing.parent_issue_sort_order);

        sqlx::query_as::<_, LocalIssue>(
            "UPDATE local_issues
             SET status_id = ?, title = ?, description = ?, priority = ?, sort_order = ?,
                 parent_issue_id = ?, parent_issue_sort_order = ?,
                 updated_at = datetime('now', 'subsec')
             WHERE id = ?
             RETURNING id, project_id, issue_number, simple_id, status_id, title, description,
                       priority, sort_order, parent_issue_id, parent_issue_sort_order,
                       creator_user_id, created_at, updated_at",
        )
        .bind(status_id)
        .bind(title)
        .bind(description)
        .bind(priority)
        .bind(sort_order)
        .bind(parent_issue_id)
        .bind(parent_issue_sort_order)
        .bind(id)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_issues WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl LocalTag {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalTag>(
            "SELECT id, project_id, name, color
             FROM local_tags
             WHERE project_id = ?
             ORDER BY name ASC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        project_id: &str,
        data: &CreateLocalTag,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let color = data.color.as_deref().unwrap_or("220 70% 50%");

        sqlx::query_as::<_, LocalTag>(
            "INSERT INTO local_tags (id, project_id, name, color)
             VALUES (?, ?, ?, ?)
             RETURNING id, project_id, name, color",
        )
        .bind(&id)
        .bind(project_id)
        .bind(&data.name)
        .bind(color)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_tags WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl LocalIssueTag {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssueTag>(
            "SELECT it.issue_id, it.tag_id
             FROM local_issue_tags it
             INNER JOIN local_issues i ON i.id = it.issue_id
             WHERE i.project_id = ?",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_all_by_issue(
        pool: &SqlitePool,
        issue_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssueTag>(
            "SELECT issue_id, tag_id
             FROM local_issue_tags
             WHERE issue_id = ?",
        )
        .bind(issue_id)
        .fetch_all(pool)
        .await
    }

    pub async fn set_tags(
        pool: &SqlitePool,
        issue_id: &str,
        tag_ids: &[String],
    ) -> Result<Vec<Self>, sqlx::Error> {
        // Remove all existing tags
        sqlx::query("DELETE FROM local_issue_tags WHERE issue_id = ?")
            .bind(issue_id)
            .execute(pool)
            .await?;

        // Insert new tags
        for tag_id in tag_ids {
            sqlx::query(
                "INSERT INTO local_issue_tags (issue_id, tag_id) VALUES (?, ?)",
            )
            .bind(issue_id)
            .bind(tag_id)
            .execute(pool)
            .await?;
        }

        Self::find_all_by_issue(pool, issue_id).await
    }
}

// ── Issue Relationship Operations ───────────────────────────────────────────

impl LocalIssueRelationship {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssueRelationship>(
            "SELECT r.id, r.issue_id, r.related_issue_id, r.relationship_type, r.created_at
             FROM local_issue_relationships r
             INNER JOIN local_issues i ON i.id = r.issue_id
             WHERE i.project_id = ?",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        data: &CreateLocalIssueRelationship,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query_as::<_, LocalIssueRelationship>(
            "INSERT INTO local_issue_relationships (id, issue_id, related_issue_id, relationship_type)
             VALUES (?, ?, ?, ?)
             RETURNING id, issue_id, related_issue_id, relationship_type, created_at",
        )
        .bind(&id)
        .bind(&data.issue_id)
        .bind(&data.related_issue_id)
        .bind(&data.relationship_type)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_issue_relationships WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

// ── Issue Comment Operations ────────────────────────────────────────────────

impl LocalIssueComment {
    pub async fn find_all_by_issue(
        pool: &SqlitePool,
        issue_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalIssueComment>(
            "SELECT id, issue_id, author_id, parent_id, message, created_at, updated_at
             FROM local_issue_comments
             WHERE issue_id = ?
             ORDER BY created_at ASC",
        )
        .bind(issue_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        data: &CreateLocalIssueComment,
    ) -> Result<Self, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query_as::<_, LocalIssueComment>(
            "INSERT INTO local_issue_comments (id, issue_id, parent_id, message)
             VALUES (?, ?, ?, ?)
             RETURNING id, issue_id, author_id, parent_id, message, created_at, updated_at",
        )
        .bind(&id)
        .bind(&data.issue_id)
        .bind(&data.parent_id)
        .bind(&data.message)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        data: &UpdateLocalIssueComment,
    ) -> Result<Self, sqlx::Error> {
        let existing = sqlx::query_as::<_, LocalIssueComment>(
            "SELECT id, issue_id, author_id, parent_id, message, created_at, updated_at
             FROM local_issue_comments WHERE id = ?",
        )
        .bind(id)
        .fetch_one(pool)
        .await?;

        let message = data.message.as_deref().unwrap_or(&existing.message);

        sqlx::query_as::<_, LocalIssueComment>(
            "UPDATE local_issue_comments SET message = ?, updated_at = datetime('now', 'subsec')
             WHERE id = ?
             RETURNING id, issue_id, author_id, parent_id, message, created_at, updated_at",
        )
        .bind(message)
        .bind(id)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM local_issue_comments WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

// ── Workspace Issue Link Operations ─────────────────────────────────────────

impl LocalWorkspaceIssue {
    pub async fn find_all_by_project(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, LocalWorkspaceIssue>(
            "SELECT workspace_id, issue_id, project_id, created_at
             FROM local_workspace_issues
             WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &SqlitePool,
        data: &CreateLocalWorkspaceIssue,
    ) -> Result<Self, sqlx::Error> {
        // INSERT OR IGNORE produces no RETURNING row when the link already exists,
        // so use fetch_optional and fall back to querying the existing row.
        let inserted = sqlx::query_as::<_, LocalWorkspaceIssue>(
            "INSERT OR IGNORE INTO local_workspace_issues (workspace_id, issue_id, project_id)
             VALUES (?, ?, ?)
             RETURNING workspace_id, issue_id, project_id, created_at",
        )
        .bind(&data.workspace_id)
        .bind(&data.issue_id)
        .bind(&data.project_id)
        .fetch_optional(pool)
        .await?;

        match inserted {
            Some(row) => Ok(row),
            None => {
                sqlx::query_as::<_, LocalWorkspaceIssue>(
                    "SELECT workspace_id, issue_id, project_id, created_at
                     FROM local_workspace_issues
                     WHERE workspace_id = ? AND issue_id = ?",
                )
                .bind(&data.workspace_id)
                .bind(&data.issue_id)
                .fetch_one(pool)
                .await
            }
        }
    }

    pub async fn delete_by_workspace(
        pool: &SqlitePool,
        workspace_id: &str,
    ) -> Result<bool, sqlx::Error> {
        let result =
            sqlx::query("DELETE FROM local_workspace_issues WHERE workspace_id = ?")
                .bind(workspace_id)
                .execute(pool)
                .await?;
        Ok(result.rows_affected() > 0)
    }
}
