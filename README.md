This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Geist.

## Environment Variables

Create `.env.local` at the repo root.

```
DATABASE_URL=

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=sims
MYSQL_PASSWORD=sims-password
MYSQL_DATABASE=sims-local

POS_API_EMAIL=email@example.com
POS_API_PASSWORD=password
POS_AUTH_URL=https://api.getslurp.com/api/login
POS_IMPORT_URL=http://api.getslurp.com/api/franchise-retrieve/

MERCHANT_IMPORT_USER_ID=

MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_PUBLIC_URL=http://127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=sims-assets
MINIO_REGION=us-east-1
```

## Database (Docker)

Start MySQL and phpMyAdmin with Docker:

```
docker compose up -d
```

Defaults:
- MySQL runs on `localhost:3306` with database `sims-local` and user `sims`/`sims-password`.
- phpMyAdmin is at `http://localhost:8080` (server: `mysql`, user: `sims`, password: `sims-password`).
- MinIO is at `http://localhost:9000` with console at `http://localhost:9001`.

The schema file at `schema.sql` is loaded automatically the first time the container starts. If you need to re-run it, delete the `mysql_data` volume and restart.

Default login (local):
- Email: `admin@sims.local`
- Password: `sims-admin`

## Merchant Import

Manual import runs from the Merchants page and pulls data from the POS API.

Scheduled import is handled by your platform scheduler (for example, Coolify).
See `docs/scheduler.md` for a ready-to-use setup, including curl examples,
cron timing in Asia/Kuala_Lumpur, and the `MERCHANT_IMPORT_USER_ID` secret.

## File Uploads (MinIO)

All file uploads should go through the shared API: `POST /api/uploads`.
See `docs/uploads.md` for request format and folder conventions.

This project relies on `schema.sql` for database updates. If you already have data in MySQL, back it up before reloading the schema.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

Use the platform or container runtime that matches your infrastructure.

For Coolify (Dockerfile build):
- Set the build context to repo root.
- Use `Dockerfile` at the repo root.
