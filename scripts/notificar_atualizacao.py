from __future__ import annotations

import argparse
import os
import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)


def build_message(shift: str, date_text: str) -> str:
    greeting = "Boa noite" if "jantar" in shift.lower() else "Boa tarde"
    return (
        f"{greeting}! O Dashboard de Itens Pausados foi atualizado com os dados "
        f"de {shift}, {date_text}.\n\n"
        "Acesse o portal, entre com a senha de franqueado e pesquise sua unidade "
        "para consultar itens ativos, pausados e o ranking da rede."
    )


def send_email(subject: str, body: str, attachment: Path) -> int:
    recipients = [value.strip() for value in os.getenv("NOTIFY_EMAIL_TO", "").split(",") if value.strip()]
    if not recipients:
        return 0
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = os.environ["SMTP_FROM"]
    message["Bcc"] = ", ".join(recipients)
    message.set_content(body)
    message.add_attachment(
        attachment.read_bytes(),
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=attachment.name,
    )
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "465"))) as client:
        client.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        client.send_message(message)
    return len(recipients)


def send_whatsapp(body: str) -> int:
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    recipients = [value.strip() for value in os.getenv("WHATSAPP_TO", "").split(",") if value.strip()]
    if not token or not phone_id or not recipients:
        return 0
    url = f"https://graph.facebook.com/v23.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    for recipient in recipients:
        response = requests.post(
            url,
            headers=headers,
            json={"messaging_product": "whatsapp", "to": recipient, "type": "text", "text": {"body": body}},
            timeout=30,
        )
        response.raise_for_status()
    return len(recipients)


def main() -> None:
    parser = argparse.ArgumentParser(description="Notifica a rede após uma atualização do dashboard.")
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--turno", choices=["Almoço", "Jantar"], required=True)
    parser.add_argument("--data", default=datetime.now().strftime("%d/%m/%Y"))
    parser.add_argument("--enviar", action="store_true", help="Efetua os envios configurados.")
    args = parser.parse_args()

    attachment = args.xlsx.resolve()
    if not attachment.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {attachment}")
    body = build_message(args.turno, args.data)
    subject = f"Dashboard atualizado – {args.turno} – {args.data}"
    print(body)
    if not args.enviar:
        print("\nPrévia gerada. Use --enviar somente após configurar e validar os destinatários.")
        return
    email_count = send_email(subject, body, attachment)
    whatsapp_count = send_whatsapp(body)
    print(f"Envio concluído: {email_count} e-mail(s) e {whatsapp_count} WhatsApp(s).")


if __name__ == "__main__":
    main()
