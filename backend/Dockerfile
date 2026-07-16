FROM node:22-bookworm-slim

# Install system dependencies needed to build sqlite3 native bindings
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source files
COPY . .

EXPOSE 5000
ENV PORT=5000

CMD ["node", "server.js"]
