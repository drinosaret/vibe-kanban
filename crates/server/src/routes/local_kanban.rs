use axum::{
    Router,
    extract::{Json, Path, Query, State},
    response::Json as ResponseJson,
    routing::get,
};
use db::models::local_kanban::{
    CreateLocalIssue, CreateLocalIssueComment, CreateLocalIssueRelationship, CreateLocalProject,
    CreateLocalProjectStatus, CreateLocalTag, CreateLocalWorkspaceIssue, LocalIssue,
    LocalIssueComment, LocalIssueRelationship, LocalIssueTag, LocalProject, LocalProjectStatus,
    LocalTag, LocalWorkspaceIssue, SetIssueTags, UpdateLocalIssue, UpdateLocalIssueComment,
    UpdateLocalProject, UpdateLocalProjectStatus,
};
use deployment::Deployment;
use serde::Deserialize;
use ts_rs::TS;
use utils::response::ApiResponse;

use crate::{DeploymentImpl, error::ApiError};

// ── Query params ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, TS)]
pub struct ListProjectsQuery {
    pub organization_id: Option<String>,
}

// ── Project routes ──────────────────────────────────────────────────────────

async fn list_projects(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListProjectsQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalProject>>>, ApiError> {
    let org_id = query.organization_id.as_deref().unwrap_or("local-org");
    let projects = LocalProject::find_all(&deployment.db().pool, org_id).await?;
    Ok(ResponseJson(ApiResponse::success(projects)))
}

async fn create_project(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateLocalProject>,
) -> Result<ResponseJson<ApiResponse<LocalProject>>, ApiError> {
    let project = LocalProject::create(&deployment.db().pool, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(project)))
}

async fn get_project(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<LocalProject>>, ApiError> {
    let project = LocalProject::find_by_id(&deployment.db().pool, &id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Project not found".to_string()))?;
    Ok(ResponseJson(ApiResponse::success(project)))
}

async fn update_project(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLocalProject>,
) -> Result<ResponseJson<ApiResponse<LocalProject>>, ApiError> {
    let project = LocalProject::update(&deployment.db().pool, &id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(project)))
}

async fn delete_project(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = LocalProject::delete(&deployment.db().pool, &id).await?;
    if rows == 0 {
        Err(ApiError::BadRequest("Project not found".to_string()))
    } else {
        Ok(ResponseJson(ApiResponse::success(())))
    }
}

// ── Status routes ───────────────────────────────────────────────────────────

async fn list_statuses(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalProjectStatus>>>, ApiError> {
    let statuses =
        LocalProjectStatus::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(statuses)))
}

async fn create_status(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
    Json(payload): Json<CreateLocalProjectStatus>,
) -> Result<ResponseJson<ApiResponse<LocalProjectStatus>>, ApiError> {
    let status =
        LocalProjectStatus::create(&deployment.db().pool, &project_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(status)))
}

async fn update_status(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLocalProjectStatus>,
) -> Result<ResponseJson<ApiResponse<LocalProjectStatus>>, ApiError> {
    let status = LocalProjectStatus::update(&deployment.db().pool, &id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(status)))
}

async fn delete_status(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = LocalProjectStatus::delete(&deployment.db().pool, &id).await?;
    if rows == 0 {
        Err(ApiError::BadRequest("Status not found".to_string()))
    } else {
        Ok(ResponseJson(ApiResponse::success(())))
    }
}

// ── Issue routes ────────────────────────────────────────────────────────────

async fn list_issues(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalIssue>>>, ApiError> {
    let issues = LocalIssue::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(issues)))
}

async fn create_issue(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
    Json(payload): Json<CreateLocalIssue>,
) -> Result<ResponseJson<ApiResponse<LocalIssue>>, ApiError> {
    let issue = LocalIssue::create(&deployment.db().pool, &project_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(issue)))
}

async fn get_issue(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<LocalIssue>>, ApiError> {
    let issue = LocalIssue::find_by_id(&deployment.db().pool, &id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Issue not found".to_string()))?;
    Ok(ResponseJson(ApiResponse::success(issue)))
}

async fn update_issue(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLocalIssue>,
) -> Result<ResponseJson<ApiResponse<LocalIssue>>, ApiError> {
    let issue = LocalIssue::update(&deployment.db().pool, &id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(issue)))
}

async fn delete_issue(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = LocalIssue::delete(&deployment.db().pool, &id).await?;
    if rows == 0 {
        Err(ApiError::BadRequest("Issue not found".to_string()))
    } else {
        Ok(ResponseJson(ApiResponse::success(())))
    }
}

// ── Tag routes ──────────────────────────────────────────────────────────────

async fn list_tags(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalTag>>>, ApiError> {
    let tags = LocalTag::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(tags)))
}

async fn create_tag(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
    Json(payload): Json<CreateLocalTag>,
) -> Result<ResponseJson<ApiResponse<LocalTag>>, ApiError> {
    let tag = LocalTag::create(&deployment.db().pool, &project_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(tag)))
}

async fn delete_tag(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = LocalTag::delete(&deployment.db().pool, &id).await?;
    if rows == 0 {
        Err(ApiError::BadRequest("Tag not found".to_string()))
    } else {
        Ok(ResponseJson(ApiResponse::success(())))
    }
}

// ── Issue tag routes ────────────────────────────────────────────────────────

async fn list_issue_tags_for_project(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalIssueTag>>>, ApiError> {
    let tags = LocalIssueTag::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(tags)))
}

async fn set_issue_tags(
    State(deployment): State<DeploymentImpl>,
    Path(issue_id): Path<String>,
    Json(payload): Json<SetIssueTags>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalIssueTag>>>, ApiError> {
    let tags =
        LocalIssueTag::set_tags(&deployment.db().pool, &issue_id, &payload.tag_ids).await?;
    Ok(ResponseJson(ApiResponse::success(tags)))
}

// ── Issue relationship routes ───────────────────────────────────────────────

async fn list_issue_relationships_for_project(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalIssueRelationship>>>, ApiError> {
    let rels = LocalIssueRelationship::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(rels)))
}

async fn create_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateLocalIssueRelationship>,
) -> Result<ResponseJson<ApiResponse<LocalIssueRelationship>>, ApiError> {
    let rel = LocalIssueRelationship::create(&deployment.db().pool, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(rel)))
}

async fn delete_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    LocalIssueRelationship::delete(&deployment.db().pool, &id).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}

// ── Issue comment routes ───────────────────────────────────────────────────

async fn list_issue_comments(
    State(deployment): State<DeploymentImpl>,
    Path(issue_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalIssueComment>>>, ApiError> {
    let comments = LocalIssueComment::find_all_by_issue(&deployment.db().pool, &issue_id).await?;
    Ok(ResponseJson(ApiResponse::success(comments)))
}

async fn create_issue_comment(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateLocalIssueComment>,
) -> Result<ResponseJson<ApiResponse<LocalIssueComment>>, ApiError> {
    let comment = LocalIssueComment::create(&deployment.db().pool, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(comment)))
}

async fn update_issue_comment(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateLocalIssueComment>,
) -> Result<ResponseJson<ApiResponse<LocalIssueComment>>, ApiError> {
    let comment = LocalIssueComment::update(&deployment.db().pool, &id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(comment)))
}

async fn delete_issue_comment(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    LocalIssueComment::delete(&deployment.db().pool, &id).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}

// ── Workspace issue link routes ─────────────────────────────────────────────

async fn list_workspace_issues(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<LocalWorkspaceIssue>>>, ApiError> {
    let links =
        LocalWorkspaceIssue::find_all_by_project(&deployment.db().pool, &project_id).await?;
    Ok(ResponseJson(ApiResponse::success(links)))
}

async fn create_workspace_issue(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateLocalWorkspaceIssue>,
) -> Result<ResponseJson<ApiResponse<LocalWorkspaceIssue>>, ApiError> {
    let link = LocalWorkspaceIssue::create(&deployment.db().pool, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(link)))
}

async fn delete_workspace_issue(
    State(deployment): State<DeploymentImpl>,
    Path(workspace_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    LocalWorkspaceIssue::delete_by_workspace(&deployment.db().pool, &workspace_id).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}

// ── Router ──────────────────────────────────────────────────────────────────

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        // Projects
        .route(
            "/local/projects",
            get(list_projects).post(create_project),
        )
        .route(
            "/local/projects/{id}",
            get(get_project).put(update_project).delete(delete_project),
        )
        // Statuses
        .route(
            "/local/projects/{id}/statuses",
            get(list_statuses).post(create_status),
        )
        .route(
            "/local/statuses/{id}",
            axum::routing::put(update_status).delete(delete_status),
        )
        // Issues
        .route(
            "/local/projects/{id}/issues",
            get(list_issues).post(create_issue),
        )
        .route(
            "/local/issues/{id}",
            get(get_issue).put(update_issue).delete(delete_issue),
        )
        // Tags
        .route(
            "/local/projects/{id}/tags",
            get(list_tags).post(create_tag),
        )
        .route("/local/tags/{id}", axum::routing::delete(delete_tag))
        // Issue tags
        .route(
            "/local/projects/{id}/issue-tags",
            get(list_issue_tags_for_project),
        )
        .route(
            "/local/issues/{id}/tags",
            axum::routing::put(set_issue_tags),
        )
        // Issue relationships
        .route(
            "/local/projects/{id}/issue-relationships",
            get(list_issue_relationships_for_project),
        )
        .route(
            "/local/issue-relationships",
            axum::routing::post(create_issue_relationship),
        )
        .route(
            "/local/issue-relationships/{id}",
            axum::routing::delete(delete_issue_relationship),
        )
        // Issue comments
        .route(
            "/local/issues/{id}/comments",
            get(list_issue_comments),
        )
        .route(
            "/local/comments",
            axum::routing::post(create_issue_comment),
        )
        .route(
            "/local/comments/{id}",
            axum::routing::put(update_issue_comment).delete(delete_issue_comment),
        )
        // Workspace issue links
        .route(
            "/local/projects/{id}/workspace-issues",
            get(list_workspace_issues),
        )
        .route(
            "/local/workspace-issues",
            axum::routing::post(create_workspace_issue),
        )
        .route(
            "/local/workspace-issues/{workspace_id}",
            axum::routing::delete(delete_workspace_issue),
        )
}
