#!/bin/bash

# Script de monitoramento para containers Docker
set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Função para mostrar status dos containers
show_status() {
    echo
    info "📊 Status dos Containers:"
    echo "=========================="
    docker-compose -f docker-compose.prod.yml ps
}

# Função para mostrar uso de recursos
show_resources() {
    echo
    info "💻 Uso de Recursos:"
    echo "==================="
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Função para mostrar logs recentes
show_logs() {
    local service=${1:-""}
    echo
    if [ -z "$service" ]; then
        info "📋 Logs Recentes (Todos os Serviços):"
        echo "====================================="
        docker-compose -f docker-compose.prod.yml logs --tail=20 --timestamps
    else
        info "📋 Logs Recentes ($service):"
        echo "============================="
        docker-compose -f docker-compose.prod.yml logs --tail=50 --timestamps "$service"
    fi
}

# Função para verificar saúde dos serviços
check_health() {
    echo
    info "🏥 Verificação de Saúde:"
    echo "========================"
    
    # Verificar API
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log "✅ API: Saudável"
    else
        error "❌ API: Não responsiva"
    fi
    
    # Verificar Nginx
    if curl -f -s http://localhost/ > /dev/null 2>&1; then
        log "✅ Nginx: Saudável"
    else
        error "❌ Nginx: Não responsiva"
    fi
    
    # Verificar Redis
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
        log "✅ Redis: Saudável"
    else
        error "❌ Redis: Não responsiva"
    fi
}

# Função para mostrar informações do sistema
show_system_info() {
    echo
    info "🖥️  Informações do Sistema:"
    echo "==========================="
    echo "Uptime: $(uptime -p)"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    echo "Memória: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2 " (" $3/$2*100 "%)"}')"
    echo "Disco: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
    echo "Docker: $(docker --version)"
}

# Função para mostrar estatísticas de rede
show_network_stats() {
    echo
    info "🌐 Estatísticas de Rede:"
    echo "========================"
    docker network ls | grep trade
    echo
    docker-compose -f docker-compose.prod.yml exec -T nginx cat /var/log/nginx/access.log | tail -10 2>/dev/null || warn "Logs do Nginx não disponíveis"
}

# Função para verificar atualizações
check_updates() {
    echo
    info "🔄 Verificando Atualizações:"
    echo "============================"
    
    # Verificar se há commits novos
    if git status --porcelain | grep -q .; then
        warn "⚠️  Há alterações locais não commitadas"
    fi
    
    git fetch origin main 2>/dev/null || warn "Não foi possível verificar atualizações remotas"
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
    
    if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
        warn "🔄 Há atualizações disponíveis no repositório"
        echo "   Para atualizar: git pull && ./scripts/deploy.sh"
    else
        log "✅ Código está atualizado"
    fi
}

# Menu principal
show_menu() {
    echo
    info "🔧 Monitor Trade NB Members"
    echo "==========================="
    echo "1) Status dos containers"
    echo "2) Uso de recursos"
    echo "3) Logs (todos os serviços)"
    echo "4) Logs da API"
    echo "5) Logs do Bot"
    echo "6) Logs do Nginx"
    echo "7) Verificar saúde"
    echo "8) Informações do sistema"
    echo "9) Estatísticas de rede"
    echo "10) Verificar atualizações"
    echo "11) Monitoramento contínuo"
    echo "0) Sair"
    echo
}

# Monitoramento contínuo
continuous_monitor() {
    echo
    info "🔄 Monitoramento Contínuo (Ctrl+C para sair)"
    echo "============================================="
    
    while true; do
        clear
        echo "$(date)"
        show_status
        show_resources
        check_health
        echo
        info "Próxima atualização em 30 segundos..."
        sleep 30
    done
}

# Verificar se está no diretório correto
if [ ! -f "docker-compose.prod.yml" ]; then
    error "Arquivo docker-compose.prod.yml não encontrado!"
    error "Execute este script no diretório raiz do projeto."
    exit 1
fi

# Menu interativo ou comando direto
if [ $# -eq 0 ]; then
    while true; do
        show_menu
        read -p "Escolha uma opção: " choice
        
        case $choice in
            1) show_status ;;
            2) show_resources ;;
            3) show_logs ;;
            4) show_logs "trade-api" ;;
            5) show_logs "trade-bot" ;;
            6) show_logs "nginx" ;;
            7) check_health ;;
            8) show_system_info ;;
            9) show_network_stats ;;
            10) check_updates ;;
            11) continuous_monitor ;;
            0) log "👋 Saindo..."; exit 0 ;;
            *) error "Opção inválida!" ;;
        esac
        
        echo
        read -p "Pressione Enter para continuar..."
    done
else
    # Executar comando específico
    case $1 in
        "status") show_status ;;
        "resources") show_resources ;;
        "logs") show_logs "$2" ;;
        "health") check_health ;;
        "system") show_system_info ;;
        "network") show_network_stats ;;
        "updates") check_updates ;;
        "monitor") continuous_monitor ;;
        *) 
            error "Comando inválido: $1"
            echo "Comandos disponíveis: status, resources, logs, health, system, network, updates, monitor"
            exit 1
            ;;
    esac
fi