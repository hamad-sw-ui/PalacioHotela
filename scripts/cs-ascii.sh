:
echo "=== SNAPSHOT CODE PRE-DEPLOY ==="
TS=$(date +%Y%m%d_%H%M%S)
tar -cf /var/backups/palacio/code-pre-deploy-${TS}.tar -C /var/www palacio --exclude='palacio/node_modules' --exclude='palacio/.next/cache'
echo "snapshot: /var/backups/palacio/code-pre-deploy-${TS}.tar"
ls -la /var/backups/palacio/code-pre-deploy-${TS}.tar
tar -tf /var/backups/palacio/code-pre-deploy-${TS}.tar | wc -l
echo "=== NB FICHIERS CODE ACTUEL (sans node_modules) ==="
find /var/www/palacio -type f -not -path '*/node_modules/*' -not -path '*/.next/*' | wc -l
