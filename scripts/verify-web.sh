#!/usr/bin/env bash
# Que fait ce VPS comme serveur web ? Recherche le site/URL public.
set -u
echo "--- nginx ? ---"
command -v nginx >/dev/null && echo "nginx installé" || echo "nginx absent"
systemctl is-active nginx 2>/dev/null | head -1
echo "--- caddy ? ---"
command -v caddy >/dev/null && echo "caddy installé" || echo "caddy absent"
echo "--- env ---"
grep -E '^SITE_URL|^PORT|^HOST' /var/www/palacio/.env 2>/dev/null
echo "--- ports en écoute ---"
ss -tlnp 2>/dev/null | head -10
