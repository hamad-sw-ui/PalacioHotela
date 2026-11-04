MARK=$(wc -l < /root/.pm2/logs/palaciohotel-error.log)
for p in / /contact /devis /hebergements /disponibilites /compte /reservation /suivi /page-xyz-404; do
  curl -s -o /dev/null -w '' "http://127.0.0.1:3000$p"
done
sleep 3
echo "=== lignes ajoutées: $(( $(wc -l < /root/.pm2/logs/palaciohotel-error.log) - MARK )) ==="
tail -n +$((MARK+1)) /root/.pm2/logs/palaciohotel-error.log | head -20
