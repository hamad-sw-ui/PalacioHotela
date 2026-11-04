#!/usr/bin/env bash
set -u
curl -s -m 12 -o /tmp/home.html http://localhost:3000/
echo "--- occurrences de 'reservation' dans le HTML ---"
grep -o 'reservation' /tmp/home.html | wc -l
echo "--- contexte autour ---"
grep -oE '.{40}reservation.{20}' /tmp/home.html | head -4
echo "--- occurrences de 'compte?next' ---"
grep -o 'compte%3Fnext\|compte?next' /tmp/home.html | wc -l
