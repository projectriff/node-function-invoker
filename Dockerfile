FROM node:10.7.0-alpine
WORKDIR /usr/app
COPY . .
ENV HOST 0.0.0.0
ENV HTTP_PORT 8080
RUN npm install --production
EXPOSE 10382 8080
CMD ["node", "server.js"]
