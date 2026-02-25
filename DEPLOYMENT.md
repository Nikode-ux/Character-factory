# Deployment (single-container, no Pages/Wrangler)

## Build + run with Docker
```bash
docker build -t character-chat:latest .
docker run -d --name character-chat -p 4000:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e WEB_DIST=/app/frontend/dist \
  -e CORS_ORIGIN=https://app.yourdomain.com \
  -e JWT_SECRET=<long-random-secret> \
  character-chat:latest
```
The backend serves both API and the built frontend at the same origin (http://localhost:4000).

## Using docker-compose.prod.yml
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Override envs with `--env-file` or in the compose file.

## Cloudflare Tunnel (optional)
`~/.cloudflared/config.yml`:
```yaml
tunnel: <your-tunnel-name>
credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```
Run: `cloudflared tunnel run <your-tunnel-name>`

Set `CORS_ORIGIN` to your public frontend hostname. No GitHub Pages/Wrangler needed.
