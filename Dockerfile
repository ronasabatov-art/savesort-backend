# שדרוג לגרסה 20 פותר את שגיאת ה-ReferenceError: File
FROM node:20-alpine

# התקנת ffmpeg עבור המערכת
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# ודואגים שההרצה היא על server.js
CMD ["node", "server.js"]
