# שדרוג לגרסה 20 פותר את שגיאת ה-ReferenceError: File
FROM node:20-alpine

# התקנת ffmpeg עבור המערכת
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m venv /venv && \
    /venv/bin/pip install yt-dlp

COPY . .

EXPOSE 3000

# ודואגים שההרצה היא על server.js
CMD ["node", "server.js"]
