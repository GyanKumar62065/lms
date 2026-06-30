# Deploying the LMS to Render (free)

This deploys the app as **two free Render web services** (frontend + backend) plus two free
external services it depends on:

| Piece | Where | Free tier |
|---|---|---|
| Frontend (Next.js) | **Render** web service (Docker) | ✓ (sleeps after 15 min idle) |
| Backend (Express) | **Render** web service (Docker) | ✓ (sleeps after 15 min idle) |
| MongoDB | **MongoDB Atlas** M0 | ✓ (a real replica set → transactions work) |
| Object storage (salary slips) | **Cloudflare R2** | ✓ (10 GB; S3-compatible) |

The blueprint is [`render.yaml`](render.yaml). It wires the two services to each other
automatically (`fromService`) and generates the JWT/pepper secrets for you; you only paste in
the Atlas and R2 values.

> **Heads-up:** free Render services **spin down after ~15 min idle** and cold-start in ~30–60s.
> Fine for a demo; see *Keeping it awake* at the end.

---

## 1) MongoDB Atlas (free M0)

1. Create a free account at <https://www.mongodb.com/atlas> → **Build a Database** → **M0 (Free)**.
2. **Database Access** → add a user (username + password). Save them.
3. **Network Access** → **Add IP** → **Allow access from anywhere** (`0.0.0.0/0`) — Render's egress IPs are dynamic on the free tier.
4. **Connect** → **Drivers** → copy the SRV connection string. Insert your password and add the DB name `lms`:
   ```
   mongodb+srv://<user>:<password>@<cluster>.xxxx.mongodb.net/lms?retryWrites=true&w=majority
   ```
   (Atlas is already a replica set — **do not** add `replicaSet=...`; the SRV string handles it.)

## 2) Cloudflare R2 (free, S3-compatible)

1. Cloudflare dashboard → **R2** → **Create bucket** named **`lms-docs`** (must match `MINIO_BUCKET`).
2. **Manage R2 API Tokens** → **Create API Token** (Object Read & Write) → copy the **Access Key ID** and **Secret Access Key**.
3. Note your **S3 endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (Account ID is on the R2 overview).
4. **Bucket → Settings → CORS Policy** → add (so the browser can upload/preview slips). Replace the origin with your real frontend URL once you have it (step 4):
   ```json
   [
     {
       "AllowedOrigins": ["https://lms-frontend.onrender.com"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

## 3) Create the Render Blueprint

1. Push the latest code (the blueprint must be in the repo):
   ```bash
   git push origin main
   ```
2. Render dashboard → **New** → **Blueprint** → connect the GitHub repo `GyanKumar62065/lms`.
3. Render reads `render.yaml` and proposes **lms-backend** and **lms-frontend**. Click **Apply**.
   - It auto-generates `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PASSWORD_PEPPER`.
   - It wires `BACKEND_ORIGIN` and `CORS_ORIGIN` between the two services.

## 4) Fill the secrets (backend service → Environment)

On the **lms-backend** service, set the five `sync: false` vars:

| Key | Value |
|---|---|
| `MONGO_URI` | the Atlas SRV string from step 1 |
| `MINIO_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `MINIO_PUBLIC_ENDPOINT` | same R2 endpoint as above |
| `MINIO_ACCESS_KEY` | R2 Access Key ID |
| `MINIO_SECRET_KEY` | R2 Secret Access Key |

Save → Render redeploys the backend. On boot it **seeds** roles, users, and products
(`SEED_ON_BOOT=true`, idempotent).

## 5) Open it

- Frontend URL: `https://lms-frontend.onrender.com` (or whatever Render assigned).
- Log in with a seeded account, e.g. **`admin@lms.test` / `Admin@123`** (or sign up as a borrower).
- If a page is slow on first hit, that's the cold start waking the service.

---

## How auth works in this deployment (why the proxy matters)

Two `*.onrender.com` subdomains **can't share cookies** (`onrender.com` is a public suffix), so
the browser only ever talks to the **frontend** origin: it calls `/api/v1/*` (relative), and
Next.js proxies those to the backend (`BACKEND_ORIGIN`, baked at build). Cookies stay
**first-party** to the frontend domain, and `COOKIE_SECURE=true` over HTTPS keeps them `Secure` +
`SameSite=Strict`. Server-side rendering calls the backend directly (derived from `BACKEND_ORIGIN`).

## Troubleshooting

- **Build can't find the Dockerfile** → in the service's *Settings*, confirm **Root Directory** =
  `lms-backend` / `lms-frontend` and **Dockerfile Path** = `./Dockerfile`.
- **Frontend can reach the API but login then "logs out"** → the frontend was built before
  `BACKEND_ORIGIN` resolved. Trigger **Manual Deploy → Clear build cache & deploy** on the frontend.
- **Slip upload fails in the browser (CORS)** → set the R2 bucket CORS policy (step 2.4) to your
  real frontend URL.
- **Backend won't boot / `Invalid environment configuration`** → a required env var is missing;
  check the backend logs for which key.
- **Mongo connection errors** → verify Atlas Network Access allows `0.0.0.0/0` and the SRV
  password/db name are correct.

## Keeping it awake (optional)

Free services sleep after 15 min. To keep the demo warm, ping the health endpoint every ~10 min
from a free scheduler (e.g. [cron-job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com)):
```
https://lms-backend.onrender.com/healthz
```
(Pinging the backend keeps it warm; the frontend wakes on the first real visit.)

## Costs

Everything above is on free tiers. The only thing that may ask for a card is **Cloudflare R2**
(no charge under the 10 GB free allowance). Render free and Atlas M0 need no card.
