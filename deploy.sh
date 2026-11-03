#!/usr/bin/env bash
# =============================================================
#  Palacio Hotel — Script de déploiement automatique (VPS Ubuntu/Debian)
#
#  Usage (sur le VPS, dans /var/www/palacio) :
#     bash deploy.sh            # déploiement complet
#     bash deploy.sh --quick    # rapide : build + redémarrage seulement
#     bash deploy.sh --db       # force aussi la mise à jour du schéma DB
#
#  À exécuter APRÈS avoir transféré les fichiers modifiés avec WinSCP.
# =============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="palaciohotel"
NODE_MIN="20"
LOG_FILE="/var/log/${APP_NAME}-deploy.log"

cd "$APP_DIR"

# Couleurs
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "${GREEN}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}"; exit 1; }

QUICK=0
FORCE_DB=0
case "${1:-}" in
  --quick) QUICK=1 ;;
  --db)    FORCE_DB=1 ;;
  "")      ;;
  *) fail "Option inconnue : $1 (utilisez --quick, --db ou rien)" ;;
esac

echo "======================================================="
echo " Déploiement Palacio Hotel — $(date '+%Y-%m-%d %H:%M:%S')"
echo " Dossier : $APP_DIR"
echo "======================================================="

# -------------------------------------------------------------
# 0. Vérifications préalables
# -------------------------------------------------------------
step "Vérification de l'environnement"

command -v node >/dev/null || fail "Node.js n'est pas installé. Voir README, Étape 2."
command -v npm  >/dev/null || fail "npm n'est pas disponible."
command -v pm2  >/dev/null || warn "PM2 absent — installation..."
command -v pm2  >/dev/null || npm install -g pm2

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge "$NODE_MIN" ] || fail "Node.js >= ${NODE_MIN} requis (trouvé : $(node -v))"

[ -f ".env" ] || fail ".env introuvable. Copiez .env.example vers .env et renseignez-le."
[ -f "package.json" ] || fail "package.json introuvable — êtes-vous dans le bon dossier ?"

echo "  Node $(node -v) | npm v$(npm -v) | PM2 $(pm2 -v 2>/dev/null || echo '?')"

# -------------------------------------------------------------
# 1. Fichiers verrouillés par WinSCP ? On attend la fin du transfert
# -------------------------------------------------------------
step "Vérification qu'aucun transfert WinSCP n'est en cours"
if pgrep -f "winscp" >/dev/null 2>&1; then
  warn "Un processus WinSCP semble actif sur le serveur — le transfert est peut-être en cours."
  read -r -p "Continuer quand même ? [o/N] " answer
  [[ "${answer:-n}" =~ ^[oO]$ ]] || fail "Déploiement annulé."
fi

# -------------------------------------------------------------
# 2. Dépendances (uniquement si package.json/lock a changé)
# -------------------------------------------------------------
if [ "$QUICK" -eq 1 ]; then
  step "Mode --quick : installation des dépendances ignorée"
else
  LOCK_HASH_BEFORE=$(md5sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "none")
  LAST_INSTALL_HASH=$(cat .deploy-lock-hash 2>/dev/null || echo "different")

  if [ "$LOCK_HASH_BEFORE" = "$LAST_INSTALL_HASH" ]; then
    step "Dépendances à jour (package-lock.json inchangé) — npm install ignoré"
  else
    step "Installation des dépendances (npm install)..."
    npm install --no-audit --no-fund
    echo "$LOCK_HASH_BEFORE" > .deploy-lock-hash
  fi
fi

# -------------------------------------------------------------
# 3. Schéma de base de données (Drizzle)
# -------------------------------------------------------------
if [ "$QUICK" -eq 1 ] && [ "$FORCE_DB" -eq 0 ]; then
  step "Mode --quick : mise à jour du schéma DB ignorée (utilisez --db pour la forcer)"
else
  step "Application du schéma Drizzle (npx drizzle-kit push)..."
  npx drizzle-kit push --force || fail "Échec de drizzle-kit push — vérifiez DATABASE_URL dans .env"
fi

# -------------------------------------------------------------
# 4. Build de production Next.js
# -------------------------------------------------------------
step "Build de production (npm run build) — quelques minutes..."
if npm run build; then
  echo "  ✅ Build réussi"
else
  fail "Échec du build — consultez les erreurs ci-dessus."
fi

# -------------------------------------------------------------
# 5. Redémarrage de l'application via PM2
# -------------------------------------------------------------
step "Redémarrage de l'application (PM2)..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  warn "L'app PM2 '$APP_NAME' n'existe pas encore — création..."
  pm2 start npm --name "$APP_NAME" -- run start
  pm2 startup 2>/dev/null || warn "Exécutez manuellement la commande affichée par 'pm2 startup' (en root)."
fi
pm2 save

# -------------------------------------------------------------
# 6. Vérifications post-déploiement
# -------------------------------------------------------------
step "Attente du démarrage (10 s)..."
sleep 10

step "Vérification de santé (healthcheck)..."
HEALTH=""
for i in 1 2 3 4 5; do
  HEALTH=$(curl -s -m 5 http://localhost:3000/api/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"ok":true'; then
    echo "  ✅ Application en ligne : $HEALTH"
    break
  fi
  echo "  ... tentative $i/5"
  sleep 5
done
echo "$HEALTH" | grep -q '"ok":true' || fail "L'application ne répond pas. Logs : pm2 logs $APP_NAME"

pm2 status "$APP_NAME"

echo ""
echo "======================================================="
echo -e "${GREEN} ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS${NC}"
echo "======================================================="
echo " Site          : $(grep -oP 'SITE_URL=\K.*' .env 2>/dev/null || echo 'https://votre-domaine.com')"
echo " Heure         : $(date '+%H:%M:%S')"
echo " Logs applic.  : pm2 logs $APP_NAME"
echo " Log déploiem. : $LOG_FILE"
echo "======================================================="
