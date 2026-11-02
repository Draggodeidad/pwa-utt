# Same immutable Node 22.22.3 / Debian base for every stage; no registry push.
FROM node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752 AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
ARG COMMIT_SHA
RUN node -e 'if (!/^[0-9a-f]{40}$/i.test(process.argv[1] || "")) process.exit(1)' "$COMMIT_SHA"
COPY . .
# This input is compiled into /api/health by next.config.mjs.
RUN W10_BUILD_SHA="$COMMIT_SHA" npm run build && rm -rf .next/cache

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752 AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ARG COMMIT_SHA
LABEL org.opencontainers.image.revision="$COMMIT_SHA"
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json /app/next.config.mjs ./
COPY --from=build /app/src/lib/security/headers.mjs ./src/lib/security/headers.mjs
COPY --from=build /app/.next ./.next
# Includes offline-assets.json and sw-build.js from the existing postbuild.
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/api/health", {signal: AbortSignal.timeout(4000)}).then(async r => { const b = await r.json(); if (r.status !== 200 || b.status !== "ok" || !/^[0-9a-f]{40}$/i.test(b.commitSha || "")) process.exit(1); }).catch(() => process.exit(1))'
# Same Next start as npm start, with Node as PID 1 to receive stop signals.
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
