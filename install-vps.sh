#!/bin/bash

# Script de Instalação Automatizada - Trade NB Members
# Para VPS Ubuntu/Debian

set -e  # Para o script se houver erro

echo "🚀 Iniciando instalação do Trade NB Members na VPS..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root"
fi

# Variáveis
APP_NAME="trade-nb-members"
APP_DIR="/var/www/trade_nb_members"
DOMAIN=""
GITHUB_REPO=""

# Função para obter inputs do usuário
get_user_inputs() {
    echo -e "${BLUE}=== Configuração da Instalação ===${NC}"
    
    read -p "Digite o domínio (ex: meusite.com): " DOMAIN
    read -p "Digite a URL do repositório GitHub: " GITHUB_REPO
    
    if [[ -z "$DOMAIN" || -z "$GITHUB_REPO" ]]; then
        error "Domínio e repositório são obrigatórios"
    fi
    
    echo -e "${GREEN}Configuração salva:${NC}"
    echo "Domínio: $DOMAIN"
    echo "Repositório: $GITHUB_REPO"
    echo ""
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    apt update && apt upgrade -y
    log "Sistema atualizado com sucesso"
}

# Instalar dependências básicas
install_basic_deps() {
    log "Instalando dependências básicas..."
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    log "Dependências básicas instaladas"
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js 18.x..."
    
    # Remover versões antigas se existirem
    apt remove -y nodejs npm 2>/dev/null || true
    
    # Instalar Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Verificar instalação
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js $NODE_VERSION e npm $NPM_VERSION instalados"
}

# Instalar PM2
install_pm2() {
    log "Instalando PM2..."
    npm install -g pm2
    log "PM2 instalado com sucesso"
}

# Instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    apt install -y nginx
    
    # Iniciar e habilitar Nginx
    systemctl start nginx
    systemctl enable nginx
    
    log "Nginx instalado e configurado"
}

# Configurar firewall
setup_firewall() {
    log "Configurando firewall..."
    
    # Instalar ufw se não estiver instalado
    apt install -y ufw
    
    # Configurar regras básicas
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80
    ufw allow 443
    ufw allow 3000
    
    # Habilitar firewall
    echo "y" | ufw enable
    
    log "Firewall configurado"
}

# Clonar projeto
clone_project() {
    log "Clonando projeto..."
    
    # Criar diretório se não existir
    mkdir -p /var/www
    
    # Remover diretório se existir
    rm -rf $APP_DIR
    
    # Clonar repositório
    git clone $GITHUB_REPO $APP_DIR
    
    # Configurar permissões
    chown -R www-data:www-data $APP_DIR
    chmod -R 755 $APP_DIR
    
    log "Projeto clonado em $APP_DIR"
}

# Instalar dependências do projeto
install_project_deps() {
    log "Instalando dependências do projeto..."
    
    cd $APP_DIR
    
    # Instalar dependências
    npm install
    
    log "Dependências do projeto instaladas"
}

# Criar arquivo .env
create_env_file() {
    log "Criando arquivo .env..."
    
    cat > $APP_DIR/.env << EOF
# Configurações da API
BINGX_API_KEY=sua_api_key_bingx
BINGX_API_SECRET=sua_api_secret_bingx
TELEGRAM_BOT_TOKEN=seu_token_telegram
TELEGRAM_CHAT_ID=seu_chat_id_telegram

# Configurações do Servidor
NODE_ENV=production
PORT=3000

# Configurações do Banco de Dados
DB_PATH=$APP_DIR/db/trades.db
EOF

    log "Arquivo .env criado. Lembre-se de configurar suas chaves API!"
}

# Build do projeto
build_project() {
    log "Fazendo build do projeto..."
    
    cd $APP_DIR
    
    # Build do frontend
    npm run frontend:build
    
    # Build do backend
    npm run build
    
    log "Build concluído"
}

# Criar configuração do PM2
create_pm2_config() {
    log "Criando configuração do PM2..."
    
    cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

    log "Configuração do PM2 criada"
}

# Criar configuração do Nginx
create_nginx_config() {
    log "Criando configuração do Nginx..."
    
    cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Configuração de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Logs
    access_log /var/log/nginx/$APP_NAME.access.log;
    error_log /var/log/nginx/$APP_NAME.error.log;

    # Proxy para a aplicação Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Configuração para WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Configuração para arquivos estáticos
    location /static/ {
        alias $APP_DIR/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Ativar configuração
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    nginx -t
    
    # Reiniciar Nginx
    systemctl restart nginx
    
    log "Configuração do Nginx criada e ativada"
}

# Criar diretórios de logs
setup_logs() {
    log "Configurando logs..."
    
    mkdir -p $APP_DIR/logs
    
    # Configurar rotação de logs
    cat > /etc/logrotate.d/$APP_NAME << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
EOF

    log "Logs configurados"
}

# Criar script de backup
create_backup_script() {
    log "Criando script de backup..."
    
    cat > /usr/local/bin/backup-$APP_NAME.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/trade-nb-members"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco de dados
cp /var/www/trade_nb_members/db/*.db $BACKUP_DIR/ 2>/dev/null || true

# Backup dos logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/www/trade_nb_members/logs/ 2>/dev/null || true

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
EOF

    chmod +x /usr/local/bin/backup-$APP_NAME.sh
    
    # Adicionar ao crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-$APP_NAME.sh") | crontab -
    
    log "Script de backup criado"
}

# Iniciar aplicação
start_application() {
    log "Iniciando aplicação..."
    
    cd $APP_DIR
    
    # Iniciar com PM2
    pm2 start ecosystem.config.js
    
    # Salvar configuração
    pm2 save
    
    # Configurar para iniciar com o sistema
    pm2 startup
    
    log "Aplicação iniciada com PM2"
}

# Instalar SSL (opcional)
install_ssl() {
    read -p "Deseja instalar SSL com Let's Encrypt? (y/n): " install_ssl
    
    if [[ $install_ssl =~ ^[Yy]$ ]]; then
        log "Instalando SSL..."
        
        apt install -y certbot python3-certbot-nginx
        
        # Obter certificado
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        # Configurar renovação automática
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        log "SSL instalado com sucesso"
    else
        warning "SSL não foi instalado. Configure manualmente se necessário."
    fi
}

# Verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    # Verificar PM2
    if pm2 list | grep -q $APP_NAME; then
        log "✅ PM2: OK"
    else
        error "❌ PM2: Falha"
    fi
    
    # Verificar Nginx
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx: OK"
    else
        error "❌ Nginx: Falha"
    fi
    
    # Verificar aplicação
    if curl -s http://localhost:3000 > /dev/null; then
        log "✅ Aplicação: OK"
    else
        warning "⚠️  Aplicação: Não respondeu (pode estar inicializando)"
    fi
    
    log "Verificação concluída"
}

# Mostrar informações finais
show_final_info() {
    echo ""
    echo -e "${GREEN}🎉 Instalação concluída com sucesso!${NC}"
    echo ""
    echo -e "${BLUE}=== Informações da Instalação ===${NC}"
    echo "Domínio: $DOMAIN"
    echo "Diretório da aplicação: $APP_DIR"
    echo "Porta da aplicação: 3000"
    echo ""
    echo -e "${BLUE}=== Comandos Úteis ===${NC}"
    echo "Ver status: pm2 status"
    echo "Ver logs: pm2 logs $APP_NAME"
    echo "Reiniciar: pm2 restart $APP_NAME"
    echo "Backup manual: /usr/local/bin/backup-$APP_NAME.sh"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
    echo "1. Configure suas chaves API no arquivo .env"
    echo "2. Acesse http://$DOMAIN para verificar a aplicação"
    echo "3. Monitore os logs regularmente"
    echo ""
    echo -e "${GREEN}✅ Instalação finalizada!${NC}"
}

# Função principal
main() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Trade NB Members - VPS Installer${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    get_user_inputs
    
    update_system
    install_basic_deps
    install_nodejs
    install_pm2
    install_nginx
    setup_firewall
    clone_project
    install_project_deps
    create_env_file
    build_project
    create_pm2_config
    create_nginx_config
    setup_logs
    create_backup_script
    start_application
    install_ssl
    verify_installation
    show_final_info
}

# Executar função principal
main "$@" 