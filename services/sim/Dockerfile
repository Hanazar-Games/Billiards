# The simulation service image (D059). Build the bundle first (npm run build -w
# services/sim): the image copies only build/server.mjs and downloads nothing.
FROM node:24-alpine
WORKDIR /app
COPY build/server.mjs ./server.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
