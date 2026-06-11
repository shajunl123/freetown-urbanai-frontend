# Local Runtime Data

This directory is for local prototype runtime state.

Expected local files:

- `freetown.db` - SQLite database for corpus metadata, chunks, sessions, messages, and request logs.
- `freetown.db-shm` / `freetown.db-wal` - SQLite WAL sidecar files.
- `uploads/` - uploaded local evidence files used by the backend ingestion flow.

These files are intentionally gitignored. The safe reproducible demo corpus lives in `backend/fixtures/demo-corpus/` and can be loaded with:

```bash
npm run seed:demo
```
