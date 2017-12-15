FROM node:8.9.1-alpine
WORKDIR /usr/app
COPY src/main/node/ .
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
