# File Uploads

Use the shared upload endpoint for all files:

```
POST /api/uploads
```

## Request format

Send `multipart/form-data` with:
- `file` (required) - file to upload.
- `folder` (optional) - logical bucket prefix. Allowed values: `avatars`, `uploads`.

Example (curl):
```
curl -X POST https://your-app-domain.com/api/uploads \
  -H "x-user-id: YOUR_USER_ID" \
  -F "file=@/path/to/file.png" \
  -F "folder=uploads"
```

The response returns the proxy `url`, `publicUrl`, and `key` for storage.

## Notes

- Avatars must be images and are stored under `avatars/`.
- The default folder is `uploads`.
- File size limit: 10MB.
