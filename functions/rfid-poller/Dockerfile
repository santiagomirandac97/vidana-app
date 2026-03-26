FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src/ ./src/

# Install devDependencies temporarily for build, then prune
RUN npm install && npm run build && npm prune --production

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]
