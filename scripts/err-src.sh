echo "=== le chunk du build actuel contient-il _1_6a6w9 ? ==="
ls /var/www/palacio/.next/server/chunks/ssr/ 2>/dev/null | grep -c '1_6a6w9'
ls /var/www/palacio/.next/server/chunks/ssr/ | head -5
echo "=== les erreurs sont-elles dans le buffer log du restart actuel ==="
# pm_uptime = 1793493375035 (ms epoch) => compare error log lines count avant/apres
echo "lignes log: $(wc -l < /root/.pm2/logs/palaciohotel-error.log)"
echo "=== taille du fichier log ==="
ls -la /root/.pm2/logs/palaciohotel-error.log
echo "=== dernier message d'erreur complet ==="
tail -12 /root/.pm2/logs/palaciohotel-error.log
