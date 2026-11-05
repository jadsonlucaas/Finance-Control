# Build a partir da RAIZ do repositorio:
#   docker build -f services/whatsapp-api/Dockerfile -t finance-control-whatsapp-api .
FROM node:22-alpine

WORKDIR /app

# O servico reaproveita o dominio puro do app (validacao e regras de calculo).
RUN echo '{"type":"module","private":true}' > /app/package.json
COPY src/core ./src/core
COPY src/domain ./src/domain
COPY src/application/selectors ./src/application/selectors

COPY services/whatsapp-api/package.json services/whatsapp-api/package-lock.json ./services/whatsapp-api/
RUN cd services/whatsapp-api && npm ci --omit=dev --no-audit --no-fund
COPY services/whatsapp-api/src ./services/whatsapp-api/src

ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1
CMD ["node", "services/whatsapp-api/src/server.js"]
