FROM node:20-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NPM_CONFIG_LOGLEVEL=warn

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --prod

# Install Playwright browser and system packages in Node
RUN npx playwright install chromium && npx playwright install-deps chromium

COPY . .

EXPOSE 8080
CMD ["pnpm", "start"]
