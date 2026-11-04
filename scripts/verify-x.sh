#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- classes hero avec 'u002Freservation' (toutes formes) ---"
grep -oiE 'u002Freservation|002Freservation' /tmp/home.html | head -3
echo "--- extraits de self.__next_f (payload RSC) ---"
grep -oE 'self.__next_f.push\(\[1,"[^"]{0,300}' /tmp/home.html | head -2
