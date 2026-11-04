:
cd /var/www/palacio-release
for p in next drizzle-orm drizzle-kit react pg; do
  v=$(node -p "require('$p/package.json').version" 2>/dev/null || echo ABSENT)
  echo "$p=$v"
done
echo "=== npm ls ==="
npm ls next drizzle-orm drizzle-kit 2>/dev/null | head -8
