/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { describe, it, before, beforeEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import type { Express } from 'express'
import nodemailer from 'nodemailer'
import { createTestApp } from './helpers/setup'
import { login, register } from './helpers/auth'
import { UserModel } from '../../models/user'
import { PasswordRecoveryModel, PasswordRecoveryLimitModel } from '../../models/passwordRecovery'
import * as security from '../../lib/insecurity'

let app: Express
let email: string
let userId: number
let token: string
let sequence = 0
const password = 'original-password'
const newPassword = 'replacement-password'
const sentCodes = new Map<string, string>()

before(async () => {
  process.env.PASSWORD_RESET_HMAC_KEY = 'ab'.repeat(32)
  process.env.SMTP_HOST = 'localhost'
  process.env.SMTP_FROM = 'shop@example.test'
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (mail: { to: { address: string }, text: string }) => {
      const code = mail.text.match(/code is: (\d{8})/)?.[1]
      assert.ok(code)
      sentCodes.set(mail.to.address, code)
    }
  }) as unknown as ReturnType<typeof nodemailer.createTransport>)
  const result = await createTestApp()
  app = result.app
}, { timeout: 60000 })

beforeEach(async () => {
  await PasswordRecoveryLimitModel.destroy({ where: {} })
  sentCodes.clear()
  email = 'password-test-' + ++sequence + '@example.test'
  const res = await register(app, { email, password })
  userId = res.body.data.id
  token = (await login(app, { email, password })).token
})

after(() => { mock.restoreAll() })

async function requestCode (authorization = token) {
  const res = await request(app)
    .post('/rest/user/request-password-reset')
    .set({ Authorization: 'Bearer ' + authorization })
    .send({ email })
  assert.equal(res.status, 202)
  const code = sentCodes.get(email)
  assert.ok(code)
  assert.ok(!JSON.stringify(res.body).includes(code))
  return code
}

function reset (code: unknown, passwords: Record<string, unknown> = { new: newPassword, repeat: newPassword }) {
  return request(app).post('/rest/user/reset-password').send({ email, code, ...passwords })
}

void describe('/rest/user/change-password', () => {
  void it('changes the password with the correct current password', async () => {
    const res = await request(app).get('/rest/user/change-password')
      .query({ current: password, new: newPassword, repeat: newPassword })
      .set({ Authorization: 'Bearer ' + token })
    assert.equal(res.status, 200)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(newPassword))
    assert.ok((await login(app, { email, password: newPassword })).token)
    const retry = await request(app).get('/rest/user/change-password')
      .query({ current: password, new: 'another-password', repeat: 'another-password' })
      .set({ Authorization: 'Bearer ' + token })
    assert.equal(retry.status, 401)
  })

  for (const current of ['', 'wrong-password']) {
    void it('rejects an empty or incorrect current password: ' + JSON.stringify(current), async () => {
      const res = await request(app).get('/rest/user/change-password')
        .query({ current, new: newPassword, repeat: newPassword })
        .set({ Authorization: 'Bearer ' + token })
      assert.equal(res.status, 401)
      assert.ok(res.text.includes('Current password is not correct'))
      assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
    })
  }

  void it('rejects a missing current password', async () => {
    const res = await request(app).get('/rest/user/change-password')
      .query({ new: newPassword, repeat: newPassword })
      .set({ Authorization: 'Bearer ' + token })
    assert.equal(res.status, 401)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
  })

  for (const passwords of [{ new: '', repeat: '' }, { new: newPassword, repeat: 'different' }]) {
    void it('rejects invalid new passwords: ' + JSON.stringify(passwords), async () => {
      const res = await request(app).get('/rest/user/change-password')
        .query({ current: password, ...passwords })
        .set({ Authorization: 'Bearer ' + token })
      assert.equal(res.status, 401)
      assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
    })
  }

  for (const authorization of ['', 'Bearer unknown']) {
    void it('rejects missing or invalid authentication: ' + JSON.stringify(authorization), async () => {
      const res = await request(app).get('/rest/user/change-password')
        .query({ current: password, new: newPassword, repeat: newPassword })
        .set({ Authorization: authorization })
      assert.equal(res.status, 401)
      assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
    })
  }
})

void describe('emailed password recovery', () => {
  void it('uses a code once and invalidates existing sessions', async () => {
    const code = await requestCode()
    assert.equal((await reset(code)).status, 200)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(newPassword))
    assert.equal((await PasswordRecoveryModel.findByPk(userId))?.sessionVersion, 1)
    assert.equal((await reset(code)).status, 401)
    assert.equal((await request(app).get('/rest/2fa/status')
      .set({ Authorization: 'Bearer ' + token })).status, 401)
    assert.equal((await request(app).get('/rest/2fa/status')
      .set('Cookie', 'token=' + token)).status, 401)

    const codeRes = await request(app).post('/rest/user/request-password-reset')
      .set({ Authorization: 'Bearer ' + token, Cookie: 'token=' + token }).send({ email })
    assert.equal(codeRes.status, 202)
    const nextCode = sentCodes.get(email)
    assert.ok(nextCode)
    const resetRes = await request(app).post('/rest/user/reset-password')
      .set({ Authorization: 'Bearer ' + token, Cookie: 'token=' + token })
      .send({ email, code: nextCode, new: password, repeat: password })
    assert.equal(resetRes.status, 200)
    const loginRes = await request(app).post('/rest/user/login')
      .set({ Authorization: 'Bearer ' + token, Cookie: 'token=' + token })
      .send({ email, password })
    assert.equal(loginRes.status, 200)
    assert.ok(loginRes.body.authentication.token)
    assert.equal((await request(app).get('/rest/2fa/status')
      .set({ Authorization: 'Bearer ' + loginRes.body.authentication.token })).status, 200)
  })

  void it('does not accept a security answer instead of an emailed code', async () => {
    const res = await request(app).post('/rest/user/reset-password')
      .send({ email, answer: 'Samuel', new: newPassword, repeat: newPassword })
    assert.equal(res.status, 401)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
  })

  for (const code of ['123', 'abcdefgh', 12345678, undefined]) {
    void it('rejects malformed codes: ' + JSON.stringify(code), async () => {
      await requestCode()
      assert.equal((await reset(code)).status, 401)
      assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
    })
  }

  void it('rejects expired codes', async () => {
    const code = await requestCode()
    await PasswordRecoveryModel.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { UserId: userId } })
    assert.equal((await reset(code)).status, 401)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
  })

  void it('invalidates the previous code when another is requested', async () => {
    const code = await requestCode()
    const nextCode = await requestCode()
    if (code !== nextCode) assert.equal((await reset(code)).status, 401)
    assert.equal((await reset(nextCode)).status, 200)
  })

  void it('limits code redemption attempts', async () => {
    const code = await requestCode()
    const wrongCode = code === '00000000' ? '00000001' : '00000000'
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await reset(wrongCode)).status, 401)
    assert.equal((await reset(code)).status, 429)
    assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
  })

  void it('limits requests without revealing whether the account exists', async () => {
    const first = await request(app).post('/rest/user/request-password-reset').send({ email })
    for (let attempt = 0; attempt < 2; attempt++) await requestCode()
    sentCodes.clear()
    const limited = await request(app).post('/rest/user/request-password-reset').send({ email })
    const unknown = await request(app).post('/rest/user/request-password-reset').send({ email: 'unknown@example.test' })
    assert.equal(limited.status, 202)
    assert.equal(unknown.status, 202)
    assert.deepEqual(limited.body, first.body)
    assert.deepEqual(unknown.body, first.body)
    assert.equal(sentCodes.size, 0)
  })

  for (const passwords of [{ repeat: newPassword }, { new: newPassword, repeat: 'different' }]) {
    void it('rejects invalid replacement passwords: ' + JSON.stringify(passwords), async () => {
      const code = await requestCode()
      assert.equal((await reset(code, passwords)).status, 400)
      assert.equal((await UserModel.findByPk(userId))?.password, security.hash(password))
      assert.equal((await reset(code)).status, 200)
    })
  }

  void it('rejects missing or invalid email addresses and empty requests', async () => {
    for (const body of [{}, { email: 'invalid', code: '00000000' }]) {
      assert.equal((await request(app).post('/rest/user/reset-password').send(body)).status, 401)
    }
  })

  void it('returns 503 when recovery is not configured', async () => {
    const key = process.env.PASSWORD_RESET_HMAC_KEY
    delete process.env.PASSWORD_RESET_HMAC_KEY
    try {
      assert.equal((await request(app).post('/rest/user/request-password-reset').send({ email })).status, 503)
      assert.equal((await reset('00000000')).status, 503)
    } finally {
      process.env.PASSWORD_RESET_HMAC_KEY = key
    }
  })
})
