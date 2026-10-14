#!/bin/sh
set -e

# Railway variable COOKIES_B64 = base64 of cookies.txt
# yt-dlp rewrites the cookie file, so keep it in a writable path
if [ -n "$COOKIES_B64" ]; then
  echo "$COOKIES_B64" | base64 -d > /tmp/cookies.txt
  chmod 600 /tmp/cookies.txt
  export YTDLP_COOKIES=/tmp/cookies.txt
fi

exec "$@"
