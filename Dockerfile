FROM node:20-alpine

# התקנת ffmpeg, פייתון ו-pip עבור yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m venv /venv && \
    /venv/bin/pip install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
