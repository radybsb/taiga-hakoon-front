# Wiki chapters and permanent links

Use the editor's **Tt → Heading 1** for a chapter and **Heading 2** for a
subchapter. These correspond to `##` and `###` in the editor's Markdown mode.
A Markdown `#` heading is also accepted as a top-level chapter.

Save the page to update its expandable sidebar outline. Click a chapter in the
sidebar to open its page and scroll to the heading. Hover or focus a heading's
**#** button to copy its permanent URL. Links work across pages and on a fresh
browser load; the page must still be accessible to the recipient.

The backend stores a small `WikiPage.outline` JSON field containing heading IDs,
labels, and levels. It is read-only through the API. IDs survive title changes,
ordinary insertions, and reordering of distinct titles. Duplicate titles get
different IDs; deleted chapters no longer resolve. Simultaneous structural edits
and renaming can be ambiguous because the existing editor does not store heading
IDs in its document model; in that case a new heading can receive a new ID.

`GET /api/v1/wiki/outline?project=<id>` returns page IDs, slugs, and outlines only,
checking `view_wiki_pages` for the project. It does not return full page contents.
The sidebar updates after saving without refetching every page's content.

Deployment requires the frontend, backend, and migration
`wiki.0006_wikipage_outline`. The migration indexes existing content without
changing page text, versions, modification dates, or history. Keep the standalone
parser module available for this data migration. The local backend container was
updated for validation; bake these files into the image for deployment.

Tests:

- `node scripts/test-wiki-outline.cjs` checks anchors, focus, scrolling, clipboard,
  rerendering, and cleanup.
- `tests/unit/test_wiki_outline.py` checks parsing, code blocks, hierarchy, title
  changes, insertions, reordering, and duplicate IDs.
