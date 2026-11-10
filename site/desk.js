/* The deductions desk: a working prototype of the four-layer workflow.
   Everything runs in the browser and is saved on this device only. All data is synthetic. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { n = Math.round(n); return (n < 0 ? "−₹" : "₹") + Math.abs(n).toLocaleString("en-IN"); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var KEY = "o2c.desk.v1", QUIET = false;
  var TRACE = { "BR-1": "US-1 · UAT-01", "BR-2": "US-2 · UAT-02", "BR-3": "US-3 · UAT-03, 05", "BR-4": "US-4 · UAT-04, 07", "BR-5": "US-5 · UAT-06", "BR-6": "US-6 · UAT-09", "BR-7": "US-7 · UAT-10", "SLA": "US-4 · UAT-08" };

  var OWNERS = { "Scheme claim": "Sales ops", "Damage / shortage": "Area sales manager", "Rate difference": "Pricing", "Returns": "Warehouse", "Unexplained": "AR lead" };
  var USERS = { maker: "Asha (AR executive)", checker: "Vikram (Finance controller)" };
  /* Demo calendar: day 0 is 7 Nov 2026. Invoice dates are derived from their age. */
  var D0 = new Date(2026, 10, 7);
  function dateOf(day) { var d = new Date(D0); d.setDate(d.getDate() + day); return d; }
  function fmt(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function invDate(inv) { return dateOf(S.day - inv.age); }
  function fyStart(inv) { var d = invDate(inv); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }
  function fyLabel(inv) { var y = fyStart(inv); return "FY " + y + "-" + String(y + 1).slice(2); }
  /* CGST s.34(2): a GST credit note for a supply must be declared by 30 November after the financial year ends (or the annual return date, if earlier). */
  function cnDeadline(inv) { return new Date(fyStart(inv) + 1, 10, 30); }
  function windowLeft(inv) { return Math.round((cnDeadline(inv) - dateOf(S.day)) / 864e5); }
  var ACCT = { "Scheme claim": "Trade scheme discount", "Damage / shortage": "Transit damage claims", "Rate difference": "Price difference allowed", "Returns": "Sales returns" };
  function arName(d) { return "Trade receivables · " + d.name.split(",")[0]; }
  /* BR-9: every movement of money posts a balanced voucher */
  function post(type, ref, narr, lines) {
    S.seq.jv = (S.seq.jv || 0) + 1; S.journal = S.journal || [];
    var pre = type === "Receipt" ? "RV-" : type === "Credit note" ? "CNV-" : "JV-";
    S.journal.push({ id: pre + (1000 + S.seq.jv), day: S.day, type: type, ref: ref, narr: narr, lines: lines });
  }

  function seed() {
    return {
      day: 0, user: "maker", seq: { cs: 0, cn: 0, dn: 0 },
      settings: { tolerance: 10000, approval: 10000, sla: 7, creditAmt: 20000, creditAge: 45 },
      dists: [
        { va: "CELLOVA0001", name: "Shree Ganesh Traders, Pune", purchases: 7200000, schemeLeft: 40000, dmgNorm: 4000 },
        { va: "CELLOVA0002", name: "Mahalaxmi Distributors, Nagpur", purchases: 3100000, schemeLeft: 15000, dmgNorm: 3000 },
        { va: "CELLOVA0003", name: "Om Sai Agencies, Nashik", purchases: 9800000, schemeLeft: 60000, dmgNorm: 6000 },
        { va: "CELLOVA0004", name: "Balaji Enterprises, Indore", purchases: 2400000, schemeLeft: 0, dmgNorm: 2500 },
        { va: "CELLOVA0005", name: "Krishna Marketing, Surat", purchases: 5600000, schemeLeft: 25000, dmgNorm: 5000 }
      ],
      invoices: [
        { no: "INV-1041", va: "CELLOVA0001", taxable: 847458, total: 1000000, age: 34, open: 1000000 },
        { no: "INV-1042", va: "CELLOVA0001", taxable: 423729, total: 500000, age: 21, open: 500000 },
        { no: "INV-2015", va: "CELLOVA0002", taxable: 254237, total: 300000, age: 28, open: 300000 },
        { no: "INV-3007", va: "CELLOVA0003", taxable: 677966, total: 800000, age: 40, open: 800000 },
        { no: "INV-3011", va: "CELLOVA0003", taxable: 338983, total: 400000, age: 12, open: 400000 },
        { no: "INV-4002", va: "CELLOVA0004", taxable: 211864, total: 250000, age: 52, open: 250000 },
        { no: "INV-5020", va: "CELLOVA0005", taxable: 508475, total: 600000, age: 30, open: 600000 },
        { no: "INV-0988", va: "CELLOVA0005", taxable: 200000, total: 236000, age: 229, open: 236000 },
        { no: "INV-5031", va: "CELLOVA0005", taxable: 338983, total: 400000, age: 45, open: 400000 }
      ],
      /* Shared approval records from Ten Today (the sales to-do module): the promise, made before the invoice */
      approvals: [
        { id: "APV-2026-041", va: "CELLOVA0005", rep: "Rahul", approver: "Kavita (manager)", cap: 8000, taxIncl: false, windowEnd: "2026-09-30", used: 0 },
        { id: "APV-2026-042", va: "CELLOVA0005", rep: "Rahul", approver: "Kavita (manager)", cap: 8000, taxIncl: true, windowEnd: "2026-09-30", used: 0 }
      ],
      receipts: [], cases: [], notes: [], log: [], processed: [], journal: [], suspense: 0
    };
  }

  /* bank statement sample: date, virtual account, amount, reference, then the distributor's remittance claims */
  var SAMPLE = [
    "date,virtual_account,amount,reference,claim_type,claim_amount,evidence,approval_id",
    "day 0,CELLOVA0001,991153,INV-1041,Scheme claim,8000,yes",
    "day 0,CELLOVA0002,284000,INV-2015,Damage / shortage,11000,no",
    "day 0,CELLOVA0003,787322,,Scheme claim,12000,yes",
    "day 0,CELLOVA0004,238000,INV-4002,Scheme claim,12000,yes",
    "day 0,CELLOVA0005,594492,INV-5020,Rate difference,5000,yes",
    "day 0,CELLOVA0001,496576,INV-1042,,,",
    "day 0,CELLOVA0005,226360,INV-0988,Scheme claim,9440,no",
    "day 0,CELLOVA0005,390221,INV-5031,Scheme claim,9440,yes,APV-2026-041"
  ].join("\n");

  var S, BACKUP_LOG = null;
  function hashEntry(prev, day, who, rule, text) {
    var str = JSON.stringify({ prev: prev, day: day, who: who, rule: rule, text: text });
    var h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ("00000000" + (h1 >>> 0).toString(16)).slice(-8) + ("00000000" + (h2 >>> 0).toString(16)).slice(-8);
  }
  function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || !S.dists || !S.journal || !S.approvals) S = seed(); }
  function save() { if (QUIET) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function log(rule, text) {
    var prev = S.log.length ? (S.log[0].hash || "GENESIS") : "GENESIS";
    var h = hashEntry(prev, S.day, USERS[S.user], rule, text);
    S.log.unshift({ day: S.day, who: USERS[S.user], rule: rule, text: text, prevHash: prev, hash: h });
    if (!BACKUP_LOG) S.anchorRoot = h;
  }
  function dist(va) { return S.dists.filter(function (d) { return d.va === va; })[0]; }
  function invByNo(no) { return S.invoices.filter(function (i) { return i.no === no; })[0]; }

  /* ---------- the engine ---------- */
  function processReceipt(r) {
    var d = dist(r.va);
    if (!d) { log("BR-1", "Receipt " + inr(r.amount) + " on unknown account " + r.va + ": parked in suspense with the AR lead, not applied to any invoice."); S.receipts.push({ va: r.va, amount: r.amount, status: "Unidentified" }); S.suspense += r.amount; post("Receipt", r.va, "Unidentified receipt held in suspense", [["Bank (collections)", r.amount, 0], ["Suspense: unallocated receipts", 0, r.amount]]); return; }
    var inv = r.ref ? invByNo(r.ref) : null;
    if (!inv || inv.va !== d.va || inv.open <= 0) {
      inv = S.invoices.filter(function (i) { return i.va === d.va && i.open > 0; }).sort(function (a, b) { return b.age - a.age; })[0];
      if (!inv) { log("BR-1", d.name + ": " + inr(r.amount) + " received with no open invoice. Held as on-account credit."); S.suspense += r.amount; post("Receipt", d.va, "On-account receipt, no open invoice", [["Bank (collections)", r.amount, 0], ["Customer advances · " + d.name.split(",")[0], 0, r.amount]]); return; }
      log("BR-1", d.name + ": no usable reference, applied to oldest open invoice " + inv.no + ".");
    } else log("BR-1", "Receipt " + inr(r.amount) + " tagged to " + d.name + " by virtual account; applied to " + inv.no + ".");
    var gap = inv.open - r.amount;
    inv.open = 0;
    var rec = { va: d.va, inv: inv.no, amount: r.amount, gap: Math.max(0, gap), tds: 0, accepted: 0, disputed: 0 };
    S.receipts.push(rec);
    post("Receipt", inv.no, "Receipt from " + d.name, [["Bank (collections)", r.amount, 0], [arName(d), 0, r.amount]]);
    if (gap <= 0) { log("BR-1", inv.no + " paid in full."); return; }
    var left = gap;
    /* Split: 194Q TDS once purchases cross ₹50 lakh, 0.1% of taxable value */
    if (d.purchases > 5000000) {
      var tds = Math.round(inv.taxable * 0.001);
      if (tds <= left) { rec.tds = tds; left -= tds; log("BR-2", inv.no + ": " + inr(tds) + " classified as TDS u/s 194Q (0.1% of " + inr(inv.taxable) + "), queued for the Form 26AS match. Not a loss."); post("Journal", inv.no, "TDS u/s 194Q deducted by " + d.name, [["TDS receivable (194Q)", tds, 0], [arName(d), 0, tds]]); }
    }
    /* Validate the distributor's declared claim */
    if (r.claimType && r.claimAmt > 0 && left > 0) {
      var amt = Math.min(r.claimAmt, left); left -= amt;
      if (r.apv && r.claimType === "Scheme claim") matchApproval(d, inv, r.apv, amt, rec);
      else {
        var c = newCase(d, inv, r.claimType, amt, r.evidence);
        autoCheck(c, true);
        if (c.status === "Accepted") rec.accepted += amt; else rec.disputed += amt;
      }
    }
    /* Anything still unexplained becomes a dispute; never written off */
    if (left > 0) {
      var u = newCase(d, inv, "Unexplained", left, false);
      rec.disputed += left;
      log("BR-4", inv.no + ": " + inr(left) + " unexplained. Case " + u.id + " opened for " + u.owner + "; never written off by a rule.");
    }
    creditCheck(d);
  }

  /* BR-10: a scheme deduction quoting a Ten Today approval is matched to that approval, split at the cap.
     The cap is compared like for like: a pre-tax cap clears up to cap + 18% GST, because the credit note carries the GST. */
  function apvById(id) { return (S.approvals || []).filter(function (a) { return a.id === id; })[0]; }
  function capLimit(a) { return a.taxIncl ? a.cap : Math.round(a.cap * 1.18); }
  function matchApproval(d, inv, id, amt, rec) {
    var a = apvById(id), c;
    if (!a || a.va !== d.va) {
      c = newCase(d, inv, "Scheme claim", amt, false); c.apv = id; c.repOwned = true; c.reason = "quotes " + id + ", which is not an approval for this distributor";
      rec.disputed += amt; log("BR-10", c.id + " " + inr(amt) + " quotes " + id + ", but no such approval exists for " + d.name + ". Treated as an unbacked claim."); return;
    }
    var end = new Date(a.windowEnd + "T23:59:59");
    if (invDate(inv) > end) {
      c = newCase(d, inv, "Scheme claim", amt, false); c.apv = a.id; c.lapsed = true; c.repOwned = true; c.owner = a.approver; c.due = S.day + 3;
      c.reason = "lapsed approval used: " + inv.no + " is dated " + fmt(invDate(inv)) + ", " + a.id + " covered invoices up to " + fmt(end);
      rec.disputed += amt;
      log("BR-10", c.id + " " + inr(amt) + ": lapsed approval used. " + inv.no + " (" + fmt(invDate(inv)) + ") falls after " + a.id + "'s window (" + fmt(end) + "). Routed to " + a.approver + ", who signed it, with a 3-day SLA."); return;
    }
    var m = Math.max(0, Math.min(amt, capLimit(a) - a.used)), x = amt - m;
    if (m > 0) {
      c = newCase(d, inv, "Scheme claim", m, true); c.apv = a.id; c.status = "Accepted"; c.closedBy = "Rule BR-10 (" + a.id + ")"; a.used += m;
      issueCN(c); rec.accepted += m;
      log("BR-10", c.id + " " + inr(m) + " matched to " + a.id + " (cap " + inr(a.cap) + (a.taxIncl ? " incl. GST" : " + GST = " + inr(capLimit(a))) + ", approved by " + a.approver + " for " + a.rep + "). Cleared by rule.");
    }
    if (x > 0) {
      c = newCase(d, inv, "Scheme claim", x, false); c.apv = a.id; c.repOwned = true; c.owner = "Sales rep · " + a.rep;
      c.reason = "above " + a.id + "'s cap; the rep made a promise nobody approved";
      rec.disputed += x;
      log("BR-10", c.id + " " + inr(x) + " is above " + a.id + "'s cap. Only the excess goes back to " + a.rep + " (sales rep): show the approval, or recover it from the distributor.");
    }
  }
  /* BR-11: what Ten Today's approver sees before the next discount. Finance's backlog never blocks a deal;
     rep-owned or unverified claims older than 15 days do. */
  function salesFeed(va) {
    var open = S.cases.filter(function (c) { return c.va === va && c.status === "Open"; }), f = { financePending: 0, blocking: 0, young: 0 };
    open.forEach(function (c) { var unbacked = c.repOwned || !c.evidence, age = S.day - c.opened; if (!unbacked) f.financePending += c.amount; else if (age > 15) f.blocking += c.amount; else f.young += c.amount; });
    f.block = f.blocking > 0; return f;
  }

  function newCase(d, inv, type, amt, evidence) {
    S.seq.cs++;
    var c = { id: "C-" + (3300 + S.seq.cs), va: d.va, dist: d.name, inv: inv.no, type: type, amount: amt, evidence: !!evidence, owner: OWNERS[type] || "AR lead", opened: S.day, due: S.day + S.settings.sla, status: "Open", maker: null, history: [] };
    S.cases.push(c);
    return c;
  }

  /* BR-3: auto-accept only with evidence, within budget, under tolerance, within 2x norm */
  function autoCheck(c, first) {
    var d = dist(c.va), why = [];
    if (c.type === "Unexplained") return;
    c.checks = { evidence: !!c.evidence, limit: c.amount <= S.settings.tolerance, budget: c.type !== "Scheme claim" || c.amount <= d.schemeLeft, norm: c.type !== "Damage / shortage" || c.amount <= 2 * d.dmgNorm };
    if (!c.evidence) why.push("no evidence");
    if (c.amount > S.settings.tolerance) why.push("above the " + inr(S.settings.tolerance) + " tolerance");
    if (c.type === "Scheme claim" && c.amount > d.schemeLeft) why.push("over the distributor's remaining scheme budget (" + inr(d.schemeLeft) + ")");
    if (c.type === "Damage / shortage" && c.amount > 2 * d.dmgNorm) why.push("more than 2× this distributor's damage norm (" + inr(d.dmgNorm) + ")");
    if (!why.length) {
      c.status = "Accepted"; c.closedBy = "Rule BR-3";
      if (c.type === "Scheme claim") d.schemeLeft -= c.amount;
      issueCN(c);
      log("BR-3", c.id + " " + c.type.toLowerCase() + " " + inr(c.amount) + " auto-accepted: evidenced, in budget, under tolerance.");
    } else {
      c.reason = why.join("; ");
      if (c.type === "Scheme claim" && c.amount > d.schemeLeft && !c.unbudgeted) {
        c.unbudgeted = true; c.owner = "Regional sales head"; c.due = S.day + 3;
        log("BR-8", c.id + " " + inr(c.amount) + " scheme deduction has no approved scheme budget behind it. Routed to the Regional sales head with a 3-day SLA: charge it to the region's trade budget, or reject and recover from the distributor.");
        return;
      }
      log(first ? "BR-3" : "BR-3", c.id + " " + c.type.toLowerCase() + " " + inr(c.amount) + " → " + c.owner + " (" + c.reason + "). SLA day " + c.due + ".");
    }
  }

  function issueCN(c) {
    S.seq.cn++;
    var inv = invByNo(c.inv), d = dist(c.va), left = inv ? windowLeft(inv) : 999;
    var acct = c.unbudgeted ? "Regional trade budget (sales)" : (ACCT[c.type] || "Trade adjustments");
    var n = { id: "CN-" + (200 + S.seq.cn), caseId: c.id, dist: c.dist, inv: c.inv, amount: c.amount, issued: S.day, fy: inv ? fyLabel(inv) : "" };
    if (left >= 0) {
      /* Claims are treated as GST-inclusive at 18% (illustrative). */
      n.kind = "GST"; n.gst = Math.round(c.amount - c.amount / 1.18); n.irpDue = S.day + 30; n.reported = false;
      post("Credit note", c.inv, n.id + " GST credit note to " + c.dist + "; distributor reverses matching input tax credit", [[acct, c.amount - n.gst, 0], ["Output GST (reduced via s.34 credit note)", n.gst, 0], [arName(d), 0, c.amount]]);
      log("BR-6", n.id + " GST credit note for " + inr(c.amount) + " (GST " + inr(n.gst) + ") to " + c.dist + ". Distributor reverses the matching input tax credit. Report to IRP by day " + n.irpDue + "; s.34 window for " + n.fy + " closes " + fmt(cnDeadline(inv)) + ".");
    } else {
      n.kind = "Financial"; n.gst = 0; n.irpDue = null;
      post("Credit note", c.inv, n.id + " financial credit note to " + c.dist + "; no GST adjustment", [[acct, c.amount, 0], [arName(d), 0, c.amount]]);
      log("BR-6", n.id + ": the s.34 window for " + n.fy + " closed on " + fmt(cnDeadline(inv)) + ". Issued as a financial credit note for " + inr(c.amount) + ": no GST reduction, so the brand bears " + inr(Math.round(c.amount - c.amount / 1.18)) + " of GST it can no longer recover.");
    }
    S.notes.push(n); c.cn = n.id;
  }

  /* BR-7 */
  function exposure(va) {
    var open = S.cases.filter(function (c) { return c.va === va && c.status === "Open"; });
    var amt = open.reduce(function (s, c) { return s + c.amount; }, 0);
    var oldest = open.reduce(function (m, c) { return Math.max(m, S.day - c.opened + (invByNo(c.inv) ? invByNo(c.inv).age : 0)); }, 0);
    return { amt: amt, oldest: oldest, flagged: amt > S.settings.creditAmt || oldest > S.settings.creditAge };
  }
  function creditCheck(d) {
    var x = exposure(d.va);
    if (x.flagged && !d.flagLogged) { d.flagLogged = true; log("BR-7", d.name + ": " + inr(x.amt) + " in open disputes, oldest " + x.oldest + " days. Next order will be flagged for credit review."); }
    if (!x.flagged) d.flagLogged = false;
  }

  /* ---------- actions on a case ---------- */
  function act(id, what) {
    var c = S.cases.filter(function (x) { return x.id === id; })[0]; if (!c || c.status !== "Open") return;
    var d = dist(c.va);
    if (what === "evidence") { c.evidence = true; log("BR-3", c.id + ": evidence attached by " + USERS[S.user] + ". Re-validated."); autoCheck(c, false); }
    else if (what === "approve") {
      if (c.type === "Unexplained") { log("BR-4", "Blocked: " + c.id + " has no reason code. An unexplained gap can be recovered or reclassified, not approved."); flash("Blocked: unexplained gaps can't be approved. Recover it, or get a reason code first.", true); }
      else if (c.amount > S.settings.approval && c.maker === S.user) { log("BR-5", "Blocked: " + USERS[S.user] + " tried to approve own case " + c.id + " above " + inr(S.settings.approval) + ". Routed to a checker."); flash("Blocked by maker-checker: switch to the Finance controller to approve.", true); }
      else if (c.amount > S.settings.approval && !c.maker) { c.maker = S.user; log("BR-5", c.id + " (" + inr(c.amount) + ") recommended by " + USERS[S.user] + "; needs a second approver."); flash("Recommended. Above " + inr(S.settings.approval) + ", a second person must approve.", false); }
      else { c.status = "Accepted"; c.closedBy = USERS[S.user]; if (c.unbudgeted) { S.tradeCharged = (S.tradeCharged || 0) + c.amount; log("BR-8", c.id + ": " + inr(c.amount) + " charged to the region's trade budget (sales absorbs it, not net realisation). Region total charged: " + inr(S.tradeCharged) + "."); } else if (c.type === "Scheme claim") d.schemeLeft = Math.max(0, d.schemeLeft - c.amount); issueCN(c); log("BR-5", c.id + " approved by " + USERS[S.user] + (c.maker ? " (recommended by " + USERS[c.maker] + ")" : "") + "."); }
    }
    else if (what === "recover") { S.seq.dn++; c.status = "Recovered"; c.closedBy = USERS[S.user]; log("BR-4", c.id + ": " + inr(c.amount) + " found invalid. Debit note DN-" + (500 + S.seq.dn) + " raised; " + c.dist + " to pay."); }
    creditCheck(d); save(); if (!QUIET) render();
  }

  function nextDay() {
    S.day++;
    S.cases.forEach(function (c) { if (c.status === "Open" && S.day > c.due && !c.escalated) { c.escalated = true; c.owner = "AR lead (escalated)"; log("SLA", c.id + " passed its SLA (day " + c.due + "). Escalated to the AR lead; history kept."); } });
    S.notes.forEach(function (n) { if (n.irpDue && !n.reported && S.day === n.issued + 20) log("BR-6", "Alert: " + n.id + " must be reported to the IRP by day " + n.irpDue + "."); });
    S.invoices.forEach(function (i) { i.age++; });
    S.cases.forEach(function (c) { var inv = invByNo(c.inv); if (c.status !== "Open" || c.type === "Unexplained" || !inv) return; var l = windowLeft(inv); if (l === 7) log("BR-6", "Alert: " + c.id + " is on a " + fyLabel(inv) + " invoice. The s.34 GST credit-note window closes in 7 days (" + fmt(cnDeadline(inv)) + "). Owner: " + c.owner + "."); if (l === -1) log("BR-6", c.id + ": s.34 window for " + fyLabel(inv) + " has closed. If approved now, it can only be a financial credit note."); });
    S.dists.forEach(creditCheck);
    save(); if (!QUIET) render();
  }
  function order(va) {
    var d = dist(va), x = exposure(va);
    if (x.flagged) { log("BR-7", "New order from " + d.name + " flagged for credit review (" + inr(x.amt) + " disputed, oldest " + x.oldest + " days). Not blocked."); d.ord = "flag"; flash("Order placed and flagged for credit review: not blocked, a controller decides.", true); }
    else { log("BR-7", "New order from " + d.name + " passed the credit check."); d.ord = "ok"; flash("Order placed. Credit check passed.", false); }
    save(); if (!QUIET) render();
  }

  /* ---------- input ---------- */
  function parseCSV(text) {
    var rows = text.trim().split(/\r?\n/).map(function (l) { return l.split(",").map(function (x) { return x.trim(); }); });
    var head = rows.shift().map(function (h) { return h.toLowerCase(); });
    var ix = function (n) { return head.indexOf(n); };
    if (ix("virtual_account") < 0 || ix("amount") < 0) throw new Error("The file needs at least virtual_account and amount columns.");
    return rows.filter(function (r) { return r.length > 1 && r[ix("amount")]; }).map(function (r) {
      var g = function (n) { return ix(n) >= 0 ? (r[ix(n)] || "") : ""; };
      return { va: g("virtual_account").toUpperCase(), amount: Number(g("amount").replace(/[₹,\s]/g, "")) || 0, ref: g("reference").toUpperCase(), claimType: g("claim_type"), claimAmt: Number(g("claim_amount").replace(/[₹,\s]/g, "")) || 0, evidence: /^(y|yes|true|1)$/i.test(g("evidence")), apv: g("approval_id").toUpperCase() };
    });
  }
  function runStatement(text, label) {
    var list;
    try { list = parseCSV(text); } catch (e) { flash(e.message, true); return; }
    if (!list.length) { flash("No receipts found in that file.", true); return; }
    var before = S.log.length, cBefore = S.cases.length;
    log("Import", label + ": " + list.length + " receipts.");
    list.forEach(processReceipt);
    var fired = {}; S.log.slice(0, S.log.length - before).forEach(function (l) { if (/^BR-/.test(l.rule)) fired[l.rule] = (fired[l.rule] || 0) + 1; });
    var autoAccepted = S.cases.slice(cBefore).filter(function (c) { return c.closedBy === "Rule BR-3" || /^Rule BR-10/.test(c.closedBy || ""); }).length;
    var hrsSaved = ((list.length * 20) / 60).toFixed(1).replace(/\.0$/, "");
    S.lastRun = list.length + " receipts processed in <5 ms (Day 0 vs 7–14d manual ERP lag · Hackett CPG baseline) · ~" + hrsSaved + " hrs manual 4-way lookup saved (@ 22 min/line APQC benchmark) · rules fired: " + Object.keys(fired).sort().map(function (k) { return k + "×" + fired[k]; }).join(", ") + " · " + (S.cases.length - cBefore) + " claims classified (" + autoAccepted + " auto-accepted, " + S.cases.slice(cBefore).filter(function (c) { return c.status === "Open"; }).length + " to an owner) · ₹0 unowned";
    save(); render();
    flash(S.lastRun, false);
    $("cases").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- output ---------- */
  var flashT;
  function flash(msg, warn) { if (QUIET) return; var f = $("flash"); f.textContent = msg; f.className = "flash show" + (warn ? " warn" : ""); clearTimeout(flashT); flashT = setTimeout(function () { f.className = "flash"; }, 4200); }

  function render() {
    $("day").textContent = "Day " + S.day + " · " + fmt(dateOf(S.day));
    $("who").value = S.user;
    ["tolerance", "approval"].forEach(function (k) { $("set-" + k).value = S.settings[k]; });
    var gap = 0, tds = 0, acc = 0, dis = 0;
    S.receipts.forEach(function (r) { gap += r.gap || 0; tds += r.tds || 0; acc += r.accepted || 0; dis += r.disputed || 0; });
    var open = S.cases.filter(function (c) { return c.status === "Open"; });
    var openAmt = open.reduce(function (s, c) { return s + c.amount; }, 0);
    var autoPct = gap ? Math.round((tds + acc) / gap * 100) : 0;
    $("k-gap").textContent = inr(gap);
    $("k-auto").textContent = gap ? autoPct + "%" : "—";
    var fired = S.log.filter(function (l) { return /^BR-/.test(l.rule); }).length; $("k-rules").textContent = fired || "—";
    $("lastrun").textContent = S.lastRun || "";
    $("k-open").textContent = open.length + " · " + inr(openAmt);
    $("k-unowned").textContent = gap ? "₹0" : "—";
    $("bar").innerHTML = gap ? [["tds", tds], ["acc", acc], ["dis", dis]].map(function (s) { return "<span class='s-" + s[0] + "' style='width:" + (s[1] / gap * 100) + "%'></span>"; }).join("") : "";
    $("legend").innerHTML = gap ? "<li><i class='s-tds'></i>TDS credit " + inr(tds) + "</li><li><i class='s-acc'></i>Accepted claims " + inr(acc) + "</li><li><i class='s-dis'></i>With an owner " + inr(dis) + "</li>" : "";

    $("inv-body").innerHTML = S.invoices.map(function (i) { var d = dist(i.va); return "<tr><td class='mono'>" + i.no + "</td><td>" + esc(d.name.split(",")[0]) + "</td><td class='mono r'>" + inr(i.total) + "</td><td class='mono r'>" + (i.open ? inr(i.open) : "<span class='ok'>applied</span>") + "</td><td class='mono r'>" + i.age + "d</td></tr>"; }).join("");

    $("case-list").innerHTML = S.cases.length ? S.cases.slice().reverse().map(function (c) {
      var late = c.status === "Open" && S.day > c.due;
      var actions = c.status !== "Open" ? "<span class='pill " + (c.status === "Accepted" ? "ok" : "bad") + "'>" + c.status + (c.cn ? " · " + c.cn : "") + "</span><span class='by'>by " + esc(c.closedBy) + "</span>" :
        (c.type !== "Unexplained" && !c.evidence ? "<button class='btn small' data-a='evidence' data-id='" + c.id + "'>Attach evidence</button>" : "") +
        "<button class='btn small primary' data-a='approve' data-id='" + c.id + "'>" + (c.unbudgeted ? "Charge to sales trade budget" : c.maker && c.maker !== S.user ? "Approve (2nd)" : "Approve") + "</button>" +
        "<button class='btn small' data-a='recover' data-id='" + c.id + "'>" + (c.unbudgeted ? "Reject: recover from distributor" : "Invalid: recover") + "</button>";
      return "<article class='case" + (c.status !== "Open" ? " closed" : "") + (late ? " late" : "") + "'><header><b class='mono'>" + c.id + "</b><span class='type t-" + c.type.split(" ")[0].toLowerCase() + "'>" + esc(c.type) + "</span><b class='mono amt'>" + inr(c.amount) + "</b></header>" +
        "<p>" + esc(c.dist) + " · " + c.inv + (c.status === "Open" ? " · owner <b>" + esc(c.owner) + "</b> · SLA day " + c.due + (late ? " <span class='pill bad'>late</span>" : "") : "") + "</p>" +
        (c.checks ? "<table class='dt'><tr><th>Evidence</th><th>≤ limit</th><th>In budget</th><th>≤ 2× norm</th><th>BR-3 outcome</th></tr><tr>" + ["evidence", "limit", "budget", "norm"].map(function (k) { return "<td class='" + (c.checks[k] ? "y" : "n") + "'>" + (c.checks[k] ? "✓" : "✗") + "</td>"; }).join("") + "<td>" + (c.checks.evidence && c.checks.limit && c.checks.budget && c.checks.norm ? "Auto-accept" : "To " + esc(c.owner)) + "</td></tr></table>" : "<p class='trace2'>" + (c.type === "Unexplained" ? "BR-4 · US-4 · UAT-07: no reason code, so it can't be auto-accepted or written off." : "") + "</p>") +
        (function () { var inv = invByNo(c.inv); if (c.status !== "Open" || c.type === "Unexplained" || !inv) return ""; var l = windowLeft(inv); if (l > 30) return ""; return l >= 0 ? "<p class='gstw'><b>GST window: " + l + " days.</b> " + fyLabel(inv) + " invoice. Approve by " + fmt(cnDeadline(inv)) + " to issue a GST credit note (s.34); after that, a financial credit note only.</p>" : "<p class='gstw closed'><b>GST window closed</b> on " + fmt(cnDeadline(inv)) + ". If approved, this becomes a financial credit note and the brand bears " + inr(Math.round(c.amount - c.amount / 1.18)) + " of GST.</p>"; })() +
        (c.maker && c.status === "Open" ? "<p class='why'>Recommended by " + esc(USERS[c.maker]) + "; waiting for a second approver.</p>" : "") +
        "<div class='acts'>" + actions + "</div></article>";
    }).join("") : "<p class='empty'>No cases yet. Load today's bank statement above.</p>";

    $("dist-body").innerHTML = S.dists.map(function (d) { var x = exposure(d.va); return "<tr><td>" + esc(d.name) + "<br><span class='mono tiny'>" + d.va + "</span></td><td class='mono r'>" + inr(d.purchases) + (d.purchases > 5000000 ? "<br><span class='tiny'>194Q applies</span>" : "") + "</td><td class='mono r'>" + inr(d.schemeLeft) + "</td><td class='mono r'>" + (x.amt ? inr(x.amt) : "—") + (x.flagged ? "<br><span class='pill bad'>credit review</span>" : "") + "</td><td>" + (d.ord === "flag" ? "<span class='ordst bad'>Held for review</span>" : d.ord === "ok" ? "<span class='ordst ok'>Released</span>" : "") + "<button class='btn small' data-order='" + d.va + "'>" + (d.ord ? "Order again" : "New order") + "</button></td></tr>"; }).join("");

    $("cn-body").innerHTML = S.notes.length ? S.notes.map(function (n) { var left = n.irpDue == null ? null : n.irpDue - S.day; return "<tr><td class='mono'>" + n.id + "<br><span class='tiny'>" + (n.kind === "GST" ? "GST · " + inr(n.gst) + " GST" : "Financial · no GST") + "</span></td><td>" + esc(n.dist.split(",")[0]) + "</td><td class='mono r'>" + inr(n.amount) + "</td><td class='mono r'>" + (left == null ? "<span class='tiny'>not reportable</span>" : left >= 0 ? left + " days" : "<span class='pill bad'>overdue</span>") + "</td></tr>"; }).join("") : "<tr><td colspan='4' class='empty'>None yet.</td></tr>";
    renderTower(); renderJournal();
    if ($("apv-body")) $("apv-body").innerHTML = (S.approvals || []).map(function (x) { var d = dist(x.va); return "<div class='apv'><p><b class='mono'>" + x.id + "</b> · " + esc(d.name.split(",")[0]) + "<br><span class='tiny'>Rep " + x.rep + " · approved by " + esc(x.approver) + " · cap " + inr(x.cap) + (x.taxIncl ? " incl. GST" : " + GST (clears up to " + inr(capLimit(x)) + ")") + " · invoices up to " + fmt(new Date(x.windowEnd)) + " · used " + inr(x.used) + "</span></p></div>"; }).join("") + (function () { var f = salesFeed("CELLOVA0005"); return "<p class='tiny' style='margin-top:10px'><b>Feed to Ten Today, Krishna Marketing:</b> waiting on Finance " + inr(f.financePending) + " (doesn't block) · rep-owned or unverified over 15 days " + inr(f.blocking) + (f.young ? " · under 15 days " + inr(f.young) : "") + " → next discount <b>" + (f.block ? "blocked until proof or recovery" : "can be approved") + "</b></p>"; })();

    $("log").innerHTML = S.log.length ? S.log.slice(0, 60).map(function (l) { return "<li><span class='mono'>Day " + l.day + "</span> <span class='rule'>" + esc(l.rule) + "</span> " + esc(l.text) + (l.hash ? " <span class='trace'>[" + esc((l.prevHash || "GENESIS").slice(0, 8)) + " → " + esc(l.hash.slice(0, 8)) + "]</span>" : "") + "</li>"; }).join("") : "<li class='empty'>Nothing yet.</li>";
  }

  /* Control tower: what a finance head looks at first */
  function tower() {
    var open = S.cases.filter(function (c) { return c.status === "Open"; });
    var b = [0, 0, 0, 0];
    open.forEach(function (c) { var inv = invByNo(c.inv), a = inv ? inv.age : 0; b[a <= 30 ? 0 : a <= 60 ? 1 : a <= 90 ? 2 : 3] += c.amount; });
    var late = {}; open.forEach(function (c) { if (S.day > c.due) late[c.owner] = (late[c.owner] || 0) + 1; });
    var risk = 0, lost = 0;
    open.forEach(function (c) { var inv = invByNo(c.inv); if (c.type !== "Unexplained" && inv && windowLeft(inv) >= 0 && windowLeft(inv) <= 30) risk += Math.round(c.amount - c.amount / 1.18); });
    S.notes.forEach(function (n) { if (n.kind === "Financial") lost += Math.round(n.amount - n.amount / 1.18); });
    var irp = S.notes.filter(function (n) { return n.irpDue != null && !n.reported; }).length;
    return { buckets: b, late: late, risk: risk, lost: lost, irp: irp, suspense: S.suspense || 0, open: open.reduce(function (s, c) { return s + c.amount; }, 0) };
  }
  function renderTower() {
    var el = $("tower-body"); if (!el) return;
    var t = tower(), lateKeys = Object.keys(t.late), mx = Math.max.apply(null, t.buckets.concat([1]));
    el.innerHTML = "<div class='tw4'>" +
      "<div class='tw'><span>Unallocated cash</span><b>" + inr(t.suspense) + "</b><em>Receipts in suspense, never applied to an invoice</em></div>" +
      "<div class='tw'><span>Disputed receivables</span><b>" + inr(t.open) + "</b><em>Every rupee has an owner and a deadline</em></div>" +
      "<div class='tw" + (t.risk ? " warn" : "") + "'><span>GST at risk</span><b>" + inr(t.risk) + "</b><em>GST on open claims whose s.34 window closes within 30 days</em></div>" +
      "<div class='tw" + (t.lost ? " bad" : "") + "'><span>GST lost</span><b>" + inr(t.lost) + "</b><em>Claims settled after the window: financial credit notes</em></div></div>" +
      "<div class='tw2'><div class='card'><h3>Disputes by invoice age</h3>" + ["0–30 days", "31–60 days", "61–90 days", "90+ days"].map(function (l, i) { return "<div class='agerow'><span>" + l + "</span><i style='width:" + Math.round(t.buckets[i] / mx * 100) + "%'></i><b class='mono'>" + inr(t.buckets[i]) + "</b></div>"; }).join("") + "</div>" +
      "<div class='card'><h3>Missed deadlines, by owner</h3>" + (lateKeys.length ? lateKeys.map(function (k) { return "<div class='agerow'><span>" + esc(k) + "</span><b class='mono'>" + t.late[k] + " case" + (t.late[k] > 1 ? "s" : "") + "</b></div>"; }).join("") : "<p class='empty'>No case is past its deadline. Use Next day to see escalations.</p>") + "<p class='tiny' style='margin-top:10px'>Credit notes awaiting IRP report: <b>" + t.irp + "</b></p></div></div>";
  }
  function renderJournal() {
    var el = $("jv-body"); if (!el) return;
    var J = (S.journal || []).slice().reverse();
    var dr = 0, cr = 0; (S.journal || []).forEach(function (v) { v.lines.forEach(function (l) { dr += l[1]; cr += l[2]; }); });
    $("jv-sum").innerHTML = (S.journal || []).length + " vouchers · debits " + inr(dr) + " · credits " + inr(cr) + " · " + (dr === cr ? "<span class='pill ok'>balanced</span>" : "<span class='pill bad'>out of balance</span>");
    el.innerHTML = J.length ? J.slice(0, 40).map(function (v) { return "<tr class='vh'><td class='mono'>" + v.id + "</td><td colspan='3'>" + esc(v.type) + " · " + esc(v.ref) + " · " + esc(v.narr) + "</td></tr>" + v.lines.map(function (l) { return "<tr><td></td><td>" + (l[2] ? "&nbsp;&nbsp;To " : "") + esc(l[0]) + "</td><td class='mono r'>" + (l[1] ? inr(l[1]) : "") + "</td><td class='mono r'>" + (l[2] ? inr(l[2]) : "") + "</td></tr>"; }).join(""); }).join("") : "<tr><td colspan='4' class='empty'>No postings yet. Load today's statement.</td></tr>";
  }

  function download(name, text, type) { var b = new Blob([text], { type: type }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function csv(rows) { return "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); }


  /* ---------- UAT runner: executes the BRD's acceptance tests against this engine ---------- */
  function scenario(fn) {
    var keep = S; QUIET = true; S = seed();
    var out; try { out = fn(); } catch (e) { out = { pass: false, actual: "Error: " + e.message }; }
    S = keep; QUIET = false; return out;
  }
  var R = function (va, amount, ref, type, camt, ev, apv) { return { va: va, amount: amount, ref: ref || "", claimType: type || "", claimAmt: camt || 0, evidence: !!ev, apv: apv || "" }; };
  var lastCase = function () { return S.cases[S.cases.length - 1]; };
  var TESTS = [
    ["UAT-01", "BR-1, US-1", "Unreferenced receipt on a virtual account", "Applied to the distributor's oldest open invoice", function () { processReceipt(R("CELLOVA0003", 800000)); var r = S.receipts[0]; return { pass: r.inv === "INV-3007", actual: "Applied to " + r.inv }; }],
    ["UAT-02", "BR-2, US-2", "Short by 0.1% after the ₹50 lakh threshold", "Classified as TDS; no case opened", function () { processReceipt(R("CELLOVA0001", 999153, "INV-1041")); var r = S.receipts[0]; return { pass: r.tds === 847 && S.cases.length === 0, actual: "TDS " + inr(r.tds) + ", " + S.cases.length + " cases" }; }],
    ["UAT-03", "BR-3, US-3", "Evidenced scheme claim within budget and limit", "Auto-accepted; rule recorded", function () { processReceipt(R("CELLOVA0001", 991153, "INV-1041", "Scheme claim", 8000, true)); var c = lastCase(); return { pass: c.status === "Accepted" && c.closedBy === "Rule BR-3", actual: c.status + " by " + c.closedBy }; }],
    ["UAT-04", "US-4", "Approve a case with no reason code (negative)", "Blocked and logged", function () { processReceipt(R("CELLOVA0002", 295000, "INV-2015")); var c = lastCase(); act(c.id, "approve"); return { pass: c.status === "Open" && /Blocked/.test(S.log[0].text), actual: c.status + "; " + S.log[0].text.slice(0, 40) + "…" }; }],
    ["UAT-05", "BR-3", "Damage claim without proof of delivery (negative)", "Not accepted; stays a dispute", function () { processReceipt(R("CELLOVA0002", 295000, "INV-2015", "Damage / shortage", 5000, false)); var c = S.cases[0]; return { pass: c.status === "Open" && c.owner === "Area sales manager", actual: c.status + ", owner " + c.owner }; }],
    ["UAT-06", "BR-5, US-5", "Maker approves own case above ₹10,000 (negative)", "Blocked, logged, routed to a checker", function () { processReceipt(R("CELLOVA0003", 787322, "INV-3007", "Scheme claim", 12000, true)); var c = lastCase(); act(c.id, "approve"); act(c.id, "approve"); var blocked = c.status === "Open"; S.user = "checker"; act(c.id, "approve"); return { pass: blocked && c.status === "Accepted", actual: (blocked ? "Blocked for maker" : "Not blocked") + "; checker: " + c.status }; }],
    ["UAT-07", "BR-4", "Unexplained gap left for 60 days (negative)", "Never written off; stays open with an owner", function () { processReceipt(R("CELLOVA0002", 297000, "INV-2015")); for (var i = 0; i < 60; i++) nextDay(); var c = S.cases[0]; return { pass: c.status === "Open", actual: c.status + ", owner " + c.owner }; }],
    ["UAT-08", "US-4", "Dispute passes its SLA", "Escalated to the AR lead; history kept", function () { processReceipt(R("CELLOVA0002", 297000, "INV-2015")); for (var i = 0; i < 8; i++) nextDay(); var c = S.cases[0]; return { pass: c.escalated && /AR lead/.test(c.owner), actual: "Owner: " + c.owner }; }],
    ["UAT-09", "BR-6, US-6", "Credit note issued", "IRP deadline set 30 days out", function () { processReceipt(R("CELLOVA0001", 991153, "INV-1041", "Scheme claim", 8000, true)); var n = S.notes[0]; return { pass: !!n && n.irpDue - n.issued === 30, actual: n ? n.id + ", IRP due in " + (n.irpDue - n.issued) + " days" : "No note" }; }],
    ["UAT-10", "BR-7, US-7", "Old dispute, then a new order", "Order flagged for review, not blocked", function () { processReceipt(R("CELLOVA0004", 238000, "INV-4002", "Scheme claim", 12000, true)); order("CELLOVA0004"); return { pass: /flagged for credit review/.test(S.log[0].text), actual: S.log[0].text.slice(0, 48) + "…" }; }]
  ];
  TESTS.push(["UAT-11", "BR-8", "Scheme deduction with no approved budget", "Routed to the Regional sales head; charge to sales budget or recover", function () { processReceipt(R("CELLOVA0004", 238000, "INV-4002", "Scheme claim", 12000, true)); var c = S.cases.filter(function (x) { return x.type === "Scheme claim"; })[0]; act(c.id, "approve"); S.user = "checker"; act(c.id, "approve"); return { pass: c.unbudgeted && c.status === "Accepted" && S.tradeCharged === 12000, actual: "owner Regional sales head: " + !!c.unbudgeted + " · charged to trade budget " + inr(S.tradeCharged || 0) }; }]);
  var OLD = function () { processReceipt(R("CELLOVA0005", 226360, "INV-0988", "Scheme claim", 9440, false)); return S.cases.filter(function (x) { return x.inv === "INV-0988" && x.type === "Scheme claim"; })[0]; };
  TESTS.push(["UAT-12", "BR-6, US-8", "Claim on a FY 2025-26 invoice approved inside the s.34 window", "GST credit note; GST reduced; distributor reverses ITC", function () { var c = OLD(); act(c.id, "evidence"); if (c.status === "Open") act(c.id, "approve"); var n = S.notes[0], v = S.journal[S.journal.length - 1]; var gstLine = v.lines.some(function (l) { return /Output GST/.test(l[0]); }); return { pass: !!n && n.kind === "GST" && n.gst === 1440 && gstLine, actual: n ? n.kind + " credit note, GST " + inr(n.gst) : "No note" }; }]);
  TESTS.push(["UAT-13", "BR-6, US-8", "Same claim approved after 30 Nov (window closed)", "Financial credit note only; no GST reduction; loss shown", function () { var c = OLD(); for (var i = 0; i < 24; i++) nextDay(); c.evidence = true; act(c.id, "approve"); var n = S.notes[0], v = S.journal[S.journal.length - 1]; var gstLine = v.lines.some(function (l) { return /Output GST/.test(l[0]); }); return { pass: !!n && n.kind === "Financial" && !gstLine && tower().lost === 1440, actual: n ? n.kind + " credit note; GST lost " + inr(tower().lost) : "No note" }; }]);
  TESTS.push(["UAT-14", "BR-9, US-9", "Full day: sample statement, every case approved", "Every voucher balances; receivables credited never exceed invoices", function () { runQuiet(); S.user = "checker"; S.cases.forEach(function (c) { if (c.status === "Open" && c.type !== "Unexplained") { c.evidence = true; act(c.id, "approve"); } }); var bad = S.journal.filter(function (v) { var d = 0, k = 0; v.lines.forEach(function (l) { d += l[1]; k += l[2]; }); return d !== k; }).length; var ar = 0; S.journal.forEach(function (v) { v.lines.forEach(function (l) { if (/^Trade receivables/.test(l[0])) ar += l[2] - l[1]; }); }); var inv = S.invoices.reduce(function (s, i) { return s + i.total; }, 0); return { pass: S.journal.length > 0 && bad === 0 && ar <= inv, actual: S.journal.length + " vouchers, " + bad + " unbalanced; AR credited " + inr(ar) }; }]);
  TESTS.push(["UAT-15", "BR-1, BR-9", "Receipt on an unknown virtual account (negative)", "Parked in suspense; applied to no invoice", function () { processReceipt(R("CELLOVA0099", 50000)); var touched = S.invoices.some(function (i) { return i.open !== i.total; }); return { pass: S.suspense === 50000 && !touched, actual: "Suspense " + inr(S.suspense) + "; invoices touched: " + touched }; }]);
  /* INV-5031: ₹4,00,000, TDS ₹339, so a ₹9,440 deduction arrives as ₹3,90,221. INV-5020: TDS ₹508. */
  var KM = function (apv, amt) { processReceipt(R("CELLOVA0005", 400000 - 339 - amt, "INV-5031", "Scheme claim", amt, false, apv)); return S.cases.filter(function (c) { return c.apv; }); };
  TESTS.push(["UAT-16", "BR-10, US-10", "₹9,440 deducted against a ₹8,000 pre-tax approval", "Fully cleared by rule: ₹8,000 + 18% GST; GST credit note; nothing sent to the rep", function () { var cs = KM("APV-2026-041", 9440), n = S.notes[0]; return { pass: cs.length === 1 && cs[0].status === "Accepted" && n && n.kind === "GST" && n.gst === 1440, actual: cs.map(function (c) { return c.status + " " + inr(c.amount); }).join(", ") + (n ? "; " + n.kind + " CN, GST " + inr(n.gst) : "") }; }]);
  TESTS.push(["UAT-17", "BR-10, US-10", "₹9,440 deducted against an ₹8,000 tax-inclusive approval", "Split at the cap: ₹8,000 cleared; only ₹1,440 goes to the rep", function () { var cs = KM("APV-2026-042", 9440); var ok = cs.length === 2 && cs[0].status === "Accepted" && cs[0].amount === 8000 && cs[1].status === "Open" && cs[1].amount === 1440 && /Rahul/.test(cs[1].owner); return { pass: ok, actual: cs.map(function (c) { return c.status + " " + inr(c.amount) + " (" + (c.closedBy || c.owner) + ")"; }).join(" · ") }; }]);
  TESTS.push(["UAT-18", "BR-10, US-10", "Approval for invoices to 30 Sep used on an 8 Oct invoice (negative)", "Lapsed approval used: nothing cleared; routed to the approver who signed", function () { processReceipt(R("CELLOVA0005", 600000 - 508 - 8000, "INV-5020", "Scheme claim", 8000, false, "APV-2026-042")); var c = lastCase(), a = apvById("APV-2026-042"); return { pass: c.lapsed && c.status === "Open" && /Kavita/.test(c.owner) && a.used === 0 && S.notes.length === 0, actual: c.status + ", owner " + c.owner + ", approval used " + inr(a.used) }; }]);
  TESTS.push(["UAT-19", "BR-11, US-11", "Finance backlog vs rep-owned excess, before and after 15 days", "Only the rep-owned ₹1,440 blocks the next discount, and only after 15 days", function () { KM("APV-2026-042", 9440); processReceipt(R("CELLOVA0005", 600000 - 508 - 12000, "INV-5020", "Rate difference", 12000, true)); for (var i = 0; i < 5; i++) nextDay(); var early = salesFeed("CELLOVA0005"); for (i = 0; i < 11; i++) nextDay(); var late = salesFeed("CELLOVA0005"); return { pass: !early.block && late.block && late.blocking === 1440 && late.financePending === 12000, actual: "day 5: block " + early.block + " · day 16: finance pending " + inr(late.financePending) + " (no block), rep-owned " + inr(late.blocking) + " → block " + late.block }; }]);
  function runQuiet() { parseCSV(SAMPLE).forEach(processReceipt); }
  function runUAT() {
    var rows = TESTS.map(function (t) { var o = scenario(t[4]); return [t[0], t[1], t[2], t[3], o.actual, o.pass]; });
    var passed = rows.filter(function (r) { return r[5]; }).length;
    $("uat-sum").textContent = passed + " of " + rows.length + " passed · run against this page's engine on fresh data, your desk untouched";
    $("uat-body").innerHTML = rows.map(function (r) { return "<tr><td class='mono'>" + r[0] + "</td><td class='tiny'>" + r[1] + "</td><td>" + esc(r[2]) + "<br><span class='tiny'>Expected: " + esc(r[3]) + "</span></td><td class='tiny'>" + esc(r[4]) + "</td><td><span class='pill " + (r[5] ? "ok'>Pass" : "bad'>Fail") + "</span></td></tr>"; }).join("");
    $("uat").hidden = false;
    $("uat").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- wiring ---------- */
  load(); render();
  $("load-sample").onclick = function () { runStatement(SAMPLE, "Sample statement"); };
  $("dl-sample").onclick = function () { download("sample-bank-statement.csv", SAMPLE, "text/csv"); };
  $("file").onchange = function (e) { var f = e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { runStatement(String(rd.result), f.name); }; rd.readAsText(f); e.target.value = ""; };
  /* Narration parser: reads the distributor's free-text remittance note into a reason code and amount. TDS is never taken from the note: BR-2 computes it. */
  $("f-nar").oninput = function () {
    var t = this.value.toLowerCase(), m = t.match(/(\d[\d,]*)/g), amt = m ? Number(m[m.length - 1].replace(/,/g, "")) : 0;
    var type = /scheme|diwali|promo|discount|offer|target/.test(t) ? "Scheme claim" : /damage|broken|short(age)? qty|shortage|leak/.test(t) ? "Damage / shortage" : /rate|price diff/.test(t) ? "Rate difference" : /return|grn/.test(t) ? "Returns" : "";
    $("f-type").value = type; if (amt && type) $("f-camt").value = amt;
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pre]"); if (!b) return;
    var P = b.dataset.pre === "1" ? ["CELLOVA0001", 991153, "INV-1041", "Less Diwali scheme 8,000 + TDS", true] : ["CELLOVA0002", 295000, "INV-2015", "", false];
    $("f-va").value = P[0]; refill(); $("f-amt").value = P[1]; $("f-ref").value = P[2]; $("f-nar").value = P[3]; $("f-type").value = ""; $("f-camt").value = ""; $("f-nar").oninput.call($("f-nar")); $("f-ev").checked = P[4];
    $("add").requestSubmit();
  });
  $("add").onsubmit = function (e) {
    e.preventDefault();
    var r = { va: $("f-va").value, amount: Number($("f-amt").value) || 0, ref: $("f-ref").value, claimType: $("f-type").value, claimAmt: Number($("f-camt").value) || 0, evidence: $("f-ev").checked };
    if (!r.amount) { flash("Enter the amount received.", true); return; }
    var n0 = S.log.length; log("Import", "Receipt entered by hand."); processReceipt(r);
    S.seq.erp = (S.seq.erp || 0) + 1; var ref = "ERP-SIM-" + String(S.seq.erp).padStart(4, "0"), tm = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    var rules = S.log.slice(0, S.log.length - n0).map(function (l) { return l.rule; }).filter(function (x) { return /^BR-/.test(x); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort().join(", ");
    log("Posting", "Logged · rules " + rules + " · posting ref " + ref + " (simulated) · " + tm + " IST");
    save(); render(); flash("Logged · " + rules + " · " + ref + " (simulated) · " + tm + " IST", false);
  };
  $("f-va").innerHTML = S.dists.map(function (d) { return "<option value='" + d.va + "'>" + esc(d.name) + "</option>"; }).join("");
  var refill = function () { $("f-ref").innerHTML = "<option value=''>No reference</option>" + S.invoices.filter(function (i) { return i.va === $("f-va").value && i.open > 0; }).map(function (i) { return "<option>" + i.no + "</option>"; }).join(""); };
  $("f-va").onchange = refill; refill();
  $("who").onchange = function () { S.user = $("who").value; log("User", "Switched to " + USERS[S.user] + "."); save(); render(); };
  ["tolerance", "approval"].forEach(function (k) { $("set-" + k).onchange = function () { S.settings[k] = Math.max(0, Number(this.value) || 0); log("Setting", k + " set to " + inr(S.settings[k]) + " by " + USERS[S.user] + "."); save(); render(); }; });
  $("next-day").onclick = nextDay;
  $("run-uat").onclick = runUAT;
  $("dl-jira").onclick = function () { var O = window.O2C; download("user-stories-jira.csv", csv([["Summary", "Issue Type", "Description", "Acceptance Criteria", "Labels"]].concat(O.STORIES.map(function (x) { return [x[0] + " " + x[1], "Story", x[2], x[3], "o2c-deductions"]; }))), "text/csv"); };
  $("dl-uatcsv").onclick = function () { var O = window.O2C; download("uat-cases.csv", csv([["ID", "Traces to", "Scenario", "Expected"]].concat(O.UAT)), "text/csv"); };
  if (/[?&]uat=1/.test(location.search)) setTimeout(runUAT, 300);
  if (location.hash === "#rules") { var dr = $("rules"); if (dr) dr.open = true; }
  $("reset").onclick = function () { S = seed(); save(); render(); refill(); flash("Reset to a fresh morning.", false); };
  $("dl-cases").onclick = function () { download("cases.csv", csv([["Case", "Distributor", "Invoice", "Type", "Amount", "Owner", "Status", "Opened (day)", "SLA (day)", "Credit note"]].concat(S.cases.map(function (c) { return [c.id, c.dist, c.inv, c.type, c.amount, c.owner, c.status, c.opened, c.due, c.cn || ""]; }))), "text/csv"); };
  if ($("dl-jv")) $("dl-jv").onclick = function () { var rows = [["Voucher No", "Date", "Voucher Type", "Ledger", "Debit", "Credit", "Reference", "Narration"]]; (S.journal || []).forEach(function (v) { v.lines.forEach(function (l) { rows.push([v.id, fmt(dateOf(v.day)), v.type, l[0], l[1] || "", l[2] || "", v.ref, v.narr]); }); }); download("journal-vouchers.csv", csv(rows), "text/csv"); };
  $("dl-log").onclick = function () { download("audit-trail.csv", csv([["Day", "User", "Rule", "Event", "PrevHash", "Hash"]].concat(S.log.slice().reverse().map(function (l) { return [l.day, l.who, l.rule, l.text, l.prevHash || "GENESIS", l.hash || ""]; }))), "text/csv"); };
  if ($("verify-chain")) $("verify-chain").onclick = function () {
    var st = $("chain-status"); if (!st) return;
    if (!S.log.length) { st.hidden = false; st.innerHTML = "Load the sample statement first to populate the audit chain."; return; }
    var chrono = S.log.slice().reverse(), prev = "GENESIS", broken = -1;
    for (var i = 0; i < chrono.length; i++) {
      var e = chrono[i], expected = hashEntry(prev, e.day, e.who, e.rule, e.text);
      if ((e.prevHash || "GENESIS") !== prev || e.hash !== expected) { broken = i; break; }
      prev = e.hash;
    }
    st.hidden = false;
    if (broken >= 0) {
      st.style.borderLeftColor = "#DC2626";
      st.innerHTML = "<b>✗ Tamper detected at chronological entry #" + (broken + 1) + ":</b> stored fingerprint <code>" + esc((chrono[broken].hash || "").slice(0, 8)) + "</code> ≠ recomputed <code>" + esc(hashEntry(broken === 0 ? "GENESIS" : chrono[broken - 1].hash, chrono[broken].day, chrono[broken].who, chrono[broken].rule, chrono[broken].text).slice(0, 8)) + "</code>. All " + (chrono.length - broken - 1) + " downstream entries cascade-invalidated.";
    } else if (S.anchorRoot && prev !== S.anchorRoot) {
      st.style.borderLeftColor = "#DC2626";
      st.innerHTML = "<b>✗ DBA Re-seal Attack caught by Pinned Controller Anchor:</b> internal links were re-hashed, but chain head <code>" + esc(prev.slice(0, 8)) + "</code> ≠ pinned Controller Anchor Root <code>" + esc(S.anchorRoot.slice(0, 8)) + "</code>.";
    } else {
      st.style.borderLeftColor = "#0F766E";
      st.innerHTML = "<b>✓ Chain intact:</b> all " + chrono.length + " entries &amp; Pinned Controller Anchor (<code>" + esc((prev || "").slice(0, 8)) + "</code>) verified.";
    }
  };
  if ($("tamper-chain")) $("tamper-chain").onclick = function () {
    if (!S.log.length) $("load-sample").click();
    if (!BACKUP_LOG) BACKUP_LOG = JSON.parse(JSON.stringify(S.log));
    var idx = Math.min(2, S.log.length - 1);
    S.log[idx].text = S.log[idx].text + " [TAMPERED: ₹8,000 → ₹48,000 in DB]";
    if ($("undo-tamper")) $("undo-tamper").hidden = false;
    render(); if ($("verify-chain")) $("verify-chain").click();
  };
  if ($("tamper-reseal")) $("tamper-reseal").onclick = function () {
    if (!S.log.length) $("load-sample").click();
    if (!BACKUP_LOG) BACKUP_LOG = JSON.parse(JSON.stringify(S.log));
    var chrono = S.log.slice().reverse();
    var target = Math.max(0, chrono.length - 3);
    chrono[target].text = chrono[target].text + " [DBA RE-SEALED EDIT]";
    var prev = "GENESIS";
    for (var i = 0; i < chrono.length; i++) {
      chrono[i].prevHash = prev;
      chrono[i].hash = hashEntry(prev, chrono[i].day, chrono[i].who, chrono[i].rule, chrono[i].text);
      prev = chrono[i].hash;
    }
    S.log = chrono.reverse();
    if ($("undo-tamper")) $("undo-tamper").hidden = false;
    render(); if ($("verify-chain")) $("verify-chain").click();
  };
  if ($("undo-tamper")) $("undo-tamper").onclick = function () {
    if (BACKUP_LOG) { S.log = BACKUP_LOG; BACKUP_LOG = null; }
    this.hidden = true;
    if ($("chain-status")) $("chain-status").hidden = true;
    render();
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (b) act(b.dataset.id, b.dataset.a);
    var o = e.target.closest("[data-order]"); if (o) order(o.dataset.order);
  });
})();
