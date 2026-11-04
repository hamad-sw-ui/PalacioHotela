#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- routes connues dans le HTML servi ---"
for known in hebergements compte contact devis reservation; do
  count=$(grep -oiE "$known" /tmp/home.html | head -1 | wc -l)
  echo "$known => $count"
done
echo "--- self.__next_f (payload RSC) ---"
grep -c 'self.__next_f' /tmp/home.html || true
