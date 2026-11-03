#!/usr/bin/env bash
# Résumé HTML servi (header + hero) — vérifier que /reservation est servi et nav-book absent.
set -u
curl -s -m 12 -o /tmp/home.html -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost:3000/
echo "--- payload RSC : u002Freservation (liens vers la réservation) ---"
grep -oE 'u002Freservation' /tmp/home.html | sort | uniq -c | head -3
echo "--- classes hero-button ---"
grep -oE 'btn-gold' /tmp/home.html | sort | uniq -c | head -2
echo "--- nav-book (bouton retiré) ---"
grep -c 'nav-book' /tmp/home.html | head -1
