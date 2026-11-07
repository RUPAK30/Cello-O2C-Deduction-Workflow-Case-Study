/* Single source for rules, reason codes, stories and UAT: used by the page, the BRD and the exports. */
window.O2C = {
  RULES: [
    ["BR-1", "Identify", "Each distributor pays into its own virtual account number, so every receipt is tagged to the payer. An unreferenced partial payment settles the oldest open invoice first."],
    ["BR-2", "Split", "Track each distributor's running purchase total. TDS u/s 194Q applies when the buyer's previous-year turnover exceeds ₹10 crore and its purchases from the seller exceed ₹50 lakh in the year, at 0.1% of the amount above ₹50 lakh; once crossed, a TDS line is expected and matched to Form 26AS. GST-TDS (2%) applies only to notified buyers such as government bodies."],
    ["BR-3", "Validate", "Auto-accept a claim only if its evidence is present, it is within budget, it is under the Finance-set tolerance and it is within 2× the distributor's own norm. Everything else goes to a person."],
    ["BR-4", "Validate", "Unexplained gaps are never written off by a rule."],
    ["BR-5", "Control", "Above the approval threshold (illustratively ₹10,000) a second person approves; self-approval is blocked."],
    ["BR-6", "Prevent", "Valid claims are settled as credit notes. Credit notes are reported to the IRP within 30 days (e-invoicing, turnover ₹10 Cr+, from 1 April 2025) and GST credit notes are issued no later than 30 November of the following year (Section 34)."],
    ["BR-7", "Credit", "When disputed deductions exceed a threshold or age past a limit, the next order is flagged for credit review."],
    ["BR-8", "Control", "A scheme deduction with no approved scheme budget behind it (a verbal promise) goes to the Regional sales head within 3 days: charge it to the region's trade budget, or reject and recover from the distributor. It never sits in unallocated receivables."],
    ["BR-9", "Post", "Every movement of money posts a balanced voucher: receipts, TDS, credit notes and suspense. GST is reduced only through a GST credit note issued inside the s.34 window; after it closes, the claim is settled by a financial credit note and the GST cost is shown, not hidden."],
    ["BR-10", "Match", "A scheme deduction that quotes a Ten Today approval is matched to it and split at the cap, comparing like with like: a pre-tax cap clears up to cap + 18% GST. Only the excess goes back to the rep who made the promise. If the invoice falls after the approval's window, nothing clears: it is a lapsed approval, routed to the approver who signed it."],
    ["BR-11", "Feed back", "Before the next discount, Ten Today's approver sees two numbers for the distributor: claims waiting on Finance (never block a deal) and rep-owned or unverified claims older than 15 days (block the approval until proof or recovery)."]
  ],
  CODES: [
    ["Scheme claim", "Scheme circular or agreement, plus eligibility", "Within that distributor's scheme budget"],
    ["Damage / shortage", "Proof of delivery or damage report", "Flagged if more than 2× the distributor's own trailing average"],
    ["Rate difference", "Price list or contract in force on the invoice date", "Matches that price"],
    ["Returns", "Goods received note", "Matches the quantity received"],
    ["No evidence", "None", "Never; it becomes a dispute with an owner and an SLA"]
  ],
  STORIES: [
    ["US-1", "Identify payer", "As an AR executive, I want each receipt tagged to its distributor, so I never identify payers from bank narrations.", "Given a receipt on a distributor's virtual account with no reference, when it is imported, then it is applied to that distributor's oldest open invoice and logged."],
    ["US-2", "Expect TDS", "As an AR lead, I want TDS separated from deductions, so tax credits are not chased as losses.", "Given a distributor past the ₹50 lakh purchase threshold, when a receipt is short by the expected 0.1%, then the amount is classified as TDS and queued for the Form 26AS match."],
    ["US-3", "Auto-accept evidenced claims", "As a Finance Controller, I want evidenced, in-budget claims under tolerance accepted automatically, so people work only exceptions.", "Given a scheme claim with its circular attached, within budget, under tolerance and within 2x the distributor's norm, when it is validated, then it is accepted and the rule that accepted it is recorded."],
    ["US-4", "Route disputes", "As an AR lead, I want every unevidenced deduction to open a case with a reason code, owner and SLA, so nothing waits for month-end.", "Given a damage claim without proof of delivery, when it is classified, then a dispute opens, is assigned to the area sales manager, the owner is notified and the SLA timer starts."],
    ["US-5", "Maker-checker", "As a Finance Controller, I want deductions above the threshold approved by a second person, so write-offs are controlled.", "Given a case above ₹10,000, when its maker approves it, then the action is blocked, logged and routed to a checker."],
    ["US-6", "Settle upfront", "As a Sales manager, I want valid scheme benefits issued as credit notes before payment, so the distributor pays in full.", "Given an approved claim, when the credit note is issued, then a 30-day IRP reporting deadline is set and alerts at day 20."],
    ["US-7", "Credit flag", "As a credit controller, I want ageing disputes to flag the next order, so exposure doesn't compound.", "Given disputed deductions above the threshold or age limit, when the distributor places an order, then the order is flagged for review, not blocked."],
    ["US-8", "GST credit-note window", "As a Finance Controller, I want claims on older invoices flagged before the s.34 deadline, so GST is not lost by default.", "Given an open claim on a FY 2025-26 invoice, when it is approved by 30 November 2026, then a GST credit note is issued; when approved after, then a financial credit note is issued and the GST cost is reported."],
    ["US-9", "Balanced postings", "As a Finance Controller, I want every receipt, deduction and credit note posted as a balanced voucher, so the desk ties to the ledger.", "Given any action that moves money, when it completes, then a voucher posts with equal debits and credits, exportable as a journal file."],
    ["US-10", "Approved promise", "As an AR executive, I want a deduction quoting a sales approval cleared against it, so only the unapproved excess becomes work.", "Given an approval with a cap and an invoice window, when a deduction quotes it, then the amount within the cap clears by rule, the excess goes to the rep, and an invoice outside the window clears nothing."],
    ["US-11", "Fault-based block", "As a sales approver, I want to see whose action a distributor's open deductions wait on, so I block a discount only for the rep's unbacked claims.", "Given open claims, when I review a new discount, then Finance-pending amounts are shown but do not block; rep-owned or unverified claims older than 15 days block."]
  ],
  UAT: [
    ["UAT-01", "BR-1, US-1", "Unreferenced receipt on a virtual account", "Tagged to the distributor; applied to the oldest open invoice; logged"],
    ["UAT-02", "BR-2, US-2", "Receipt short by 0.1% after the ₹50 lakh threshold", "Classified as TDS; queued for Form 26AS match"],
    ["UAT-03", "BR-3, US-3", "Evidenced scheme claim within budget and tolerance", "Auto-accepted; accepting rule recorded"],
    ["UAT-04", "US-4", "Close a case without a reason code (negative)", "Blocked and logged"],
    ["UAT-05", "BR-3", "Accept a damage claim without proof of delivery (negative)", "Blocked; claim stays a dispute"],
    ["UAT-06", "BR-5, US-5", "Maker approves own case above ₹10,000 (negative)", "Blocked, logged, routed to a checker"],
    ["UAT-07", "BR-4", "Auto write-off of an unexplained gap (negative)", "Blocked; case stays open with its owner"],
    ["UAT-08", "US-4", "Dispute passes its SLA", "Escalated to the AR lead; history kept"],
    ["UAT-09", "BR-6, US-6", "Credit note issued", "30-day IRP deadline set; alert at day 20"],
    ["UAT-10", "BR-7, US-7", "Disputes above ₹20,000 or older than 45 days, new order placed", "Order flagged for credit review, not blocked"],
    ["UAT-11", "BR-8", "Scheme deduction with no approved scheme budget", "Routed to the Regional sales head; charged to the trade budget or recovered from the distributor"],
    ["UAT-12", "BR-6, US-8", "Claim on a FY 2025-26 invoice approved inside the s.34 window", "GST credit note; GST reduced; distributor reverses ITC"],
    ["UAT-13", "BR-6, US-8", "Same claim approved after 30 November", "Financial credit note only; GST cost reported"],
    ["UAT-14", "BR-9, US-9", "Full day of receipts and approvals", "Every voucher balances; receivables credited never exceed invoices"],
    ["UAT-15", "BR-1, BR-9", "Receipt on an unknown virtual account (negative)", "Parked in suspense; applied to no invoice"],
    ["UAT-16", "BR-10, US-10", "₹9,440 deducted against a ₹8,000 pre-tax approval", "Fully cleared: ₹8,000 + 18% GST, GST credit note, nothing sent to the rep"],
    ["UAT-17", "BR-10, US-10", "₹9,440 deducted against an ₹8,000 tax-inclusive approval", "Split at the cap: ₹8,000 cleared; ₹1,440 to the rep"],
    ["UAT-18", "BR-10, US-10", "Approval used on an invoice after its window (negative)", "Lapsed approval: nothing cleared; routed to the approver"],
    ["UAT-19", "BR-11, US-11", "Finance backlog vs rep-owned excess over 15 days", "Only the rep-owned excess blocks, and only after 15 days"]
  ],
  render: function (doc) {
    var o = this, fill = function (id, html) { var el = doc.getElementById(id); if (el) el.innerHTML = html; };
    fill("rules-body", o.RULES.map(function (r) { return "<tr id='" + r[0] + "'><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td></tr>"; }).join(""));
    fill("codes-body", o.CODES.map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td></tr>"; }).join(""));
    fill("stories", o.STORIES.map(function (s) { return "<li id='" + s[0] + "'><b>" + s[0] + " " + s[1] + ".</b> " + s[2] + " <i>" + s[3] + "</i></li>"; }).join(""));
    fill("uat", o.UAT.map(function (u) { return "<tr id='" + u[0] + "'><td class='id'>" + u[0] + "</td><td>" + u[1] + "</td><td>" + u[2] + "</td><td>" + u[3] + "</td></tr>"; }).join(""));
  }
};
