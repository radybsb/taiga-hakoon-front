# Build customized source, not taiga-front-dist from upstream.
# Node 16 is confined to the builder for compatibility with node-sass 8.
ARG NODE_IMAGE=node:16.20.2-bullseye
ARG NGINX_IMAGE=nginx:stable-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /src
RUN git --version && python3 --version && make --version \
    && git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
    && git config --global --add url."https://github.com/".insteadOf git@github.com:
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
ENV DISABLE_ROBOTS=true
RUN ./node_modules/.bin/gulp deploy --dist /build/dist --tmp /build/tmp \
    && node docker/verify-build.cjs /build/dist \
    && rm /build/dist/conf.json

FROM ${NGINX_IMAGE} AS runtime
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Hakoon Taiga frontend" \
      org.opencontainers.image.source="https://github.com/radybsb/taiga-hakoon-front" \
      org.opencontainers.image.revision=${VCS_REF}
RUN apk add --no-cache bash jq \
    && rm -rf /usr/share/nginx/html/*
COPY --from=build /build/dist/ /usr/share/nginx/html/
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/frontend-locations.conf /etc/nginx/snippets/frontend-locations.conf
COPY docker/conf.json.template /usr/share/nginx/html/conf.json.template
COPY docker/config_env_subst.sh /docker-entrypoint.d/30_config_env_subst.sh
RUN chmod +x /docker-entrypoint.d/30_config_env_subst.sh
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
EXPOSE 80
