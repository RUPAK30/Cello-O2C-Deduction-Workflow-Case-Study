(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + n.toLocaleString("en-IN"); };

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

  function addStep(list, html) {
    var li = document.createElement("li");
    li.className = "new";
    li.innerHTML = html;
    list.appendChild(li);
  }

  /* ---------- today (hypothesised) ---------- */
  var TODAY = [
    { day: 0, emails: 0, html: "<b>₹9,80,000 lands in the collection account.</b> No invoice reference, no breakdown. A ₹20,000 gap against INV-1042.<br><span class='tag pain'>No remittance detail</span>" },
    { day: 3, emails: 0, html: "<b>AR identifies the payer manually</b> from the bank narration and parks the gap in a spreadsheet.<br><span class='tag pain'>No reason code</span>" },
    { day: 4, emails: 2, html: "<b>AR emails Sales:</b> \"Is this a scheme deduction?\" Sales assumes AR is chasing the distributor.<br><span class='tag pain'>Unclear owner</span>" },
    { day: 11, emails: 5, html: "<b>Sales forwards a scheme circular.</b> It covers part of the gap. Nobody checks the rest, or the TDS the distributor withheld.<br><span class='tag pain'>Unstructured reasons</span>" },
    { day: 18, emails: 7, html: "<b>The Controller approves the deduction over email.</b> The evidence lives in an inbox.<br><span class='tag pain'>Weak audit trail</span>" },
    { day: 31, emails: 9, html: "<b>Month-end close:</b> the unresolved balance shows up in ageing. Meanwhile the distributor has kept ordering on credit.<br><span class='tag pain'>Late visibility</span>" }
  ];
  var tIdx = 0;
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

  /* ---------- proposed ---------- */
  var GAP = 20000;
  var split = { tds: 0, ok: 0, disp: 0 };
  var PROPOSED = [
    {
      html: "<span class='day'>Day 0, 09:02</span><b>Receipt arrives on Distributor A's virtual account.</b> Payer known instantly; no reference, so it settles the oldest open invoice first: INV-1042.<dl><dt>Invoice</dt><dd>₹10,00,000</dd><dt>Received</dt><dd>₹9,80,000</dd><dt>Gap</dt><dd>₹20,000</dd></dl>",
      audit: "Receipt ₹9,80,000 tagged to Distributor A (virtual account); applied to INV-1042 (oldest open)"
    },
    {
      key: "tds", amt: 1000,
      html: "<span class='day'>Day 0, 09:02</span><b>TDS line expected.</b> Distributor A's purchases this year crossed ₹50 lakh, so 0.1% TDS u/s 194Q is expected on this invoice (on its taxable value, before GST).<dl><dt>Expected</dt><dd>₹1,000 (illustrative)</dd><dt>Status</dt><dd>Credit to match in Form 26AS</dd></dl><span class='tag tds'>Not a loss</span>",
      audit: "₹1,000 classified as TDS u/s 194Q; queued for Form 26AS match"
    },
    {
      key: "ok", amt: 8000,
      html: "<span class='day'>Day 0, 09:03</span><b>Scheme claim.</b> Distributor A's portal claim cites the Q3 display scheme.<dl><dt>Evidence</dt><dd>Scheme circular + eligibility: present</dd><dt>Budget</dt><dd>₹8,000 of ₹22,000 remaining</dd><dt>Tolerance</dt><dd>Under ₹10,000 (Finance-set)</dd></dl><span class='tag ok'>Auto-accepted by rule</span>",
      audit: "₹8,000 scheme claim auto-accepted: evidence present, within budget, under tolerance"
    },
    {
      key: "disp", amt: 11000,
      html: "<span class='day'>Day 0, 09:03</span><b>Damage claim.</b> No proof of delivery or damage report attached.<dl><dt>Amount</dt><dd>₹11,000</dd><dt>Distributor norm</dt><dd>₹4,200 trailing average; this is 2.6×</dd><dt>Owner</dt><dd>Area sales manager, West</dd><dt>SLA</dt><dd>7 days, escalates to AR lead</dd></dl><span class='tag disp'>Dispute opened · reason code: damage</span>",
      audit: "Case C-3318 opened: ₹11,000 damage, no POD, 2.6× norm; owner area sales manager; SLA 7 days"
    }
  ];
  var pIdx = 0;

  function renderSplit() {
    var unk = GAP - split.tds - split.ok - split.disp;
    var pct = function (v) { return (v / GAP * 100) + "%"; };
    var bar = $("bar");
    bar.innerHTML =
      "<span class='seg seg-tds' style='width:" + pct(split.tds) + "'></span>" +
      "<span class='seg seg-ok' style='width:" + pct(split.ok) + "'></span>" +
      "<span class='seg seg-disp' style='width:" + pct(split.disp) + "'></span>" +
      "<span class='seg seg-unk' style='width:" + pct(unk) + "'></span>";
    var items = [];
    if (split.tds) items.push("<li><i class='k-tds'></i>TDS credit <b>" + inr(split.tds) + "</b></li>");
    if (split.ok) items.push("<li><i class='k-ok'></i>Valid, accepted <b>" + inr(split.ok) + "</b></li>");
    if (split.disp) items.push("<li><i class='k-disp'></i>In dispute <b>" + inr(split.disp) + "</b></li>");
    items.push("<li><i class='k-unk'></i>Unexplained <b>" + inr(unk) + "</b></li>");
    $("legend").innerHTML = items.join("");
  }

  var clock = 0;
  function audit(text, blocked) {
    var li = document.createElement("li");
    var m = 2 + clock++;
    li.textContent = "09:" + (m < 10 ? "0" + m : m) + "  " + text;
    if (blocked) li.className = "blk";
    $("audit").appendChild(li);
  }

  function propReset() {
    pIdx = 0; clock = 0;
    split = { tds: 0, ok: 0, disp: 0 };
    $("prop-steps").innerHTML = "";
    $("audit").innerHTML = "";
    $("blocked").innerHTML = "";
    $("result").hidden = true; $("break").hidden = true; $("credit").hidden = true;
    $("prop-next").disabled = false; $("prop-next").textContent = "Next step";
    renderSplit();
    propNext();
  }
  function propNext() {
    if (pIdx < PROPOSED.length) {
      var s = PROPOSED[pIdx++];
      addStep($("prop-steps"), s.html);
      if (s.key) { split[s.key] = s.amt; renderSplit(); }
      audit(s.audit);
      if (pIdx === PROPOSED.length) $("prop-next").textContent = "Show result";
      return;
    }
    $("result").hidden = false; $("break").hidden = false; $("credit").hidden = false;
    audit("Distributor A next order flagged for credit review: ₹25,000 disputed, oldest 47 days");
    $("prop-next").disabled = true; $("prop-next").textContent = "Done";
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("prop-next").addEventListener("click", propNext);
  $("prop-reset").addEventListener("click", propReset);

  /* ---------- try to break it ---------- */
  var BREAKS = {
    noreason: ["Close case C-3318 without a reason code", "A case cannot close without a reason code; causes must be reportable."],
    nopod: ["Accept ₹11,000 damage claim without proof of delivery", "Damage claims need proof of delivery or a damage report; without it the claim stays a dispute."],
    self: ["Maker approves own ₹11,000 case", "Above the ₹10,000 threshold a second person must approve; the attempt is logged and routed to a checker."],
    writeoff: ["Auto write-off of unexplained remainder", "Unexplained gaps are never written off by a rule; the case stays open with its owner."]
  };
  document.querySelectorAll("[data-break]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = BREAKS[b.dataset.break];
      $("blocked").innerHTML = "<b>Blocked.</b> " + r[1];
      audit("BLOCKED: " + r[0], true);
    });
  });

  todayReset();
  propReset();
})();
