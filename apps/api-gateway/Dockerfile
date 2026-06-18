FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts --production --legacy-peer-deps
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
