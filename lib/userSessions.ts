/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import jwt from 'jsonwebtoken'
import { sequelize } from '../models'
import { UserModel } from '../models/user'
import { PasswordRecoveryModel } from '../models/passwordRecovery'
import * as security from './insecurity'

export async function authorizeForUser (user: Pick<UserModel, 'id' | 'password'>, payload: Record<string, unknown>, expectedVersion?: number) {
  return await sequelize.transaction(async transaction => {
    const currentUser = await UserModel.findByPk(user.id, { transaction })
    if (!currentUser || currentUser.password !== user.password) {
      throw new Error('Credentials changed. Please sign in again.')
    }
    const recovery = await PasswordRecoveryModel.findByPk(user.id, { transaction })
    const sessionVersion = recovery?.sessionVersion ?? 0
    if (expectedVersion !== undefined && expectedVersion !== sessionVersion) {
      throw new Error('Session expired. Please sign in again.')
    }
    return security.authorize({ ...payload, sessionVersion })
  })
}

export async function readUserToken (token: unknown): Promise<Record<string, any> | undefined> {
  if (typeof token !== 'string') return undefined
  const payload = await new Promise<Record<string, any> | undefined>(resolve => {
    jwt.verify(token, security.publicKey, (error, decoded) => { resolve(!error && decoded && typeof decoded === 'object' ? decoded : undefined) })
  })
  const userId = payload?.data?.id ?? payload?.userId
  if (!payload || !Number.isSafeInteger(userId) || userId <= 0) return undefined
  const recovery = await PasswordRecoveryModel.findByPk(userId)
  if ((payload.sessionVersion ?? 0) !== (recovery?.sessionVersion ?? 0)) return undefined
  return payload
}
