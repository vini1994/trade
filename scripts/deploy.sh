#!/bin/bash

# Script de deploy para VPS
set -e

echo "🚀 Iniciando deploy do Trade NB Members..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    log "Docker instalado com sucesso!"
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose não está instalado. Instalando..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "Docker Compose instalado com sucesso!"
fi

# Verificar se arquivo .env existe
if [ ! -f .env ]; then
    warn "Arquivo .env não encontrado. Copiando do exemplo..."
    cp .env.example .env
    warn "⚠️  IMPORTANTE: Configure suas credenciais no arquivo .env antes de continuar!"
    read -p "Pressione Enter após configurar o arquivo .env..."
fi

# Criar diretórios necessários
log "Criando diretórios necessários..."
mkdir -p db data logs ssl

# Parar containers existentes
log "Parando containers existentes..."
docker-compose -f docker-compose.prod.yml down --remove-orphans || true

# Remover imagens antigas (opcional)
read -p "Deseja remover imagens Docker antigas? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removendo imagens antigas..."
    docker system prune -f
fi

# Build das imagens
log "Fazendo build das imagens Docker..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Iniciar serviços
log "Iniciando serviços..."
docker-compose -f docker-compose.prod.yml up -d

# Aguardar serviços ficarem prontos
log "Aguardando serviços ficarem prontos..."
sleep 30

# Verificar status dos containers
log "Verificando status dos containers..."
docker-compose -f docker-compose.prod.yml ps

# Verificar logs
log "Verificando logs dos serviços..."
docker-compose -f docker-compose.prod.yml logs --tail=50

# Teste de conectividade
log "Testando conectividade..."
if curl -f http://localhost/health &> /dev/null; then
    log "✅ Aplicação está rodando corretamente!"
    log "🌐 Acesse: http://$(curl -s ifconfig.me)"
else
    warn "⚠️  Aplicação pode não estar respondendo corretamente"
    warn "Verifique os logs: docker-compose -f docker-compose.prod.yml logs"
fi

# Configurar firewall (se ufw estiver disponível)
if command -v ufw &> /dev/null; then
    log "Configurando firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
fi

# Configurar logrotate
log "Configurando rotação de logs..."
sudo tee /etc/logrotate.d/docker-trade > /dev/null <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF

log "🎉 Deploy concluído com sucesso!"
log "📊 Monitoramento:"
log "   - Status: docker-compose -f docker-compose.prod.yml ps"
log "   - Logs: docker-compose -f docker-compose.prod.yml logs -f"
log "   - Parar: docker-compose -f docker-compose.prod.yml down"
log "   - Reiniciar: docker-compose -f docker-compose.prod.yml restart"

echo
log "🔧 Comandos úteis:"
echo "   docker-compose -f docker-compose.prod.yml exec trade-api sh"
echo "   docker-compose -f docker-compose.prod.yml logs -f trade-bot"
echo "   docker stats"