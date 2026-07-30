import { useEffect, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';

export function AutomatedNotificationPage() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('Ital in House');
  const [testRecipient, setTestRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  function recipientList(value = recipients) {
    return [...new Set(value
      .split(/[\n,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean))];
  }

  async function loadStatus() {
    const response = await fetch('/api/notifications/status', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return;
    const next = await response.json();
    setStatus(next);
    setMessage((current) => current || next.preview?.message || '');
    setSubject((current) => current || next.preview?.subject || '');
    setRecipients((current) => current || (next.emailRecipients || []).join('\n'));
    setSenderEmail((current) => current || next.senderEmail || '');
    setSenderName((current) => current || next.senderName || 'Ital in House');
    setTestRecipient((current) => current || next.emailRecipients?.[0] || '');
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function saveSettings(nextAutoEnabled = status?.autoEnabled) {
    setSaving(true);
    setFeedback('');
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoEnabled: Boolean(nextAutoEnabled),
          emailRecipients: recipientList(),
          senderEmail,
          senderName,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || 'Falha ao salvar a configuração.');
      setStatus((current) => ({ ...current, ...result }));
      setRecipients(result.emailRecipients.join('\n'));
      setFeedback(nextAutoEnabled
        ? 'Envio automático ativado e configuração salva.'
        : 'Envio automático desativado e configuração salva.');
      return true;
    } catch (error) {
      setFeedback(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setFeedback('');
    try {
      const saved = await saveSettings(status?.autoEnabled);
      if (!saved) return;
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testRecipient }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || 'Falha ao enviar o teste.');
      setFeedback(`E-mail de teste enviado para ${result.recipient}.`);
      await loadStatus();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setTesting(false);
    }
  }

  async function send() {
    setSending(true);
    setFeedback('');
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, subject }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || 'Falha ao enviar.');
      setFeedback(`Enviado: ${result.emailCount || 0} e-mail(s) e ${result.whatsappCount || 0} WhatsApp(s).`);
      await loadStatus();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="notify-page">
      <div className="network-hero">
        <div>
          <span className="eyebrow">COMUNICAÇÃO AUTOMÁTICA</span>
          <h1>Avisos da rede</h1>
          <p>A mensagem usa automaticamente a data da base e define Almoço antes das 17h ou Jantar a partir das 17h.</p>
        </div>
      </div>

      <Card className={`notification-toggle-card ${status?.autoEnabled ? 'is-enabled' : 'is-disabled'}`}>
        <div>
          <small>ENVIO APÓS O UPLOAD</small>
          <strong>{status?.autoEnabled ? 'Automação ativada' : 'Automação desativada'}</strong>
          <p>
            {status?.autoEnabled
              ? 'Ao publicar uma nova planilha, o aviso será enviado aos destinatários cadastrados.'
              : 'Novos uploads não enviarão mensagens automaticamente.'}
          </p>
        </div>
        <button
          type="button"
          className="notification-switch"
          role="switch"
          aria-checked={Boolean(status?.autoEnabled)}
          disabled={!status || saving}
          onClick={() => saveSettings(!status?.autoEnabled)}
        >
          <span />
          {status?.autoEnabled ? 'Ativado' : 'Desativado'}
        </button>
      </Card>

      <div className="notification-status-grid">
        <Card><small>Destinatários por e-mail</small><strong style={{ color: status?.emailConfigured ? C.green : C.muted }}>{recipientList().length} cadastrado(s)</strong></Card>
        <Card><small>Servidor de e-mail</small><strong style={{ color: status?.smtpConfigured ? C.green : C.red }}>{status?.smtpConfigured ? 'SMTP configurado' : 'SMTP pendente'}</strong></Card>
        <Card><small>Último envio</small><strong>{status?.sentAt ? new Date(status.sentAt).toLocaleString('pt-BR') : 'Ainda não enviado'}</strong></Card>
      </div>

      <Card>
        <div className="notification-recipients-header">
          <div>
            <strong>Remetente</strong>
            <p>É o nome e o endereço que aparecerão como responsáveis pelo envio.</p>
          </div>
          <span>{status?.smtpConfigured ? 'Servidor pronto' : 'Servidor pendente'}</span>
        </div>
        <div className="notification-sender-grid">
          <label className="notification-field">Nome do remetente
            <input value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="Ital in House" />
          </label>
          <label className="notification-field">E-mail remetente
            <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="avisos@italinhouse.com" />
          </label>
        </div>
        {!status?.smtpConfigured && (
          <div className="notification-config-warning">
            O endereço remetente identifica a mensagem, mas o envio ainda precisa de um servidor SMTP autorizado.
            Configure SMTP_HOST, SMTP_USER e SMTP_PASSWORD no arquivo local ou na Vercel.
          </div>
        )}
      </Card>

      <Card>
        <div className="notification-recipients-header">
          <div>
            <strong>Destinatários dos avisos</strong>
            <p>Digite um e-mail por linha. Também aceitamos endereços separados por vírgula ou ponto e vírgula.</p>
          </div>
          <span>{recipientList().length} e-mail(s)</span>
        </div>
        <label className="notification-field">Lista de e-mails
          <textarea
            className="notification-recipients"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder={'franqueado1@empresa.com.br\nfranqueado2@empresa.com.br\nfranqueado3@empresa.com.br'}
            spellCheck="false"
          />
        </label>
        <button type="button" className="secondary-action" disabled={saving} onClick={() => saveSettings()}>
          {saving ? 'Salvando…' : 'Salvar remetente e destinatários'}
        </button>
      </Card>

      <Card className="notification-test-card">
        <div>
          <strong>Testar antes de ativar</strong>
          <p>Envia uma mensagem curta somente para o endereço abaixo.</p>
        </div>
        <div className="notification-test-action">
          <input
            type="email"
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            placeholder="seu-email@empresa.com.br"
            aria-label="Destinatário do e-mail de teste"
          />
          <button type="button" className="primary-action" disabled={testing || saving || !testRecipient.trim()} onClick={sendTest}>
            {testing ? 'Enviando teste…' : 'Enviar e-mail de teste'}
          </button>
        </div>
      </Card>

      <Card>
        <label className="notification-field">Assunto
          <input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label className="notification-field">Mensagem
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
        <div className="notification-actions">
          <button className="primary-action" disabled={sending || !message.trim()} onClick={send}>
            {sending ? 'Enviando…' : 'Enviar agora pelos canais configurados'}
          </button>
          {feedback && <span>{feedback}</span>}
        </div>
      </Card>
      <Card style={{ borderLeft: `4px solid ${C.blue}` }}>
        <strong>Configuração protegida</strong>
        <p style={{ color: C.muted, marginBottom: 0 }}>
          Os destinatários e o estado da automação ficam salvos no backend. Senha SMTP e tokens continuam
          exclusivamente nas variáveis de ambiente da Vercel e nunca são enviados ao navegador.
        </p>
      </Card>
    </section>
  );
}
