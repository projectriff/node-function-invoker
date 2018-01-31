FROM node:8.9.4-alpine
WORKDIR /usr/app
COPY lib ./lib
COPY server.js package.json package-lock.json ./
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
