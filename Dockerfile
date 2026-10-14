FROM node:22-bookworm-slim

# ffmpeg + certs; yt-dlp standalone binary needs no python
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# deno = JS runtime yt-dlp needs for YouTube
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Latest yt-dlp (rebuild the service to update it)
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
