# Builder stage
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./

COPY . .
RUN npm ci

RUN npm run prisma:generate
RUN npm run prisma:migrate:prod
RUN npm run build:worker

# Runner stage
FROM node:lts-alpine AS runner

WORKDIR /app

COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# COPY --from=builder /app/prisma ./prisma
# COPY --from=builder /app/prisma.config.ts ./

RUN npm ci --omit=dev

# CMD ["sh", "-c", "npm run prisma:migrate:prod && npm run start:worker"]
CMD ["node", "dist/apps/worker/main"]