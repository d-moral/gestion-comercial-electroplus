FROM node:20-alpine

RUN apk add --no-cache postgresql16-client

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]