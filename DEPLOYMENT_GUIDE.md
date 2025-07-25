# Guia de Deploy - VPS Hostinger

Este guia te ajudará a instalar e configurar o projeto `trade_nb_members` em uma VPS da Hostinger.

## Pré-requisitos

- VPS Linux na Hostinger (Ubuntu 20.04+ recomendado)
- Acesso SSH à VPS
- Domínio configurado (opcional, mas recomendado)

## Passo 1: Conectar à VPS

```bash
ssh root@seu-ip-da-vps
```

## Passo 2: Atualizar o Sistema

```bash
apt update && apt upgrade -y
```

## Passo 3: Instalar Node.js e npm

```bash
# Instalar curl se não estiver instalado
apt install -y curl

# Baixar e instalar Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

## Passo 4: Instalar Git

```bash
apt install -y git
```

## Passo 5: Instalar PM2 (Process Manager)

```bash
npm install -g pm2
```

## Passo 6: Instalar Nginx (Web Server)

```bash
apt install -y nginx

# Iniciar e habilitar Nginx
systemctl start nginx
systemctl enable nginx
```

## Passo 7: Configurar Firewall

```bash
# Instalar ufw se não estiver instalado
apt install -y ufw

# Configurar regras básicas
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000

# Habilitar firewall
ufw enable
```

## Passo 8: Clonar o Projeto

```bash
# Navegar para diretório de aplicações
cd /var/www

# Clonar o repositório
git clone https://github.com/seu-usuario/trade_nb_members.git
cd trade_nb_members

# Dar permissões adequadas
chown -R www-data:www-data /var/www/trade_nb_members
chmod -R 755 /var/www/trade_nb_members
```

## Passo 9: Instalar Dependências

```bash
# Instalar dependências do projeto
npm install

# Se preferir usar pnpm
npm install -g pnpm
pnpm install
```

## Passo 10: Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
nano .env
```

Adicione as seguintes variáveis:

```env
# Configurações da API
BINGX_API_KEY=sua_api_key_bingx
BINGX_API_SECRET=sua_api_secret_bingx
TELEGRAM_BOT_TOKEN=seu_token_telegram
TELEGRAM_CHAT_ID=seu_chat_id_telegram

# Configurações do Servidor
NODE_ENV=production
PORT=3000

# Configurações do Banco de Dados
DB_PATH=/var/www/trade_nb_members/db/trades.db
```

## Passo 11: Build do Projeto

```bash
# Build do frontend
npm run frontend:build

# Build do backend
npm run build
```

## Passo 12: Configurar PM2

Criar arquivo de configuração do PM2:

```bash
nano ecosystem.config.js
```

Adicionar o seguinte conteúdo:

```javascript
module.exports = {
  apps: [{
    name: 'trade-nb-members',
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
```

## Passo 13: Iniciar a Aplicação com PM2

```bash
# Iniciar a aplicação
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar com o sistema
pm2 startup
```

## Passo 14: Configurar Nginx como Proxy Reverso

```bash
# Criar configuração do site
nano /etc/nginx/sites-available/trade-nb-members
```

Adicionar o seguinte conteúdo:

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Configuração de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Logs
    access_log /var/log/nginx/trade-nb-members.access.log;
    error_log /var/log/nginx/trade-nb-members.error.log;

    # Proxy para a aplicação Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Configuração para WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Configuração para arquivos estáticos
    location /static/ {
        alias /var/www/trade_nb_members/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Passo 15: Ativar Configuração do Nginx

```bash
# Criar link simbólico
ln -s /etc/nginx/sites-available/trade-nb-members /etc/nginx/sites-enabled/

# Remover configuração padrão (opcional)
rm /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

# Reiniciar Nginx
systemctl restart nginx
```

## Passo 16: Configurar SSL com Certbot (Opcional)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Configurar renovação automática
crontab -e
```

Adicionar a linha:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

## Passo 17: Configurar Logs

```bash
# Criar diretório de logs se não existir
mkdir -p /var/www/trade_nb_members/logs

# Configurar rotação de logs
nano /etc/logrotate.d/trade-nb-members
```

Adicionar:
```
/var/www/trade_nb_members/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

## Passo 18: Configurar Backup Automático

```bash
# Criar script de backup
nano /usr/local/bin/backup-trade-app.sh
```

Adicionar:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/trade-nb-members"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco de dados
cp /var/www/trade_nb_members/db/*.db $BACKUP_DIR/

# Backup dos logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/www/trade_nb_members/logs/

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Dar permissão de execução
chmod +x /usr/local/bin/backup-trade-app.sh

# Adicionar ao crontab
crontab -e
```

Adicionar:
```
0 2 * * * /usr/local/bin/backup-trade-app.sh
```

## Passo 19: Verificar Instalação

```bash
# Verificar status do PM2
pm2 status

# Verificar logs
pm2 logs trade-nb-members

# Verificar status do Nginx
systemctl status nginx

# Testar a aplicação
curl http://localhost:3000
```

## Passo 20: Comandos Úteis para Manutenção

```bash
# Reiniciar aplicação
pm2 restart trade-nb-members

# Ver logs em tempo real
pm2 logs trade-nb-members --lines 100

# Atualizar código
cd /var/www/trade_nb_members
git pull
npm install
npm run build
pm2 restart trade-nb-members

# Verificar uso de recursos
pm2 monit

# Backup manual
/usr/local/bin/backup-trade-app.sh
```

## Troubleshooting

### Problema: Aplicação não inicia
```bash
# Verificar logs
pm2 logs trade-nb-members

# Verificar se as portas estão em uso
netstat -tlnp | grep :3000

# Verificar permissões
ls -la /var/www/trade_nb_members/
```

### Problema: Nginx não carrega
```bash
# Verificar configuração
nginx -t

# Verificar logs
tail -f /var/log/nginx/error.log

# Reiniciar Nginx
systemctl restart nginx
```

### Problema: SSL não funciona
```bash
# Verificar certificado
certbot certificates

# Renovar certificado
certbot renew --dry-run
```

## Monitoramento

Para monitorar a aplicação em produção, considere:

1. **Uptime Robot** - Para monitoramento de disponibilidade
2. **PM2 Plus** - Para monitoramento avançado do PM2
3. **Logs centralizados** - Para análise de logs

## Segurança

1. **Firewall**: Mantenha apenas as portas necessárias abertas
2. **Atualizações**: Mantenha o sistema sempre atualizado
3. **Backups**: Configure backups automáticos
4. **SSL**: Sempre use HTTPS em produção
5. **Logs**: Monitore logs regularmente

## Suporte

Se encontrar problemas:

1. Verifique os logs: `pm2 logs trade-nb-members`
2. Verifique o status: `pm2 status`
3. Reinicie a aplicação: `pm2 restart trade-nb-members`
4. Verifique recursos: `htop` ou `pm2 monit` 