FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV WHATSAPP_AUTH_DIR=/data/wa-auth
RUN mkdir -p /data/wa-auth

EXPOSE 3100

CMD ["npm", "start"]
