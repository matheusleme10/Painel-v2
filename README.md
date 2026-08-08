# Dashboard de Itens — Guia Geral

## 1. Visão do sistema

Portal da Ital in House para acompanhar itens ativos e pausados por rede, marca, unidade,
categoria e período. Existem dois perfis:

- **Admin:** visão global, indicadores financeiros, ranking, importação e avisos.
- **Franqueado:** escolhe marca e unidade, vê seus itens, disponibilidade, potencial,
  categorias, ranking e Forneria. Receita pausada é ocultada.

A página **Forneria** acompanha Cannoli, Crostini, Palha Italiana, Brownie e Tiramisu.
Os filtros de produto e período recalculam as métricas exibidas.

## 2. Executar localmente

Pré-requisitos: Node.js e Python 3.11 ou superior.

```powershell
npm install
python -m pip install -r requirements.txt
npm run build
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080
```

Abra `http://localhost:8080/`. Não use `file:///.../index.html`: o login e os dados
dependem do backend Python.

Se a porta estiver ocupada, encerre somente o processo correspondente ou use outra porta:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8081
```

## 3. Configuração segura

Crie `.env.local` com valores reais. Nunca envie esse arquivo ao Git.

```dotenv
ADMIN_PASSWORD_HASH=hash_sha256_da_senha_admin
FRANCHISE_PASSWORD_HASH=hash_sha256_da_senha_franqueado
SESSION_SECRET=chave_aleatoria_de_no_minimo_32_caracteres
BLOB_READ_WRITE_TOKEN=token_criado_pela_integracao_vercel_blob
```

Para gerar um hash de senha:

```powershell
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('SUA SENHA FORTE').digest('hex'))"
```

As senhas não ficam no frontend. O backend cria uma sessão assinada em cookie `HttpOnly`,
com `SameSite=Strict`, limite de tentativas e cabeçalhos de segurança.

## 4. Atualizar os dados

1. Entre como Admin.
2. Abra **Atualizar Dados**.
3. Selecione o XLSX de almoço ou jantar.
4. Confira prévia, data e quantidade.
5. Clique em **Aplicar e Salvar na Nuvem**.
6. Valide a visão geral e uma unidade conhecida.

O parser combina as abas `Vista Loja x Produtos` e `Vista Loja x Produtos (2)`.
O zero de pausados é respeitado e o portal abre no último dia do relatório.

Teste rápido:

```powershell
npm run validate:data -- "São Carlos"
```

## 5. Publicar na Vercel

Envie:

- `api/`, `backend/`, `scripts/`, `src/` e `tests/`
- `index.html`, `package.json`, `package-lock.json`
- `requirements.txt`, `vite.config.js` e `vercel.json`
- `GERAL.md` e imagens públicas usadas pelo portal

Não envie:

- `.env`, `.env.local`
- `data/`, planilhas e exportações operacionais
- `node_modules/`, `dist/`, caches Python ou caches de testes
- tokens iFood, AWS, SMTP, WhatsApp ou Vercel

Antes do push:

```powershell
git status --short
git ls-files .env .env.local data
```

O segundo comando não deve retornar arquivos.

Na Vercel:

1. Importe o repositório.
2. Crie e conecte um **Vercel Blob privado**.
3. Configure `ADMIN_PASSWORD_HASH`, `FRANCHISE_PASSWORD_HASH` e `SESSION_SECRET`
   como variáveis sensíveis.
4. Confirme que `BLOB_READ_WRITE_TOKEN` foi criado pela integração.
5. Faça um novo deploy após alterar variáveis.

## 6. Avisar os franqueados automaticamente

O backend pode enviar e-mail e WhatsApp automaticamente assim que o administrador
publicar uma nova base. A data vem do relatório. O turno é definido pelo horário do
upload: Almoço antes das 17h e Jantar a partir das 17h.

Configure na Vercel:

```text
DASHBOARD_PUBLIC_URL=https://seu-dashboard.vercel.app
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURITY=ssl
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_TO=5511999999999,5511888888888
```

Na página **Avisos**, cadastre até 1.000 destinatários de e-mail, um por linha, e use
o controle verde/vermelho para ativar ou desativar o envio após cada upload. Essa
configuração fica no armazenamento privado do backend e é compartilhada entre os
administradores. A senha SMTP e os tokens continuam somente nas variáveis da Vercel.
O nome e o e-mail remetente também são configurados nessa página. Normalmente o
remetente precisa ser o mesmo endereço autenticado em `SMTP_USER`, ou um endereço
previamente autorizado pelo seu provedor de e-mail.

Use **Enviar e-mail de teste** antes de ligar a automação. Se o painel indicar
`SMTP pendente`, preencher apenas o remetente não enviará mensagens: ainda será
necessário configurar `SMTP_HOST`, `SMTP_USER` e `SMTP_PASSWORD`.

As variáveis `AUTO_NOTIFY_ON_UPLOAD` e `NOTIFY_EMAIL_TO` ainda podem ser usadas como
configuração inicial, mas deixam de ser necessárias depois que a configuração for
salva pela página **Avisos**.

## 7. Integração iFood

A integração direta permanece desativada na interface até o aplicativo possuir Merchant e
Catalog homologados. Não salve Bearer Token manual no código ou no Git. Quando os módulos
forem liberados, configure as credenciais exclusivamente no backend e nas variáveis
sensíveis da plataforma.

Preencha `IFOOD_CLIENT_ID` e `IFOOD_CLIENT_SECRET` no `.env.local` (app do tipo
**Centralizado**, com `grantType=client_credentials`) para testar. Dois scripts prontos,
sem nenhuma credencial escrita no código:

```powershell
# Testa a autenticação (token) e diagnostica erro de permissão/loja vinculada.
python scripts/extrair_ifood.py --test-token

# Extração completa: autentica, lista as lojas (Merchant) e os itens ativos/pausados
# por categoria (Catalog) de todas elas, salvando um CSV em data/staging/.
python scripts/extrair_ifood.py

# Testa loja a loja de forma interativa (já existente).
python scripts/testar_loja_ifood.py --all
```

Importante (confirmado em teste real, inclusive na tela do Developer Portal): o
`/oauth/token` da iFood só emite `access_token` se o app tiver **pelo menos uma loja
autorizada**, e nenhuma loja consegue autorizar o app — nem a loja de teste — antes dele
estar **homologado**. A própria aba **Permissões** do app mostra "O aplicativo precisa
estar homologado para receber autorização" enquanto isso não acontece. Ou seja, `403 no
permissions granted to client` nesse estágio é esperado, não é erro de configuração.
Próximo passo: abrir um chamado de homologação no Developer Portal (Central de Ajuda /
Suporte) pedindo os módulos **Merchant** e **Catalog** para este app centralizado. Depois
de homologado, rode `python scripts/extrair_ifood.py --test-token` de novo para confirmar
o token e a lista de lojas. `--test-token` mostra o status HTTP e essas instruções
automaticamente quando a autenticação falha. O CSV gerado por `extrair_ifood.py` usa o
mesmo layout (`CSV_HEADERS`) já consumido pelo portal, servindo de base para uma futura
automação (n8n, cron, etc.) sem substituir o upload manual do XLSX, que continua
funcionando.

## 8. Testes

```powershell
npm run build
python -m pytest -q
npm run validate:data -- "São Carlos"
```

Após o build, confirme que nenhum segredo aparece em `dist/`. Em produção, monitore erros
401, 403, 429 e 5xx nos logs da Vercel.
