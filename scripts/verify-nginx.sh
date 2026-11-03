#!/usr/bin/env bash
# Où est le site public ? nginx écoute 80/443. Recherche la config nginx.
set -u
echo "--- nginx sites ---"
nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass|root ' | head -15
echo "--- listen 3000 ? ---"
ss -tlnp 2>/dev/null | grep -E '3000' || echo "port 3000 non exposé — l'app est derrière nginx (proxy local)"
echo "--- test local via nginx ---"
curl -s -m 8 -o /dev/null -w 'HTTP %{http_code}\n' -H 'Host: localhost' http://127.0.0.1:80/
