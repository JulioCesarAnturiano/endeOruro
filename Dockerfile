# Etapa 1: compila el frontend (necesita las dependencias de desarrollo: Vite, TypeScript)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci
COPY frontend frontend
RUN npm run build

# Etapa 2: imagen final, solo el backend con sus dependencias y el frontend compilado
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --omit=dev -w backend && npm cache clean --force
COPY backend/src backend/src
COPY --from=build /app/frontend/dist frontend/dist
USER node
EXPOSE 3001
# Las variables (OPENAI_API_KEY, etc.) llegan desde docker-compose, no desde un archivo .env en la imagen
CMD ["node", "backend/src/index.js"]