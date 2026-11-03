#!/usr/bin/env bash
# Le payload RSC est chunké avec des IDs. Les liens sont dans des chunks plus avancés.
# Vérification directe : extraire tous les chunks self.__next_f et chercher la route.
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- tous les chunks self.__next_f, recherche de la route /reservation ---"
# Extraire le contenu des scripts inline et chercher "reservation" (encodé ou non)
python3 - <<'EOF'
import re, sys
html = open('/tmp/home.html', encoding='utf-8').read()
# Le payload RSC encode "/" en \u002F dans les chaînes JS
found = [m.start() for m in re.finditer(r'reservation', html, re.IGNORECASE)]
print("occurrences brutes 'reservation':", len(found))
found_enc = [m.start() for m in re.finditer(r'\\\\u002Freservation', html)]
print("occurrences encodées '\\u002Freservation':", len(found_enc))
# Chercher aussi dans le payload décodé
import codecs
for m in re.finditer(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.DOTALL):
    chunk = m.group(1)
    if 'reservation' in chunk.lower():
        print("CHUNK avec 'reservation' trouvé, extrait:", chunk[:200])
        break
else:
    print("aucun chunk inline avec 'reservation' — le contenu est chargé dynamiquement (composant client)")
EOF
