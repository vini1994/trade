# 🚀 Deploy Rápido - Trade NB Members

## Opção 1: Deploy Manual (Recomendado)

### 1. Conectar à VPS
```bash
ssh root@seu-ip-da-vps
```

### 2. Executar Script Automatizado
```bash
# Baixar o script
wget https://raw.githubusercontent.com/seu-usuario/trade_nb_members/main/install-vps.sh

# Dar permissão de execução
chmod +x install-vps.sh

# Executar instalação
./install-vps.sh
```

### 3. Configurar Variáveis de Ambiente
```bash
nano /var/www/trade_nb_members/.env
```

Editar com suas chaves:
```env
BINGX_API_KEY=sua_api_key_bingx
BINGX_API_SECRET=sua_api_secret_bingx
TELEGRAM_BOT_TOKEN=seu_token_telegram
TELEGRAM_CHAT_ID=seu_chat_id_telegram
NODE_ENV=production
PORT=3000
```

### 4. Reiniciar Aplicação
```bash
pm2 restart trade-nb-members
```

## Opção 2: Deploy com Docker

### 1. Instalar Docker na VPS
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 2. Instalar Docker Compose
```bash
apt install docker-compose -y
```

### 3. Clonar Projeto
```bash
git clone https://github.com/seu-usuario/trade_nb_members.git
cd trade_nb_members
```

### 4. Configurar .env
```bash
cp .env.example .env
nano .env
```

### 5. Executar com Docker
```bash
docker-compose up -d
```

## Verificação

### Verificar Status
```bash
# PM2
pm2 status

# Docker
docker-compose ps

# Logs
pm2 logs trade-nb-members
# ou
docker-compose logs -f
```

### Acessar Aplicação
- URL: `http://seu-ip-da-vps` ou `http://seu-dominio.com`
- Porta padrão: 3000

## Comandos Úteis

### PM2
```bash
pm2 status                    # Ver status
pm2 logs trade-nb-members     # Ver logs
pm2 restart trade-nb-members  # Reiniciar
pm2 stop trade-nb-members     # Parar
pm2 start trade-nb-members    # Iniciar
```

### Docker
```bash
docker-compose up -d          # Iniciar
docker-compose down           # Parar
docker-compose restart        # Reiniciar
docker-compose logs -f        # Ver logs
```

### Sistema
```bash
systemctl status nginx        # Status Nginx
systemctl restart nginx       # Reiniciar Nginx
ufw status                    # Status firewall
```

## Troubleshooting

### Problema: Aplicação não inicia
```bash
# Verificar logs
pm2 logs trade-nb-members

# Verificar porta
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
```

### Problema: Docker não inicia
```bash
# Verificar logs
docker-compose logs

# Verificar imagens
docker images

# Rebuild
docker-compose build --no-cache
```

## Backup

### Backup Manual
```bash
# PM2
/usr/local/bin/backup-trade-nb-members.sh

# Docker
docker-compose exec app tar -czf backup-$(date +%Y%m%d).tar.gz db/ logs/
```

### Restore
```bash
# PM2
cp /var/backups/trade-nb-members/*.db /var/www/trade_nb_members/db/

# Docker
docker-compose exec app tar -xzf backup-YYYYMMDD.tar.gz
```

## Monitoramento

### Recursos do Sistema
```bash
htop                    # Monitor de recursos
df -h                   # Espaço em disco
free -h                 # Memória
```

### Logs em Tempo Real
```bash
# PM2
pm2 monit

# Docker
docker-compose logs -f

# Sistema
tail -f /var/log/nginx/access.log
```

## Segurança

### Firewall
```bash
ufw status
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
```

### SSL (Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d seu-dominio.com
```

## Atualizações

### Atualizar Código
```bash
# PM2
cd /var/www/trade_nb_members
git pull
npm install
npm run build
pm2 restart trade-nb-members

# Docker
git pull
docker-compose build
docker-compose up -d
```

### Atualizar Sistema
```bash
apt update && apt upgrade -y
```

## Suporte

Se encontrar problemas:

1. Verifique os logs: `pm2 logs trade-nb-members`
2. Verifique o status: `pm2 status`
3. Reinicie a aplicação: `pm2 restart trade-nb-members`
4. Verifique recursos: `htop`

## Links Úteis

- [Documentação PM2](https://pm2.keymetrics.io/docs/)
- [Documentação Docker](https://docs.docker.com/)
- [Documentação Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/) 