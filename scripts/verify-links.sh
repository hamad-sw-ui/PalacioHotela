#!/usr/bin/env bash
# Le payload RSC chunké encode le slash en u002F. Les liens de la page d'accueil
# vers /reservation doivent donc apparaître encodés en "u002Freservation".
# Vérification directe : le payload chunké contient-il la route encodée ?
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- recherche de 'u002Fres' et '002Fres' (encodage RSC) ---"
grep -oE 'u002Fres|002Fres' /tmp/home.html | head -3
echo "--- le payload contient-il 'Réservation' encodé (u005C) ? ---"
grep -cE 'u005C' /tmp/home.html
echo "--- extraits chunkés ---"
grep -oE 'self.__next_f.push\(\[1,"2:.{0,400}' /tmp/home.html | head -2
