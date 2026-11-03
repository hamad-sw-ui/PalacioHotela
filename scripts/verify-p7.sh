#!/usr/bin/env bash
# Le HTML de / est Streaming SSR : le contenu arrive dans des chunks. curl reçoit tout
# mais les composants clients (HomeClient) hydratent côté client : le payload RSC du
# composant client est référencé par ID de module, pas inline. La vérification fiable
# se fait via le navigateur. Test Playwright si disponible, sinon rendu SSR partiel :
set -u
echo "--- le payload contient-il 'Réserver mon séjour' (encodé 'u005C' ou direct) ? ---"
curl -s -m 15 --compressed http://localhost:3000/ | grep -oE 'Réserv|Book my|u005Cu00E9' | head -4
echo "--- recherche de mots du hero FR ---"
curl -s -m 15 --compressed http://localhost:3000/ | grep -oE 'BIENVENUE|PALACIO HOTEL|BIENVENUE AU' | head -3
