# Ital In House — Dashboard de Gestão de Cardápio

## Estrutura do Projeto

```
src/
├── App.jsx              # Estado global + roteamento entre páginas
├── constants.js         # Paleta de cores, config, TABS
├── main.jsx             # Entry point (ReactDOM.createRoot)
├── styles/global.css    # Reset, scrollbar, animações
├── utils/
│   ├── security.js      # sha256, sanitize (anti-XSS)
│   ├── date.js          # parseDate, getLastDate
│   ├── parser.js        # CSV/XLSX → dados normalizados
│   ├── format.js        # brl(), pct(), shortName()
│   └── storage.js       # localStorage helpers
├── components/
│   ├── ui/              # Card, Pill, Icon, Kpi, AlertBanner
│   │   └── charts/      # Ring, HBar, Donut, Gauge (SVG nativos)
│   └── layout/          # Splash, Header
└── pages/
    ├── DashPage.jsx     # Visão geral da rede (franqueadora)
    ├── FranchPage.jsx   # Análise por franquia
    ├── ItemsPage.jsx    # Ranking · Sistêmicos · Busca de itens
    ├── CatPage.jsx      # Análise por categoria
    ├── AlertsPage.jsx   # Central de alertas prioritários ← NOVO
    └── AdminPage.jsx    # Upload CSV/XLSX · Exportar · Limpar
```

## Desenvolvimento Local

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build para Produção

```bash
npm run build      # Gera dist/
npm run preview    # Testa o build localmente
```

## Deploy na Vercel

### Opção 1 — Via GitHub (recomendado)
1. Suba este projeto (pasta `ital-dashboard-src`) para um repositório GitHub
2. Acesse https://vercel.com → "Add New Project"
3. Selecione o repositório
4. Vercel detecta Vite automaticamente: Framework = Vite, Build = `npm run build`, Output = `dist`
5. Clique **Deploy** ✓

### Opção 2 — Via Vercel CLI (deploy direto do dist/)
```bash
npm install -g vercel
vercel deploy --prod
```

### Opção 3 — Arrastar e soltar
1. Execute `npm run build`
2. Acesse https://vercel.com → "Add New Project" → "Browse"
3. Arraste a pasta `dist/` para a área de upload

O `vercel.json` já configura o rewrite de SPA para que o refresh de página funcione.

## Senha Admin
`ITAL123` (hash SHA-256 verificado no browser, sem backend)

## Formato do Arquivo de Dados

CSV ou XLSX com as colunas:
- `lojasSimpleName` — Nome simplificado da loja
- `categoriesName`  — Categoria do item
- `rowsName`        — Nome do produto
- `data`            — Data (ex: 10-abr-26)
- `status`          — "Pausado" ou "Ativo"
- `priceValue`      — Preço (ex: R$ 12,90) — opcional

Delimitadores aceitos: `,` ou `;`
