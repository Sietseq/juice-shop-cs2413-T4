/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { UserModel } from '../models/user'
import * as security from '../lib/insecurity'

export function changePassword () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const loggedInUser = security.authenticatedUsers.from(req)
    if (!loggedInUser) {
      res.status(401).send(res.__('You need to be logged in to change your password.'))
      return
    }

    const currentPassword = req.query.current
    const newPassword = req.query.new
    const repeatPassword = req.query.repeat

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      res.status(401).send(res.__('Current password is not correct.'))
      return
    }

    if (typeof newPassword !== 'string' || !newPassword || newPassword === 'undefined') {
      res.status(401).send(res.__('Password cannot be empty.'))
      return
    } else if (newPassword !== repeatPassword) {
      res.status(401).send(res.__('New and repeated password do not match.'))
      return
    }

    try {
      const user = await UserModel.findByPk(loggedInUser.data.id)
      if (!user) {
        res.status(404).send(res.__('User not found.'))
        return
      }

      if (security.hash(currentPassword) !== user.password) {
        res.status(401).send(res.__('Current password is not correct.'))
        return
      }

      await user.update({ password: newPassword })
      res.json({ user })
    } catch (error) {
      next(error)
    }
  }
}
