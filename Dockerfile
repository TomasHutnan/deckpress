# Single-container DeckPress image: built React Studio UI + Fastify server + Alpine system Chromium & Git.
FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts
COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
RUN apk add --no-cache \
      chromium \
      git \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto
ENV NODE_ENV=production \
    PORT=8080 \
    DECKPRESS_STATIC_DIR=/app/dist/client \
    DECKPRESS_DATA_DIR=/data \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts/hash-password.mjs ./scripts/hash-password.mjs
RUN mkdir -p /data/projects /home/node/.cache && chown -R node:node /data /home/node/.cache
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "dist/server/server/main.js"]
