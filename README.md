# Kabati

Your favourite shops, sorted. Kabati turns Instagram shops' posts into one site that buyers browse by size.

## How it's built

- `public/` – the app people see (plain HTML, CSS and JavaScript). Opens like an app from the home screen.
- `api/index.js` – one server function that answers every `/api/...` request.
- `lib/` – the server code: database, Instagram sign-in and post reading, AI caption reading, photo copies, buyer/seller/admin actions.
- `db/schema.sql` – the database tables. They are created automatically on first use.

Hosting: Vercel (site + server function + daily scheduled check), a Neon Postgres database and Vercel Blob for photo copies, both added from inside Vercel.

## Settings (Vercel → Project → Settings → Environment Variables)

| Name | What it is |
| --- | --- |
| `SESSION_SECRET` | Any long random text (at least 16 characters). Keeps sign-ins safe. |
| `IG_APP_ID` | Instagram app ID, from the Meta developer app ("Instagram API with Instagram login"). |
| `IG_APP_SECRET` | Instagram app secret, from the same place. |
| `ADMIN_USERNAMES` | Instagram usernames that can open the admin page, comma separated, e.g. `kabati.ke`. |
| `CRON_SECRET` | Any random text. Stops strangers triggering the daily Instagram check. |
| `ANTHROPIC_API_KEY` | Optional. Lets AI read captions and photos. Without it, simple caption rules are used. |
| `AUTO_APPROVE` | Optional. `1` lets new shops appear without admin approval. Leave unset for the pilot. |
| `DATABASE_URL` | Added automatically when you connect the Neon database in Vercel. |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when you connect Blob storage in Vercel. |

## Running on a computer

```
npm install
npm run images      # makes the sample photos (already included)
npm run dev         # http://localhost:3000 with a pretend Instagram shop
```

Locally the database is PGlite (a Postgres that runs inside Node) in `.data/`, photos go to `.data/blobs`, and `FAKE_IG=1` replaces Instagram with sample posts.
