FROM node:8.9.1-alpine
ADD src/main/node/* /
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
