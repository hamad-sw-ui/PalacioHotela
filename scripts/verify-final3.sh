#!/usr/bin/env bash
# HTML servi par le site (dernier test) — le lien /reservation doit être présent.
set -u
echo "--- HTML accueil : liens /reservation ---"
curl -s -m 12 http://localhost:3000/ | grep -oE 'href="/reservation[^"]*"' | sort | uniq -c
echo "--- HTML accueil : liens /compte?next (réservation) ---"
curl -s -m 12 http://localhost:3000/ | grep -oE '/compte\?next[^"]*' | sort | uniq -c | head -3
echo "--- Heure actuelle ---"
date '+%Y-%m-%d %H:%M:%S'
