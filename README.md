# Transfer Student Checker

A static web app for admissions staff. Enter a transferring student's visa dates, up to 5 COEs and the proposed course, and it returns:

- **Release required?** — National Code 2018, Standard 7 (first 6 months of the principal course)
- **Must apply from?** — Onshore / Offshore, under the Migration Amendment (Student Visa Reform) Regulations 2026
- **Summary** — a copy-ready note citing the provisions applied

No build step, no backend, no data stored. Everything runs in the browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Form and layout |
| `style.css` | Styles (light and dark) |
| `app.js` | Rules and summary text — edit here when the rules change |
| `netlify.toml` | Netlify config (publishes the repo root) |

## Put it on GitHub

1. Create a new repository on GitHub (e.g. `transfer-checker`), private is fine.
2. Upload these files: on the repo page choose **Add file → Upload files**, drag them in, and commit.
   Or from a terminal in this folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-account>/transfer-checker.git
   git push -u origin main
   ```

## Host it on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub**, and pick the repo.
2. Leave the build command empty and the publish directory as `.` (netlify.toml sets this).
3. Deploy. Every push to `main` redeploys automatically.

To restrict access to staff, turn on Netlify password protection or put it behind your SSO.

## How the rules work

**Release required**
- Principal course = the COE with the latest start date (last course in the package).
- Same provider as the proposed course → No (internal change).
- Principal course not started, or under 6 months completed → Yes.
- Otherwise → No.

**Must apply from**
- New visa needed if the proposed course ends after the visa end date, or the student is not on a primary 500 visa.
- Lodged before 2 Oct 2026 → old rules (Sch 13 cl. 16601).
- Primary 500 holder, not exempt → Offshore, and must be offshore at grant (1222(3)(aa), 500.411(1)).
- Primary 500 holder in an exempt class (Defence, Foreign Affairs, school, instrument) → Onshore (1222(3A)).
- Secondary 500 or other substantive visa → Onshore, to be confirmed against 1222(4A) and 1222(5)(e).
- No substantive visa → Onshore only via the ART set-aside pathway within 28 days, once (1222(4B)); otherwise Offshore.

Operational guide only — not migration or legal advice.
