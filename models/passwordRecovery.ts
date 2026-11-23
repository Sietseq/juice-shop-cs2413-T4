/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Model, DataTypes, type InferAttributes, type InferCreationAttributes, type CreationOptional, type Sequelize } from 'sequelize'

class PasswordRecovery extends Model<InferAttributes<PasswordRecovery>, InferCreationAttributes<PasswordRecovery>> {
  declare UserId: number
  declare codeHash: CreationOptional<string | null>
  declare expiresAt: CreationOptional<Date | null>
  declare attempts: CreationOptional<number>
  declare usedAt: CreationOptional<Date | null>
  declare verifiedEmail: CreationOptional<string | null>
  declare sessionVersion: CreationOptional<number>
}

class PasswordRecoveryLimit extends Model<InferAttributes<PasswordRecoveryLimit>, InferCreationAttributes<PasswordRecoveryLimit>> {
  declare key: string
  declare windowStartedAt: Date
  declare attempts: number
}

export function PasswordRecoveryModelInit (sequelize: Sequelize) {
  PasswordRecovery.init({
    UserId: { type: DataTypes.INTEGER, primaryKey: true },
    codeHash: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    expiresAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    usedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    verifiedEmail: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    sessionVersion: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, { sequelize, tableName: 'PasswordRecoveries', timestamps: false })

  PasswordRecoveryLimit.init({
    key: { type: DataTypes.STRING, primaryKey: true },
    windowStartedAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false }
  }, { sequelize, tableName: 'PasswordRecoveryLimits', timestamps: false })
}

export { PasswordRecovery as PasswordRecoveryModel, PasswordRecoveryLimit as PasswordRecoveryLimitModel }
