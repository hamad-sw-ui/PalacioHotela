#!/usr/bin/env bash
# Test direct du HTML servi : le bouton accueil doit contenir href="/reservation"
# (via le payload RSC Next.js encodé "\\u002Freservation").
set -u
curl -s -m 12 -o /tmp/home.html -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost:3000/
echo "--- grep 'u002Freservation' (payload RSC) ---"
grep -oE 'u002Freservation' /tmp/home.html | head -2
echo "--- grep '002Freservation' ---"
grep -oE '002Freservation' /tmp/home.html | head -2
echo "--- grep 'Réserver mon séjour' ---"
grep -oE 'Réserver mon séjour' /tmp/home.html | head -1
echo "--- grep 'Book my stay' ---"
grep -oE 'Book my stay' /tmp/home.html | head -1
