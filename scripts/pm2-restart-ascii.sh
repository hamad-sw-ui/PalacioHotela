:
pm2 restart palaciohotel --update-env
sleep 6
pm2 status | grep palaciohotel
echo "=== HEALTH ==="
sleep 3
curl -s -o /dev/null -w 'home: %{http_code}\n' http://127.0.0.1:3000/
curl -s -o /dev/null -w 'contact: %{http_code}\n' http://127.0.0.1:3000/contact
curl -s -o /dev/null -w 'devis: %{http_code}\n' http://127.0.0.1:3000/devis
curl -s -o /dev/null -w 'notfound: %{http_code}\n' http://127.0.0.1:3000/page-inexistante-xyz
curl -s http://127.0.0.1:3000/ | grep -oE '<title>[^<]+' | head -1