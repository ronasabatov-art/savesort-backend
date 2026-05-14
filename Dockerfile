# שימוש בגרסת Node 20
FROM node:20-alpine

# התקנת ffmpeg, Python ו-yt-dlp עבור חילוץ מידע מתקדם
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m venv /venv && \
    /venv/bin/pip install yt-dlp

WORKDIR /app

# העתקת הגדרות החבילות והתקנתן
COPY package*.json ./
RUN npm install

# העתקת שאר הקבצים
COPY . .

EXPOSE 3000

# הרצת השרת על בסיס server.js
CMD ["node", "server.js"]
