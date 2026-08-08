import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/Users/LemeM/OneDrive/Área de Trabalho/Ital in House/Projetos/Dashboard - Itens Pausados';
const TMP = path.join(ROOT, 'ppt_manuals_tmp');
const OUT = path.join(ROOT, 'Manuais');
const LOGO = path.join(ROOT, 'public', 'ih-logo.png');
const W = 1280, H = 720;
const RED = '#C8102E', DARK_RED = '#8F0624', PINK = '#FFF1F3';
const INK = '#101828', SUB = '#475467', MUTED = '#667085', LINE = '#E4E7EC';
const WHITE = '#FFFFFF', GREEN = '#059669', BLUE = '#2563EB', ORANGE = '#EA580C';

async function bytes(file) {
  const b = await fs.readFile(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function box(slide, x, y, w, h, fill = WHITE, radius = 'rounded-xl', line = LINE) {
  return slide.shapes.add({ geometry: 'roundRect', position: { left: x, top: y, width: w, height: h },
    fill, line: { style: 'solid', fill: line, width: 1 }, borderRadius: radius });
}

function text(slide, value, x, y, w, h, size = 20, color = INK, bold = false, align = 'left') {
  const shape = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { fontSize: size, color, bold, alignment: align, fontFamily: 'Arial' };
  return shape;
}

async function addLogo(slide, x, y, w = 128, h = 78) {
  slide.images.add({ blob: await bytes(LOGO), contentType: 'image/png', alt: 'Logo Ital in House', fit: 'contain',
    position: { left: x, top: y, width: w, height: h } });
}

async function header(slide, title, number, audience) {
  slide.background.fill = '#FAFAFB';
  slide.shapes.add({ geometry: 'rect', position: { left: 0, top: 0, width: W, height: 14 }, fill: RED,
    line: { style: 'solid', fill: RED, width: 0 } });
  box(slide, 58, 23, 102, 66, RED, 'rounded-xl', RED);
  await addLogo(slide, 68, 29, 82, 52);
  text(slide, title, 182, 31, 880, 52, 35, INK, true);
  text(slide, audience, 182, 76, 600, 24, 13, MUTED, true);
  text(slide, String(number).padStart(2, '0'), 1155, 40, 60, 30, 16, RED, true, 'right');
  slide.shapes.add({ geometry: 'rect', position: { left: 64, top: 108, width: 1152, height: 1 }, fill: LINE,
    line: { style: 'solid', fill: LINE, width: 0 } });
}

function footer(slide, label) {
  text(slide, label, 64, 680, 900, 20, 11, MUTED, false);
  text(slide, 'Portal de Itens Pausados × Ativos', 950, 680, 266, 20, 11, RED, true, 'right');
}

async function cover(deck, audience, subtitle) {
  const s = deck.slides.add();
  s.background.fill = RED;
  s.shapes.add({ geometry: 'rect', position: { left: 0, top: 0, width: 410, height: H }, fill: DARK_RED,
    line: { style: 'solid', fill: DARK_RED, width: 0 } });
  await addLogo(s, 86, 78, 230, 140);
  text(s, 'MANUAL DE USO', 480, 105, 650, 34, 18, '#FFD2DB', true);
  text(s, audience, 480, 165, 690, 105, 54, WHITE, true);
  text(s, subtitle, 480, 305, 670, 92, 24, '#FFE8ED', false);
  s.shapes.add({ geometry: 'rect', position: { left: 480, top: 430, width: 120, height: 6 }, fill: WHITE,
    line: { style: 'solid', fill: WHITE, width: 0 } });
  text(s, 'Ital in House · Operação', 480, 465, 500, 30, 18, WHITE, true);
  text(s, 'Versão de treinamento', 480, 502, 400, 24, 14, '#FFD2DB');
  return s;
}

function step(slide, n, titleValue, body, x, y, color = RED, width = 340) {
  slide.shapes.add({ geometry: 'ellipse', position: { left: x, top: y, width: 52, height: 52 }, fill: color,
    line: { style: 'solid', fill: color, width: 0 } });
  text(slide, String(n), x, y + 9, 52, 30, 22, WHITE, true, 'center');
  text(slide, titleValue, x + 70, y - 2, width - 70, 34, 22, INK, true);
  text(slide, body, x + 70, y + 34, width - 70, 78, 16, SUB);
}

function callout(slide, titleValue, body, x, y, w, h, color = RED, fill = PINK) {
  box(slide, x, y, w, h, fill, 'rounded-xl', fill);
  slide.shapes.add({ geometry: 'rect', position: { left: x, top: y, width: 8, height: h }, fill: color,
    line: { style: 'solid', fill: color, width: 0 } });
  text(slide, titleValue, x + 26, y + 18, w - 46, 30, 21, color, true);
  text(slide, body, x + 26, y + 54, w - 46, h - 68, 16, SUB);
}

function bulletList(slide, items, x, y, w, gap = 62, color = RED) {
  items.forEach((item, i) => {
    slide.shapes.add({ geometry: 'ellipse', position: { left: x, top: y + i * gap + 7, width: 14, height: 14 }, fill: color,
      line: { style: 'solid', fill: color, width: 0 } });
    text(slide, item, x + 28, y + i * gap, w - 28, 42, 18, INK, false);
  });
}

async function buildFranchise() {
  const deck = Presentation.create({ slideSize: { width: W, height: H } });
  await cover(deck, 'Portal do Franqueado', 'Consulte sua unidade, entenda o cardápio e priorize ações em poucos minutos.');

  let s = deck.slides.add(); await header(s, 'Seu caminho até o painel', 2, 'MANUAL DO FRANQUEADO');
  step(s, 1, 'Entre com a senha', 'Use a senha compartilhada do perfil de franqueado.', 78, 175, RED, 350);
  step(s, 2, 'Identifique-se', 'Informe nome completo e e-mail autorizado.', 465, 175, BLUE, 350);
  step(s, 3, 'Escolha a unidade', 'Selecione a marca e pesquise sua loja pelo nome ou cidade.', 852, 175, GREEN, 350);
  callout(s, 'Quer trocar de perfil?', 'Na identificação, use “Voltar e trocar perfil”. Dentro do portal, use “Trocar unidade” ou “Sair”.', 160, 430, 960, 140);
  footer(s, 'A identificação registra nome, e-mail, data e unidade acessada.');

  s = deck.slides.add(); await header(s, 'Os filtros controlam todas as páginas', 3, 'MANUAL DO FRANQUEADO');
  step(s, 1, 'Escolha o período', 'Use Última carga, Últimas 7 cargas ou datas específicas.', 90, 165, RED, 500);
  step(s, 2, 'Escolha o turno', 'Almoço e Jantar mostram recortes diferentes do relatório.', 90, 310, ORANGE, 500);
  step(s, 3, 'Confirme a análise', 'Clique em Aplicar para recalcular todos os indicadores.', 90, 455, GREEN, 500);
  callout(s, 'Regra principal', 'Ativos e pausados sempre representam o período e o turno aplicados. Ao entrar, o portal abre na última carga disponível.', 690, 205, 450, 285, RED, PINK);
  footer(s, 'Se uma tela parecer antiga, confira período e turno antes de comparar.');

  s = deck.slides.add(); await header(s, 'Minha Unidade mostra a situação atual', 4, 'MANUAL DO FRANQUEADO');
  callout(s, 'Disponibilidade', 'Percentual do cardápio ativo no recorte selecionado.', 75, 165, 345, 145, GREEN, '#ECFDF5');
  callout(s, 'Itens pausados', 'Produtos indisponíveis que exigem atenção da operação.', 468, 165, 345, 145, RED, PINK);
  callout(s, 'Itens ativos', 'Produtos disponíveis para venda na unidade.', 860, 165, 345, 145, BLUE, '#EFF6FF');
  text(s, 'Na mesma página você pode:', 75, 365, 500, 32, 24, INK, true);
  bulletList(s, ['Pesquisar produto ou categoria', 'Alternar entre listas de ativos e pausados', 'Ver quantas vezes cada produto pausou no período'], 82, 420, 1050, 64);
  footer(s, 'Use a pesquisa para localizar itens além da primeira página.');

  s = deck.slides.add(); await header(s, 'Itens e Categorias explicam onde agir', 5, 'MANUAL DO FRANQUEADO');
  callout(s, 'Itens', 'Lista o catálogo da unidade. Pesquise pelo nome e navegue entre ativos e pausados.', 75, 165, 520, 190, RED, PINK);
  callout(s, 'Categorias', 'Resume quantos estão pausados, ativos e o percentual de disponibilidade de cada grupo.', 685, 165, 520, 190, BLUE, '#EFF6FF');
  box(s, 160, 410, 960, 115, WHITE, 'rounded-xl', LINE);
  text(s, 'Exemplo de leitura', 190, 430, 250, 26, 20, RED, true);
  text(s, '36 pausados · 27 ativos · 63 no total · 43% ativos', 190, 468, 830, 34, 25, INK, true);
  footer(s, 'Clique em uma categoria para abrir os produtos pausados daquele grupo.');

  s = deck.slides.add(); await header(s, 'Ranking compara lojas da mesma marca', 6, 'MANUAL DO FRANQUEADO');
  text(s, 'O ranking ajuda a entender a posição da sua unidade sem misturar operações diferentes.', 75, 150, 1080, 50, 23, SUB);
  step(s, 1, 'Veja os líderes', 'As primeiras posições aparecem no topo.', 90, 245, GREEN, 350);
  step(s, 2, 'Encontre sua unidade', 'Sua loja fica destacada mesmo quando está fora das primeiras posições.', 465, 245, RED, 350);
  step(s, 3, 'Compare com a média', 'Use disponibilidade, ativos e pausados para orientar ações.', 840, 245, BLUE, 350);
  callout(s, 'Importante', 'Franqueados não visualizam receita pausada nem valores financeiros de outras lojas.', 230, 485, 820, 110, RED, PINK);
  footer(s, 'City compara com City; Green com Green; Ital in House com Ital in House.');

  s = deck.slides.add(); await header(s, 'Forneria acompanha os produtos fornecidos', 7, 'MANUAL DO FRANQUEADO');
  text(s, 'Use os filtros para acompanhar um tipo por vez ou todos juntos.', 75, 150, 900, 36, 22, SUB);
  const types = ['Cannoli', 'Crostini', 'Palha Italiana', 'Brownie', 'Tiramisu'];
  types.forEach((v, i) => { box(s, 75 + i * 226, 230, 200, 90, i === 4 ? '#FFF7ED' : WHITE, 'rounded-xl', LINE); text(s, v, 88 + i * 226, 257, 174, 32, 19, i === 4 ? ORANGE : INK, true, 'center'); });
  callout(s, 'A porcentagem muda com o filtro', 'Ao retirar um tipo, os cards de disponibilidade, ativos, pausados e unidades encontradas são recalculados.', 185, 390, 910, 150, BLUE, '#EFF6FF');
  footer(s, 'Tiramisu é monitorado, mas não é fornecido pela mesma operação dos demais itens.');

  s = deck.slides.add(); await header(s, 'Potencial exige uma segunda autorização', 8, 'MANUAL DO FRANQUEADO');
  callout(s, 'O que a página estima', 'Preço médio dos itens ativos, potencial diário e potencial do período conforme as premissas informadas.', 90, 170, 520, 235, GREEN, '#ECFDF5');
  callout(s, 'Como acessar', 'Abra Potencial e informe a senha adicional disponibilizada pela gestão. Não compartilhe essa senha fora da operação.', 670, 170, 520, 235, RED, PINK);
  text(s, 'A estimativa não representa faturamento realizado.', 170, 480, 940, 42, 27, INK, true, 'center');
  text(s, 'É um cenário calculado a partir de preços ativos e premissas de volume.', 220, 535, 840, 32, 18, SUB, false, 'center');
  footer(s, 'Em caso de dúvida, valide os números com a gestão antes de tomar decisões financeiras.');

  s = deck.slides.add(); await header(s, 'Rotina recomendada em 3 minutos', 9, 'MANUAL DO FRANQUEADO');
  bulletList(s, ['Confirme se o portal está atualizado até Almoço ou Jantar.', 'Verifique disponibilidade, ativos e pausados da sua unidade.', 'Pesquise os itens pausados e confira as categorias mais afetadas.', 'Consulte sua posição no ranking da marca.', 'Acione a operação responsável e volte após a próxima atualização.'], 125, 155, 1030, 88, RED);
  callout(s, 'Precisa de ajuda?', 'Anote unidade, período, turno e página. Envie essas quatro informações ao suporte para acelerar a análise.', 190, 585, 900, 74, RED, PINK);
  footer(s, 'Nunca envie senhas ou capturas com credenciais.');
  return deck;
}

async function buildAdmin() {
  const deck = Presentation.create({ slideSize: { width: W, height: H } });
  await cover(deck, 'Portal do Administrador', 'Atualize a base, acompanhe a rede, controle acessos e comunique novas cargas.');

  let s = deck.slides.add(); await header(s, 'O Admin enxerga a operação inteira', 2, 'MANUAL DO ADMINISTRADOR');
  callout(s, 'Visão consolidada', 'Rede, marcas, unidades, categorias, produtos, ranking, Forneria e potencial.', 75, 160, 520, 205, RED, PINK);
  callout(s, 'Governança', 'Atualização da base, domínios autorizados, registros de acesso e avisos.', 685, 160, 520, 205, BLUE, '#EFF6FF');
  text(s, 'O perfil Admin pode ver métricas financeiras que não são entregues ao franqueado.', 125, 440, 1030, 70, 27, INK, true, 'center');
  footer(s, 'Use o Admin somente em dispositivos confiáveis.');

  s = deck.slides.add(); await header(s, 'Atualize os dados com o arquivo oficial', 3, 'MANUAL DO ADMINISTRADOR');
  step(s, 1, 'Abra Atualizar Dados', 'Selecione o relatório XLSX mais recente.', 80, 165, RED, 355);
  step(s, 2, 'Confira a prévia', 'Valide registros, última data, unidades e valores.', 465, 165, BLUE, 355);
  step(s, 3, 'Salve na nuvem', 'Use Aplicar e Salvar na Nuvem e aguarde a confirmação.', 850, 165, GREEN, 355);
  callout(s, 'Antes de publicar', 'Confirme se a carga corresponde a Almoço ou Jantar e se a última data do relatório está correta.', 180, 405, 920, 150, ORANGE, '#FFF7ED');
  footer(s, 'A última versão salva permanece disponível após F5 e para todos os usuários.');

  s = deck.slides.add(); await header(s, 'Período, turno e marca recalculam a rede', 4, 'MANUAL DO ADMINISTRADOR');
  step(s, 1, 'Defina o período', 'Última carga, sete cargas, todas ou datas específicas.', 85, 170, RED, 500);
  step(s, 2, 'Escolha o turno', 'Almoço e Jantar devem refletir a carga desejada.', 85, 315, ORANGE, 500);
  step(s, 3, 'Escolha a marca', 'Todas, Ital in House, Fast Food Caipira, City Burger ou Green.', 85, 460, BLUE, 500);
  callout(s, 'Escopo global', 'Depois de clicar em Aplicar, todas as páginas usam o mesmo período e turno. O filtro de marca acompanha a análise administrativa.', 680, 230, 470, 260, RED, PINK);
  footer(s, 'Evite comparar telas com filtros diferentes.');

  s = deck.slides.add(); await header(s, 'Use cada página para uma decisão', 5, 'MANUAL DO ADMINISTRADOR');
  const decisions = [
    ['Geral da Rede', 'Saúde consolidada e unidades mais afetadas'],
    ['Franquias', 'Busca por loja e comparação operacional'],
    ['Itens', 'Ocorrências, sistêmicos e receita em risco'],
    ['Categorias', 'Grupos com maior concentração de pausas'],
    ['Ranking', 'Desempenho relativo por disponibilidade'],
    ['Forneria', 'Disponibilidade dos produtos acompanhados'],
    ['Potencial', 'Cenários gerais ou por unidade'],
  ];
  decisions.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    text(s, d[0], 95 + col * 570, 145 + row * 120, 220, 26, 20, RED, true);
    text(s, d[1], 315 + col * 570, 145 + row * 120, 320, 58, 16, SUB);
    s.shapes.add({ geometry: 'rect', position: { left: 95 + col * 570, top: 205 + row * 120, width: 500, height: 1 }, fill: LINE, line: { style: 'solid', fill: LINE, width: 0 } });
  });
  footer(s, 'A antiga página Alertas foi removida por repetir informações dessas páginas.');

  s = deck.slides.add(); await header(s, 'Acessos controla identidade e permissões', 6, 'MANUAL DO ADMINISTRADOR');
  callout(s, 'Domínios permitidos', 'Cadastre italinhouse.com, gmail.com ou outros domínios autorizados. Salve antes de testar.', 75, 165, 520, 190, BLUE, '#EFF6FF');
  callout(s, 'Histórico de acesso', 'Consulte nome, e-mail, data, evento, marca e unidade selecionada.', 685, 165, 520, 190, GREEN, '#ECFDF5');
  callout(s, 'Limpeza dos logs', 'Use Apagar logs somente após confirmar a política de retenção. A ação é definitiva e não apaga a base.', 225, 420, 830, 135, RED, PINK);
  footer(s, 'Nome e e-mail são declaratórios; contas individuais são a evolução recomendada.');

  s = deck.slides.add(); await header(s, 'Avisos comunica cada nova atualização', 7, 'MANUAL DO ADMINISTRADOR');
  step(s, 1, 'Cadastre destinatários', 'Informe um e-mail por linha ou separe por vírgula.', 80, 155, RED, 355);
  step(s, 2, 'Revise assunto e mensagem', 'Data e turno podem ser preenchidos automaticamente.', 465, 155, BLUE, 355);
  step(s, 3, 'Teste antes de ativar', 'Envie para um endereço controlado e confirme o recebimento.', 850, 155, GREEN, 355);
  callout(s, 'Automação após upload', 'Ative em verde para enviar após novas cargas. Deixe vermelho durante testes ou manutenção.', 210, 410, 860, 135, ORANGE, '#FFF7ED');
  footer(s, 'WhatsApp depende de configuração própria; e-mail depende do servidor SMTP.');

  s = deck.slides.add(); await header(s, 'E-mail corporativo exige credencial própria', 8, 'MANUAL DO ADMINISTRADOR');
  callout(s, 'Gmail / Google Workspace', 'Use verificação em duas etapas e Senha de app. A senha normal da conta não deve ser usada no sistema.', 75, 165, 520, 210, RED, PINK);
  callout(s, 'Conta recomendada', 'Crie uma caixa exclusiva, como avisos@italinhouse.com, aprovada e administrada pela empresa.', 685, 165, 520, 210, BLUE, '#EFF6FF');
  text(s, 'Variáveis sensíveis ficam apenas na Vercel.', 180, 445, 920, 38, 27, INK, true, 'center');
  text(s, 'Nunca coloque senha, token ou credencial no GitHub ou no navegador.', 210, 505, 860, 32, 18, SUB, false, 'center');
  footer(s, 'Após alterar variáveis, faça um novo deploy sem cache.');

  s = deck.slides.add(); await header(s, 'Checklist de publicação e operação', 9, 'MANUAL DO ADMINISTRADOR');
  bulletList(s, ['Validar data, turno e quantidade de unidades da nova carga.', 'Confirmar que a base foi salva na nuvem.', 'Testar Geral, Itens, Categorias, Ranking e uma unidade franqueada.', 'Verificar destinatários e enviar um e-mail de teste.', 'Acompanhar os primeiros acessos e registrar feedback do piloto.', 'Nunca publicar .env.local, senhas, tokens ou planilhas reais no GitHub.'], 105, 145, 1060, 78, RED);
  footer(s, 'Em caso de erro, registre página, horário, ação executada e mensagem exibida.');
  return deck;
}

async function exportDeck(deck, name) {
  const renderDir = path.join(TMP, name);
  await fs.mkdir(renderDir, { recursive: true });
  for (const [i, slide] of deck.slides.items.entries()) {
    const png = await deck.export({ slide, format: 'png', scale: 1 });
    await fs.writeFile(path.join(renderDir, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: 'layout' });
    await fs.writeFile(path.join(renderDir, `slide-${String(i + 1).padStart(2, '0')}.layout.json`), await layout.text());
  }
  const montage = await deck.export({ format: 'webp', montage: true, scale: 1 });
  await fs.writeFile(path.join(renderDir, 'montage.webp'), new Uint8Array(await montage.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(path.join(OUT, `${name}.pptx`));
}

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(TMP, 'source-notes.txt'), 'Conteúdo baseado no funcionamento e nos arquivos locais do Portal de Itens Pausados x Ativos. Sem fontes externas.\n', 'utf8');
await exportDeck(await buildFranchise(), 'Manual_Franqueado_Ital_in_House');
await exportDeck(await buildAdmin(), 'Manual_Administrador_Ital_in_House');
