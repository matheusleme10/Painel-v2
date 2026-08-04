const FORM_URL = import.meta.env.VITE_FEEDBACK_FORM_URL || '';

const questions = [
  'Qual é o seu nome, e-mail e unidade?',
  'Com que frequência você utiliza o portal?',
  'De 0 a 10, quão fácil é encontrar os itens pausados?',
  'A visão de ativos, pausados e preços ajuda na operação diária?',
  'Qual página é mais útil para você?',
  'Existe alguma informação confusa ou difícil de interpretar?',
  'O portal ajudou a identificar ou corrigir algum item pausado?',
  'Qual funcionalidade você gostaria que fosse adicionada?',
  'De 0 a 10, qual a sua satisfação geral com o portal?',
  'Deseja deixar algum comentário ou sugestão adicional?',
];

export function FranchiseFeedbackPage() {
  return <section className="franchise-feedback-page"><div className="network-hero"><div><span className="eyebrow">SUA OPINIÃO MELHORA O PORTAL</span><h1>Feedback</h1><p>Conte como o sistema está ajudando sua unidade e o que podemos melhorar.</p></div></div><div className="feedback-callout"><span>💬</span><div><h2>Leva menos de 3 minutos</h2><p>As respostas serão utilizadas para melhorar clareza, desempenho e funcionalidades do painel.</p></div>{FORM_URL ? <a href={FORM_URL} target="_blank" rel="noreferrer">Responder formulário</a> : <b>Formulário em configuração</b>}</div><section className="feedback-questions"><span className="eyebrow">PERGUNTAS DO FORMULÁRIO</span><h2>O que queremos entender</h2><ol>{questions.map((question) => <li key={question}>{question}</li>)}</ol></section></section>;
}
