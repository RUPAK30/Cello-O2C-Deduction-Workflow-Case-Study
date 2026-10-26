(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + n.toLocaleString("en-IN"); };

  /* ---------- shared data: stories and UAT (rendered on the page and exported) ---------- */
  var STORIES = [
    ["US-1", "Identify payer", "As an AR executive, I want each receipt tagged to its distributor, so I never identify payers from bank narrations.", "Given a receipt on a distributor's virtual account with no reference, when it is imported, then it is applied to that distributor's oldest open invoice and logged."],
    ["US-2", "Expect TDS", "As an AR lead, I want TDS separated from deductions, so tax credits are not chased as losses.", "Given a distributor past the ₹50 lakh purchase threshold, when a receipt is short by the expected 0.1%, then the amount is classified as TDS and queued for the Form 26AS match."],
    ["US-3", "Auto-accept evidenced claims", "As a Finance Controller, I want evidenced, in-budget claims under tolerance accepted automatically, so people work only exceptions.", "Given a scheme claim with its circular attached, within budget, under tolerance and within 2x the distributor's norm, when it is validated, then it is accepted and the rule that accepted it is recorded."],
    ["US-4", "Route disputes", "As an AR lead, I want every unevidenced deduction to open a case with a reason code, owner and SLA, so nothing waits for month-end.", "Given a damage claim without proof of delivery, when it is classified, then a dispute opens, is assigned to the area sales manager, the owner is notified and the SLA timer starts."],
    ["US-5", "Maker-checker", "As a Finance Controller, I want deductions above the threshold approved by a second person, so write-offs are controlled.", "Given a case above ₹10,000, when its maker approves it, then the action is blocked, logged and routed to a checker."],
    ["US-6", "Settle upfront", "As a Sales manager, I want valid scheme benefits issued as credit notes before payment, so the distributor pays in full.", "Given an approved claim, when the credit note is issued, then a 30-day IRP reporting deadline is set and alerts at day 20."],
    ["US-7", "Credit flag", "As a credit controller, I want ageing disputes to flag the next order, so exposure doesn't compound.", "Given disputed deductions above the threshold or age limit, when the distributor places an order, then the order is flagged for review, not blocked."]
  ];
  var UAT = [
    ["UAT-01", "BR-1, US-1", "Unreferenced receipt on a virtual account", "Tagged to the distributor; applied to the oldest open invoice; logged"],
    ["UAT-02", "BR-2, US-2", "Receipt short by 0.1% after the ₹50 lakh threshold", "Classified as TDS; queued for Form 26AS match"],
    ["UAT-03", "BR-3, US-3", "Evidenced scheme claim within budget and tolerance", "Auto-accepted; accepting rule recorded"],
    ["UAT-04", "US-4", "Close a case without a reason code (negative)", "Blocked and logged"],
    ["UAT-05", "BR-3", "Accept a damage claim without proof of delivery (negative)", "Blocked; claim stays a dispute"],
    ["UAT-06", "BR-5, US-5", "Maker approves own case above ₹10,000 (negative)", "Blocked, logged, routed to a checker"],
    ["UAT-07", "BR-4", "Auto write-off of an unexplained gap (negative)", "Blocked; case stays open with its owner"],
    ["UAT-08", "US-4", "Dispute passes its SLA", "Escalated to the AR lead; history kept"],
    ["UAT-09", "BR-6, US-6", "Credit note issued", "30-day IRP deadline set; alert at day 20"],
    ["UAT-10", "BR-7, US-7", "Disputes above ₹20,000 or older than 45 days, new order placed", "Order flagged for credit review, not blocked"]
  ];

  $("stories").innerHTML = STORIES.map(function (s) {
    return "<li id='" + s[0] + "'><b>" + s[0] + " " + s[1] + ".</b> " + s[2] + " <i>" + s[3] + "</i></li>";
  }).join("");
  $("uat").innerHTML = UAT.map(function (u) {
    return "<tr id='" + u[0] + "'><td class='id'>" + u[0] + "</td><td>" + u[1] + "</td><td>" + u[2] + "</td><td>" + u[3] + "</td></tr>";
  }).join("");

  /* ---------- traceability links ---------- */
  document.querySelectorAll("#trace > .tbl-wrap tbody td:nth-child(n+2)").forEach(function (td) {
    td.innerHTML = td.textContent.replace(/\b(BR|US|UAT)-\d+\b/g, function (id) { return "<a href='#" + id + "' class='idlink'>" + id + "</a>"; });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.idlink");
    if (!a) return;
    e.preventDefault();
    var el = $(a.getAttribute("href").slice(1));
    if (!el) return;
    var d = el.closest("details");
    if (d) d.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl");
  });

  /* ---------- downloads and calendar ---------- */
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function csv(rows) {
    return "﻿" + rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
  }
  $("dl-stories").addEventListener("click", function () {
    var rows = [["Summary", "Issue Type", "Description", "Acceptance Criteria", "Labels"]];
    STORIES.forEach(function (s) { rows.push([s[0] + " " + s[1], "Story", s[2], s[3], "o2c-deductions"]); });
    download("o2c-user-stories-jira.csv", csv(rows), "text/csv;charset=utf-8");
  });
  $("dl-uat").addEventListener("click", function () {
    var rows = [["Test ID", "Traces to", "Scenario", "Expected result"]].concat(UAT);
    download("o2c-uat-cases.csv", csv(rows), "text/csv;charset=utf-8");
  });

  function addDays(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
  function pretty(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function gcal(title, d, details) {
    var end = new Date(d); end.setDate(end.getDate() + 1);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) +
      "&dates=" + ymd(d) + "/" + ymd(end) + "&details=" + encodeURIComponent(details);
  }
  function ics(title, d, details, alarmDays) {
    var end = new Date(d); end.setDate(end.getDate() + 1);
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//everyrupee-o2c//EN", "BEGIN:VEVENT",
      "UID:" + ymd(d) + "-" + title.replace(/\W+/g, "") + "@everyrupee-o2c", "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + ymd(d), "DTEND;VALUE=DATE:" + ymd(end),
      "SUMMARY:" + title, "DESCRIPTION:" + details,
      "BEGIN:VALARM", "TRIGGER:-P" + alarmDays + "D", "ACTION:DISPLAY", "DESCRIPTION:" + title, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }

  var SLA_DUE = addDays(7);
  var SLA_TITLE = "SLA due: case C-3318, ₹11,000 damage claim (illustrative)";
  var SLA_DETAILS = "Distributor A, INV-1042. No proof of delivery; 2.6x the distributor's norm. Escalates to AR lead on breach.";
  var IRP_DUE = addDays(28);
  var IRP_TITLE = "IRP reporting deadline: credit note CN-0213 (illustrative)";
  var IRP_DETAILS = "₹8,000 scheme credit note for Distributor A. Report to the IRP within 30 days of issue. Check current rules.";
  $("irp-date").textContent = pretty(IRP_DUE);
  $("irp-gcal").href = gcal(IRP_TITLE, IRP_DUE, IRP_DETAILS);
  $("irp-ics").addEventListener("click", function () { download("irp-deadline.ics", ics(IRP_TITLE, IRP_DUE, IRP_DETAILS, 10), "text/calendar"); });

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll("[data-tab]");
  function showTab(name) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === name;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $("pane-" + t.dataset.tab).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { showTab(t.dataset.tab); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); showTab(next.dataset.tab);
    });
  });
  showTab("proposed");

  /* ---------- as-is (hypothesised) ---------- */
  var TODAY = [
    { day: 0, emails: 0, html: "<b>₹9,80,000 lands in the collection account.</b> No invoice reference, no breakdown. A ₹20,000 gap against INV-1042.<br><span class='tag pain'>P1 No remittance detail</span>" },
    { day: 3, emails: 0, html: "<b>AR identifies the payer manually</b> from the bank narration and parks the gap in a spreadsheet.<br><span class='tag pain'>P2 No reason code</span>" },
    { day: 4, emails: 2, html: "<b>AR emails Sales:</b> \"Is this a scheme deduction?\" Sales assumes AR is chasing the distributor.<br><span class='tag pain'>P3 Unclear owner</span>" },
    { day: 11, emails: 5, html: "<b>Sales forwards a scheme circular.</b> It covers part of the gap. Nobody checks the rest, or the TDS the distributor withheld.<br><span class='tag pain'>P2 Unstructured reasons</span>" },
    { day: 18, emails: 7, html: "<b>The Controller approves the deduction over email.</b> The evidence lives in an inbox.<br><span class='tag pain'>P4 Weak audit trail</span>" },
    { day: 31, emails: 9, html: "<b>Month-end close:</b> the unresolved balance shows up in ageing. Meanwhile the distributor has kept ordering on credit.<br><span class='tag pain'>P5 Late visibility</span>" }
  ];
  var tIdx = 0;
  function addStep(list, html) {
    var li = document.createElement("li");
    li.className = "new";
    li.innerHTML = html;
    list.appendChild(li);
  }
  function todayReset() {
    tIdx = 0;
    $("today-steps").innerHTML = "";
    $("t-days").textContent = "0"; $("t-emails").textContent = "0";
    $("t-owner").textContent = "Unclear"; $("t-explained").textContent = "₹0";
    $("today-next").disabled = false; $("today-next").textContent = "Next step";
    todayNext();
  }
  function todayNext() {
    if (tIdx >= TODAY.length) return;
    var s = TODAY[tIdx++];
    addStep($("today-steps"), "<span class='day'>Day " + s.day + " (illustrative)</span>" + s.html);
    $("t-days").textContent = s.day;
    $("t-emails").textContent = s.emails;
    if (tIdx >= TODAY.length) {
      $("t-explained").textContent = "Unclear";
      $("today-next").disabled = true; $("today-next").textContent = "End of flow";
    }
  }
  $("today-next").addEventListener("click", todayNext);
  $("today-reset").addEventListener("click", todayReset);

  /* ---------- to-be ---------- */
  var GAP = 20000, SCHEME = 8000, DAMAGE = 11000, NORM = 4200, THRESHOLD = 10000;
  var params = { tol: 10000, pod: false };
  var pIdx = 0, events = [];

  function classify() {
    var schemeAuto = SCHEME <= params.tol;
    return {
      tds: 1000,
      scheme: schemeAuto ? "auto" : "review",
      damage: params.pod ? "review" : "disp"
    };
  }

  function stepHtml(i, c) {
    if (i === 0) return "<span class='day'>Day 0, 09:02</span><b>Receipt arrives on Distributor A's virtual account.</b> Payer known instantly; no reference, so it settles the oldest open invoice first: INV-1042 (BR-1).<dl><dt>Invoice</dt><dd>₹10,00,000</dd><dt>Received</dt><dd>₹9,80,000</dd><dt>Gap</dt><dd>₹20,000</dd></dl>";
    if (i === 1) return "<span class='day'>Day 0, 09:02</span><b>TDS line expected (BR-2).</b> Distributor A's purchases this year crossed ₹50 lakh, so 0.1% TDS u/s 194Q is expected on this invoice (on its taxable value, before GST).<dl><dt>Expected</dt><dd>₹1,000 (illustrative)</dd><dt>Status</dt><dd>Credit to match in Form 26AS</dd></dl><span class='tag tds'>Not a loss</span>";
    if (i === 2) return "<span class='day'>Day 0, 09:03</span><b>Scheme claim (BR-3).</b> The claim cites the Q3 display scheme.<dl><dt>Evidence</dt><dd>Scheme circular + eligibility: present</dd><dt>Budget</dt><dd>₹8,000 of ₹22,000 remaining</dd><dt>Tolerance</dt><dd>" + inr(params.tol) + " (Finance-set)</dd></dl>" +
      (c.scheme === "auto" ? "<span class='tag ok'>Auto-accepted by rule</span>" : "<span class='tag rev'>Above tolerance: to AR lead for review</span>");
    if (c.damage === "disp") {
      return "<span class='day'>Day 0, 09:03</span><b>Damage claim.</b> No proof of delivery or damage report attached.<dl><dt>Amount</dt><dd>₹11,000</dd><dt>Distributor norm</dt><dd>₹4,200 trailing average; this is 2.6×</dd><dt>Owner</dt><dd>Area sales manager, West</dd><dt>SLA</dt><dd>7 days, due " + pretty(SLA_DUE) + "; escalates to AR lead</dd></dl><span class='tag disp'>Dispute opened · reason code: damage</span>" +
        "<div class='slack' aria-label='Proposed Slack notification'><div class='slack-h'><b>#ar-disputes</b><span>Proposed notification · mock, not connected</span></div>" +
        "<p><b>Case C-3318 assigned to you</b> · Distributor A · INV-1042<br>₹11,000 damage claim · no proof of delivery · 2.6× norm<br>SLA due " + pretty(SLA_DUE) + "</p>" +
        "<div class='cal'><a target='_blank' rel='noopener' href='" + gcal(SLA_TITLE, SLA_DUE, SLA_DETAILS) + "'>Add SLA to Google Calendar</a><button class='linkbtn' data-act='sla-ics'>Download .ics</button><button class='linkbtn' data-act='copy-slack'>Copy as Slack message</button></div></div>";
    }
    return "<span class='day'>Day 0, 09:03</span><b>Damage claim.</b> Proof of delivery attached, but the amount is abnormal.<dl><dt>Amount</dt><dd>₹11,000</dd><dt>Distributor norm</dt><dd>₹4,200 trailing average; this is 2.6×, above the 2× limit</dd><dt>Owner</dt><dd>AR lead review; above ₹10,000, so a checker approves (BR-5)</dd></dl><span class='tag rev'>Evidenced but abnormal: human review</span>";
  }

  function baseAudit(c) {
    var a = [
      "09:02  Receipt ₹9,80,000 tagged to Distributor A (virtual account); applied to INV-1042 (oldest open)",
      "09:02  ₹1,000 classified as TDS u/s 194Q; queued for Form 26AS match",
      c.scheme === "auto" ? "09:03  ₹8,000 scheme claim auto-accepted: evidence present, within budget, under tolerance"
        : "09:03  ₹8,000 scheme claim above tolerance " + inr(params.tol) + "; routed to AR lead",
      c.damage === "disp" ? "09:03  Case C-3318 opened: ₹11,000 damage, no POD, 2.6× norm; owner area sales manager; SLA 7 days; owner notified"
        : "09:03  Case C-3318 opened: ₹11,000 damage, POD attached, 2.6× norm; AR lead review; maker-checker required"
    ];
    return a.slice(0, pIdx);
  }

  function renderSplit(c) {
    var tds = pIdx > 1 ? 1000 : 0;
    var auto = pIdx > 2 && c.scheme === "auto" ? SCHEME : 0;
    var review = (pIdx > 2 && c.scheme === "review" ? SCHEME : 0) + (pIdx > 3 && c.damage === "review" ? DAMAGE : 0);
    var disp = pIdx > 3 && c.damage === "disp" ? DAMAGE : 0;
    var unk = GAP - tds - auto - review - disp;
    var segs = [["tds", tds, "TDS credit"], ["ok", auto, "Auto-accepted"], ["rev", review, "Needs review"], ["disp", disp, "In dispute"], ["unk", unk, "Unexplained"]];
    $("bar").innerHTML = segs.map(function (s) { return "<span class='seg seg-" + s[0] + "' style='width:" + (s[1] / GAP * 100) + "%'></span>"; }).join("");
    $("legend").innerHTML = segs.filter(function (s) { return s[1] || s[0] === "unk"; })
      .map(function (s) { return "<li><i class='k-" + s[0] + "'></i>" + s[2] + " <b>" + inr(s[1]) + "</b></li>"; }).join("");
  }

  function renderAfter(c) {
    var rows = [["TDS: a tax credit to match in Form 26AS, not a loss", 1000, "Rule BR-2"]];
    rows.push(c.scheme === "auto" ? ["Valid claim: scheme, evidenced, within budget", SCHEME, "Rule BR-3"]
      : ["Valid claim awaiting review: above the " + inr(params.tol) + " tolerance", SCHEME, "AR lead"]);
    rows.push(c.damage === "disp" ? ["Dispute: damage, no proof of delivery", DAMAGE, "Area sales manager, SLA 7 days"]
      : ["Review: damage with proof, but 2.6× norm", DAMAGE, "AR lead + checker (BR-5)"]);
    $("result-rows").innerHTML = rows.map(function (r) { return "<tr><td>" + r[0] + "</td><td class='num'>" + inr(r[1]) + "</td><td>" + r[2] + "</td></tr>"; }).join("");
    var autoAmt = 1000 + (c.scheme === "auto" ? SCHEME : 0);
    $("kpi").innerHTML = "<strong>" + Math.round(autoAmt / GAP * 100) + "%</strong> of this gap (" + inr(autoAmt) + ") was classified without a person; every other rupee had a named owner on day 0. Nothing was written off.";

    var disputes = [];
    if (c.damage === "disp") disputes.push(["Damage, INV-1042 (this payment)", DAMAGE, 0]);
    disputes.push(["Shortage, INV-0971, no goods received note", 14000, 47]);
    var total = disputes.reduce(function (s, d) { return s + d[1]; }, 0);
    var oldest = Math.max.apply(null, disputes.map(function (d) { return d[2]; }));
    $("credit-rows").innerHTML = disputes.map(function (d) { return "<tr><td>" + d[0] + "</td><td class='num'>" + inr(d[1]) + "</td><td class='num'>" + d[2] + " days</td></tr>"; }).join("") +
      "<tr class='tot'><td>Total</td><td class='num'>" + inr(total) + "</td><td class='num'>oldest " + oldest + "</td></tr>";
    var why = [];
    if (total > 20000) why.push("over ₹20,000");
    if (oldest > 45) why.push("older than 45 days");
    $("credit-flag").textContent = why.length ? "Next order flagged for credit review (" + why.join(", ") + ")" : "No flag";
  }

  function render(animateLast) {
    var c = classify();
    var list = $("prop-steps");
    list.innerHTML = "";
    for (var i = 0; i < Math.min(pIdx, 4); i++) {
      var li = document.createElement("li");
      if (animateLast && i === pIdx - 1) li.className = "new";
      li.innerHTML = stepHtml(i, c);
      list.appendChild(li);
    }
    renderSplit(c);
    var done = pIdx > 4;
    $("after").hidden = !done;
    if (done) renderAfter(c);
    var lines = baseAudit(c);
    if (done) lines.push("09:04  Distributor A next order flagged for credit review (BR-7)");
    $("audit").innerHTML = lines.concat(events).map(function (l) {
      var blk = l.indexOf("BLOCKED") > -1;
      return "<li" + (blk ? " class='blk'" : "") + ">" + l + "</li>";
    }).join("");
    $("prop-next").disabled = done;
    $("prop-next").textContent = done ? "Done" : pIdx === 4 ? "Show outcome" : "Next step";
  }

  var clock = 5;
  function event(text) {
    events.push("09:" + String(clock++).padStart(2, "0") + "  " + text);
  }

  function propReset() {
    pIdx = 1; events = []; clock = 5;
    params = { tol: 10000, pod: false };
    $("tol").value = 10000; $("tol-out").textContent = inr(10000); $("pod").checked = false;
    $("blocked").innerHTML = "";
    render(true);
  }
  $("prop-next").addEventListener("click", function () {
    pIdx++;
    render(true);
    if (pIdx > 4) $("after").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("prop-reset").addEventListener("click", propReset);

  $("tol").addEventListener("input", function () {
    params.tol = +this.value;
    $("tol-out").textContent = inr(params.tol);
    render(false);
  });
  $("tol").addEventListener("change", function () { event("Finance changed auto-accept tolerance to " + inr(params.tol) + "; payment re-classified"); render(false); });
  $("pod").addEventListener("change", function () {
    params.pod = this.checked;
    event(params.pod ? "Proof of delivery attached to C-3318; re-classified to review" : "Proof of delivery removed from C-3318; re-classified to dispute");
    render(false);
  });

  /* ---------- control tests ---------- */
  var BREAKS = {
    noreason: ["UAT-04 close C-3318 without a reason code", "A case cannot close without a reason code; causes must be reportable."],
    nopod: ["UAT-05 accept damage claim without proof of delivery", "Damage claims need proof of delivery or a damage report; without it the claim stays a dispute."],
    self: ["UAT-06 maker approves own ₹11,000 case", "Above the ₹10,000 threshold a second person must approve; the attempt is logged and routed to a checker."],
    writeoff: ["UAT-07 auto write-off of unexplained remainder", "Unexplained gaps are never written off by a rule; the case stays open with its owner."]
  };
  document.querySelectorAll("[data-break]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = BREAKS[b.dataset.break];
      $("blocked").innerHTML = "<b>Blocked.</b> " + r[1];
      event("BLOCKED: " + r[0]);
      render(false);
    });
  });

  /* ---------- slack and calendar actions inside the dispute step ---------- */
  $("prop-steps").addEventListener("click", function (e) {
    var act = e.target.dataset && e.target.dataset.act;
    if (act === "sla-ics") download("sla-c-3318.ics", ics(SLA_TITLE, SLA_DUE, SLA_DETAILS, 1), "text/calendar");
    if (act === "copy-slack") {
      var msg = "*Case C-3318 assigned to you* · Distributor A · INV-1042\n₹11,000 damage claim · no proof of delivery · 2.6× norm\nSLA due " + pretty(SLA_DUE) + " (illustrative)";
      var btn = e.target;
      var ok = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy as Slack message"; }, 1500); };
      try {
        navigator.clipboard.writeText(msg).then(ok, function () { btn.textContent = "Copy not allowed here"; });
      } catch (err) { btn.textContent = "Copy not allowed here"; }
    }
  });

  todayReset();
  propReset();
})();
