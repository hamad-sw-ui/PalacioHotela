:
rm -f /var/backups/palacio/code-pre-deploy-20261101_003228.tar
TS=$(date +%Y%m%d_%H%M%S)
tar -cf /var/backups/palacio/code-pre-deploy-${TS}.tar -C /var/www --exclude='palacio/node_modules' --exclude='palacio/.next/cache' palacio
echo "snapshot: /var/backups/palacio/code-pre-deploy-${TS}.tar"
ls -la /var/backups/palacio/code-pre-deploy-${TS}.tar
tar -tf /var/backups/palacio/code-pre-deploy-${TS}.tar | wc -l
df -h / | tail -1