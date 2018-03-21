FROM node:8.10.0-alpine
WORKDIR /usr/app
COPY . .
ENV HOST 0.0.0.0
ENV GRPC_PORT 10382
RUN npm install --production
EXPOSE 10382
CMD ["node", "server.js"]
