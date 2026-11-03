#!/usr/bin/env bash
# Test final du payload RSC chunké : les extraits hexadécimaux de self.__next_f
# contiennent-ils la route /reservation encodée ?
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- extraits de self.__next_f.push([1,...) ---"
grep -oE 'self.__next_f.push\(\[1,".{0,500}' /tmp/home.html | head -2
echo "--- recherche de 'reservation' dans le payload chunké ---"
grep -oiE '.{30}reservation.{20}' /tmp/home.html | head -3
echo "--- total lettres 'Rés' encodées ---"
grep -cE 'R00E9' /tmp/home.html || true
