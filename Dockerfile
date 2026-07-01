# Monmon Quest - single container for Cloud Run
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Install deps first for better layer caching
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# App source
COPY server.js ./
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
