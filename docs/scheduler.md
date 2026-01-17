# Scheduler (Coolify)

Use your platform scheduler to trigger the merchants import instead of running
an in-app cron. The app exposes a single endpoint:

```
POST /api/merchants/import
```

## Coolify job example

Cron expression (Asia/Kuala_Lumpur 00:15 daily):
```
15 16 * * *
```

If Coolify lets you set the timezone, choose `Asia/Kuala_Lumpur`.

Command example (curl) using a secret env var:
```
export MERCHANT_IMPORT_USER_ID="YOUR_SUPER_ADMIN_USER_ID"
curl -X POST https://your-app-domain.com/api/merchants/import \
  -H "x-user-id: ${MERCHANT_IMPORT_USER_ID}"
```

Notes:
- Store the user ID as a platform secret (for example, `MERCHANT_IMPORT_USER_ID`).
- `x-user-id` must be an existing user ID (typically Super Admin).
- The import creates an entry in `merchant_import_runs`.
- You can test the same call locally with `http://localhost:3000`.
