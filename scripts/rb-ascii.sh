:
cd /var/www/palacio-release
export DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder_build"
export NODE_ENV="production"
npx next build > /tmp/build-out2.txt 2>&1
echo "BUILD_EXIT=$?" >> /tmp/build-out2.txt
