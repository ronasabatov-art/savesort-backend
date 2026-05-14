# שימוש בגרסת Node עדכנית
FROM node:20-alpine

# התקנת כלי מערכת: ffmpeg ו-Python עבור חילוץ המידע
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m venv /venv && \
    /venv/bin/pip install yt-dlp

WORKDIR /app

# העתקת קבצי ההגדרות והתקנת ספריות ה-Node
COPY package*.json ./
RUN npm install

# העתקת שאר קודי הפרויקט
COPY . .

EXPOSE 3000

# הרצת השרת
CMD ["node", "server.js"]
