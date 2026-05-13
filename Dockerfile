# שימוש בגרסה יציבה של Node.js
FROM node:18-alpine

# התקנת ffmpeg ישירות על מערכת ההפעלה של השרת
RUN apk add --no-cache ffmpeg

# הגדרת תיקיית העבודה
WORKDIR /app

# העתקת קבצי ההגדרות והתקנת הספריות
COPY package*.json ./
RUN npm install

# העתקת כל שאר הקוד (כולל server.js)
COPY . .

# הפקודה שמפעילה את השרת שלך
CMD ["node", "server.js"]
