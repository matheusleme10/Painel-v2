import { Component } from 'react';

const RELOAD_FLAG = 'ih-chunk-reload-attempted';

// Falha típica quando o navegador tenta baixar um pedaço (chunk) de código
// que já não existe mais no Vercel — porque uma nova versão do dashboard foi
// publicada enquanto a aba continuava aberta com o HTML antigo em cache.
// Isso costuma acontecer ao clicar para abrir uma aba carregada sob demanda
// (Admin, Gestão, Aviso automático).
function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Loading chunk|dynamically imported module|error loading dynamically imported module/i.test(message);
}

// Sem essa guarda por sessão, o mesmo clique que causou o erro dispara o
// erro de novo a cada nova tentativa — dando a impressão de um aviso de
// versão "preso em loop". Aqui a página só recarrega automaticamente UMA
// vez por sessão; se o problema persistir depois disso, mostra um aviso fixo
// com um botão manual em vez de continuar recarregando sozinha.
export class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, chunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, chunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.failed) {
      const alreadyTried = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(RELOAD_FLAG);
      if (this.state.chunkError && !alreadyTried) {
        return <main className="app-main"><div className="loading-state">Atualizando...</div></main>;
      }
      return (
        <main className="app-main">
          <div className="version-update-banner">
            <strong>Nova versão disponível</strong>
            <p>O dashboard foi atualizado. Recarregue a página para continuar navegando.</p>
            <button type="button" onClick={() => window.location.reload()}>Recarregar página</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
