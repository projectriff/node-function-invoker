FROM node:8.9.4-alpine
WORKDIR /usr/app
COPY . .
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
