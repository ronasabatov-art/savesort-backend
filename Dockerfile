FROM node:20-alpine

# התקנת Python ו-yt-dlp בצורה גלובלית
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip install --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
