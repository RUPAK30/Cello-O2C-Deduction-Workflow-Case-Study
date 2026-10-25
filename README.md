# Every rupee needs an owner: an order-to-cash case study

> Product case study by **Rupak Ghanpathi** · Order-to-cash · built from Cello World Ltd's public filings

When a distributor short-pays, the gap can bounce between AR, Sales and Finance over email before anyone closes it. This is the exception workflow I'd build to fix it.

**[Read the full case study (PDF)](Cello_O2C_Case_Study.pdf)** · **[One-pager (PDF)](Cello_O2C_One_Pager.pdf)**

[![One-pager preview](preview.png)](Cello_O2C_One_Pager.pdf)

## Why it matters
| Metric (FY25 to FY26) | Change |
| --- | --- |
| Trade receivables, ₹658 Cr to ₹750 Cr | **+14.0%** |
| Revenue, ₹2,136 Cr to ₹2,324 Cr | +8.8% |
| Receivables above revenue-pace growth | **approx. ₹34 Cr** (an estimate, not a measured backlog) |

## Proposed workflow
Auto-match (exact reference and amount) → case opens with a mandatory reason code → routed owner (Finance or Sales) with an SLA → maker-checker above threshold → approved outcome recorded in the ERP, with case history kept.

## Design decisions
1. **Control before speed**: fix ownership and approvals first.
2. **Strict matching at launch**: a lower auto-match rate in exchange for zero wrong matches.
3. **ERP stays the system of record**: a lightweight case layer (proposed: ServiceNow case management) records only approved outcomes.
4. **No automatic write-offs** above a Finance-set tolerance.

## Validate, measure, control
- **Validate first:** five stakeholder interviews and one month of receipts; stop if gaps are rare or close fast.
- **Pilot metrics:** auto-match rate by value · median days to resolve · value aged over 30 days · zero wrong matches.
- **Controls and UAT:** audit trail per case · self-approval blocked · SLA breach escalates · Given/When/Then test cases.

## Skills shown
Problem framing · stakeholder analysis · process design · user stories and acceptance criteria · controls and UAT · success metrics

---
*Self-initiated case study from Cello World Ltd's public filings (FY26 consolidated, FY25 restated). Internal processes are hypotheses, not confirmed company practice.*
