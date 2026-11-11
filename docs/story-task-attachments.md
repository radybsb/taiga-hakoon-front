# Story attachment inheritance

A story's attachment list can include its child tasks' original files. This is a read projection: it does not copy files, create attachment rows, move ownership, or change task attachment order.

## API

- `GET /api/v1/userstories/attachments?project=ID&object_id=STORY_ID&include_task_attachments=1` returns direct story files plus files from tasks currently attached to that story. The existing frontend URL resolver supplies the attachment endpoint path.
- Returned task files include `source_task_id`. Their `object_id`, URL, ID and ownership remain those of the task attachment.
- Both story visibility and task visibility apply. Without `view_tasks`, callers receive direct story files only.
- Story summaries requested with `include_attachments` include visible task images for Kanban carousels. `total_attachments` includes child files visible to that caller. Deprecated files remain available in the detail list's existing deprecated-file view but are excluded from card summaries.
- Reassigning or detaching a task changes the next story response automatically. There is no synchronization job or migration.
- Typed attachment detail/PATCH/DELETE endpoints remain unchanged. A task attachment does not become writable through the story endpoint.

## Frontend

- Story detail pages and pop-ups share the combined list and existing image/video preview.
- Story-owned files appear first and retain their independent ordering. Inherited files can be viewed/downloaded; editing, deleting and ordering stay with the owning task. This restriction applies to list, gallery and preview controls, and is enforced in the attachment service too.
- Closing a task pop-up refreshes the parent's projected list after its attachment context is restored. Existing board popup/attachment refresh events reload Kanban summaries.
- Taskboard story headers display their image/GIF carousel using batched sprint attachment summaries. Task cards and Kanban cards retain their existing carousel behavior.

## Validation and deployment

- Frontend: `node scripts/test-story-task-attachments.cjs`, `node scripts/test-attachment-upload-isolation.cjs`, `node scripts/test-video-attachments.cjs`, `node scripts/test-taskboard-story-slideshow.cjs`.
- Backend: `tests/integration/test_story_task_attachments.py` is included in the image workflow. Local database verification exercises actual PostgreSQL queries and permission rules using rollback-only metadata fixtures.
- Deploy the backend image before, or together with, the frontend image. No database migration is required. The frontend flag is ignored by an older backend, so inherited files will not appear until the backend is updated.
