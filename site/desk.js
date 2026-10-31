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
        { no: "INV-5020", va: "CELLOVA0005", taxable: 508475, total: 600000, age: 30, open: 600000 }
      ],
      receipts: [], cases: [], notes: [], log: [], processed: []
    };
  }

  /* bank statement sample: date, virtual account, amount, reference, then the distributor's remittance claims */
  var SAMPLE = [
    "date,virtual_account,amount,reference,claim_type,claim_amount,evidence",
    "day 0,CELLOVA0001,991153,INV-1041,Scheme claim,8000,yes",
    "day 0,CELLOVA0002,284000,INV-2015,Damage / shortage,11000,no",
    "day 0,CELLOVA0003,787322,,Scheme claim,12000,yes",
    "day 0,CELLOVA0004,238000,INV-4002,Scheme claim,12000,yes",
    "day 0,CELLOVA0005,594492,INV-5020,Rate difference,5000,yes",
    "day 0,CELLOVA0001,496576,INV-1042,,,"
  ].join("\n");

  var S;
  function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || !S.dists) S = seed(); }
  function save() { if (QUIET) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function log(rule, text) { S.log.unshift({ day: S.day, who: USERS[S.user], rule: rule, text: text }); }
  function dist(va) { return S.dists.filter(function (d) { return d.va === va; })[0]; }
  function invByNo(no) { return S.invoices.filter(function (i) { return i.no === no; })[0]; }

  /* ---------- the engine ---------- */
  function processReceipt(r) {
    var d = dist(r.va);
    if (!d) { log("BR-1", "Receipt " + inr(r.amount) + " on unknown account " + r.va + ": held for review, not applied."); S.receipts.push({ va: r.va, amount: r.amount, status: "Unidentified" }); return; }
    var inv = r.ref ? invByNo(r.ref) : null;
    if (!inv || inv.va !== d.va || inv.open <= 0) {
      inv = S.invoices.filter(function (i) { return i.va === d.va && i.open > 0; }).sort(function (a, b) { return b.age - a.age; })[0];
      if (!inv) { log("BR-1", d.name + ": " + inr(r.amount) + " received with no open invoice. Held as on-account credit."); return; }
      log("BR-1", d.name + ": no usable reference, applied to oldest open invoice " + inv.no + ".");
    } else log("BR-1", "Receipt " + inr(r.amount) + " tagged to " + d.name + " by virtual account; applied to " + inv.no + ".");
    var gap = inv.open - r.amount;
    inv.open = 0;
    var rec = { va: d.va, inv: inv.no, amount: r.amount, gap: Math.max(0, gap), tds: 0, accepted: 0, disputed: 0 };
    S.receipts.push(rec);
    if (gap <= 0) { log("BR-1", inv.no + " paid in full."); return; }
    var left = gap;
    /* Split: 194Q TDS once purchases cross ₹50 lakh, 0.1% of taxable value */
    if (d.purchases > 5000000) {
      var tds = Math.round(inv.taxable * 0.001);
      if (tds <= left) { rec.tds = tds; left -= tds; log("BR-2", inv.no + ": " + inr(tds) + " classified as TDS u/s 194Q (0.1% of " + inr(inv.taxable) + "), queued for the Form 26AS match. Not a loss."); }
    }
    /* Validate the distributor's declared claim */
    if (r.claimType && r.claimAmt > 0 && left > 0) {
      var amt = Math.min(r.claimAmt, left); left -= amt;
      var c = newCase(d, inv, r.claimType, amt, r.evidence);
      autoCheck(c, true);
      if (c.status === "Accepted") rec.accepted += amt; else rec.disputed += amt;
    }
    /* Anything still unexplained becomes a dispute; never written off */
    if (left > 0) {
      var u = newCase(d, inv, "Unexplained", left, false);
      rec.disputed += left;
      log("BR-4", inv.no + ": " + inr(left) + " unexplained. Case " + u.id + " opened for " + u.owner + "; never written off by a rule.");
    }
    creditCheck(d);
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
      log(first ? "BR-3" : "BR-3", c.id + " " + c.type.toLowerCase() + " " + inr(c.amount) + " → " + c.owner + " (" + c.reason + "). SLA day " + c.due + ".");
    }
  }

  function issueCN(c) {
    S.seq.cn++;
    var n = { id: "CN-" + (200 + S.seq.cn), caseId: c.id, dist: c.dist, amount: c.amount, issued: S.day, irpDue: S.day + 30, reported: false };
    S.notes.push(n); c.cn = n.id;
    log("BR-6", n.id + " issued for " + inr(c.amount) + " to " + c.dist + ". Report to IRP by day " + n.irpDue + " (alert at day " + (S.day + 20) + ").");
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
      else { c.status = "Accepted"; c.closedBy = USERS[S.user]; if (c.type === "Scheme claim") d.schemeLeft = Math.max(0, d.schemeLeft - c.amount); issueCN(c); log("BR-5", c.id + " approved by " + USERS[S.user] + (c.maker ? " (recommended by " + USERS[c.maker] + ")" : "") + "."); }
    }
    else if (what === "recover") { S.seq.dn++; c.status = "Recovered"; c.closedBy = USERS[S.user]; log("BR-4", c.id + ": " + inr(c.amount) + " found invalid. Debit note DN-" + (500 + S.seq.dn) + " raised; " + c.dist + " to pay."); }
    creditCheck(d); save(); if (!QUIET) render();
  }

  function nextDay() {
    S.day++;
    S.cases.forEach(function (c) { if (c.status === "Open" && S.day > c.due && !c.escalated) { c.escalated = true; c.owner = "AR lead (escalated)"; log("SLA", c.id + " passed its SLA (day " + c.due + "). Escalated to the AR lead; history kept."); } });
    S.notes.forEach(function (n) { if (!n.reported && S.day === n.issued + 20) log("BR-6", "Alert: " + n.id + " must be reported to the IRP by day " + n.irpDue + "."); });
    S.invoices.forEach(function (i) { i.age++; });
    S.dists.forEach(creditCheck);
    save(); if (!QUIET) render();
  }
  function order(va) {
    var d = dist(va), x = exposure(va);
    if (x.flagged) { log("BR-7", "New order from " + d.name + " flagged for credit review (" + inr(x.amt) + " disputed, oldest " + x.oldest + " days). Not blocked."); flash("Order placed and flagged for credit review: not blocked, a controller decides.", true); }
    else { log("BR-7", "New order from " + d.name + " passed the credit check."); flash("Order placed. Credit check passed.", false); }
    save(); if (!QUIET) render();
  }

  /* ---------- input ---------- */
  function parseCSV(text) {
    var rows = text.trim().split(/\r?\n/).map(function (l) { return l.split(",").map(function (x) { return x.trim(); }); });
    var head = rows.shift().map(function (h) { return h.toLowerCase(); });
    var ix = function (n) { return head.indexOf(n); };
    if (ix("virtual_account") < 0 || ix("amount") < 0) throw new Error("The file needs at least virtual_account and amount columns.");
    return rows.filter(function (r) { return r.length > 1 && r[ix("amount")]; }).map(function (r) {
      var g = function (n) { return ix(n) >= 0 ? r[ix(n)] : ""; };
      return { va: g("virtual_account").toUpperCase(), amount: Number(g("amount").replace(/[₹,\s]/g, "")) || 0, ref: g("reference").toUpperCase(), claimType: g("claim_type"), claimAmt: Number(g("claim_amount").replace(/[₹,\s]/g, "")) || 0, evidence: /^(y|yes|true|1)$/i.test(g("evidence")) };
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
    S.lastRun = list.length + " receipts · rules fired: " + Object.keys(fired).sort().map(function (k) { return k + "×" + fired[k]; }).join(", ") + " · " + (S.cases.length - cBefore) + " claims classified (" + S.cases.slice(cBefore).filter(function (c) { return c.closedBy === "Rule BR-3"; }).length + " auto-accepted, " + S.cases.slice(cBefore).filter(function (c) { return c.status === "Open"; }).length + " to an owner) · 0 unowned rupees";
    save(); render();
    flash(S.lastRun, false);
    $("cases").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- output ---------- */
  var flashT;
  function flash(msg, warn) { if (QUIET) return; var f = $("flash"); f.textContent = msg; f.className = "flash show" + (warn ? " warn" : ""); clearTimeout(flashT); flashT = setTimeout(function () { f.className = "flash"; }, 4200); }

  function render() {
    $("day").textContent = "Day " + S.day;
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
        "<button class='btn small primary' data-a='approve' data-id='" + c.id + "'>" + (c.maker && c.maker !== S.user ? "Approve (2nd)" : "Approve") + "</button>" +
        "<button class='btn small' data-a='recover' data-id='" + c.id + "'>Invalid: recover</button>";
      return "<article class='case" + (c.status !== "Open" ? " closed" : "") + (late ? " late" : "") + "'><header><b class='mono'>" + c.id + "</b><span class='type t-" + c.type.split(" ")[0].toLowerCase() + "'>" + esc(c.type) + "</span><b class='mono amt'>" + inr(c.amount) + "</b></header>" +
        "<p>" + esc(c.dist) + " · " + c.inv + (c.status === "Open" ? " · owner <b>" + esc(c.owner) + "</b> · SLA day " + c.due + (late ? " <span class='pill bad'>late</span>" : "") : "") + "</p>" +
        (c.checks ? "<table class='dt'><tr><th>Evidence</th><th>≤ limit</th><th>In budget</th><th>≤ 2× norm</th><th>BR-3 outcome</th></tr><tr>" + ["evidence", "limit", "budget", "norm"].map(function (k) { return "<td class='" + (c.checks[k] ? "y" : "n") + "'>" + (c.checks[k] ? "✓" : "✗") + "</td>"; }).join("") + "<td>" + (c.checks.evidence && c.checks.limit && c.checks.budget && c.checks.norm ? "Auto-accept" : "To " + esc(OWNERS[c.type])) + "</td></tr></table>" : "<p class='trace2'>" + (c.type === "Unexplained" ? "BR-4 · US-4 · UAT-07: no reason code, so it can't be auto-accepted or written off." : "") + "</p>") +
        (c.maker && c.status === "Open" ? "<p class='why'>Recommended by " + esc(USERS[c.maker]) + "; waiting for a second approver.</p>" : "") +
        "<div class='acts'>" + actions + "</div></article>";
    }).join("") : "<p class='empty'>No cases yet. Load today's bank statement above.</p>";

    $("dist-body").innerHTML = S.dists.map(function (d) { var x = exposure(d.va); return "<tr><td>" + esc(d.name) + "<br><span class='mono tiny'>" + d.va + "</span></td><td class='mono r'>" + inr(d.purchases) + (d.purchases > 5000000 ? "<br><span class='tiny'>194Q applies</span>" : "") + "</td><td class='mono r'>" + inr(d.schemeLeft) + "</td><td class='mono r'>" + (x.amt ? inr(x.amt) : "—") + (x.flagged ? "<br><span class='pill bad'>credit review</span>" : "") + "</td><td><button class='btn small' data-order='" + d.va + "'>New order</button></td></tr>"; }).join("");

    $("cn-body").innerHTML = S.notes.length ? S.notes.map(function (n) { var left = n.irpDue - S.day; return "<tr><td class='mono'>" + n.id + "</td><td>" + esc(n.dist.split(",")[0]) + "</td><td class='mono r'>" + inr(n.amount) + "</td><td class='mono r'>" + (left >= 0 ? left + " days" : "<span class='pill bad'>overdue</span>") + "</td></tr>"; }).join("") : "<tr><td colspan='4' class='empty'>None yet.</td></tr>";

    $("log").innerHTML = S.log.length ? S.log.slice(0, 60).map(function (l) { return "<li><span class='mono'>Day " + l.day + "</span> <span class='rule'>" + esc(l.rule) + "</span> " + esc(l.text) + "</li>"; }).join("") : "<li class='empty'>Nothing yet.</li>";
  }

  function download(name, text, type) { var b = new Blob([text], { type: type }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function csv(rows) { return "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); }


  /* ---------- UAT runner: executes the BRD's acceptance tests against this engine ---------- */
  function scenario(fn) {
    var keep = S; QUIET = true; S = seed();
    var out; try { out = fn(); } catch (e) { out = { pass: false, actual: "Error: " + e.message }; }
    S = keep; QUIET = false; return out;
  }
  var R = function (va, amount, ref, type, camt, ev) { return { va: va, amount: amount, ref: ref || "", claimType: type || "", claimAmt: camt || 0, evidence: !!ev }; };
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
  $("add").onsubmit = function (e) {
    e.preventDefault();
    var r = { va: $("f-va").value, amount: Number($("f-amt").value) || 0, ref: $("f-ref").value, claimType: $("f-type").value, claimAmt: Number($("f-camt").value) || 0, evidence: $("f-ev").checked };
    if (!r.amount) { flash("Enter the amount received.", true); return; }
    log("Import", "Receipt entered by hand."); processReceipt(r); save(); render(); flash("Receipt processed.", false);
  };
  $("f-va").innerHTML = S.dists.map(function (d) { return "<option value='" + d.va + "'>" + esc(d.name) + "</option>"; }).join("");
  var refill = function () { $("f-ref").innerHTML = "<option value=''>No reference</option>" + S.invoices.filter(function (i) { return i.va === $("f-va").value && i.open > 0; }).map(function (i) { return "<option>" + i.no + "</option>"; }).join(""); };
  $("f-va").onchange = refill; refill();
  $("who").onchange = function () { S.user = $("who").value; log("User", "Switched to " + USERS[S.user] + "."); save(); render(); };
  ["tolerance", "approval"].forEach(function (k) { $("set-" + k).onchange = function () { S.settings[k] = Math.max(0, Number(this.value) || 0); log("Setting", k + " set to " + inr(S.settings[k]) + " by " + USERS[S.user] + "."); save(); render(); }; });
  $("next-day").onclick = nextDay;
  $("run-uat").onclick = runUAT;
  if (/[?&]uat=1/.test(location.search)) setTimeout(runUAT, 300);
  if (location.hash === "#rules") { var dr = $("rules"); if (dr) dr.open = true; }
  $("reset").onclick = function () { S = seed(); save(); render(); refill(); flash("Reset to a fresh morning.", false); };
  $("dl-cases").onclick = function () { download("cases.csv", csv([["Case", "Distributor", "Invoice", "Type", "Amount", "Owner", "Status", "Opened (day)", "SLA (day)", "Credit note"]].concat(S.cases.map(function (c) { return [c.id, c.dist, c.inv, c.type, c.amount, c.owner, c.status, c.opened, c.due, c.cn || ""]; }))), "text/csv"); };
  $("dl-log").onclick = function () { download("audit-trail.csv", csv([["Day", "User", "Rule", "Event"]].concat(S.log.slice().reverse().map(function (l) { return [l.day, l.who, l.rule, l.text]; }))), "text/csv"); };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (b) act(b.dataset.id, b.dataset.a);
    var o = e.target.closest("[data-order]"); if (o) order(o.dataset.order);
  });
})();
