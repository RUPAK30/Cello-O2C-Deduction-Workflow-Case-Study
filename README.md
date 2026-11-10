# Every Rupee — Canonical Specification & Quote-to-Cash Case Study

**A discount promised in Sales gets paid for in Finance. Follow one rupee from the sales approval in Ten Today all the way to closed, balanced books—backed by 16 business rules and 31 executable browser tests.**

[![Quote-to-Cash Route](https://img.shields.io/badge/Canonical_Spec-everyrupee--o2c.vercel.app-0F2742?style=flat-square)](https://everyrupee-o2c.vercel.app/)
[![Interactive Product App](https://img.shields.io/badge/Interactive_Product_App-every--rupee--gets--owner.lovable.app-C2410C?style=flat-square)](https://every-rupee-gets-owner.lovable.app/)
[![Brand Desk UAT](https://img.shields.io/badge/Brand_Desk-11_Rules_·_19%2F19_UAT_Passing-0F766E?style=flat-square)](https://everyrupee-o2c.vercel.app/desk.html?uat=1)
[![Lender Desk UAT](https://img.shields.io/badge/Lender_Desk-5_Rules_·_12%2F12_UAT_Passing-0F766E?style=flat-square)](https://everyrupee-o2c.vercel.app/lender.html)

Built by **Rupak Ghanpathi** ([Portfolio](https://rupak-lemon.vercel.app) · [LinkedIn](https://www.linkedin.com/in/rupak-ghanpathi) · `rupakr2g@gmail.com`) — Business Analyst (2.5 yrs at HDFC Bank across retail lending, agri-finance, maker-checker controls, and SOX audit support).

[![Every Rupee Preview](preview.png)](https://everyrupee-o2c.vercel.app/)

---

## Two Repositories, One System

| Repository | Live URL | Role in the Architecture |
| :--- | :--- | :--- |
| **Canonical Spec & Case Study** *(this repo)* | [`everyrupee-o2c.vercel.app`](https://everyrupee-o2c.vercel.app/) | The complete business analysis and executable specification: interactive **Quote-to-Cash Route** (`/`), **Case Study** (`/case-study.html`), **Brand O2C Desk** (`/desk.html` — 11 rules, 19 UAT tests), **Lender NACH Desk** (`/lender.html` — 5 rules, 12 UAT tests), **BRD**, and **Sources**. |
| **Interactive Full-Stack Product** ([`RUPAK30/every-rupee-gets-owner`](https://github.com/RUPAK30/every-rupee-gets-owner)) | [`every-rupee-gets-owner.lovable.app`](https://every-rupee-gets-owner.lovable.app/) | TanStack Start + TypeScript + Postgres application enforcing the same invariants in integer paise, with SHA-256 hash-chained case logs, private saved workspaces, and 27 Vitest unit/contract tests. |

---

## What `everyrupee-o2c.vercel.app` Presents

### 1. Front Door: Quote-to-Cash — One Rupee's Route ([`/`](https://everyrupee-o2c.vercel.app/))
Follows invoice **`INV-5031`** (**₹4,00,000** billed to *Krishna Marketing, Surat*; **₹3,90,221** received; **₹9,779** short: **₹339** TDS u/s 194Q + **₹9,440** quoting sales approval `APV-2026-041` from **[Ten Today](https://tentoday.vercel.app/)**) across three selectable outcomes, with dated timeline steps and expandable balanced double-entry journal vouchers (`RV-1001`, `JV-1002`, `CNV-1003`):

1. **Outcome 1 · Clean (`₹8,000 + GST` approved):** Pre-tax cap clears up to `₹8,000 + 18% GST = ₹9,440`. Settled same day by rule (`BR-10`), GST credit note `CN-201` posted and queued for 30-day IRP reporting (`BR-6`). **0 emails, 0 people after approval.**
2. **Outcome 2 · Over-deducted (`₹8,000 incl. GST` approved):** Distributor still deducts ₹9,440. The engine clears the approved **₹8,000** by rule and routes only the **₹1,440** unapproved excess back to **Rahul** (Sales Rep) with a 3-day SLA (`BR-8` / `BR-10`).
3. **Outcome 3 · Expired (`Invoice after approval window`):** Nothing clears automatically. Routed to **Kavita** (Sales Manager who signed the approval) to re-authorize or recover.

Includes a **60-second interactive explainer tour** for non-finance readers and direct handoff links into both [Ten Today's cockpit](https://tentoday.vercel.app/cockpit.html?km=1) and [Every Rupee's desk](https://every-rupee-gets-owner.lovable.app/demo).

---

### 2. The Case Study & Traceability Proof ([`/case-study.html`](https://everyrupee-o2c.vercel.app/case-study.html))
- **Plain-language executive summary** + **60-second guided walkthrough**.
- **Public financial signal:** Cello World Ltd’s FY25–FY26 trade receivables grew **+14.0%** (`₹658 Cr → ₹750 Cr`) vs **+8.8%** revenue growth (`₹2,136 Cr → ₹2,324 Cr`)—approx. **₹34 Cr** above revenue-pace growth *(an external estimate that justifies discovery, not a diagnosis)*.
- **Commercial & statutory drivers:** Thin FMCG distributor margins (**₹3.5–5 per ₹100**, AICPDF Jun 2026) and the **30 November** CGST Section 34(2) deadline for recovering GST on post-sale discounts.
- **End-to-end traceability:** Every public signal traces to a risk, a user story (`US-1` to `US-11`), a business rule (`BR-1` to `BR-11`), a browser UAT assertion (`UAT-01` to `UAT-19`), and a live screen.

---

### 3. Brand O2C Reconciliation Desk ([`/desk.html`](https://everyrupee-o2c.vercel.app/desk.html))
An executable specification with **11 business rules (`BR-1` to `BR-11`)** and **19 in-browser UAT cases** ([run all 19 with one click at `/desk.html?uat=1`](https://everyrupee-o2c.vercel.app/desk.html?uat=1)):

| Rule | Layer | What the Engine Enforces |
| :--- | :--- | :--- |
| **`BR-1`** | Identify | Virtual account per distributor tags every receipt to its payer; unreferenced partial payments settle the oldest open invoice first. |
| **`BR-2`** | Split | Separates statutory **TDS u/s 194Q** (`0.1%` of taxable value above ₹50L turnover) from commercial deductions and queues it for Form 26AS matching. |
| **`BR-3`** | Validate | Auto-accepts a deduction **only** when evidence is attached, within the distributor's scheme budget, under Finance's tolerance, and within `2×` the distributor's trailing norm. |
| **`BR-4`** | Control | **Zero automated write-offs.** No rule can ever write money off; every gap ends in a credit note, a recovery, or a dual-authorized write-off. |
| **`BR-5`** | Control | **Maker-checker above ₹10,000.** Self-approval by the case owner is blocked and logged; requires a separate Finance Controller (`Vikram`). |
| **`BR-6`** | Prevent | Approved claims generate credit notes with a **30-day IRP reporting clock** (alerting on day 20). |
| **`BR-7`** | Prevent | Ageing or high-value disputed deductions **flag** the distributor's next order for credit review (overrides are logged by name). |
| **`BR-8`** | Escalate | Unbudgeted / verbal-promise scheme deductions escalate to the **Regional Sales Head** on a 3-day SLA: charge to regional trade budget or recover. |
| **`BR-9`** | Ledger | Every receipt, TDS split, and credit note posts a **balanced double-entry voucher** (`Debit = Credit`), exportable as a CSV journal, plus **CGST s.34** 30 November window checks. |
| **`BR-10`** | Handoff | Matches deductions quoting a **Ten Today** sales approval (`APV-*`), compares pre-tax vs GST-inclusive caps (`cap + 18% GST`), clears the covered portion by rule, and routes only the excess to the sales rep. |
| **`BR-11`** | Feedback | Sends two separate numbers back to Ten Today before the next discount approval: *Finance-pending claims* (never block a deal) vs *Rep-owned unverified claims > 15 days* (block new discounts until resolved). |

---

### 4. Lender EMI Bounce Desk ([`/lender.html`](https://everyrupee-o2c.vercel.app/lender.html))
Demonstrates that the exact same reconciliation state machine handles retail & MSME lending exceptions—with **5 lending rules (`LR-1` to `LR-5`)** and **12 in-browser UAT cases**:
- **`LR-1` & `LR-2` (NPCI NACH Return Classification):** Parses NACH return codes (`04` Insufficient balance, `61` Mandate cancelled, `06` Payment stopped by customer, `11` Account closed) and routes each to Collections, Mandate Ops, or Relationship Management with a fixed SLA.
- **`LR-3` (RBI Aug 2023 Fair Lending Penal Charges):** Enforces RBI’s mandate that bounce/late charges are levied as **standalone penal charges**—never capitalized into principal and never compounded with penal interest.
- **`LR-4` (SMA-0 / SMA-1 / SMA-2 Ageing):** Tracks Special Mention Account buckets (`1–30`, `31–60`, `61–90` days past due) per RBI IRACP norms.
- **`LR-5` (Maker-Checker on Waivers):** Blocks single-user waiver of penal charges above threshold and logs balanced journal vouchers.

---

### 5. Downloadable Artifacts & Sources
- **Business Requirements Document (BRD):** [`/brd.html`](https://everyrupee-o2c.vercel.app/brd.html) · [`Cello_O2C_BRD.pdf`](site/Cello_O2C_BRD.pdf)
- **Executive One-Pager:** [`/onepager.html`](https://everyrupee-o2c.vercel.app/onepager.html) · [`Cello_O2C_One_Pager.pdf`](site/Cello_O2C_One_Pager.pdf)
- **Case Study PDF & Deck:** [`Cello_O2C_Case_Study.pdf`](site/Cello_O2C_Case_Study.pdf) · [`Every_Rupee_Deck.pdf`](site/Every_Rupee_Deck.pdf)
- **Verified Public Sources & Caveats:** [`/sources.html`](https://everyrupee-o2c.vercel.app/sources.html)
- **Jira Stories & UAT Exports:** One-click CSV downloads inside `/desk.html` and `/case-study.html`.

---

## Key Product Trade-Offs

1. **Control over speed:** Strict reference matching, zero auto-write-offs (`BR-4`), and maker-checker above ₹10,000 (`BR-5`) intentionally trade away high "auto-clear" vanity percentages. In finance operations, a silent wrong write-off costs far more than a queued review.
2. **Fault-based sales blocking (`BR-11`):** Blocking a salesperson's next deal because Finance is slow causes reps to bypass the system. Only the rep's *own* unbacked promises older than 15 days freeze their next discount approval.
3. **Executable spec over static prose:** Every rule in `site/data.js` powers the BRD tables, the live desks (`desk.js`, `lender.js`), and the 31 automated UAT assertions (`19 Brand + 12 Lender`) so documentation and behavior can never drift apart.

---

## Repository Structure

```text
site/
├── index.html                 # Front door: Quote-to-Cash interactive timeline (INV-5031, 3 outcomes, balanced vouchers)
├── case-study.html            # Full narrative case study, plain-language tour, & signal-to-test traceability
├── desk.html & desk.js        # Brand O2C Reconciliation Desk (BR-1 to BR-11, 19 live UAT tests, CSV import/export)
├── lender.html & lender.js    # Lender NACH EMI Bounce Desk (LR-1 to LR-5, 12 live UAT tests, RBI penal rules, SMA buckets)
├── brd.html & onepager.html   # Print-styled HTML sources for the BRD and Executive One-Pager
├── sources.html               # Complete bibliography, public filing math, & honest caveats
├── data.js                    # Single source of truth for rules, reason codes, user stories, UAT cases, & RACI
├── product.css & styles.css   # Design system (screen + print layouts)
└── *.pdf                      # Generated PDFs (BRD, Case Study, One-Pager, Deck)
```

---

## Run Locally

Zero build step—pure static HTML, CSS, and vanilla JavaScript:

```bash
# Serve the site/ directory with any static file server
npx serve site
```

---

## Related Portfolio Artifacts by Rupak Ghanpathi

1. **[Every Rupee — Interactive Full-Stack App](https://every-rupee-gets-owner.lovable.app/)** ([`RUPAK30/every-rupee-gets-owner`](https://github.com/RUPAK30/every-rupee-gets-owner)) — TanStack Start + TypeScript + Postgres workspace with SHA-256 tamper-evident history and 27 Vitest tests.
2. **[Ten Today — B2B Sales Execution Module](https://tentoday.vercel.app/)** — Caps field sales reps at 10 ranked daily actions, enforces discount approval freezes, and issues the `APV-2026-041` approval record traced on this site.
3. **[Viraam — 2½-Minute Standup Close](https://lull-hr.vercel.app/)** — Calendar-anchored team meeting close with aggregate-only Friday reporting and 100 automated tests.

---

*Self-initiated case study built from Cello World Ltd's public filings (FY26 consolidated, FY25 restated) and public industry research · Internal processes and sample invoices are illustrative hypotheses, not confirmed company practice · Statutory tax and RBI rules are summarised from public sources as of Oct 2026 and do not constitute tax or legal advice.*
