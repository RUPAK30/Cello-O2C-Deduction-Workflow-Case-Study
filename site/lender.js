/* Lender mode: EMI collections and NACH returns. Same discipline as the brand desk:
   every rupee matched, every bounce classified by its NPCI reason, every overdue loan owned, nothing written off by a rule.
   Synthetic data; runs in the browser only. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { n = Math.round(n); return (n < 0 ? "−₹" : "₹") + Math.abs(n).toLocaleString("en-IN"); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var KEY = "o2c.lender.v1", QUIET = false;
  var USERS = { maker: "Neha (Collections executive)", checker: "Arvind (Collections manager)" };
  var D0 = new Date(2026, 10, 5);
  function dateOf(day) { var d = new Date(D0); d.setDate(d.getDate() + day); return d; }
  function fmt(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

  /* NPCI NACH return reasons (published codes). What each means for the next action. */
  var CODES = {
    "04": { why: "Balance insufficient", act: "re-present", owner: "Collections caller", plain: "Not enough money in the account. Re-present after the borrower is contacted." },
    "68": { why: "Account blocked or frozen", act: "re-present", owner: "Collections caller", plain: "Account temporarily blocked. Re-present once it is unfrozen." },
    "59": { why: "Network failure (CBS)", act: "technical", owner: "Payments ops", plain: "The bank's system failed, not the borrower. Re-present; no penal charge." },
    "01": { why: "Account closed", act: "mandate", owner: "Mandate ops", plain: "The account is closed. Re-presenting is pointless: get a fresh mandate." },
    "02": { why: "No such account", act: "mandate", owner: "Mandate ops", plain: "The account doesn't exist. Get a fresh mandate." },
    "14": { why: "Mandate expired", act: "mandate", owner: "Mandate ops", plain: "The mandate has expired. Get a fresh mandate." },
    "61": { why: "Mandate cancelled", act: "mandate", owner: "Mandate ops", plain: "The borrower cancelled the mandate. Contact them and get a fresh one." },
    "06": { why: "Payment stopped by drawer", act: "contact", owner: "Collections lead", plain: "The borrower stopped the payment. Talk to them first: it may be a dispute." },
    "17": { why: "Returned as per customer request", act: "contact", owner: "Collections lead", plain: "Returned at the borrower's request. Talk to them first: it may be a dispute." }
  };

  function seed() {
    return {
      day: 0, user: "maker", seq: { cs: 0, jv: 0 },
      settings: { penal: 500, retries: 2, waiver: 1000, sla: 1 },
      loans: [
        { id: "LN-24011", name: "Ravi Patil", product: "Two-wheeler loan", umrn: "HDFC7000000011", emi: 4850, int: 1050, prin: 3800, dpd: 0, overdue: 0, penal: 0, retries: 0, funds: true },
        { id: "LN-24012", name: "Sunita More", product: "Personal loan", umrn: "HDFC7000000012", emi: 7200, int: 2100, prin: 5100, dpd: 0, overdue: 0, penal: 0, retries: 0, funds: true },
        { id: "LN-24013", name: "Imran Shaikh", product: "Consumer durable loan", umrn: "HDFC7000000013", emi: 3900, int: 600, prin: 3300, dpd: 0, overdue: 0, penal: 0, retries: 0, funds: true },
        { id: "LN-24014", name: "Kavita Rao", product: "Personal loan", umrn: "HDFC7000000014", emi: 12500, int: 3900, prin: 8600, dpd: 0, overdue: 0, penal: 0, retries: 0, funds: true },
        { id: "LN-24015", name: "Arjun Desai", product: "Two-wheeler loan", umrn: "HDFC7000000015", emi: 6100, int: 1300, prin: 4800, dpd: 0, overdue: 0, penal: 0, retries: 0, funds: true },
        { id: "LN-24016", name: "Meena Joshi", product: "Kisan farm loan", umrn: "HDFC7000000016", emi: 5400, int: 1500, prin: 3900, dpd: 35, overdue: 5400, odInt: 1500, odPrin: 3900, penal: 500, retries: 2, funds: false }
      ],
      cases: [], log: [], journal: [], suspense: 0, presented: 0, collected: 0, carried: 5400
    };
  }

  /* Today's NACH result file (5 Nov EMI date) plus UPI receipts. */
  var SAMPLE = [
    "channel,loan_id,umrn,amount_due,amount_collected,return_code",
    "NACH,LN-24011,HDFC7000000011,4850,4850,",
    "NACH,LN-24012,HDFC7000000012,7200,0,04",
    "NACH,LN-24013,HDFC7000000013,3900,0,01",
    "NACH,LN-24014,HDFC7000000014,12500,0,06",
    "NACH,LN-24015,HDFC7000000015,6100,0,59",
    "UPI,LN-24016,,0,3000,",
    "UPI,LN-29999,,0,2000,"
  ].join("\n");

  var S;
  function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || !S.loans) S = seed(); }
  function save() { if (QUIET) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function log(rule, text) { S.log.unshift({ day: S.day, who: USERS[S.user], rule: rule, text: text }); }
  function loan(id) { return S.loans.filter(function (l) { return l.id === id; })[0]; }
  function post(type, ref, narr, lines) { S.seq.jv++; S.journal.push({ id: (type === "Receipt" ? "RV-" : "JV-") + (2000 + S.seq.jv), day: S.day, type: type, ref: ref, narr: narr, lines: lines }); }
  /* RBI prudential framework: SMA-0 1–30 days, SMA-1 31–60, SMA-2 61–90, NPA beyond 90. */
  function sma(dpd) { return dpd <= 0 ? "Standard" : dpd <= 30 ? "SMA-0" : dpd <= 60 ? "SMA-1" : dpd <= 90 ? "SMA-2" : "NPA"; }

  function openCase(l, kind, code, amount) {
    S.seq.cs++;
    var c = { id: "K-" + (5100 + S.seq.cs), loan: l.id, name: l.name, kind: kind, code: code || "", amount: amount, owner: code ? CODES[code].owner : "Collections caller", opened: S.day, due: S.day + S.settings.sla, status: "Open", contacted: false };
    S.cases.push(c); return c;
  }
  function raisePenal(l, c) {
    var p = S.settings.penal; l.penal += p;
    post("Journal", l.id, "Penal charge for EMI bounce (a charge, not interest)", [["Penal charges receivable · " + l.name, p, 0], ["Penal charges income", 0, p]]);
    log("LR-3", l.id + ": penal charge " + inr(p) + " raised as a separate charge. Not added to principal; no interest will be computed on it.");
    if (c) c.penal = p;
  }

  /* ---------- engine ---------- */
  function process(r) {
    var l = loan(r.loan);
    if (!l || (r.umrn && r.umrn !== l.umrn)) {
      S.suspense += r.collected;
      post("Receipt", r.loan || "?", "Unmatched collection held in suspense", [["Bank (collections)", r.collected, 0], ["Suspense: unmatched collections", 0, r.collected]]);
      log("LR-1", r.channel + " " + inr(r.collected) + " for " + (r.loan || "no loan ID") + " matched no loan and mandate. Parked in suspense with Payments ops; applied to nothing.");
      return;
    }
    if (r.channel === "NACH") S.presented += r.due;
    if (r.collected > 0 && !r.code) {
      if (r.channel === "UPI" && l.overdue > 0) return appropriate(l, r.collected, "UPI");
      S.collected += r.collected;
      post("Receipt", l.id, "EMI via " + r.channel + " from " + l.name, [["Bank (collections)", r.collected, 0], ["Interest receivable · " + l.name, 0, l.int], ["Loan principal · " + l.name, 0, r.collected - l.int]]);
      log("LR-1", l.id + ": EMI " + inr(r.collected) + " collected via " + r.channel + " and matched by loan ID and mandate " + l.umrn + ". Interest " + inr(l.int) + " and principal " + inr(r.collected - l.int) + " posted separately.");
      return;
    }
    var k = CODES[r.code];
    if (!k) { log("LR-2", l.id + ": return code " + r.code + " not in the rule table. Case opened for Payments ops."); openCase(l, "Unknown return", "", r.due); return; }
    l.overdue = (l.overdue || 0) + l.emi; l.odInt = (l.odInt || 0) + l.int; l.odPrin = (l.odPrin || 0) + l.prin; if (l.dpd === 0) l.dpd = 1;
    var c = openCase(l, k.why, r.code, l.emi);
    if (k.act === "re-present" || k.act === "technical") { c.next = "Re-present"; }
    else if (k.act === "mandate") { c.next = "Fresh mandate"; }
    else { c.next = "Contact first"; }
    log("LR-2", l.id + ": NACH returned, code " + r.code + " (" + k.why + "). " + k.plain + " Case " + c.id + " to " + c.owner + ", contact within " + S.settings.sla + " day.");
    if (k.act === "technical") log("LR-3", l.id + ": no penal charge. The bounce was the bank's system (code 59), not the borrower (lender policy).");
    else if (k.act === "contact") { c.penalHeld = true; log("LR-3", l.id + ": penal charge held until the borrower is contacted. If the stop is a genuine dispute, charging first would be unfair."); }
    else raisePenal(l, c);
  }

  /* LR-4: partial payment appropriation in the lender's disclosed order: overdue interest, then overdue principal, then charges. */
  function appropriate(l, amt, channel) {
    var left = amt, lines = [["Bank (collections)", amt, 0]], parts = [];
    var a = Math.min(left, l.odInt || 0); if (a) { left -= a; l.odInt -= a; lines.push(["Interest receivable · " + l.name, 0, a]); parts.push("interest " + inr(a)); }
    var b = Math.min(left, l.odPrin || 0); if (b) { left -= b; l.odPrin -= b; lines.push(["Loan principal · " + l.name, 0, b]); parts.push("principal " + inr(b)); }
    var p = Math.min(left, l.penal || 0); if (p) { left -= p; l.penal -= p; lines.push(["Penal charges receivable · " + l.name, 0, p]); parts.push("penal charge " + inr(p)); }
    if (left > 0) { lines.push(["Borrower advance · " + l.name, 0, left]); parts.push("advance " + inr(left)); }
    l.overdue = (l.odInt || 0) + (l.odPrin || 0);
    S.collected += amt;
    post("Receipt", l.id, "Part payment via " + channel + " from " + l.name, lines);
    log("LR-4", l.id + ": " + inr(amt) + " via " + channel + " applied in the disclosed order: " + parts.join(", ") + ". Still overdue " + inr(l.overdue) + (l.penal ? " plus penal charge " + inr(l.penal) : "") + ". No interest charged on the penal charge.");
    if (l.overdue > 0 && !S.cases.some(function (c) { return c.loan === l.id && c.status === "Open"; })) { var c = openCase(l, "Part-paid overdue", "", l.overdue); c.next = "Contact first"; c.owner = "Collections caller"; log("LR-4", l.id + ": " + sma(l.dpd) + " at " + l.dpd + " days past due. Case " + c.id + " to the Collections caller."); }
    if (l.overdue === 0) { l.dpd = 0; S.cases.forEach(function (c) { if (c.loan === l.id && c.status === "Open") { c.status = "Paid"; c.closedBy = "Payment " + channel; } }); log("LR-4", l.id + ": overdue cleared; loan back to Standard."); }
  }

  function act(id, what) {
    var c = S.cases.filter(function (x) { return x.id === id; })[0]; if (!c || c.status !== "Open") return;
    var l = loan(c.loan);
    if (what === "contact") { c.contacted = true; c.due = S.day + 3; if (c.penalHeld) { c.penalHeld = false; raisePenal(l, c); } log("LR-4", c.id + ": " + l.name + " contacted by " + USERS[S.user] + ". Promise to pay recorded; next action due day " + c.due + "."); }
    else if (what === "represent") {
      if (c.next !== "Re-present") { log("LR-2", "Blocked: " + c.id + " (" + c.kind + ") cannot be re-presented. " + (c.next === "Fresh mandate" ? "The mandate is dead; a fresh mandate is needed." : "Talk to the borrower first.")); flash("Blocked: this return code can't be re-presented.", true); }
      else if (l.retries >= S.settings.retries) { c.owner = "Collections lead"; c.next = "Field visit"; log("LR-2", "Blocked: " + l.id + " already re-presented " + l.retries + " times (lender's limit " + S.settings.retries + "). Escalated to the Collections lead for a field visit."); flash("Re-presentation limit reached. Escalated to the Collections lead.", true); }
      else {
        l.retries++;
        if (l.funds) { var paid = l.overdue; appropriate(l, paid, "NACH re-presentation"); log("LR-2", l.id + ": re-presentation " + l.retries + " of " + S.settings.retries + " succeeded."); }
        else { if (c.code !== "59") raisePenal(l, c); log("LR-2", l.id + ": re-presentation " + l.retries + " of " + S.settings.retries + " returned again (insufficient balance)."); }
      }
    }
    else if (what === "mandate") { c.next = "Mandate requested"; c.status = "Mandate sent"; c.closedBy = USERS[S.user]; log("LR-2", c.id + ": fresh e-mandate link sent to " + l.name + " by " + USERS[S.user] + ". EMI stays overdue until collected."); }
    else if (what === "waive") {
      var p = l.penal; if (!p) { flash("No penal charge to waive.", true); return; }
      if (p > S.settings.waiver && c.waiveBy === S.user) { log("LR-5", "Blocked: " + USERS[S.user] + " tried to approve their own waiver of " + inr(p) + " on " + l.id + ". Needs a second approver."); flash("Blocked by maker-checker: switch to the Collections manager.", true); }
      else if (p > S.settings.waiver && !c.waiveBy) { c.waiveBy = S.user; log("LR-5", c.id + ": waiver of " + inr(p) + " recommended by " + USERS[S.user] + "; above " + inr(S.settings.waiver) + ", a second person approves."); flash("Recommended. A second person must approve this waiver.", false); }
      else { l.penal = 0; post("Journal", l.id, "Penal charge waived", [["Penal charges waived", p, 0], ["Penal charges receivable · " + l.name, 0, p]]); log("LR-5", l.id + ": penal charge " + inr(p) + " waived by " + USERS[S.user] + (c.waiveBy ? " (recommended by " + USERS[c.waiveBy] + ")" : "") + ". The EMI itself is still owed; nothing is written off."); }
    }
    save(); if (!QUIET) render();
  }

  function nextDay() {
    S.day++;
    S.loans.forEach(function (l) { if (l.overdue > 0) { var before = sma(l.dpd); l.dpd++; var after = sma(l.dpd); if (before !== after) log("LR-4", l.id + " moved from " + before + " to " + after + " at " + l.dpd + " days past due."); } });
    S.cases.forEach(function (c) { if (c.status === "Open" && S.day > c.due && !c.escalated) { c.escalated = true; c.owner = "Collections lead (escalated)"; log("SLA", c.id + ": no borrower contact by day " + c.due + ". Escalated to the Collections lead."); } });
    save(); if (!QUIET) render();
  }

  function parse(text) {
    var rows = text.trim().split(/\r?\n/).map(function (l) { return l.split(",").map(function (x) { return x.trim(); }); });
    var h = rows.shift().map(function (x) { return x.toLowerCase(); }), ix = function (n) { return h.indexOf(n); };
    if (ix("loan_id") < 0 || ix("amount_collected") < 0) throw new Error("The file needs loan_id and amount_collected columns.");
    return rows.filter(function (r) { return r.length > 1; }).map(function (r) { var g = function (n) { return ix(n) >= 0 ? r[ix(n)] : ""; }; return { channel: (g("channel") || "NACH").toUpperCase(), loan: g("loan_id").toUpperCase(), umrn: g("umrn").toUpperCase(), due: Number(g("amount_due")) || 0, collected: Number(g("amount_collected")) || 0, code: g("return_code").padStart(g("return_code") ? 2 : 0, "0") }; });
  }
  function run(text, label) {
    var list; try { list = parse(text); } catch (e) { flash(e.message, true); return; }
    log("Import", label + ": " + list.length + " lines."); list.forEach(process); save(); render();
    flash(list.length + " lines processed · " + S.cases.filter(function (c) { return c.status === "Open"; }).length + " cases with an owner · 0 unowned rupees", false);
  }

  /* ---------- output ---------- */
  var flashT;
  function flash(msg, warn) { if (QUIET) return; var f = $("flash"); f.textContent = msg; f.className = "flash show" + (warn ? " warn" : ""); clearTimeout(flashT); flashT = setTimeout(function () { f.className = "flash"; }, 4200); }
  function tower() {
    var b = { "SMA-0": 0, "SMA-1": 0, "SMA-2": 0, "NPA": 0 }, cnt = { re: 0, mandate: 0, contact: 0 };
    S.loans.forEach(function (l) { var k = sma(l.dpd); if (l.overdue > 0 && b[k] != null) b[k] += l.overdue; });
    S.cases.forEach(function (c) { if (c.status !== "Open") return; if (c.next === "Re-present") cnt.re++; else if (c.next === "Fresh mandate") cnt.mandate++; else cnt.contact++; });
    var pending = S.cases.filter(function (c) { return c.status === "Open" && c.waiveBy; }).length;
    return { b: b, cnt: cnt, eff: S.presented ? Math.round(S.collected / (S.presented + S.carried) * 100) : 0, suspense: S.suspense, pending: pending, penal: S.loans.reduce(function (s, l) { return s + (l.penal || 0); }, 0) };
  }
  function render() {
    $("day").textContent = "Day " + S.day + " · " + fmt(dateOf(S.day));
    $("who").value = S.user;
    var t = tower(), od = S.loans.reduce(function (s, l) { return s + (l.overdue || 0); }, 0), open = S.cases.filter(function (c) { return c.status === "Open"; });
    $("k-due").textContent = S.presented ? inr(S.presented) : "—";
    $("k-col").textContent = S.presented ? inr(S.collected) : "—";
    $("k-od").textContent = S.presented ? inr(od) : "—";
    $("k-open").textContent = open.length;
    $("k-unowned").textContent = S.presented ? "₹0" : "—";
    $("loan-body").innerHTML = S.loans.map(function (l) { var k = sma(l.dpd); return "<tr><td><b>" + esc(l.name) + "</b><br><span class='mono tiny'>" + l.id + " · " + esc(l.product) + "</span></td><td class='mono r'>" + inr(l.emi) + "</td><td class='mono r'>" + (l.overdue ? inr(l.overdue) : "—") + "</td><td class='mono r'>" + (l.penal ? inr(l.penal) : "—") + "</td><td><span class='sma " + k.toLowerCase().replace("-", "") + "'>" + k + "</span><br><span class='tiny'>" + l.dpd + " DPD</span></td></tr>"; }).join("");
    $("case-list").innerHTML = S.cases.length ? S.cases.slice().reverse().map(function (c) {
      var l = loan(c.loan), late = c.status === "Open" && S.day > c.due, k = CODES[c.code];
      var acts = c.status !== "Open" ? "<span class='pill " + (c.status === "Paid" ? "ok" : "bad") + "'>" + esc(c.status) + "</span><span class='by'>by " + esc(c.closedBy || "") + "</span>" :
        (c.contacted ? "" : "<button class='btn small' data-k='contact' data-id='" + c.id + "'>Log borrower contact</button>") +
        (c.next === "Re-present" ? "<button class='btn small primary' data-k='represent' data-id='" + c.id + "'>Re-present EMI</button>" : "") +
        (c.next === "Fresh mandate" ? "<button class='btn small primary' data-k='mandate' data-id='" + c.id + "'>Send fresh e-mandate</button>" : "") +
        (l.penal ? "<button class='btn small' data-k='waive' data-id='" + c.id + "'>" + (c.waiveBy && c.waiveBy !== S.user ? "Approve waiver (2nd)" : "Waive penal " + inr(l.penal)) + "</button>" : "");
      return "<article class='case" + (c.status !== "Open" ? " closed" : "") + (late ? " late" : "") + "'><header><b class='mono'>" + c.id + "</b><span class='type'>" + (c.code ? "NACH " + c.code + " · " : "") + esc(c.kind) + "</span><b class='mono amt'>" + inr(c.amount) + "</b></header>" +
        "<p>" + esc(c.name) + " · " + c.loan + (c.status === "Open" ? " · owner <b>" + esc(c.owner) + "</b> · contact by day " + c.due + (late ? " <span class='pill bad'>late</span>" : "") : "") + "</p>" +
        (k ? "<p class='why2b'>" + esc(k.plain) + "</p>" : "") +
        "<p class='tiny'>Next action: <b>" + esc(c.next || "") + "</b> · re-presented " + l.retries + " of " + S.settings.retries + (c.contacted ? " · borrower contacted" : "") + "</p>" +
        "<div class='acts'>" + acts + "</div></article>";
    }).join("") : "<p class='empty'>No cases yet. Load today's collection file above.</p>";
    var mx = Math.max(1, t.b["SMA-0"], t.b["SMA-1"], t.b["SMA-2"], t.b.NPA);
    $("tower-body").innerHTML = "<div class='tw4'><div class='tw'><span>Collection efficiency</span><b>" + (S.presented ? t.eff + "%" : "—") + "</b><em>Collected ÷ due today, incl. carried-over overdue</em></div>" +
      "<div class='tw'><span>Unmatched collections</span><b>" + inr(t.suspense) + "</b><em>In suspense, applied to no loan</em></div>" +
      "<div class='tw" + (t.cnt.mandate ? " warn" : "") + "'><span>Dead mandates</span><b>" + t.cnt.mandate + "</b><em>Need a fresh e-mandate; re-presenting would only bounce</em></div>" +
      "<div class='tw'><span>Penal charges open</span><b>" + inr(t.penal) + "</b><em>Separate from principal; no interest on them" + (t.pending ? " · " + t.pending + " waiver awaiting 2nd approval" : "") + "</em></div></div>" +
      "<div class='tw2'><div class='card'><h3>Overdue by RBI bucket</h3>" + ["SMA-0", "SMA-1", "SMA-2", "NPA"].map(function (k) { return "<div class='agerow'><span>" + k + " <em class='tiny'>" + { "SMA-0": "1–30 DPD", "SMA-1": "31–60", "SMA-2": "61–90", NPA: "90+" }[k] + "</em></span><i style='width:" + Math.round(t.b[k] / mx * 100) + "%'></i><b class='mono'>" + inr(t.b[k]) + "</b></div>"; }).join("") + "</div>" +
      "<div class='card'><h3>Today's bounces, by next action</h3><div class='agerow'><span>Re-present</span><b class='mono'>" + t.cnt.re + "</b></div><div class='agerow'><span>Fresh mandate</span><b class='mono'>" + t.cnt.mandate + "</b></div><div class='agerow'><span>Talk to borrower first</span><b class='mono'>" + t.cnt.contact + "</b></div><p class='tiny' style='margin-top:8px'>Each NPCI return code decides the next action, so no one re-presents a closed account.</p></div></div>";
    var dr = 0, cr = 0; S.journal.forEach(function (v) { v.lines.forEach(function (x) { dr += x[1]; cr += x[2]; }); });
    $("jv-sum").innerHTML = S.journal.length + " vouchers · debits " + inr(dr) + " · credits " + inr(cr) + " · " + (dr === cr ? "<span class='pill ok'>balanced</span>" : "<span class='pill bad'>out of balance</span>");
    $("jv-body").innerHTML = S.journal.length ? S.journal.slice().reverse().slice(0, 40).map(function (v) { return "<tr class='vh'><td class='mono'>" + v.id + "</td><td colspan='3'>" + esc(v.type) + " · " + esc(v.ref) + " · " + esc(v.narr) + "</td></tr>" + v.lines.map(function (x) { return "<tr><td></td><td>" + (x[2] ? "&nbsp;&nbsp;To " : "") + esc(x[0]) + "</td><td class='mono r'>" + (x[1] ? inr(x[1]) : "") + "</td><td class='mono r'>" + (x[2] ? inr(x[2]) : "") + "</td></tr>"; }).join(""); }).join("") : "<tr><td colspan='4' class='empty'>No postings yet.</td></tr>";
    $("log").innerHTML = S.log.length ? S.log.slice(0, 60).map(function (x) { return "<li><span class='mono'>Day " + x.day + "</span> <span class='rule'>" + esc(x.rule) + "</span> " + esc(x.text) + "</li>"; }).join("") : "<li class='empty'>Nothing yet.</li>";
  }

  function download(name, text) { var b = new Blob([text], { type: "text/csv" }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function csv(rows) { return "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); }

  /* ---------- tests ---------- */
  function scenario(fn) { var keep = S; QUIET = true; S = seed(); var o; try { o = fn(); } catch (e) { o = { pass: false, actual: "Error: " + e.message }; } S = keep; QUIET = false; return o; }
  var L = function (ch, id, due, col, code) { return { channel: ch, loan: id, umrn: (loan(id) || {}).umrn || "", due: due, collected: col, code: code || "" }; };
  var caseOf = function (id) { return S.cases.filter(function (c) { return c.loan === id; }).slice(-1)[0]; };
  var balanced = function () { return S.journal.every(function (v) { var d = 0, k = 0; v.lines.forEach(function (x) { d += x[1]; k += x[2]; }); return d === k; }); };
  var TESTS = [
    ["LT-01", "LR-1", "EMI collected on its mandate", "Interest and principal posted separately; balanced", function () { process(L("NACH", "LN-24011", 4850, 4850)); var v = S.journal[0]; return { pass: v.lines.length === 3 && balanced() && !S.cases.length, actual: v.lines.map(function (x) { return x[0].split(" ·")[0]; }).join(" / ") }; }],
    ["LT-02", "LR-2, LR-3", "NACH return 04, balance insufficient", "Case to Collections caller; re-present allowed; one penal charge", function () { process(L("NACH", "LN-24012", 7200, 0, "04")); var c = caseOf("LN-24012"), l = loan("LN-24012"); return { pass: c.next === "Re-present" && c.owner === "Collections caller" && l.penal === 500, actual: c.next + ", owner " + c.owner + ", penal " + inr(l.penal) }; }],
    ["LT-03", "LR-2", "NACH return 01, account closed; then re-present (negative)", "Blocked: fresh mandate needed, not a re-presentation", function () { process(L("NACH", "LN-24013", 3900, 0, "01")); var c = caseOf("LN-24013"); act(c.id, "represent"); return { pass: c.next === "Fresh mandate" && loan("LN-24013").retries === 0 && /Blocked/.test(S.log[0].text), actual: c.next + "; re-presented " + loan("LN-24013").retries + " times" }; }],
    ["LT-04", "LR-2, LR-3", "NACH return 59, bank network failure", "Re-present; no penal charge on the borrower", function () { process(L("NACH", "LN-24015", 6100, 0, "59")); var c = caseOf("LN-24015"); return { pass: c.next === "Re-present" && loan("LN-24015").penal === 0, actual: c.next + ", penal " + inr(loan("LN-24015").penal) }; }],
    ["LT-05", "LR-4, LR-3", "₹3,000 UPI part payment on an overdue loan", "Interest first, then principal, then charges; no interest on the penal charge", function () { process(L("UPI", "LN-24016", 0, 3000)); var l = loan("LN-24016"); return { pass: l.odInt === 0 && l.odPrin === 2400 && l.penal === 500 && balanced(), actual: "Overdue interest " + inr(l.odInt) + ", principal " + inr(l.odPrin) + ", penal " + inr(l.penal) }; }],
    ["LT-06", "LR-2", "Third re-presentation after two returns (negative)", "Blocked at the lender's limit; escalated to the Collections lead", function () { var l = loan("LN-24012"); l.funds = false; process(L("NACH", "LN-24012", 7200, 0, "04")); var c = caseOf("LN-24012"); act(c.id, "represent"); act(c.id, "represent"); act(c.id, "represent"); return { pass: l.retries === 2 && c.owner === "Collections lead" && c.next === "Field visit", actual: "Re-presented " + l.retries + "; owner " + c.owner }; }],
    ["LT-07", "LR-5", "Executive approves own ₹1,500 waiver (negative)", "Blocked; needs a second approver; the EMI is still owed", function () { process(L("NACH", "LN-24012", 7200, 0, "04")); var l = loan("LN-24012"); l.penal = 1500; var c = caseOf("LN-24012"); act(c.id, "waive"); act(c.id, "waive"); var blocked = l.penal === 1500; S.user = "checker"; act(c.id, "waive"); return { pass: blocked && l.penal === 0 && l.overdue === 7200, actual: (blocked ? "Blocked for maker" : "Not blocked") + "; after checker penal " + inr(l.penal) + ", EMI owed " + inr(l.overdue) }; }],
    ["LT-08", "LR-1", "UPI payment for an unknown loan (negative)", "Parked in suspense; applied to no loan", function () { process({ channel: "UPI", loan: "LN-29999", umrn: "", due: 0, collected: 2000, code: "" }); return { pass: S.suspense === 2000 && S.loans.every(function (l) { return l.id === "LN-24016" || !l.overdue; }), actual: "Suspense " + inr(S.suspense) }; }],
    ["LT-10", "LR-3", "NACH return 06, payment stopped by the borrower", "Penal charge held until contact; raised only after", function () { process(L("NACH", "LN-24014", 12500, 0, "06")); var l = loan("LN-24014"), held = l.penal === 0, c = caseOf("LN-24014"); act(c.id, "contact"); return { pass: held && l.penal === 500 && c.owner === "Collections lead", actual: "Before contact " + (held ? "no charge" : "charged") + "; after " + inr(l.penal) }; }],
    ["LT-09", "LR-4", "Unpaid EMI ages 31 days", "Reclassified SMA-0 to SMA-1; case escalated after missed contact", function () { process(L("NACH", "LN-24012", 7200, 0, "04")); for (var i = 0; i < 30; i++) nextDay(); var l = loan("LN-24012"), c = caseOf("LN-24012"); return { pass: sma(l.dpd) === "SMA-1" && c.escalated, actual: l.dpd + " DPD, " + sma(l.dpd) + ", owner " + c.owner }; }]
  ];
  function runUAT() {
    var rows = TESTS.map(function (t) { var o = scenario(t[4]); return [t[0], t[1], t[2], t[3], o.actual, o.pass]; });
    var passed = rows.filter(function (r) { return r[5]; }).length;
    $("uat-sum").textContent = passed + " of " + rows.length + " passed · run against this page's engine on fresh data, your desk untouched";
    $("uat-body").innerHTML = rows.map(function (r) { return "<tr><td class='mono'>" + r[0] + "</td><td class='tiny'>" + r[1] + "</td><td>" + esc(r[2]) + "<br><span class='tiny'>Expected: " + esc(r[3]) + "</span></td><td class='tiny'>" + esc(r[4]) + "</td><td><span class='pill " + (r[5] ? "ok'>Pass" : "bad'>Fail") + "</span></td></tr>"; }).join("");
    $("uat").hidden = false; $("uat").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- wiring ---------- */
  load(); render();
  $("load-sample").onclick = function () { if (S.presented) { flash("Today's file is already loaded. Reset to start the day again.", true); return; } run(SAMPLE, "Today's NACH result file + UPI receipts"); };
  $("dl-sample").onclick = function () { download("sample-nach-results.csv", SAMPLE); };
  $("file").onchange = function (e) { var f = e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { run(String(rd.result), f.name); }; rd.readAsText(f); e.target.value = ""; };
  $("who").onchange = function () { S.user = $("who").value; log("User", "Switched to " + USERS[S.user] + "."); save(); render(); };
  $("next-day").onclick = nextDay;
  $("reset").onclick = function () { S = seed(); save(); render(); flash("Reset to a fresh morning.", false); };
  $("run-uat").onclick = runUAT;
  $("dl-jv").onclick = function () { var rows = [["Voucher No", "Date", "Voucher Type", "Ledger", "Debit", "Credit", "Reference", "Narration"]]; S.journal.forEach(function (v) { v.lines.forEach(function (x) { rows.push([v.id, fmt(dateOf(v.day)), v.type, x[0], x[1] || "", x[2] || "", v.ref, v.narr]); }); }); download("lender-journal.csv", csv(rows)); };
  $("dl-log").onclick = function () { download("lender-audit-trail.csv", csv([["Day", "User", "Rule", "Event"]].concat(S.log.slice().reverse().map(function (x) { return [x.day, x.who, x.rule, x.text]; })))); };
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-k]"); if (b) act(b.dataset.id, b.dataset.k); });
  if (/[?&]uat=1/.test(location.search)) setTimeout(runUAT, 300);
  window.LENDER = { tower: tower };
})();
