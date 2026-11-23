/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import crypto from 'node:crypto'
import { type Request, type Response, type NextFunction } from 'express'
import { type Transaction } from 'sequelize'
import { sequelize } from '../models'
import { UserModel } from '../models/user'
import { PasswordRecoveryModel, PasswordRecoveryLimitModel } from '../models/passwordRecovery'
import { isRecoveryEmail, passwordResetSettings, sendPasswordResetCode } from '../lib/passwordResetMail'
import * as security from '../lib/insecurity'
import logger from '../lib/logger'

const windowMs = 15 * 60 * 1000
const requestMessage = 'If an account exists for that email, a password reset code will be sent.'
const invalidCodeMessage = 'Invalid or expired password reset code.'

function digest (value: string) {
  return crypto.createHmac('sha256', passwordResetSettings().key).update(value).digest('hex')
}

async function consumeLimit (scope: string, identifier: string, maximum: number, transaction: Transaction) {
  const key = digest(scope + '\0' + identifier)
  const now = new Date()
  const limit = await PasswordRecoveryLimitModel.findByPk(key, { transaction })
  if (!limit) {
    await PasswordRecoveryLimitModel.create({ key, windowStartedAt: now, attempts: 1 }, { transaction })
    return true
  }
  if (now.getTime() - limit.windowStartedAt.getTime() >= windowMs) {
    await limit.update({ windowStartedAt: now, attempts: 1 }, { transaction })
    return true
  }
  if (limit.attempts >= maximum) return false
  await limit.update({ attempts: limit.attempts + 1 }, { transaction })
  return true
}

async function deliverCode (UserId: number, email: string, code: string, codeHash: string) {
  try {
    await sendPasswordResetCode(email, code)
  } catch {
    logger.warn('Password reset email delivery failed.')
    try {
      await PasswordRecoveryModel.update({ codeHash: null, usedAt: new Date() }, { where: { UserId, codeHash } })
    } catch {
      logger.warn('Could not invalidate an undelivered password reset code.')
    }
  }
}

export function requestPasswordReset () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      passwordResetSettings()
    } catch {
      res.status(503).send('Password recovery is unavailable.')
      return
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
    try {
      const delivery = await sequelize.transaction(async transaction => {
        const ipAllowed = await consumeLimit('request-ip', req.socket.remoteAddress ?? 'unknown', 20, transaction)
        if (!ipAllowed || !isRecoveryEmail(email)) return undefined
        if (!await consumeLimit('request-email', email.toLowerCase(), 3, transaction)) return undefined
        const user = await UserModel.findOne({ where: { email }, transaction })
        if (!user || !isRecoveryEmail(user.email)) return undefined
        const code = crypto.randomInt(0, 100000000).toString().padStart(8, '0')
        const codeHash = digest(user.id + '\0' + code)
        const [recovery] = await PasswordRecoveryModel.findOrCreate({
          where: { UserId: user.id }, transaction
        })
        await recovery.update({
          codeHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          attempts: 0,
          usedAt: null
        }, { transaction })
        return { UserId: user.id, email: user.email, code, codeHash }
      })
      res.status(202).json({ message: requestMessage })
      if (delivery) void deliverCode(delivery.UserId, delivery.email, delivery.code, delivery.codeHash)
    } catch (error) {
      next(error)
    }
  }
}

export function resetPassword () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      passwordResetSettings()
    } catch {
      res.status(503).send('Password recovery is unavailable.')
      return
    }
    const { email: inputEmail, code, new: newPassword, repeat } = req.body ?? {}
    const email = typeof inputEmail === 'string' ? inputEmail.trim() : ''
    try {
      const result = await sequelize.transaction(async transaction => {
        const ipAllowed = await consumeLimit('redeem-ip', req.socket.remoteAddress ?? 'unknown', 50, transaction)
        if (!ipAllowed) return { status: 429, message: invalidCodeMessage }
        if (!isRecoveryEmail(email)) return { status: 401, message: invalidCodeMessage }
        const emailAllowed = await consumeLimit('redeem-email', email.toLowerCase(), 5, transaction)
        if (!emailAllowed) return { status: 429, message: invalidCodeMessage }
        const user = await UserModel.findOne({ where: { email }, transaction })
        const recovery = user ? await PasswordRecoveryModel.findByPk(user.id, { transaction }) : null
        if (!user || !recovery || !recovery.codeHash || recovery.usedAt || !recovery.expiresAt ||
            recovery.expiresAt.getTime() <= Date.now() || recovery.attempts >= 5) {
          return { status: 401, message: invalidCodeMessage }
        }
        await recovery.update({ attempts: recovery.attempts + 1 }, { transaction })
        const validFormat = typeof code === 'string' && /^\d{8}$/.test(code)
        const candidate = digest(user.id + '\0' + (validFormat ? code : ''))
        if (!validFormat || !crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(recovery.codeHash, 'hex'))) {
          return { status: 401, message: invalidCodeMessage }
        }
        if (typeof newPassword !== 'string' || !newPassword || newPassword === 'undefined') {
          return { status: 400, message: 'Password cannot be empty.' }
        }
        if (newPassword !== repeat) return { status: 400, message: 'New and repeated password do not match.' }
        await user.update({ password: newPassword }, { transaction })
        await recovery.update({
          codeHash: null,
          usedAt: new Date(),
          verifiedEmail: user.email,
          sessionVersion: recovery.sessionVersion + 1
        }, { transaction })
        return { status: 200, message: 'Password successfully changed. Please sign in again.', UserId: user.id }
      })
      if (result.UserId !== undefined) {
        security.invalidateUserSessions(result.UserId)
        res.clearCookie('token')
      }
      res.status(result.status).json({ message: result.message })
    } catch (error) {
      next(error)
    }
  }
}
