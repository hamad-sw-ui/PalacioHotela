#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- recherche du bouton hero avec le lien (le HTML servi est-il chunké RSC ?) ---"
grep -oE '.{40}u005Cu002Freservation.{20}' /tmp/home.html | head -3
grep -oE '.{40}u005C.{30}reservation.{15}' /tmp/home.html | head -3
grep -oE '.{30}reservation.{15}' /tmp/home2.html 2>/dev/null | head -3
echo "--- occurrence de 'u005Cu002F' ---"
grep -oE 'u005Cu002F' /tmp/home.html | wc -l
