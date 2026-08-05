FROM node:20-alpine

# `wget`/`openssl` are needed by the Prisma engines and the healthcheck.
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first so the layer is cached across source changes.
COPY package*.json ./
RUN npm ci --omit=dev

# Generate the Prisma client against the checked-in schema.
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000
# Disable the Prisma CLI version check so startup works without egress.
ENV CHECKPOINT_DISABLE=1
EXPOSE 5000

USER node

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
