#!/bin/bash

# Script de backup para containers Docker
set -e

# Configurações
BACKUP_DIR="/home/backup/trade-nb-members"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

log "🗄️  Iniciando backup - $DATE"

# Backup dos volumes Docker
log "Fazendo backup dos volumes..."
docker run --rm \
    -v trade_nb_members_redis-data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:latest \
    tar czf "/backup/redis-data_$DATE.tar.gz" -C /data .

# Backup dos bancos de dados SQLite
log "Fazendo backup dos bancos SQLite..."
if [ -d "./db" ]; then
    tar czf "$BACKUP_DIR/sqlite-db_$DATE.tar.gz" -C . db/
fi

# Backup dos dados da aplicação
log "Fazendo backup dos dados da aplicação..."
if [ -d "./data" ]; then
    tar czf "$BACKUP_DIR/app-data_$DATE.tar.gz" -C . data/
fi

# Backup dos logs
log "Fazendo backup dos logs..."
if [ -d "./logs" ]; then
    tar czf "$BACKUP_DIR/logs_$DATE.tar.gz" -C . logs/
fi

# Backup da configuração
log "Fazendo backup das configurações..."
tar czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    docker-compose.prod.yml \
    nginx.conf \
    redis.conf \
    .env 2>/dev/null || warn "Alguns arquivos de configuração não foram encontrados"

# Backup das imagens Docker (opcional)
read -p "Deseja fazer backup das imagens Docker? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Fazendo backup das imagens Docker..."
    docker save $(docker-compose -f docker-compose.prod.yml config --services | xargs -I {} echo "trade_nb_members_{}" | tr '\n' ' ') | gzip > "$BACKUP_DIR/docker-images_$DATE.tar.gz"
fi

# Limpeza de backups antigos
log "Limpando backups antigos (mais de $RETENTION_DAYS dias)..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Verificar tamanho do backup
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "✅ Backup concluído!"
log "📁 Localização: $BACKUP_DIR"
log "📊 Tamanho total: $BACKUP_SIZE"

# Listar backups
log "📋 Backups disponíveis:"
ls -lah "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -10 || warn "Nenhum backup encontrado"