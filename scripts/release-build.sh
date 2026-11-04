cd /var/www/palacio-release
export DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder_build"
export NEXT_PHASE="phase-production-build"
npx next build > /tmp/build-out3.txt 2>&1
echo "BUILD_EXIT=$?" >> /tmp/build-out3.txt
