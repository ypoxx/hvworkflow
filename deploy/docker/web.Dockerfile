# syntax=docker/dockerfile:1
# Slice 037a: the web interface in HTTP mode behind nginx, with the limits in front of the service
# (`deploy/docker/nginx.conf`). Build context is the repository root. Base images pinned by tag and index digest.

# ---- build stage: `HV_WEB_MODE=http` is a build-time switch of the interface (same-origin `/v1` and `/auth`) --------
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/contract/package.json packages/contract/
# Optional extra root certificate for build hosts behind a TLS-inspecting proxy; see api.Dockerfile.
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    corepack enable && pnpm install --frozen-lockfile --filter '@hv/web...'
COPY tsconfig.base.json ./
COPY packages/domain packages/domain
COPY packages/contract packages/contract
COPY apps/web apps/web
# The build writes source maps (`vite.config.ts`); they are removed here and nginx answers every `.map` with 404 too.
RUN HV_WEB_MODE=http pnpm --filter @hv/web build \
 && find apps/web/dist -name '*.map' -delete

# ---- runtime: nginx without root (user 101, port 8080) ----------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e AS web
COPY --chown=0:0 deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=0:0 /app/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
