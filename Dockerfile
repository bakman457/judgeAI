# Judge AI - Production Docker Image
# Optimized for Google Cloud Run (Free Tier compatible)

FROM node:22-slim

WORKDIR /app

# Install pnpm and build tools for native modules (sharp, bcrypt, etc.)
RUN npm install -g pnpm@10.4.1 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      ca-certificates \
      && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first (for layer caching)
COPY package.json pnpm-lock.yaml .npmrc* ./

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build client + server for production
RUN pnpm build

# Ensure uploads directory exists and is writable
RUN mkdir -p uploads/judge-ai && chmod -R 777 uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start: run migrations then server
CMD ["sh", "-c", "pnpm drizzle-kit migrate && node dist/index.js"]
