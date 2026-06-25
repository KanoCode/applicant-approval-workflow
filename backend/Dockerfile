FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Apply migrations then start the compiled server. In a real deployment
# you'd likely run migrations as a separate release step rather than on
# every container start, but for a self-contained docker-compose demo this
# keeps "docker compose up" sufficient on a fresh database.
CMD sh -c "npx prisma migrate deploy && node dist/server.js"
