# ![Juice Shop Logo](https://raw.githubusercontent.com/juice-shop/juice-shop/master/frontend/src/assets/public/images/JuiceShop_Logo_100px.png) OWASP Juice Shop

This repository contains our CS2413 course project based on OWASP Juice Shop,
an intentionally vulnerable web application for security training. Our project
focuses on strengthening login, password management, and account recovery.
Below are the security fixes applied and instructions for running the project
with a local test mailbox.

## Table of contents

- [Security fixes applied](#security-fixes-applied)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [1. Install the application](#1-install-the-application)
  - [2. Start Mailpit](#2-start-mailpit)
  - [3. Configure and start Juice Shop](#3-configure-and-start-juice-shop)
  - [4. Try password recovery](#4-try-password-recovery)
- [Licensing](#licensing)

## Security fixes applied

- Login uses bound SQL parameters to prevent SQL injection.
- Login is limited to five failed attempts per IP within five minutes.
- Proxy trust is disabled to prevent forwarded headers from controlling the client IP.
- Admin, support, and cloud-admin passwords use environment variables or randomly
  generated values. The testing admin account has been removed.
- Password changes require authentication and the correct current password.
- Password recovery uses emailed, eight-digit codes with a ten-minute expiry,
  single-use enforcement, and request and verification attempt limits.
- Password recovery invalidates existing sessions. Stale browser tokens do not
  prevent users from signing in again.

## Setup

### Prerequisites

- [Node.js 24 and npm](https://nodejs.org/en/download)
- [Git](https://git-scm.com/downloads)
- [Mailpit](https://mailpit.axllent.org/docs/install/), installed in step 2

The macOS commands below use Homebrew to install Mailpit. You can also download
a standalone macOS binary using the Mailpit installation guide.

### 1. Install the application

Clone the course repository, enter its folder, then install and build:

```bash
git clone https://github.com/Sietseq/juice-shop-cs2413-T4.git
cd juice-shop-cs2413-T4
npm install
npm run build
```

After pulling source changes, run `npm install` if dependencies changed, then
`npm run build`. The `npm start` command uses the compiled application.

### 2. Start Mailpit

Open a separate terminal for Mailpit and keep it running while using Juice Shop.

[Mailpit](https://mailpit.axllent.org/) captures the application's email locally.
Follow the [official installation guide](https://mailpit.axllent.org/docs/install/)
for your operating system.

**Windows (PowerShell):** Download and extract the Windows archive from the
[Mailpit releases](https://github.com/axllent/mailpit/releases), open PowerShell
in the extracted folder, and run:

```powershell
.\mailpit.exe --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
```

**Linux:** Download the Linux archive matching your architecture (`amd64` for
x86-64 or `arm64` for ARM64) from the releases page. Extract it, open a terminal
in the extracted folder, and run:

```bash
./mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
```

**macOS:** Install Mailpit with Homebrew and start it:

```bash
brew install mailpit
mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
```

Keep Mailpit running. Its web inbox is at <http://127.0.0.1:8025> and its SMTP
server listens on `127.0.0.1:1025`. No mailbox account or SMTP login is needed.

### 3. Configure and start Juice Shop

Return to the terminal in the cloned `juice-shop-cs2413-T4` folder. Set the SMTP
variables before starting the application:

**Windows (PowerShell):**

```powershell
$env:SMTP_HOST = '127.0.0.1'
$env:SMTP_PORT = '1025'
$env:SMTP_FROM = 'no-reply@juice-shop.local'
$env:PASSWORD_RESET_HMAC_KEY = node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
Remove-Item Env:SMTP_USER, Env:SMTP_PASSWORD -ErrorAction SilentlyContinue
npm start
```

**Linux and macOS (Bash or Zsh):**

```bash
export SMTP_HOST='127.0.0.1'
export SMTP_PORT='1025'
export SMTP_FROM='no-reply@juice-shop.local'
export PASSWORD_RESET_HMAC_KEY="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
unset SMTP_USER SMTP_PASSWORD
npm start
```

These environment variables apply to the current terminal and processes started
from it. Set them again when starting from a new terminal. Keep the generated
HMAC key private.

### 4. Try password recovery

1. Open <http://localhost:3000> and register a test account, for example
   `student@example.test`.
2. On the login page, choose **Forgot your password?**, enter the registered
   email address, and select **Send code**.
3. Open <http://127.0.0.1:8025> and read the password reset email.
4. Enter its eight-digit code and a new password in Juice Shop. Codes expire
   after ten minutes and can only be used once.
5. Sign in with the new password. Existing sessions are invalidated by the reset.

Mailpit captures messages for test addresses in its local inbox instead of
delivering them to a real email account. Stop Juice Shop and Mailpit with
`Ctrl+C` in their respective terminals when finished.

## Licensing

[![license](https://img.shields.io/github/license/juice-shop/juice-shop.svg)](LICENSE)

This program is free software: you can redistribute it and/or modify it under the terms of the [MIT license](LICENSE).
OWASP Juice Shop and any contributions are Copyright © by Bjoern Kimminich & the OWASP Juice Shop contributors
2014-2026.

![Juice Shop Logo](https://raw.githubusercontent.com/juice-shop/juice-shop/master/frontend/src/assets/public/images/JuiceShop_Logo_400px.png)
