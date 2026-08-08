// Os valores apontam para variáveis CSS (definidas em global.css, com
// substituições em [data-theme="dark"]) em vez de hex fixo. Assim o modo
// escuro se propaga automaticamente para todo lugar que usa `C.xxx` em
// estilos inline, sem precisar tocar em cada componente.
export const C = {
  red: 'var(--ih-red)', red2: 'var(--ih-red2)', redL: 'var(--ih-redL)', redM: 'var(--ih-redM)',
  white: 'var(--ih-white)', bg: 'var(--ih-bg)', card: 'var(--ih-card)',
  border: 'var(--ih-border)', text: 'var(--ih-text)', sub: 'var(--ih-sub)', muted: 'var(--ih-muted)',
  green: 'var(--ih-green)', greenL: 'var(--ih-greenL)', greenM: 'var(--ih-greenM)',
  amber: 'var(--ih-amber)', amberL: 'var(--ih-amberL)', amberM: 'var(--ih-amberM)',
  blue: 'var(--ih-blue)', blueL: 'var(--ih-blueL)', blueM: 'var(--ih-blueM)',
  purple: 'var(--ih-purple)', purpleL: 'var(--ih-purpleL)', purpleM: 'var(--ih-purpleM)',
  orange: 'var(--ih-orange)', orangeL: 'var(--ih-orangeL)', orangeM: 'var(--ih-orangeM)',
  teal: 'var(--ih-teal)', tealL: 'var(--ih-tealL)',
};

export const PAL = [
  C.red, C.blue, C.amber, C.green, C.purple, C.orange, C.teal, '#BE185D', '#065F46', '#1E3A8A'
];

export const ADMIN_TABS = [
  { id: 'network', label: 'Geral da Rede', icon: 'network' },
  { id: 'franch', label: 'Franquias',  icon: 'store'  },
  { id: 'items',  label: 'Itens',      icon: 'item'   },
  { id: 'cats',   label: 'Categorias', icon: 'cat'    },
  { id: 'rank',   label: 'Ranking',    icon: 'trophy' },
  { id: 'forneria', label: 'Forneria', icon: 'bakery' },
  { id: 'revenue', label: 'Potencial', icon: 'money' },
  { id: 'alerts', label: 'Central de Alertas', icon: 'fire' },
  { id: 'access', label: 'Gestão', icon: 'access' },
  { id: 'notify', label: 'Avisos',     icon: 'alert'  },
  { id: 'update', label: 'Atualizar Dados', icon: 'upload' },
];

export const FRANCHISE_TABS = [
  { id: 'dash',  label: 'Minha Unidade', icon: 'dash' },
  { id: 'alerts', label: 'Central de Alertas', icon: 'fire' },
  { id: 'revenue', label: 'Potencial', icon: 'money' },
  { id: 'items', label: 'Itens', icon: 'item' },
  { id: 'cats',  label: 'Categorias', icon: 'cat' },
  { id: 'rank',  label: 'Ranking', icon: 'trophy' },
  { id: 'forneria', label: 'Forneria', icon: 'bakery' },
  { id: 'feedback', label: 'Feedback', icon: 'access' },
];
