FROM node:8.9.4-alpine
WORKDIR /usr/app
COPY . .
ENV HOST 0.0.0.0
ENV PORT 8080
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
