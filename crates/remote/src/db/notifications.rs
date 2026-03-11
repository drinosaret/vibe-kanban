use api_types::{Notification, NotificationType};
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{Executor, Postgres};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum NotificationError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

pub struct NotificationRepository;

impl NotificationRepository {
    pub async fn find_by_id<'e, E>(
        executor: E,
        id: Uuid,
    ) -> Result<Option<Notification>, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let record = sqlx::query_as!(
            Notification,
            r#"
            SELECT
                id                AS "id!: Uuid",
                organization_id   AS "organization_id!: Uuid",
                user_id           AS "user_id!: Uuid",
                notification_type AS "notification_type!: NotificationType",
                payload           AS "payload!: Value",
                issue_id          AS "issue_id: Uuid",
                comment_id        AS "comment_id: Uuid",
                seen              AS "seen!",
                dismissed_at      AS "dismissed_at: DateTime<Utc>",
                created_at        AS "created_at!: DateTime<Utc>"
            FROM notifications
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(executor)
        .await?;

        Ok(record)
    }

    pub async fn create<'e, E>(
        executor: E,
        organization_id: Uuid,
        user_id: Uuid,
        notification_type: NotificationType,
        payload: Value,
        issue_id: Option<Uuid>,
        comment_id: Option<Uuid>,
    ) -> Result<Notification, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let record = sqlx::query_as!(
            Notification,
            r#"
            INSERT INTO notifications (id, organization_id, user_id, notification_type, payload, issue_id, comment_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id                AS "id!: Uuid",
                organization_id   AS "organization_id!: Uuid",
                user_id           AS "user_id!: Uuid",
                notification_type AS "notification_type!: NotificationType",
                payload           AS "payload!: Value",
                issue_id          AS "issue_id: Uuid",
                comment_id        AS "comment_id: Uuid",
                seen              AS "seen!",
                dismissed_at      AS "dismissed_at: DateTime<Utc>",
                created_at        AS "created_at!: DateTime<Utc>"
            "#,
            id,
            organization_id,
            user_id,
            notification_type as NotificationType,
            payload,
            issue_id,
            comment_id,
            now
        )
        .fetch_one(executor)
        .await?;

        Ok(record)
    }

    pub async fn list_by_user<'e, E>(
        executor: E,
        user_id: Uuid,
        include_dismissed: bool,
    ) -> Result<Vec<Notification>, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let records = if include_dismissed {
            sqlx::query_as!(
                Notification,
                r#"
                SELECT
                    id                AS "id!: Uuid",
                    organization_id   AS "organization_id!: Uuid",
                    user_id           AS "user_id!: Uuid",
                    notification_type AS "notification_type!: NotificationType",
                    payload           AS "payload!: Value",
                    issue_id          AS "issue_id: Uuid",
                    comment_id        AS "comment_id: Uuid",
                    seen              AS "seen!",
                    dismissed_at      AS "dismissed_at: DateTime<Utc>",
                    created_at        AS "created_at!: DateTime<Utc>"
                FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                "#,
                user_id
            )
            .fetch_all(executor)
            .await?
        } else {
            sqlx::query_as!(
                Notification,
                r#"
                SELECT
                    id                AS "id!: Uuid",
                    organization_id   AS "organization_id!: Uuid",
                    user_id           AS "user_id!: Uuid",
                    notification_type AS "notification_type!: NotificationType",
                    payload           AS "payload!: Value",
                    issue_id          AS "issue_id: Uuid",
                    comment_id        AS "comment_id: Uuid",
                    seen              AS "seen!",
                    dismissed_at      AS "dismissed_at: DateTime<Utc>",
                    created_at        AS "created_at!: DateTime<Utc>"
                FROM notifications
                WHERE user_id = $1 AND dismissed_at IS NULL
                ORDER BY created_at DESC
                "#,
                user_id
            )
            .fetch_all(executor)
            .await?
        };

        Ok(records)
    }

    pub async fn list_by_organization_and_user<'e, E>(
        executor: E,
        organization_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Notification>, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let records = sqlx::query_as!(
            Notification,
            r#"
            SELECT
                id                AS "id!: Uuid",
                organization_id   AS "organization_id!: Uuid",
                user_id           AS "user_id!: Uuid",
                notification_type AS "notification_type!: NotificationType",
                payload           AS "payload!: Value",
                issue_id          AS "issue_id: Uuid",
                comment_id        AS "comment_id: Uuid",
                seen              AS "seen!",
                dismissed_at      AS "dismissed_at: DateTime<Utc>",
                created_at        AS "created_at!: DateTime<Utc>"
            FROM notifications
            WHERE organization_id = $1 AND user_id = $2
            ORDER BY created_at DESC
            "#,
            organization_id,
            user_id
        )
        .fetch_all(executor)
        .await?;

        Ok(records)
    }

    pub async fn update<'e, E>(
        executor: E,
        id: Uuid,
        seen: Option<bool>,
    ) -> Result<Notification, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let record = sqlx::query_as!(
            Notification,
            r#"
            UPDATE notifications
            SET seen = COALESCE($1, seen),
                dismissed_at = CASE
                    WHEN $1 = true AND dismissed_at IS NULL THEN NOW()
                    ELSE dismissed_at
                END
            WHERE id = $2
            RETURNING
                id                AS "id!: Uuid",
                organization_id   AS "organization_id!: Uuid",
                user_id           AS "user_id!: Uuid",
                notification_type AS "notification_type!: NotificationType",
                payload           AS "payload!: Value",
                issue_id          AS "issue_id: Uuid",
                comment_id        AS "comment_id: Uuid",
                seen              AS "seen!",
                dismissed_at      AS "dismissed_at: DateTime<Utc>",
                created_at        AS "created_at!: DateTime<Utc>"
            "#,
            seen,
            id
        )
        .fetch_one(executor)
        .await?;

        Ok(record)
    }

    pub async fn upsert_recent<'e, E>(
        executor: E,
        organization_id: Uuid,
        user_id: Uuid,
        notification_type: NotificationType,
        payload: Value,
        issue_id: Option<Uuid>,
        comment_id: Option<Uuid>,
    ) -> Result<Notification, NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let record = sqlx::query_as!(
            Notification,
            r#"
            WITH existing AS (
                SELECT id FROM notifications
                WHERE user_id = $3
                  AND notification_type = $4
                  AND issue_id IS NOT DISTINCT FROM $6
                  AND comment_id IS NOT DISTINCT FROM $7
                  AND created_at > NOW() - INTERVAL '1 minute'
                ORDER BY created_at DESC
                LIMIT 1
            ),
            updated AS (
                UPDATE notifications
                SET payload = $5,
                    seen = FALSE,
                    dismissed_at = NULL,
                    created_at = $8
                WHERE id = (SELECT id FROM existing)
                RETURNING
                    id                AS "id!: Uuid",
                    organization_id   AS "organization_id!: Uuid",
                    user_id           AS "user_id!: Uuid",
                    notification_type AS "notification_type!: NotificationType",
                    payload           AS "payload!: Value",
                    issue_id          AS "issue_id: Uuid",
                    comment_id        AS "comment_id: Uuid",
                    seen              AS "seen!",
                    dismissed_at      AS "dismissed_at: DateTime<Utc>",
                    created_at        AS "created_at!: DateTime<Utc>"
            ),
            inserted AS (
                INSERT INTO notifications (id, organization_id, user_id, notification_type, payload, issue_id, comment_id, created_at)
                SELECT $1, $2, $3, $4, $5, $6, $7, $8
                WHERE NOT EXISTS (SELECT 1 FROM existing)
                RETURNING
                    id                AS "id!: Uuid",
                    organization_id   AS "organization_id!: Uuid",
                    user_id           AS "user_id!: Uuid",
                    notification_type AS "notification_type!: NotificationType",
                    payload           AS "payload!: Value",
                    issue_id          AS "issue_id: Uuid",
                    comment_id        AS "comment_id: Uuid",
                    seen              AS "seen!",
                    dismissed_at      AS "dismissed_at: DateTime<Utc>",
                    created_at        AS "created_at!: DateTime<Utc>"
            )
            SELECT * FROM updated
            UNION ALL
            SELECT * FROM inserted
            "#,
            id,
            organization_id,
            user_id,
            notification_type as NotificationType,
            payload,
            issue_id,
            comment_id,
            now
        )
        .fetch_one(executor)
        .await?;

        Ok(record)
    }

    pub async fn delete<'e, E>(executor: E, id: Uuid) -> Result<(), NotificationError>
    where
        E: Executor<'e, Database = Postgres>,
    {
        sqlx::query!("DELETE FROM notifications WHERE id = $1", id)
            .execute(executor)
            .await?;
        Ok(())
    }
}
