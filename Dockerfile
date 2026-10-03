# syntax=docker/dockerfile:1
FROM node:24.19.0-alpine AS base

RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm install --global npm@11.9.0 --strict-ssl=true

FROM base AS deps

WORKDIR /app

COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --strict-ssl=true

FROM deps AS build

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM base AS frontend-deps

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --prefix frontend --strict-ssl=true

FROM frontend-deps AS frontend-build

COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_STATIC_DIR=/app/public

WORKDIR /app

COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --omit=dev --strict-ssl=true && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/health',timeout:2000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

CMD ["node", "dist/main.js"]
