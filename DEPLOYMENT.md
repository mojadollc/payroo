# Payroo POS — VPS Deployment Notes

## Server
- **Provider**: DigitalOcean
- **Host**: `ubuntu-s-2vcpu-4gb-sgp1` (188.166.250.245)
- **App directory**: `/var/www/pntos.payroo.xyz`
- **Process manager**: PM2 (id **16**, name **payroo**)

## Ports
| Port | App | Notes |
|------|-----|-------|
| **3090** | Payroo POS (this app) | PM2 id 16, proxied by Nginx |
| 3000 | Other node app | Do NOT use |
| 3020 | Casino backend | PM2 id 4 |

## Nginx
- `pntos.payroo.xyz` → `http://localhost:3090`
- `pos.payroo.xyz` → `http://localhost:3090`
- Config: `/etc/nginx/sites-enabled/`

## PM2
```bash
pm2 list                        # list all processes
pm2 logs 16 --lines 50          # view payroo logs
pm2 restart 16                  # restart payroo
pm2 save                        # save process list for reboot
```

## Deploy / Update
```bash
cd /var/www/pntos.payroo.xyz
git pull
npx prisma generate
rm -rf .next
npm run build
pm2 restart 16
```

## Database
- **Engine**: PostgreSQL
- **Database**: `payroo`
- **User**: `payroo_user_postgre1` (peer auth fails — use postgres user)
- **Connect**: `sudo -u postgres psql -d payroo`

## Environment
- Config file: `/var/www/pntos.payroo.xyz/.env` (NOT `.env.local`)
- `DATABASE_URL` points to `localhost:5432/payroo`

## DB Migrations (manual)
Run missing column migrations via:
```bash
sudo -u postgres psql -d payroo -c "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..."
```
After any schema change, always run:
```bash
npx prisma generate && rm -rf .next && npm run build && pm2 restart 16
```

## Troubleshooting
- If reports show 0 / blank → check `pm2 logs 16` for Prisma column errors → run migration + rebuild
- If port 3090 not responding → `ss -tlnp | grep 3090` to confirm process is up
- If PM2 shows wrong port → old process may be hijacking port, use `kill <pid>` then `pm2 restart 16`
