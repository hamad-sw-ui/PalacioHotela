#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- nombre total de chunks self.__next_f ---"
grep -c 'self.__next_f.push' /tmp/home.html
echo "--- le payload contient-il le texte du bouton 'Réserver' ou 'Book' ? ---"
grep -oiE 'Book my stay|Réserver mon séjour' /tmp/home.html | head -2
echo "--- le payload contient-il les routes encodées u002F ? ---"
grep -c 'u002F' /tmp/home.html
