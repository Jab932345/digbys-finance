# Digby's & Co Limited — books

Double-entry accounts for the limited company: invoicing, bills, Starling bank reconciliation, VAT returns, payroll journals, staff records, mileage, directors' loans and an export pack for the accountant. Every line carries a division (Events, Pies, Butchery, Hire).

| File | What it is |
|---|---|
| `index.html` | The live app. Sign-in required (Supabase Auth). Built from `src/`. |
| `demo.html` | The same app on a fictional company, for showing the accountant. No sign-in, no real data. |
| `sole-trader.html` | The previous sole-trader finance app, kept for the pre-incorporation records. |
| `api/starling.js` | Vercel function that reads the Starling feed. Needs `STARLING_TOKEN`; only signed-in members can call it. |
| `sql/digbys-co-ltd-schema.sql` | Run once in Supabase (project `jaajrllkozknilvmdezt`) before the live app is used. |

Edit `src/`, then `python3 build.py` and `node tests/engine.test.js`.
