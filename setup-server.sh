#!/usr/bin/env bash
# =============================================================
#  Palacio Hotel — Installation initiale du VPS (Ubuntu 22.04/24.04)
#  À exécuter UNE SEULE FOIS, en root, après le premier transfert WinSCP
#
#  Usage : sudo bash setup-server.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "${GREEN}▶ $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Exécutez avec sudo : sudo bash setup-server.sh"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || fail "Usage : sudo bash setup-server.sh votredomaine.com"

echo "=== Installation serveur pour : $DOMAIN ==="

# --- 1. Système
step "Mise à jour du système..."
apt update -y && apt upgrade -y

# --- 2. Node.js 22 LTS
step "Installation de Node.js 22..."
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi
node -v

# --- 3. PostgreSQL, Nginx, Certbot
step "Installation de PostgreSQL, Nginx, Certbot, outils..."
apt install -y postgresql nginx certbot python3-certbot-nginx curl git

# --- 4. PM2
step "Installation de PM2..."
npm install -g pm2

# --- 5. Base de données
step "Configuration PostgreSQL..."
DB_PASS=$(openssl rand -hex 16)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='palacio_user'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER palacio_user WITH ENCRYPTED PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='palacio'" | grep -q 1 \
  || sudo -u postgres createdb -O palacio_user palacio
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE palacio TO palacio_user;"
echo "DATABASE_URL=postgresql://palacio_user:$DB_PASS@localhost:5432/palacio"

# --- 6. .env
step "Préparation du fichier .env..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  SESSION_SECRET=$(openssl rand -hex 32)
  {
    echo ""
    echo "DATABASE_URL=postgresql://palacio_user:$DB_PASS@localhost:5432/palacio"
    echo "SESSION_SECRET=$SESSION_SECRET"
    echo "NODE_ENV=production"
  } >> "$APP_DIR/.env"
  echo "  → .env créé. Complétez ADMIN_EMAIL, ADMIN_PASSWORD et vos clés API."
else
  echo "  → .env déjà présent, conservé."
fi

# --- 7. Permissions
chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true
chmod 600 "$APP_DIR/.env"

# --- 8. Nginx
step "Configuration Nginx..."
cat > /etc/nginx/sites-available/palacio <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 10M;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf /etc/nginx/sites-available/palacio /etc/nginx/sites-enabled/palacio
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# --- 9. HTTPS
step "Certificat HTTPS Let's Encrypt..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect \
  || echo "⚠ Certbot a échoué — le DNS pointe-t-il déjà vers ce VPS ? Relancez : sudo certbot --nginx"

# --- 10. Déploiement initial
step "Premier déploiement de l'application..."
cd "$APP_DIR"
npm install --no-audit --no-fund
npx drizzle-kit push --force || true
npm run build
pm2 start npm --name palacio -- run start
pm2 startup
pm2 save

echo ""
echo -e "${GREEN}✅ Installation terminée !${NC}"
echo "Site : https://$DOMAIN"
echo "Mot de passe DB (noté aussi dans .env) : $DB_PASS"
