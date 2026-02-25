# Deployment Guide (GitHub Pages + Docker Backend on Windows)

## 1) Backend on Windows laptop (Docker)

1. Install Docker Desktop.
2. Clone/copy this repository to the Windows laptop.
3. Create `server/.env` from `server/.env.example` and update values:
   - `NODE_ENV=production`
   - `PORT=4000`
   - `CORS_ORIGIN=https://<your-github-pages-domain>`
   - `JWT_SECRET=<long-random-secret>`
   - `DB_PATH=/app/data/data.db`
4. Start backend:

```bash
docker compose up -d --build
```

5. Verify health:

```bash
curl http://localhost:4000/health
```

6. Data persists in `./server-data` on the host.

## 2) Public backend URL with Cloudflare Tunnel

1. Install `cloudflared` on the Windows laptop.
2. Authenticate:

```bash
cloudflared tunnel login
```

3. Create a tunnel:

```bash
cloudflared tunnel create character-chat-api
```

4. Route DNS:

```bash
cloudflared tunnel route dns character-chat-api api.yourdomain.com
```

5. Create config file `%USERPROFILE%\\.cloudflared\\config.yml`:

```yaml
tunnel: character-chat-api
credentials-file: C:\\Users\\<you>\\.cloudflared\\<tunnel-id>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

6. Run tunnel:

```bash
cloudflared tunnel run character-chat-api
```

7. Optional: install as service:

```bash
cloudflared service install
```

## 3) GitHub Pages frontend

1. In GitHub repo settings:
   - Enable GitHub Pages (GitHub Actions source).
   - Add Actions secret `VITE_API_BASE_URL` = `https://api.yourdomain.com`.
   - Add Actions variable `VITE_BASE_PATH`:
     - `/` for user/org pages
     - `/<repo>/` for project pages
2. Push to `main` branch.
3. Workflow `.github/workflows/deploy-pages.yml` builds `frontend` and deploys `frontend/dist`.

## 4) Post-deploy checks

1. Open GitHub Pages URL and register/login.
2. Confirm requests go to `https://api.yourdomain.com`.
3. Confirm no CORS errors in browser console.
4. Confirm chat streaming works.
