/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { UserService } from '../Services/user.service'
import { disabled, email, form, FormField, FormRoot, minLength, required, validate } from '@angular/forms/signals'
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faSave } from '@fortawesome/free-solid-svg-icons'
import { faEdit } from '@fortawesome/free-regular-svg-icons'
import { TranslateService, TranslateModule } from '@ngx-translate/core'
import { MatButtonModule } from '@angular/material/button'
import { PasswordStrengthComponent } from '../password-strength/password-strength.component'
import { PasswordStrengthInfoComponent } from '../password-strength-info/password-strength-info.component'
import { MatSlideToggle } from '@angular/material/slide-toggle'

import { MatTooltip } from '@angular/material/tooltip'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule, MatLabel, MatSuffix, MatError, MatHint } from '@angular/material/form-field'
import { MatCardModule } from '@angular/material/card'

library.add(faSave, faEdit)

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  imports: [MatCardModule, TranslateModule, MatFormFieldModule, MatLabel, MatInputModule, FormRoot, FormField, MatIconModule, MatSuffix, MatTooltip, MatError, MatHint, MatSlideToggle, PasswordStrengthComponent, PasswordStrengthInfoComponent, MatButtonModule]
})
export class ForgotPasswordComponent {
  private readonly userService = inject(UserService)
  private readonly translate = inject(TranslateService)

  private readonly initialModel = { email: '', code: '', password: '', repeatPassword: '' }
  public readonly forgotPasswordModel = signal({ ...this.initialModel })
  public readonly codeRequested = signal(false)
  public readonly busy = signal(false)
  public readonly error = signal<string | undefined>(undefined)
  public readonly confirmation = signal<string | undefined>(undefined)

  public readonly forgotPasswordForm = form(this.forgotPasswordModel, (s) => {
    required(s.email)
    email(s.email)
    disabled(s.code, { when: () => !this.codeRequested() })
    required(s.code)
    validate(s.code, ({ value }) => /^\d{8}$/.test(value()) ? undefined : { kind: 'invalidCode' })
    disabled(s.password, { when: () => !this.codeRequested() })
    required(s.password)
    minLength(s.password, 5)
    disabled(s.repeatPassword, { when: () => !this.codeRequested() })
    required(s.repeatPassword)
    validate(s.repeatPassword, ({ value, valueOf }) => {
      if (value() && value() !== valueOf(s.password)) return { kind: 'notSame' }
      return undefined
    })
  }, { submission: { action: () => this.changePassword() } })

  emailChanged () {
    this.codeRequested.set(false)
    this.forgotPasswordForm.code().reset('')
    this.confirmation.set(undefined)
    this.error.set(undefined)
  }

  async requestCode () {
    if (this.forgotPasswordForm.email().invalid() || this.busy()) return
    const email = this.forgotPasswordModel().email
    this.busy.set(true)
    this.error.set(undefined)
    this.confirmation.set(undefined)
    try {
      const response = await firstValueFrom(this.userService.requestPasswordReset(email))
      if (this.forgotPasswordModel().email === email) {
        this.codeRequested.set(true)
        this.confirmation.set(response.message)
      }
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Could not request a code. Please try again.')
    } finally {
      this.busy.set(false)
    }
  }

  private async changePassword () {
    if (this.busy()) return
    const { email, code, password, repeatPassword } = this.forgotPasswordModel()
    this.busy.set(true)
    try {
      await firstValueFrom(this.userService.resetPassword({ email, code, new: password, repeat: repeatPassword }))
      this.error.set(undefined)
      this.confirmation.set(await this.passwordChangedConfirmation())
      this.resetForm()
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.error)
      this.confirmation.set(undefined)
      this.resetErrorForm()
    } finally {
      this.busy.set(false)
    }
  }

  resetForm () {
    this.forgotPasswordForm().reset({ ...this.initialModel })
    this.codeRequested.set(false)
  }

  resetErrorForm () {
    this.forgotPasswordForm.email().reset()
    this.forgotPasswordForm.code().reset('')
    this.forgotPasswordForm.password().reset('')
    this.forgotPasswordForm.repeatPassword().reset('')
  }

  private async passwordChangedConfirmation (): Promise<string> {
    try {
      return await firstValueFrom(this.translate.get('PASSWORD_SUCCESSFULLY_CHANGED'))
    } catch (translationId) {
      return translationId as string
    }
  }
}
