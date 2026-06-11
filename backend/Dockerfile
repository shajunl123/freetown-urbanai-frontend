FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/freetown.db
ENV UPLOAD_DIR=/app/data/uploads

EXPOSE 3001

CMD ["npm", "start"]
