#!/bin/bash

# Script de restore para containers Docker
set -e

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
    exit 1
}

# Verificar parâmetros
if [ $# -eq 0 ]; then
    error "Uso: $0 <data_do_backup> [componente]"
    echo "Exemplo: $0 20240125_143022"
    echo "Exemplo: $0 20240125_143022 redis"
    echo "Componentes disponíveis: redis, sqlite, data, logs, config, all"
    exit 1
fi

BACKUP_DATE=$1
COMPONENT=${2:-all}
BACKUP_DIR="/home/backup/trade-nb-members"

log "🔄 Iniciando restore - $BACKUP_DATE"

# Verificar se os arquivos de backup existem
if [ ! -d "$BACKUP_DIR" ]; then
    error "Diretório de backup não encontrado: $BACKUP_DIR"
fi

# Função para restaurar Redis
restore_redis() {
    if [ -f "$BACKUP_DIR/redis-data_$BACKUP_DATE.tar.gz" ]; then
        log "Restaurando dados do Redis..."
        docker-compose -f docker-compose.prod.yml stop redis
        docker run --rm \
            -v trade_nb_members_redis-data:/data \
            -v "$BACKUP_DIR":/backup \
            alpine:latest \
            sh -c "rm -rf /data/* && tar xzf /backup/redis-data_$BACKUP_DATE.tar.gz -C /data"
        docker-compose -f docker-compose.prod.yml start redis
        log "✅ Redis restaurado com sucesso!"
    else
        warn "Backup do Redis não encontrado para a data $BACKUP_DATE"
    fi
}

# Função para restaurar SQLite
restore_sqlite() {
    if [ -f "$BACKUP_DIR/sqlite-db_$BACKUP_DATE.tar.gz" ]; then
        log "Restaurando bancos SQLite..."
        docker-compose -f docker-compose.prod.yml stop trade-api trade-bot
        rm -rf ./db/*
        tar xzf "$BACKUP_DIR/sqlite-db_$BACKUP_DATE.tar.gz" -C .
        docker-compose -f docker-compose.prod.yml start trade-api trade-bot
        log "✅ Bancos SQLite restaurados com sucesso!"
    else
        warn "Backup do SQLite não encontrado para a data $BACKUP_DATE"
    fi
}

# Função para restaurar dados da aplicação
restore_data() {
    if [ -f "$BACKUP_DIR/app-data_$BACKUP_DATE.tar.gz" ]; then
        log "Restaurando dados da aplicação..."
        rm -rf ./data/*
        tar xzf "$BACKUP_DIR/app-data_$BACKUP_DATE.tar.gz" -C .
        log "✅ Dados da aplicação restaurados com sucesso!"
    else
        warn "Backup dos dados não encontrado para a data $BACKUP_DATE"
    fi
}

# Função para restaurar logs
restore_logs() {
    if [ -f "$BACKUP_DIR/logs_$BACKUP_DATE.tar.gz" ]; then
        log "Restaurando logs..."
        rm -rf ./logs/*
        tar xzf "$BACKUP_DIR/logs_$BACKUP_DATE.tar.gz" -C .
        log "✅ Logs restaurados com sucesso!"
    else
        warn "Backup dos logs não encontrado para a data $BACKUP_DATE"
    fi
}

# Função para restaurar configurações
restore_config() {
    if [ -f "$BACKUP_DIR/config_$BACKUP_DATE.tar.gz" ]; then
        log "Restaurando configurações..."
        warn "⚠️  Isso irá sobrescrever os arquivos de configuração atuais!"
        read -p "Continuar? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tar xzf "$BACKUP_DIR/config_$BACKUP_DATE.tar.gz" -C .
            log "✅ Configurações restauradas com sucesso!"
        else
            log "Restore de configurações cancelado"
        fi
    else
        warn "Backup das configurações não encontrado para a data $BACKUP_DATE"
    fi
}

# Confirmar restore
warn "⚠️  ATENÇÃO: Esta operação irá sobrescrever os dados atuais!"
warn "Componente: $COMPONENT"
warn "Data do backup: $BACKUP_DATE"
read -p "Tem certeza que deseja continuar? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Restore cancelado"
    exit 0
fi

# Executar restore baseado no componente
case $COMPONENT in
    "redis")
        restore_redis
        ;;
    "sqlite")
        restore_sqlite
        ;;
    "data")
        restore_data
        ;;
    "logs")
        restore_logs
        ;;
    "config")
        restore_config
        ;;
    "all")
        restore_redis
        restore_sqlite
        restore_data
        restore_logs
        restore_config
        ;;
    *)
        error "Componente inválido: $COMPONENT"
        ;;
esac

log "🎉 Restore concluído!"
log "🔄 Reiniciando serviços..."
docker-compose -f docker-compose.prod.yml restart

log "✅ Todos os serviços foram reiniciados!"