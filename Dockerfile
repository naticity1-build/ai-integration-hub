FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm install
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
EXPOSE 3100 3001
CMD ["node", "packages/mcp-server/dist/index.js"]
