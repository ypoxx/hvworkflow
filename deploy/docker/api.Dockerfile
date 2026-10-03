# syntax=docker/dockerfile:1
# Slice 037a: the image of the service (target `api`, the last target and therefore the default) and the image of the
# one-off fill of the local stack (target `seed`). Build context is the repository root (`deploy/compose/compose.yaml`).
#
# Supply chain: every base image is pinned by tag and by the digest of its multi-architecture index; the tag only says
# which line it is. Update tag and digest together. pnpm comes through corepack, pinned with its sha512 in
# `packageManager` (root package.json), so corepack checks the download.
#
# The service runs from source with the tsx loader, exactly as `pnpm --filter @hv/api start` and CI run it (spec 037a,
# decision 2: no second start path through a bundle). The `api` target never contains anything from `scripts/`.

# ---- build stage: production dependencies of @hv/api and its workspace packages ---------------------------------------
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/contract/package.json packages/contract/
# `build_ca` is an optional build secret: a PEM file with an extra root certificate for build hosts behind a
# TLS-inspecting proxy (HV_STACK_BUILD_CA, docs/betrieb/installation.md). It is mounted only for this step and never
# lands in a layer; without it (the normal case, and CI) the file is empty and nothing changes.
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    corepack enable && pnpm install --frozen-lockfile --prod --filter '@hv/api...'
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY apps/api/tsconfig.json apps/api/
COPY tsconfig.base.json ./
COPY packages/domain/src packages/domain/src
COPY packages/contract/src packages/contract/src
COPY packages/contract/openapi.yaml packages/contract/
# The web manifest was only needed so the frozen lockfile matches the workspace; the web package itself stays out.
RUN rm -rf apps/web \
 && mkdir -p /out/hv /out/access-log \
 && chmod 0755 /out/hv \
 && chmod 0700 /out/access-log

# ---- runtime base: distroless Node 22, user 65532, no shell, no package manager ---------------------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:13593b7570658e8477de39e2f4a1dd25db2f836d68a0ba771251572d23bb4f8e AS runtime
# The tsx loader keeps its compile cache under TMPDIR; compose mounts a tmpfs there (the root file system is read-only).
ENV TMPDIR=/tmp
COPY --from=build --chown=0:0 /app /app
# /var/lib/hv belongs to root (0755); only the access log directory belongs to the service user, with 0700. A new named
# volume on that path takes over owner and rights, so the check of slice 034b passes.
COPY --from=build --chown=0:0 /out/hv /var/lib/hv
COPY --from=build --chown=65532:65532 --chmod=0700 /out/access-log /var/lib/hv/access-log
WORKDIR /app/apps/api
USER 65532:65532

# ---- seed: the one-off fill of the local stack (never pushed; slice 037b ships only `api`) ----------------------------
FROM runtime AS seed
COPY --chown=0:0 scripts/stack-seed.mjs /app/scripts/stack-seed.mjs
COPY --chown=0:0 scripts/lib/demo-bootstrap.mjs scripts/lib/demo-persons.mjs /app/scripts/lib/
USER 65532:65532
CMD ["--import", "tsx", "/app/scripts/stack-seed.mjs"]

# ---- api: the service (default target) --------------------------------------------------------------------------------
FROM runtime AS api
USER 65532:65532
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:8787/healthz').then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"]
CMD ["--import", "tsx", "/app/apps/api/src/server.ts"]
