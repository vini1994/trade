# 🐳 Deploy com Docker - Trade NB Members

Este guia mostra como fazer o deploy do projeto usando Docker na sua VPS.

## 📋 Pré-requisitos

- VPS com Ubuntu/Debian ou CentOS
- Acesso SSH à VPS
- Pelo menos 2GB de RAM
- 10GB de espaço em disco

## 🚀 Instalação Rápida

### 1. Conectar à VPS e preparar ambiente

```bash
# Conectar via SSH
ssh usuario@ip_da_vps

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Git
sudo apt install git -y
```

### 2. Clonar o projeto

```bash
# Clonar repositório
git clone [URL_DO_SEU_REPOSITORIO]
cd trade_nb_members

# Dar permissão aos scripts
chmod +x scripts/*.sh
```

### 3. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

Configure suas credenciais:
```env
BINGX_API_KEY=sua_chave_api_aqui
BINGX_API_SECRET=seu_secret_api_aqui
TELEGRAM_BOT_TOKEN=seu_token_bot_telegram
TELEGRAM_CHAT_ID=seu_chat_id
```

### 4. Deploy automático

```bash
# Executar script de deploy
./scripts/deploy.sh
```

O script irá:
- ✅ Instalar Docker e Docker Compose
- ✅ Fazer build das imagens
- ✅ Iniciar todos os serviços
- ✅ Configurar firewall
- ✅ Configurar logs

## 📊 Serviços Incluídos

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **Nginx** | 80, 443 | Servidor web e proxy reverso |
| **API** | 3000 | API REST do sistema |
| **Bot** | - | Bot de trading automático |
| **Redis** | 6379 | Cache e sessões |

## 🔧 Comandos Úteis

### Gerenciamento básico
```bash
# Ver status dos containers
docker-compose -f docker-compose.prod.yml ps

# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f

# Parar todos os serviços
docker-compose -f docker-compose.prod.yml down

# Reiniciar todos os serviços
docker-compose -f docker-compose.prod.yml restart

# Reiniciar serviço específico
docker-compose -f docker-compose.prod.yml restart trade-api
```

### Monitoramento
```bash
# Script de monitoramento interativo
./scripts/monitor.sh

# Verificar recursos
docker stats

# Ver logs específicos
docker-compose -f docker-compose.prod.yml logs trade-bot
```

### Backup e Restore
```bash
# Fazer backup
./scripts/backup.sh

# Restaurar backup
./scripts/restore.sh 20240125_143022

# Restaurar componente específico
./scripts/restore.sh 20240125_143022 redis
```

## 🌐 Acesso à Aplicação

Após o deploy, a aplicação estará disponível em:

- **Interface Web**: `http://IP_DA_VPS`
- **API**: `http://IP_DA_VPS/api`
- **Health Check**: `http://IP_DA_VPS/health`

## 🔒 Configuração SSL (HTTPS)

### Usando Let's Encrypt (Certbot)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificado
sudo certbot --nginx -d seu_dominio.com

# Renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Configuração manual

1. Coloque seus certificados em `./ssl/`
2. Descomente a seção HTTPS no `nginx.conf`
3. Reinicie o Nginx: `docker-compose -f docker-compose.prod.yml restart nginx`

## 📈 Monitoramento Avançado

### Logs centralizados
```bash
# Ver todos os logs
docker-compose -f docker-compose.prod.yml logs --tail=100

# Filtrar por serviço
docker-compose -f docker-compose.prod.yml logs trade-api | grep ERROR

# Logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f --tail=50
```

### Métricas de performance
```bash
# Uso de recursos por container
docker stats --no-stream

# Informações detalhadas
docker system df
docker system events
```

## 🔄 Atualizações

### Atualização simples
```bash
# Baixar código atualizado
git pull

# Rebuild e restart
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Atualização com backup
```bash
# Fazer backup antes
./scripts/backup.sh

# Atualizar
git pull
./scripts/deploy.sh
```

## 🛠️ Troubleshooting

### Container não inicia
```bash
# Ver logs detalhados
docker-compose -f docker-compose.prod.yml logs [nome_do_servico]

# Verificar configuração
docker-compose -f docker-compose.prod.yml config

# Rebuild forçado
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Problemas de memória
```bash
# Verificar uso de memória
free -h
docker stats

# Limpar cache do Docker
docker system prune -f
```

### Problemas de rede
```bash
# Verificar portas
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000

# Verificar firewall
sudo ufw status
```

### Logs não aparecem
```bash
# Verificar se containers estão rodando
docker ps

# Verificar configuração de logs
docker-compose -f docker-compose.prod.yml config | grep -A 5 logging
```

## 📁 Estrutura de Arquivos Docker

```
├── Dockerfile                 # Imagem principal da aplicação
├── docker-compose.yml         # Configuração para desenvolvimento
├── docker-compose.prod.yml    # Configuração para produção
├── nginx.conf                 # Configuração do Nginx
├── redis.conf                 # Configuração do Redis
├── .dockerignore             # Arquivos ignorados no build
└── scripts/
    ├── deploy.sh             # Script de deploy automático
    ├── backup.sh             # Script de backup
    ├── restore.sh            # Script de restore
    └── monitor.sh            # Script de monitoramento
```

## 🔐 Segurança

### Configurações recomendadas
- ✅ Firewall configurado (apenas portas necessárias)
- ✅ Containers rodando como usuário não-root
- ✅ Rate limiting no Nginx
- ✅ Headers de segurança configurados
- ✅ Logs rotacionados automaticamente

### Variáveis sensíveis
- ❌ Nunca commite o arquivo `.env`
- ✅ Use senhas fortes para Redis
- ✅ Configure CORS adequadamente
- ✅ Use HTTPS em produção

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `./scripts/monitor.sh`
2. Consulte o troubleshooting acima
3. Verifique a documentação do Docker
4. Execute o health check: `curl http://localhost/health`

## 🎯 Performance

### Otimizações incluídas
- ✅ Multi-stage build para imagens menores
- ✅ Compressão gzip no Nginx
- ✅ Cache de arquivos estáticos
- ✅ Limits de recursos por container
- ✅ Health checks automáticos
- ✅ Restart automático em caso de falha

### Monitoramento de recursos
```bash
# Uso atual
docker stats --no-stream

# Histórico de uso
./scripts/monitor.sh
```

---

🎉 **Pronto!** Sua aplicação está rodando com Docker de forma profissional e segura!