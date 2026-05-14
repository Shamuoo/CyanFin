FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --production
COPY . .
RUN mkdir -p /app/data
EXPOSE 3000
ENV CONFIG_PATH=/app/data/config.json
CMD ["node", "server/index.js"]
