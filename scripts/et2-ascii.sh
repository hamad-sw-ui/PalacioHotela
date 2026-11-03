:
MARK=$(wc -l < /root/.pm2/logs/palaciohotel-error.log)
for p in / /contact /devis /hebergements /disponibilites /compte /reservation; do curl -s -o /dev/null "http://127.0.0.1:3000$p"; done
sleep 4
NEW=$(( $(wc -l < /root/.pm2/logs/palaciohotel-error.log) - MARK ))
echo "lignes ajoutees: $NEW"
tail -n +"$MARK" /root/.pm2/logs/palaciohotel-error.log | head -16