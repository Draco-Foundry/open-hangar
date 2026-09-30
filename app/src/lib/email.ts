// Account emails (verify address, reset password) through Resend's HTTP API.
// No RESEND_API_KEY (local dev)? The link is logged to the console instead.
import { env } from 'cloudflare:workers';

type EmailEnv = { RESEND_API_KEY?: string; EMAIL_FROM?: string };
const DEFAULT_FROM = 'Open Hangar <noreply@openhangar.space>';

interface Mail {
  to: string;
  subject: string;
  /** Short plain lines; the link goes on its own line. */
  lines: string[];
  link: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function sendMail({ to, subject, lines, link }: Mail) {
  const { RESEND_API_KEY, EMAIL_FROM } = env as unknown as EmailEnv;
  if (!RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not set, not sending "${subject}" to ${to}. Link: ${link}`);
    return;
  }
  const text = [...lines, '', link, '', 'Open Hangar'].join('\n');
  const html =
    lines.map((l) => `<p>${esc(l)}</p>`).join('') +
    `<p><a href="${esc(link)}">${esc(link)}</a></p><p>Open Hangar</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM || DEFAULT_FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    // Never log the key; the body only says what went wrong.
    console.error(`[email] Resend said ${res.status}: ${await res.text()}`);
    throw new Error('Could not send the email. Try again in a minute.');
  }
}

export const verifyEmail = (to: string, link: string) =>
  sendMail({
    to,
    subject: 'Confirm Your Email',
    lines: [
      'Hey, thanks for signing up for Open Hangar.',
      'Click the link below to confirm this is your email. If you didn’t sign up, you can ignore this.',
    ],
    link,
  });

export const resetPasswordEmail = (to: string, link: string) =>
  sendMail({
    to,
    subject: 'Reset Your Password',
    lines: [
      'Someone (hopefully you) asked to reset your Open Hangar password.',
      'Click the link below to pick a new one. It works for an hour. If this wasn’t you, just ignore this email.',
    ],
    link,
  });
