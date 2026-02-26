# Scheduler (Coolify)

Use your platform scheduler to trigger the merchants import instead of running
an in-app cron.

## Merchants import endpoint

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

## ClickUp ticket status sync endpoint

Use a daily scheduler call to refresh statuses for all linked ClickUp tickets:

```
POST /api/clickup/sync
```

Recommended cron expression (Asia/Kuala_Lumpur 01:00 daily):
```
0 17 * * *
```

If your scheduler supports explicit timezones, set timezone to `Asia/Kuala_Lumpur`.

Command example:
```
export CLICKUP_SYNC_CRON_SECRET="YOUR_RANDOM_SECRET"
curl -X POST https://your-app-domain.com/api/clickup/sync \
  -H "x-cron-secret: ${CLICKUP_SYNC_CRON_SECRET}"
```

Notes:
- Set `CLICKUP_API_TOKEN` and `CLICKUP_LIST_ID` in app environment.
- `CLICKUP_SYNC_CRON_SECRET` must match the header value.
- This updates `support_requests.clickup_task_status` and `clickup_task_status_synced_at`.
