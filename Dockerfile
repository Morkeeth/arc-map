FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_APP_ORIGIN=http://localhost:3117
ARG NEXT_PUBLIC_PRIVY_APP_ID=cmp5vd2h3000c0di993q8z1l6
ENV NEXT_PUBLIC_APP_ORIGIN=$NEXT_PUBLIC_APP_ORIGIN
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM dependencies AS collector
COPY --chown=node:node src ./src
COPY --chown=node:node scripts/ingest.ts ./scripts/ingest.ts
COPY --chown=node:node scripts/radar.ts ./scripts/radar.ts
COPY --chown=node:node scripts/thesis-worker.ts ./scripts/thesis-worker.ts
COPY --chown=node:node tsconfig.json ./tsconfig.json
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
CMD ["npm", "run", "ingest:watch"]

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# Single-service image: web + worker supervisor in one process tree, one volume.
# Use this target on hosts where a volume attaches to exactly one service.
FROM dependencies AS all
COPY --from=build --chown=node:node /app/.next/standalone ./.next/standalone
COPY --from=build --chown=node:node /app/.next/static ./.next/standalone/.next/static
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node tsconfig.json ./tsconfig.json
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
CMD ["node", "scripts/serve-all.mjs"]
