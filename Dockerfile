# Dockerfile para Trade NB Members
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copiar arquivos de configuração
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Instalar pnpm
RUN npm install -g pnpm

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build da aplicação
RUN pnpm run frontend:build
RUN pnpm run build

# Criar diretórios necessários
RUN mkdir -p logs db data

# Expor porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "dist/index.js"] 