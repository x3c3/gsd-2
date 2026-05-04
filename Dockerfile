# ──────────────────────────────────────────────
# Runtime
# Image: ghcr.io/gsd-build/gsd-pi
# Used by: end users via docker run
# ──────────────────────────────────────────────
FROM node:24-slim AS runtime

# Git is required for GSD's git operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install GSD globally — version is controlled by the build arg
ARG GSD_VERSION=latest
RUN npm install -g gsd-pi@${GSD_VERSION}

# Default working directory for user projects
WORKDIR /workspace

ENTRYPOINT ["gsd"]
CMD ["--help"]

# ──────────────────────────────────────────────
# Runtime (local build)
# Image: ghcr.io/gsd-build/gsd-pi:local
# Used by: PR-time e2e smoke, builds the *current source* into an image
# instead of pulling from npm. Lets `tests/e2e/docker/` exercise the actual
# runtime container produced by this branch's code.
# Build with:  docker build --target runtime-local \
#                --build-arg TARBALL=gsd-pi-<version>.tgz -t gsd-pi:local .
# The tarball must be in the build context (created by `npm pack`).
# ──────────────────────────────────────────────
FROM node:24-slim AS runtime-local

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

ARG TARBALL
COPY ${TARBALL} /tmp/gsd-pi.tgz
RUN npm install -g /tmp/gsd-pi.tgz && rm /tmp/gsd-pi.tgz

WORKDIR /workspace

ENTRYPOINT ["gsd"]
CMD ["--help"]
