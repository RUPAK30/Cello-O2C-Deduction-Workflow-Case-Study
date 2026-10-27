(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + n.toLocaleString("en-IN"); };
  var term = function (key, label) { return "<button class='term' type='button' data-term='" + key + "'>" + label + "</button>"; };

  /* ---------- glossary ---------- */
  var TERMS = {
    tds: "TDS (tax deducted at source): tax the buyer withholds and pays to the government for the seller. The seller claims it back as a credit, so it is not a loss.",
    f26: "Form 26AS: the government statement that shows TDS deposited against the seller's tax ID. It is how withheld tax is confirmed.",
    cn: "Credit note: a document that reduces what the distributor owes. Issued for a valid claim instead of letting the distributor deduct it from the payment.",
    irp: "IRP (Invoice Registration Portal): the government e-invoicing system where credit notes must be reported.",
    pod: "Proof of delivery: a signed record that the goods arrived, needed to judge a damage or shortage claim.",
    mc: "Maker-checker: the person who prepares a decision cannot approve it; a second person must.",
    va: "Virtual account: a unique bank account number for each distributor, so the bank tells you who paid."
  };
  var pop = $("pop"), popFor = null;
  function closePop() { pop.hidden = true; if (popFor) popFor.setAttribute("aria-expanded", "false"); popFor = null; }
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest(".term") : null;
    if (!t) { if (!pop.contains(e.target)) closePop(); return; }
    if (popFor === t) { closePop(); return; }
    closePop();
    pop.textContent = TERMS[t.dataset.term] || "";
    pop.hidden = false;
    var r = t.getBoundingClientRect(), w = Math.min(300, innerWidth - 32);
    pop.style.width = w + "px";
    pop.style.left = Math.max(16, Math.min(r.left, innerWidth - w - 16)) + scrollX + "px";
    pop.style.top = r.bottom + scrollY + 6 + "px";
    t.setAttribute("aria-expanded", "true");
    popFor = t;
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  /* ---------- shared data: stories and UAT (rendered and exported) ---------- */
  var STORIES = O2C.STORIES, UAT = O2C.UAT;
  O2C.render(document);

  /* ---------- spec tabs and traceability links ---------- */
  var specTabs = document.querySelectorAll("[data-spec]");
  function showSpec(name) {
    specTabs.forEach(function (t) {
      var on = t.dataset.spec === name;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.querySelector("[data-pane='" + t.dataset.spec + "']").hidden = !on;
    });
  }
  specTabs.forEach(function (t, i) {
    t.addEventListener("click", function () { showSpec(t.dataset.spec); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var next = specTabs[(i + (e.key === "ArrowRight" ? 1 : specTabs.length - 1)) % specTabs.length];
      next.focus(); showSpec(next.dataset.spec);
    });
  });
  document.querySelectorAll("#trace-table tbody td:nth-child(n+2)").forEach(function (td) {
    td.innerHTML = td.textContent.replace(/\b(BR|US|UAT)-\d+\b/g, function (id) { return "<a href='#" + id + "' class='idlink'>" + id + "</a>"; });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a.idlink") : null;
    if (!a) return;
    e.preventDefault();
    var el = $(a.getAttribute("href").slice(1));
    if (!el) return;
    showSpec(el.closest("[data-pane]").dataset.pane);
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
    download("o2c-uat-cases.csv", csv([["Test ID", "Traces to", "Scenario", "Expected result"]].concat(UAT)), "text/csv;charset=utf-8");
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

  /* ---------- rules ---------- */
  var GAP = 20000, SCHEME = 8000, DAMAGE = 11000;
  var params = { tol: 10000, pod: false };
  function classify() {
    return { scheme: SCHEME <= params.tol ? "auto" : "review", damage: params.pod ? "review" : "disp" };
  }

  /* ---------- the race ---------- */
  var DURATION = 14000;
  var ASIS = [
    { t: 0, day: "Day 0", emails: 0, html: "<b>₹9,80,000 lands with no reference.</b> A ₹20,000 gap nobody can explain.", tag: "No remittance detail" },
    { t: 2500, day: "Day 3", emails: 0, html: "<b>AR works out who paid</b> from the bank narration and parks the gap in a spreadsheet.", tag: "No reason recorded" },
    { t: 4500, day: "Day 4", emails: 2, html: "<b>AR emails Sales:</b> is this a scheme deduction? Each side assumes the other is chasing.", tag: "Unclear owner" },
    { t: 7000, day: "Day 11", emails: 5, html: "<b>Sales forwards a scheme circular.</b> It covers part of the gap. Nobody checks the rest, or the tax withheld.", tag: "Reasons live in email" },
    { t: 9500, day: "Day 18", emails: 7, html: "<b>The Controller approves over email.</b> The evidence lives in an inbox.", tag: "Weak audit trail" },
    { t: 12000, day: "Day 31", emails: 9, html: "<b>Month-end close.</b> The gap shows up in ageing. The distributor kept ordering on credit.", tag: "Late visibility" }
  ];
  function tobeEvents(c) {
    var ev = [
      { t: 600, time: "09:02", unexp: 20000, owner: "–", html: "<b>Payment arrives on Distributor A's " + term("va", "virtual account") + ".</b> Payer known instantly; applied to the oldest open invoice.", tag: "BR-1 Identify", cls: "" },
      { t: 1800, time: "09:02", unexp: 19000, owner: "–", seg: "tds", html: "<b>₹1,000 is expected " + term("tds", "TDS") + ".</b> Purchases crossed ₹50 lakh, so 0.1% was withheld; matched later in " + term("f26", "Form 26AS") + ".", tag: "BR-2 Not a loss", cls: "tds" }
    ];
    ev.push(c.scheme === "auto"
      ? { t: 3000, time: "09:03", unexp: 11000, owner: "–", seg: "ok", html: "<b>₹8,000 scheme claim accepted by rule.</b> Circular attached, within budget, under the " + inr(params.tol) + " limit.", tag: "BR-3 Auto-accepted", cls: "ok" }
      : { t: 3000, time: "09:03", unexp: 11000, owner: "AR lead", seg: "rev", html: "<b>₹8,000 scheme claim to the AR lead.</b> Evidenced, but above the " + inr(params.tol) + " auto-accept limit.", tag: "BR-3 Review", cls: "rev" });
    ev.push(c.damage === "disp"
      ? { t: 4200, time: "09:03", unexp: 0, owner: "Sales mgr", seg: "disp", html: "<b>₹11,000 damage claim becomes a dispute.</b> No " + term("pod", "proof of delivery") + ", and 2.6× this distributor's norm. Owner notified; 7-day SLA.", tag: "Dispute · owner · deadline", cls: "disp" }
      : { t: 4200, time: "09:03", unexp: 0, owner: "AR lead", seg: "rev", html: "<b>₹11,000 damage claim to review.</b> Proof attached, but 2.6× the norm; above ₹10,000, so " + term("mc", "maker-checker") + " applies.", tag: "BR-3 · BR-5 Review", cls: "rev" });
    ev.push({ t: 5200, time: "09:03", unexp: 0, owner: null, html: "<b>Every rupee classified and owned.</b> Nothing written off.", tag: "Done", cls: "ok" });
    return ev;
  }

  var elapsed = 0, playing = false, started = false, last = 0, timer = null;
  var shownA = -1, shownB = -1, tobe = tobeEvents(classify());
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function feedItem(e, fresh) {
    return "<li class='" + (fresh ? "new " : "") + "'><span class='when mono'>" + (e.day || e.time) + "</span><div>" + e.html +
      "<span class='tag " + (e.cls === undefined ? "pain" : e.cls || "id") + "'>" + e.tag + "</span></div></li>";
  }
  function renderRace(force) {
    var a = -1, b = -1;
    ASIS.forEach(function (e, i) { if (e.t <= elapsed) a = i; });
    tobe.forEach(function (e, i) { if (e.t <= elapsed) b = i; });
    if (force || a !== shownA) {
      $("a-feed").innerHTML = ASIS.slice(0, a + 1).map(function (e, i) { return feedItem(e, !force && i === a); }).reverse().join("");
      var ea = ASIS[Math.max(a, 0)];
      $("a-time").textContent = ea.day; $("a-emails").textContent = ea.emails;
      shownA = a;
    }
    if (force || b !== shownB) {
      $("b-feed").innerHTML = tobe.slice(0, b + 1).map(function (e, i) { return feedItem(e, !force && i === b); }).reverse().join("");
      var eb = tobe[Math.max(b, 0)];
      var owner = "–";
      for (var i = 0; i <= b && i < 4; i++) if (tobe[i].owner !== "–") owner = tobe[i].owner;
      $("b-time").textContent = eb.time;
      $("b-owner").textContent = owner;
      $("b-unexp").textContent = inr(b < 0 ? GAP : eb.unexp);
      $("b-unexp").classList.toggle("zero", b >= 0 && eb.unexp === 0);
      renderBar(b);
      shownB = b;
    }
    $("verdict").hidden = elapsed < 13000;
    $("r-prog").style.width = Math.min(100, elapsed / DURATION * 100) + "%";
  }
  function renderBar(b) {
    var amt = { tds: 0, ok: 0, rev: 0, disp: 0 };
    var vals = [0, 1000, SCHEME, DAMAGE];
    for (var i = 1; i <= b && i < 4; i++) amt[tobe[i].seg] += vals[i];
    var unk = GAP - amt.tds - amt.ok - amt.rev - amt.disp;
    var segs = [["tds", amt.tds, "TDS credit"], ["ok", amt.ok, "Accepted"], ["rev", amt.rev, "In review"], ["disp", amt.disp, "In dispute"], ["unk", unk, "Unexplained"]];
    $("bar").innerHTML = segs.map(function (s) { return "<span class='seg seg-" + s[0] + "' style='width:" + (s[1] / GAP * 100) + "%'></span>"; }).join("");
    $("legend").innerHTML = segs.filter(function (s) { return s[1]; })
      .map(function (s) { return "<li><i class='k-" + s[0] + "'></i>" + s[2] + " <b class='mono'>" + inr(s[1]) + "</b></li>"; }).join("");
  }

  function tick(now) {
    if (!playing) return;
    elapsed += Math.min(now - last, 100); last = now;
    if (elapsed >= DURATION) { elapsed = DURATION; setPlaying(false); }
    renderRace(false);
    if (playing) timer = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    $("r-play").textContent = on ? "Pause" : elapsed >= DURATION ? "Play" : "Play";
    $("r-play").setAttribute("aria-label", on ? "Pause" : "Play");
    if (on) { if (elapsed >= DURATION) { elapsed = 0; } last = performance.now(); timer = requestAnimationFrame(tick); }
    else cancelAnimationFrame(timer);
  }
  $("r-play").addEventListener("click", function () { started = true; setPlaying(!playing); });
  $("r-replay").addEventListener("click", function () { started = true; elapsed = 0; renderRace(true); setPlaying(true); });
  $("r-step").addEventListener("click", function () {
    started = true; setPlaying(false);
    var times = ASIS.map(function (e) { return e.t; }).concat(tobe.map(function (e) { return e.t; }), [13000]).sort(function (x, y) { return x - y; });
    var next = times.filter(function (t) { return t > elapsed; })[0];
    elapsed = next === undefined ? DURATION : next;
    renderRace(false);
  });

  function startRace() {
    if (started) return;
    started = true;
    if (reduce) { elapsed = DURATION; renderRace(true); setPlaying(false); return; }
    setPlaying(true);
  }
  renderRace(true);
  setPlaying(false);
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (x) { return x.isIntersecting; })) { startRace(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe($("race"));
  } else startRace();

  /* ---------- try it: outcome, notification, credit, audit ---------- */
  var events = [], clock = 5;
  function event(text) { events.push("09:" + String(clock++).padStart(2, "0") + "  " + text); }

  function renderTry() {
    var c = classify();
    var rows = [["TDS, a tax credit (not a loss)", 1000, "Rule"]];
    rows.push(c.scheme === "auto" ? ["Scheme claim, accepted", SCHEME, "Rule"] : ["Scheme claim, above limit", SCHEME, "AR lead"]);
    rows.push(c.damage === "disp" ? ["Damage claim, disputed", DAMAGE, "Area sales mgr"] : ["Damage claim, abnormal", DAMAGE, "AR lead + checker"]);
    $("result-rows").innerHTML = rows.map(function (r) { return "<tr><td>" + r[0] + "</td><td class='num mono'>" + inr(r[1]) + "</td><td>" + r[2] + "</td></tr>"; }).join("");
    var autoAmt = 1000 + (c.scheme === "auto" ? SCHEME : 0);
    $("kpi").innerHTML = "<b class='mono'>" + Math.round(autoAmt / GAP * 100) + "%</b> classified with no person involved; the rest has a named owner.";

    if (c.damage === "disp") {
      $("notify").innerHTML = "<div class='slack'><div class='slack-h'><b>#ar-disputes</b><span>Proposed · mock, not connected to Slack</span></div>" +
        "<p><b>Case C-3318 assigned to you</b> · Distributor A · INV-1042<br>₹11,000 damage claim · no proof of delivery · 2.6× norm<br>SLA due " + pretty(SLA_DUE) + "</p></div>" +
        "<div class='cal'><a target='_blank' rel='noopener' href='" + gcal(SLA_TITLE, SLA_DUE, SLA_DETAILS) + "'>Add SLA to Google Calendar</a><button class='linkbtn' data-act='sla-ics'>Download .ics</button><button class='linkbtn' data-act='copy-slack'>Copy as Slack message</button></div>";
    } else {
      $("notify").innerHTML = "<div class='slack'><div class='slack-h'><b>#ar-approvals</b><span>Proposed · mock, not connected to Slack</span></div>" +
        "<p><b>Case C-3318 needs review</b> · Distributor A · INV-1042<br>₹11,000 damage claim · proof attached · 2.6× norm<br>Above ₹10,000: a second approver is required</p></div>";
    }

    var disputes = [];
    if (c.damage === "disp") disputes.push(["Damage, INV-1042 (this payment)", DAMAGE, 0]);
    disputes.push(["Shortage, INV-0971, no goods note", 14000, 47]);
    var total = disputes.reduce(function (s, d) { return s + d[1]; }, 0);
    var oldest = Math.max.apply(null, disputes.map(function (d) { return d[2]; }));
    $("credit-rows").innerHTML = disputes.map(function (d) { return "<tr><td>" + d[0] + "</td><td class='num mono'>" + inr(d[1]) + "</td><td class='num'>" + d[2] + " days</td></tr>"; }).join("") +
      "<tr class='tot'><td>Total disputed</td><td class='num mono'>" + inr(total) + "</td><td class='num'>oldest " + oldest + "</td></tr>";
    var why = [];
    if (total > 20000) why.push("over ₹20,000");
    if (oldest > 45) why.push("older than 45 days");
    $("credit-flag").textContent = why.length ? "Next order flagged for credit review (" + why.join(", ") + ")" : "No flag";

    var base = [
      "09:02  Receipt ₹9,80,000 tagged to Distributor A; applied to INV-1042 (oldest open)",
      "09:02  ₹1,000 classified as TDS u/s 194Q; queued for Form 26AS match",
      c.scheme === "auto" ? "09:03  ₹8,000 scheme claim auto-accepted: evidence, budget, under limit" : "09:03  ₹8,000 scheme claim above " + inr(params.tol) + " limit; routed to AR lead",
      c.damage === "disp" ? "09:03  Case C-3318 opened: ₹11,000 damage, no POD; owner area sales manager; SLA 7 days" : "09:03  Case C-3318: ₹11,000 damage, POD attached, 2.6× norm; maker-checker required",
      "09:04  Distributor A next order flagged for credit review"
    ];
    $("audit").innerHTML = base.concat(events).map(function (l) {
      return "<li" + (l.indexOf("BLOCKED") > -1 ? " class='blk'" : "") + ">" + l + "</li>";
    }).join("");
  }

  function rulesChanged() {
    tobe = tobeEvents(classify());
    renderRace(true);
    renderTry();
  }
  $("tol").addEventListener("input", function () { params.tol = +this.value; $("tol-out").textContent = inr(params.tol); rulesChanged(); });
  $("tol").addEventListener("change", function () { event("Finance set auto-accept limit to " + inr(params.tol) + "; payment re-classified"); renderTry(); });
  $("pod").addEventListener("change", function () {
    params.pod = this.checked;
    event(params.pod ? "Proof of delivery attached to C-3318; moved to review" : "Proof of delivery removed from C-3318; back to dispute");
    rulesChanged();
  });

  var BREAKS = {
    noreason: ["close C-3318 without a reason code", "A case cannot close without a reason code, so every cause stays reportable."],
    nopod: ["accept damage claim without proof of delivery", "A damage claim needs proof of delivery or a damage report; without it, it stays a dispute."],
    self: ["maker approves own ₹11,000 case", "Above ₹10,000 a second person must approve. The attempt is logged and sent to a checker."],
    writeoff: ["auto write-off of unexplained remainder", "No rule can write off an unexplained gap. The case stays open with its owner."]
  };
  document.querySelectorAll("[data-break]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = BREAKS[b.dataset.break];
      $("blocked").innerHTML = "<b>Blocked.</b> " + r[1];
      event("BLOCKED: " + r[0]);
      renderTry();
    });
  });

  $("notify").addEventListener("click", function (e) {
    var act = e.target.dataset && e.target.dataset.act;
    if (act === "sla-ics") download("sla-c-3318.ics", ics(SLA_TITLE, SLA_DUE, SLA_DETAILS, 1), "text/calendar");
    if (act === "copy-slack") {
      var msg = "*Case C-3318 assigned to you* · Distributor A · INV-1042\n₹11,000 damage claim · no proof of delivery · 2.6× norm\nSLA due " + pretty(SLA_DUE) + " (illustrative)";
      var btn = e.target;
      try {
        navigator.clipboard.writeText(msg).then(function () {
          btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy as Slack message"; }, 1500);
        }, function () { btn.textContent = "Copy not allowed here"; });
      } catch (err) { btn.textContent = "Copy not allowed here"; }
    }
  });

  renderTry();
})();
