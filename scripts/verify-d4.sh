#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- total 'devis' occurrences ---"
grep -oiE 'devis' /tmp/home.html | wc -l
echo "--- contexte de 'devis' ---"
grep -oE '.{50}devis.{30}' /tmp/home.html | head -3
echo "--- extraits du payload RSC (script __next_f) ---"
grep -oE 'self.__next_f[^<]{0,200}' /tmp/home.html | head -2
