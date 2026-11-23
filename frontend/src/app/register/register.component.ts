/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { UserService } from '../Services/user.service'
import { FormField, email, form, maxLength, minLength, required, submit, validate } from '@angular/forms/signals'
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { library } from '@fortawesome/fontawesome-svg-core'
import { MatSnackBar } from '@angular/material/snack-bar'

import { faExclamationCircle, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { SnackBarHelperService } from '../Services/snack-bar-helper.service'
import { TranslateService, TranslateModule } from '@ngx-translate/core'
import { MatButtonModule } from '@angular/material/button'
import { PasswordStrengthComponent } from '../password-strength/password-strength.component'
import { PasswordStrengthInfoComponent } from '../password-strength-info/password-strength-info.component'
import { MatSlideToggle } from '@angular/material/slide-toggle'

import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule, MatLabel, MatError, MatHint } from '@angular/material/form-field'
import { MatCardModule } from '@angular/material/card'

import { MatIconModule } from '@angular/material/icon'
import { FormsModule } from '@angular/forms'
import { firstValueFrom } from 'rxjs'

library.add(faUserPlus, faExclamationCircle)

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [MatCardModule, TranslateModule, MatFormFieldModule, MatLabel, MatInputModule, FormsModule, FormField, MatError, MatHint, MatSlideToggle, PasswordStrengthComponent, PasswordStrengthInfoComponent, MatButtonModule, RouterLink, MatIconModule]
})
export class RegisterComponent {
  private readonly userService = inject(UserService)
  private readonly router = inject(Router)
  private readonly translateService = inject(TranslateService)
  private readonly snackBar = inject(MatSnackBar)
  private readonly snackBarHelperService = inject(SnackBarHelperService)

  public readonly registerModel = signal({
    email: '',
    password: '',
    repeatPassword: ''
  })

  public readonly registerForm = form(this.registerModel, (s) => {
    required(s.email)
    email(s.email)
    required(s.password)
    minLength(s.password, 5)
    maxLength(s.password, 40)
    required(s.repeatPassword)
    validate(s.repeatPassword, ({ value, valueOf }) => {
      if (value() && value() !== valueOf(s.password)) {
        return { kind: 'notSame' }
      }
      return undefined
    })
  })

  public error = signal<string | null>(null)

  save () {
    return submit(this.registerForm, async () => {
      const user = {
        email: this.registerModel().email,
        password: this.registerModel().password,
        passwordRepeat: this.registerModel().repeatPassword
      }

      try {
        await firstValueFrom(this.userService.save(user))
        await this.router.navigate(['/login'])
        this.snackBarHelperService.open('CONFIRM_REGISTER')
      } catch (err: any) {
        console.log(err)
        if (err.error?.errors) {
          const error = err.error.errors[0]
          if (error.message) {
            this.error.set(error.message[0].toUpperCase() + error.message.slice(1))
          } else {
            this.error.set(error)
          }
        }
      }
    })
  }
}
