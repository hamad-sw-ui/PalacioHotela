:
echo "=== erreur la plus recente: quelle heure ? ==="
stat -c '%y %n' /root/.pm2/logs/palaciohotel-error.log
date -u
echo "=== erreurs sur les pages testees ==="
M=$(wc -l < /root/.pm2/logs/palaciohotel-error.log)
for p in / /contact /devis /hebergements /disponibilites /compte /reservation /devis/suivi /admin; do curl -s -o /dev/null "http://127.0.0.1:3000$p"; done
sleep 3
N=$(wc -l < /root/.pm2/logs/palaciohotel-error.log)
echo "avant=$M apres=$N delta=$((N-M))"
echo "=== chunk culprit ==="
grep -r 'useSite' /var/www/palacio/.next/server/chunks/ssr/_1_6a6w9._.js 2>/dev/null | head -c 200
