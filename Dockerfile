# Multi-stage build para otimizar o tamanho da imagem
FROM node:18-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build do projeto
RUN pnpm build:all

# Estágio de produção
FROM node:18-alpine AS production

# Instalar pnpm
RUN npm install -g pnpm

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instalar apenas dependências de produção
RUN pnpm install --prod --frozen-lockfile

# Copiar arquivos buildados do estágio anterior
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/src/frontend/dist ./src/frontend/dist

# Criar diretórios necessários
RUN mkdir -p db data logs && chown -R nodejs:nodejs db data logs

# Mudar para usuário não-root
USER nodejs

# Expor portas
EXPOSE 3000 5173

# Comando padrão (API)
CMD ["node", "dist/api/index.js"]