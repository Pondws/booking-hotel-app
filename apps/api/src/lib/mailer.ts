import { env } from "../env";

export type MailMessage = { to: string; subject: string; text: string };

/** Sends transactional email. Only a console implementation exists until a provider is chosen (PLAN.md Phase 10). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Logs the email instead of sending it (local dev). In production the body is left out, so one-time links
 * never land in server logs.
 */
export class ConsoleMailer implements Mailer {
  async send({ to, subject, text }: MailMessage): Promise<void> {
    if (env.NODE_ENV === "production") {
      console.warn(`[mail] no mail provider configured — dropped "${subject}" to ${to}`);
      return;
    }
    console.info(`[mail] to: ${to}\n[mail] subject: ${subject}\n${text}`);
  }
}

let mailer: Mailer = new ConsoleMailer();

export function getMailer(): Mailer {
  return mailer;
}

/** Tests swap in a recorder. */
export function setMailer(next: Mailer): void {
  mailer = next;
}
