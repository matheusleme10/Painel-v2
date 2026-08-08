# Resumo do projeto — Portal de Itens Pausados x Ativos

## O que é

Dashboard operacional da Ital in House para transformar o relatório XLSX em uma consulta rápida, visual e persistente. O administrador publica uma nova base; gestores e franqueados consultam o último cardápio carregado sem precisar abrir, procurar abas ou interpretar manualmente a planilha.

## Como ajuda no dia a dia

- mostra itens ativos, pausados, disponibilidade e histórico por período e turno;
- permite pesquisar marca, unidade, categoria e produto;
- compara unidades em ranking e destaca a loja do franqueado;
- acompanha produtos da Forneria;
- oferece projeções de potencial com acesso adicional protegido;
- mantém a última base no Vercel Blob, inclusive após atualizar a página;
- permite enviar avisos por e-mail após novas cargas;
- registra nome, e-mail, horário e unidade escolhida pelos franqueados para auditoria do administrador.
- permite ao administrador autorizar domínios de e-mail e limpar o histórico de acessos quando necessário.

Isso substitui grande parte da leitura manual do XLSX: a planilha continua sendo a fonte de entrada, mas o portal vira a interface oficial de acompanhamento.

## Perfis e permissões

### Administrador

Possui visão da rede, franquias, itens, categorias, alertas, ranking, Forneria, potencial, avisos, atualização da base e log de acessos. Métricas financeiras ficam restritas a esse perfil.

### Franqueado

Após informar nome e e-mail, escolhe marca e unidade. Vê apenas o contexto operacional da unidade selecionada; o ranking respeita a marca. A página Potencial exige uma segunda senha.

## Fluxo dos dados

1. O administrador envia o XLSX em **Atualizar Dados**.
2. O navegador interpreta e normaliza as abas do relatório.
3. O resultado otimizado é salvo como JSON comprimido no Vercel Blob privado.
4. Ao abrir o portal, o frontend consulta a API Python e recupera a última versão salva.
5. Filtros de data, turno, marca e unidade recalculam as telas sem alterar a planilha original.

Os logs de acesso são gravados como objetos separados no Blob. Assim, acessos simultâneos não sobrescrevem o evento anterior.

## Segurança

- senhas nunca devem ser escritas no código ou enviadas ao GitHub;
- o backend recebe somente hashes SHA-256 pelas variáveis de ambiente;
- sessão, identidade e desbloqueio do Potencial usam cookies assinados, `HttpOnly`, `SameSite=Strict` e `Secure` em produção;
- a planilha e os logs ficam em Blob privado;
- dados financeiros pausados não são entregues ao perfil franqueado;
- nome e e-mail informados são declaratórios. Para comprovar identidade individual no futuro, recomenda-se login por conta própria com convite e verificação de e-mail.

Variáveis sensíveis principais: `ADMIN_PASSWORD_HASH`, `FRANCHISE_PASSWORD_HASH`, `FRANCHISE_POTENTIAL_PASSWORD_HASH`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, credenciais SMTP e credenciais iFood. Cadastre-as apenas no `.env.local` e na Vercel.

## Execução local

1. Instale as dependências com `npm install` e `pip install -r requirements.txt`.
2. Preencha o `.env.local` sem publicar o arquivo.
3. Execute `npm run dev`.
4. Abra o endereço informado pelo terminal.

## Publicação na Vercel

Envie ao GitHub o código-fonte, `package.json`, `package-lock.json`, `requirements.txt`, `vercel.json` e arquivos públicos. Nunca envie `.env.local`, planilhas reais, pasta `data`, `node_modules` ou credenciais. Depois de alterar variáveis na Vercel, faça um novo deploy sem cache.

## Próximas evoluções recomendadas

- autenticação individual por usuário e vínculo fixo entre conta e unidade;
- política de retenção e exportação dos logs de acesso;
- banco PostgreSQL quando houver escrita frequente ou análises maiores;
- monitoramento de erros e alertas de indisponibilidade;
- processamento assíncrono para cargas muito grandes.
