#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- le HTML servi contient-il le bouton hero ? ---"
grep -oiE '.{40}u002Freservation.{20}' /tmp/home.html | head -3
echo "--- il y a-t-il le payload RSC chunké ? ---"
grep -c 'u002F' /tmp/home.html
echo "--- toutes les lettres 'Rés' encodées (u005C) ---"
grep -c 'u005C' /tmp/home.html
