#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- recherche de '002Freservation' (payload RSC encodé du lien /reservation) ---"
grep -oiE '002Freservation' /tmp/home.html | sort | uniq -c
echo "--- recherche de '002Fcompte' (redirection connexion, devrait être 0) ---"
grep -oiE '002Fcompte' /tmp/home.html | sort | uniq -c
