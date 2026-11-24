/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { TranslateModule } from '@ngx-translate/core'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { type ComponentFixture, TestBed } from '@angular/core/testing'
import { ForgotPasswordComponent } from './forgot-password.component'

import { MatButtonModule } from '@angular/material/button'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatCardModule } from '@angular/material/card'
import { UserService } from '../../app/Services/user.service'
import { of, throwError } from 'rxjs'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatIconModule } from '@angular/material/icon'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'

describe('ForgotPasswordComponent', () => {
    let component: ForgotPasswordComponent
    let fixture: ComponentFixture<ForgotPasswordComponent>
    let userService: any

    const setModel = (values: { email?: string, code?: string, password?: string, repeatPassword?: string }) => {
        component.forgotPasswordModel.update((model) => ({ ...model, ...values }))
    }

    const submitForm = async () => {
        const form = (fixture.nativeElement as HTMLElement).querySelector('#forgot-password-form') as HTMLFormElement
        form.dispatchEvent(new Event('submit'))
        await fixture.whenStable()
        fixture.detectChanges()
    }

    beforeEach(async () => {
        userService = {
            resetPassword: vi.fn().mockName("UserService.resetPassword"),
            requestPasswordReset: vi.fn().mockReturnValue(of({ message: 'Check your email.' }))
        }
        userService.resetPassword.mockReturnValue(of({}))

        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(),
                MatCardModule,
                MatFormFieldModule,
                MatInputModule,
                MatButtonModule,
                MatTooltipModule,
                MatIconModule,
                MatSlideToggleModule,
                ForgotPasswordComponent],
            providers: [
                { provide: UserService, useValue: userService },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        })
            .compileComponents()
    })

    beforeEach(() => {
        fixture = TestBed.createComponent(ForgotPasswordComponent)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('should create', () => {
        expect(component).toBeTruthy()
    })

    it('should be compulsory to fill the email field', () => {
        setModel({ email: '' })
        expect(component.forgotPasswordForm.email().valid()).toBeFalsy()
    })

    it('should hold a valid email in the email field', () => {
        setModel({ email: 'aa' })
        expect(component.forgotPasswordForm.email().valid()).toBeFalsy()
        setModel({ email: 'user@test.test' })
        expect(component.forgotPasswordForm.email().valid()).toBe(true)
    })

    it('should require an eight-digit emailed code', () => {
        component.codeRequested.set(true)
        setModel({ code: '' })
        expect(component.forgotPasswordForm.code().valid()).toBeFalsy()
        setModel({ code: '12345678' })
        expect(component.forgotPasswordForm.code().valid()).toBe(true)
    })

    it('should disable code and password fields until a code is requested', () => {
        expect(component.forgotPasswordForm.code().disabled()).toBe(true)
        expect(component.forgotPasswordForm.password().disabled()).toBe(true)
        expect(component.forgotPasswordForm.repeatPassword().disabled()).toBe(true)
        component.codeRequested.set(true)
        expect(component.forgotPasswordForm.code().disabled()).toBe(false)
        expect(component.forgotPasswordForm.password().disabled()).toBe(false)
        expect(component.forgotPasswordForm.repeatPassword().disabled()).toBe(false)
    })

    it('should be compulsory to fill the password field', () => {
        component.codeRequested.set(true)
        setModel({ password: '' })
        expect(component.forgotPasswordForm.password().valid()).toBeFalsy()
    })

    it('should have a password length of at least five characters', () => {
        component.codeRequested.set(true)
        setModel({ password: 'aaa' })
        expect(component.forgotPasswordForm.password().valid()).toBeFalsy()
        setModel({ password: 'aaaaa' })
        expect(component.forgotPasswordForm.password().valid()).toBe(true)
    })

    it('should allow password length of more than twenty characters', () => {
        component.codeRequested.set(true)
        setModel({ password: 'aaaaaaaaaaaaaaaaaaaaa' })
        expect(component.forgotPasswordForm.password().valid()).toBe(true)
    })

    it('should be compulsory to repeat the password', () => {
        component.codeRequested.set(true)
        setModel({ password: 'a', repeatPassword: '' })
        expect(component.forgotPasswordForm.repeatPassword().valid()).toBeFalsy()
        setModel({ repeatPassword: 'a' })
        expect(component.forgotPasswordForm.repeatPassword().valid()).toBe(true)
    })

    it('should reject a repeated password that does not match the password', () => {
        component.codeRequested.set(true)
        setModel({ password: 'password', repeatPassword: 'different' })
        expect(component.forgotPasswordForm.repeatPassword().getError('notSame')).toBeDefined()
    })

    it('should reset form on calling resetForm', () => {
        component.codeRequested.set(true)
        setModel({ email: 'email', code: '12345678', password: 'password', repeatPassword: 'password' })
        component.forgotPasswordForm.email().markAsDirty()
        component.forgotPasswordForm.email().markAsTouched()
        component.resetForm()
        expect(component.codeRequested()).toBe(false)
        expect(component.forgotPasswordForm.password().disabled()).toBe(true)
        expect(component.forgotPasswordForm.email().value()).toBe('')
        expect(component.forgotPasswordForm.email().dirty()).toBe(false)
        expect(component.forgotPasswordForm.email().touched()).toBe(false)
        expect(component.forgotPasswordForm.code().value()).toBe('')
        expect(component.forgotPasswordForm.password().value()).toBe('')
        expect(component.forgotPasswordForm.repeatPassword().value()).toBe('')
    })

    it('should clear form and show confirmation after changing password', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        vi.spyOn(component, 'resetForm')
        await submitForm()
        expect(component.confirmation()).toBeDefined()
        expect(component.resetForm).toHaveBeenCalled()
    })

    it('should clear form and gracefully handle error on password change', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        userService.resetPassword.mockReturnValue(throwError(() => ({ error: 'Error' })))
        vi.spyOn(component, 'resetErrorForm')
        await submitForm()
        expect(component.error()).toBe('Error')
        expect(component.resetErrorForm).toHaveBeenCalled()
        expect(component.forgotPasswordForm.email().value()).toBe('user@test.test')
        expect(component.forgotPasswordForm.password().value()).toBe('')
    })

    it('should change the password when the form is submitted', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        fixture.detectChanges()
        const resetButton: HTMLButtonElement = fixture.nativeElement.querySelector('#resetButton')
        expect(resetButton.disabled).toBe(false)
        await submitForm()
        expect(userService.resetPassword).toHaveBeenCalledWith({
            email: 'user@test.test',
            code: '12345678',
            new: 'password',
            repeat: 'password'
        })
        expect(component.confirmation()).toBeDefined()
    })

    it('should show the confirmation once the password was changed and hide it again on further edits', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        await submitForm()
        const confirmation: HTMLElement = fixture.nativeElement.querySelector('.confirmation')
        expect(confirmation).toBeTruthy()
        expect(confirmation.getAttribute('role')).toBe('status')

        component.emailChanged()
        fixture.detectChanges()
        expect(fixture.nativeElement.querySelector('.confirmation')).toBeNull()
    })

    it('should return the form to its initial state after the password was changed', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        fixture.detectChanges()
        await submitForm()
        expect(component.confirmation()).toBeDefined()
        expect(component.codeRequested()).toBe(false)
        expect((fixture.nativeElement.querySelector('#email') as HTMLInputElement).disabled).toBe(false)
        expect((fixture.nativeElement.querySelector('#resetCode') as HTMLInputElement).disabled).toBe(true)
        expect((fixture.nativeElement.querySelector('#newPassword') as HTMLInputElement).disabled).toBe(true)
        expect((fixture.nativeElement.querySelector('#newPasswordRepeat') as HTMLInputElement).disabled).toBe(true)
        expect(fixture.nativeElement.querySelectorAll('mat-error').length).toBe(0)
    })

    it('should show the mandatory error when an empty form is submitted', async () => {
        fixture.detectChanges()
        await submitForm()
        const errors = Array.from(fixture.nativeElement.querySelectorAll('mat-error')).map((e: any) => e.textContent.trim())
        expect(errors).toEqual(['MANDATORY_EMAIL'])
    })

    it('should show the error and hide the confirmation when the password change failed', async () => {
        component.codeRequested.set(true)
        setModel({ email: 'user@test.test', code: '12345678', password: 'password', repeatPassword: 'password' })
        userService.resetPassword.mockReturnValue(throwError(() => ({ error: 'Error' })))
        await submitForm()
        const error: HTMLElement = fixture.nativeElement.querySelector('.error')
        expect(error).toBeTruthy()
        expect(error.getAttribute('role')).toBe('alert')
        expect(error.textContent).toContain('Error')
        expect(fixture.nativeElement.querySelector('.confirmation')).toBeNull()
    })

    it('should request an emailed code and enable the recovery fields', async () => {
        setModel({ email: 'known@user.test' })
        await component.requestCode()
        fixture.detectChanges()
        expect(userService.requestPasswordReset).toHaveBeenCalledWith('known@user.test')
        expect(component.codeRequested()).toBe(true)
        expect(component.confirmation()).toBe('Check your email.')
        expect(component.busy()).toBe(false)
        expect(component.forgotPasswordForm.code().disabled()).toBe(false)
    })

    it('should not request a code for an invalid email address', async () => {
        setModel({ email: 'invalid' })
        await component.requestCode()
        expect(userService.requestPasswordReset).not.toHaveBeenCalled()
    })

    it('should keep recovery disabled and show request failures', async () => {
        setModel({ email: 'known@user.test' })
        userService.requestPasswordReset.mockReturnValue(throwError(() => ({ error: { message: 'Unavailable' } })))
        await component.requestCode()
        expect(component.error()).toBe('Unavailable')
        expect(component.codeRequested()).toBe(false)
        expect(component.busy()).toBe(false)
    })

    it('should invalidate the requested code when the email changes', () => {
        component.codeRequested.set(true)
        setModel({ email: 'known@user.test', code: '12345678' })
        component.confirmation.set('Check your email.')
        component.emailChanged()
        expect(component.codeRequested()).toBe(false)
        expect(component.forgotPasswordForm.code().value()).toBe('')
        expect(component.confirmation()).toBeUndefined()
        expect(component.forgotPasswordForm.password().disabled()).toBe(true)
    })

    it('should ignore a request response after the email changes', async () => {
        const { Subject } = await import('rxjs')
        const response = new Subject<{ message: string }>()
        userService.requestPasswordReset.mockReturnValue(response)
        setModel({ email: 'known@user.test' })
        const pending = component.requestCode()
        setModel({ email: 'other@user.test' })
        component.emailChanged()
        response.next({ message: 'Check your email.' })
        response.complete()
        await pending
        expect(component.codeRequested()).toBe(false)
        expect(component.confirmation()).toBeUndefined()
    })

    it('should reject codes that are not exactly eight digits', () => {
        component.codeRequested.set(true)
        for (const code of ['123', 'abcdefgh', '123456789']) {
            setModel({ code })
            expect(component.forgotPasswordForm.code().getError('invalidCode')).toBeDefined()
        }
    })
})
