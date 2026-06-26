FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM deps AS build

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS frontend-deps

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

FROM frontend-deps AS frontend-build

COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_STATIC_DIR=/app/public

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/health',timeout:2000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

CMD ["node", "dist/main.js"]
