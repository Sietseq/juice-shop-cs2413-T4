/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import nodemailer from 'nodemailer'

const addressPattern = /^[^\s@<>,;]+@[^\s@<>,;]+$/

export const isRecoveryEmail = (email: unknown): email is string =>
  typeof email === 'string' && email.length <= 254 && addressPattern.test(email)

export function passwordResetSettings () {
  const key = process.env.PASSWORD_RESET_HMAC_KEY
  const host = process.env.SMTP_HOST
  const from = process.env.SMTP_FROM
  const port = Number(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  if (!key || !/^[a-f\d]{64}$/i.test(key) || !host || !isRecoveryEmail(from) ||
      !Number.isInteger(port) || port < 1 || port > 65535 || Boolean(user) !== Boolean(pass)) {
    throw new Error('Password recovery is not configured.')
  }
  return { key: Buffer.from(key, 'hex'), host, from, port, user, pass }
}

export async function sendPasswordResetCode (email: string, code: string) {
  const settings = passwordResetSettings()
  const local = ['localhost', '127.0.0.1', '::1'].includes(settings.host)
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: !local,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true
  })
  await transport.sendMail({
    from: { name: 'Juice Shop', address: settings.from },
    to: { name: '', address: email },
    envelope: { from: settings.from, to: [email] },
    subject: 'Your Juice Shop password reset code',
    text: 'Your password reset code is: ' + code + '\n\nIt expires in 10 minutes and can be used once. If you did not request this, ignore this email.'
  })
}
