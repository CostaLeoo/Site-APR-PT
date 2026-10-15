FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM build AS runtime
RUN npm prune --omit=dev
ENV NODE_ENV=production
USER node
# API by default. For web, override to npm run start -w @apr/web.
CMD ["npm", "run", "start", "-w", "@apr/api"]
