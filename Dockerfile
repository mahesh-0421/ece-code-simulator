FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=10000 \
    OCTAVE_HISTFILE=/dev/null

# Install GNU Octave, gnuplot (for headless plotting), and Icarus Verilog
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       octave \
       gnuplot \
       iverilog \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY backend ./backend
COPY frontend ./frontend

# Create non-root working environment
RUN mkdir -p /app/backend/temp \
    && chown -R node:node /app

USER node

EXPOSE 10000

CMD ["node", "backend/server.js"]
