# Vector

**Vector** is a personal finance web platform that brings your bank accounts, credit cards, cash and other funds together in one place. It makes it fast to log day-to-day transactions, categorizes them so you can see your spending habits and your real balance, and tracks savings goals and debt payoff with interactive progress.

The goal is to go beyond a class assignment and build a practical, secure and scalable tool for everyday use, with an asynchronous, responsive interface that avoids unnecessary page reloads.

> Academic project for **Desarrollo de Aplicaciones y Servicios Web**, ITESO.

---

## Features

### Authentication & user management
- Sign up with name, email and password, validated on both client and server
- Log in and log out. Logout clears the session token and resets the UI without a page reload.
- View and update your profile, with changes reflected instantly in the UI
- Change your password (requires your current password)
- Session persists across reloads while the token is valid; when it expires you're redirected to login
- Delete your account, which also deletes all of its data (cascade)

### Financial accounts
- Create accounts with a name, type (cash, debit, savings, credit…), starting balance, and color/icon
- Credit cards add a credit limit, statement closing day and payment due date
- List accounts with their projected balance. For credit cards, this includes limit usage (%) and outstanding debt.
- Edit or delete accounts. Deleting an account that has transactions requires confirmation.

### Transactions
- Log income and expenses with amount, account, category, date and a note
- Transfer between your own accounts, which updates both balances at the same time
- Interactive transaction history with full details for each entry
- Edit or delete transactions. Account and goal balances are recalculated automatically.

### Goals: savings & debt
- Create savings goals (e.g. "Emergency fund") with a target amount, or debt goals with a starting balance
- Track progress as a percentage. Savings grow toward the target; debt goes down toward zero.
- Link a transaction or transfer to a goal as a contribution
- Edit, complete or cancel goals
- Get a celebration notification when a goal is reached

### Search, filters & pagination
- Real-time text search by description
- Combinable filters: date range, transaction type, source/destination account, category
- Sort by date, amount or name
- Paginated results (10 or 20 per page)

### Dashboard
- Real-time net balance across all accounts
- Income and expenses for the current month
- Spending breakdown by category (chart)
- Summary widgets for accounts and priority goals
- Alert when a credit card payment is due in 5 days or less

### Extras
- Custom income/expense categories (name, color, icon) alongside the default ones
- Light/dark mode, saved in the browser
- Confirmation modal before any destructive action
- Loading indicators, modals and toast alerts
- All create, edit, delete and view changes happen asynchronously (Fetch/AJAX), with no page reloads

---

## Screens

| # | Screen | Description |
|---|--------|-------------|
| 1 | Landing & sign up | Public landing page with a registration form/modal |
| 2 | Login | Login form and password recovery |
| 3 | Dashboard | Net balance, monthly summary, category charts, quick-add transaction modal |
| 4 | Transaction history | Searchable, filterable, sortable, paginated table with detail/edit/delete modal |
| 5 | Accounts | Account cards with balances and credit details, create/edit and transfer modals |
| 6 | Goals | Savings and debt goals with progress bars |
| 7 | Profile | View and update user info, change password, delete account |

---

## Out of scope

- Receipt scanning (OCR)
- Direct bank sync (Open Banking)
- Multiple currencies
- Moving real money

---

## Tech stack

- **Backend:** Node.js
- **Database:** MongoDB
- **Frontend:** HTML, CSS, JavaScript, Bootstrap

Setup and run instructions will be added in the frontend and backend READMEs.

---

## Team

- Miguel Ángel Ureña Rodríguez
- Valeria Cervantes Magallon
- Ethan Gabriel Orozco Madrid
