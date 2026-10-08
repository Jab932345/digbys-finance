# Digby's books

The business accounts: invoicing, bills, the Starling bank feed, VAT, payroll journals, staff records, mileage and an export pack for the accountant. Every line carries a division (Events, Pies, Butchery, Hire).

Runs as the sole trader from 6 April 2026. On incorporation, switch to the limited company in Settings; the same books carry on.

| File | What it is |
|---|---|
| `index.html` | The app. Sign in with the Digby's staff-app login. Built from `src/`. |
| `api/bank.js` | Reads the Starling feed for signed-in users. Needs `STARLING_TOKEN`. |
| `sql/digbys-co-ltd-schema.sql` | One-off database setup. The app shows it with a copy button if it hasn't been run. |
| `sole-trader.html`, `api/starling.js` | The previous finance app, kept until everything is checked in the new one. |

Edit `src/`, then `python3 build.py` and `node tests/engine.test.js`.
