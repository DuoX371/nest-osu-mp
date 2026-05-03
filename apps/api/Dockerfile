# Builder stage
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN ls

COPY . .
RUN npm ci

RUN npm run prisma:generate
RUN npm run build:main

# Runner stage
FROM node:lts-alpine AS runner

WORKDIR /app

COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

CMD ["node", "dist/apps/api/main"]