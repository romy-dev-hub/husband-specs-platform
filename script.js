/* ─────────────────────────────────────────────────────────
   Future Husband Specifications — scoring engine
   ───────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const WEIGHT = { personality: 3, relationship: 2, physical: 1 };
  const DENOM  = { personality: 15, relationship: 7, physical: 6, flags: 8 };
  const MAX    = 65;              // weighted units
  const BARE   = 165;             // her height in cm

  const boxes    = $$('input[type="checkbox"][data-group]');
  const byId     = Object.fromEntries(boxes.map(b => [b.id, b]));
  const gauge    = $("#gauge");
  const fill     = $(".gauge__fill");
  const scoreEl  = $("#score");
  const pillScore= $("#pillScore");
  const verdict  = $("#verdict");
  const stamp    = $("#stamp");
  const vName    = $("#verdictName");
  const vTitle   = $("#verdictTitle");
  const vText    = $("#verdictText");
  const nameIn   = $("#candName");
  const hgtIn    = $("#candHeight");
  const s01note  = $("#s01note");
  const bonusTag = $("#bonusTag");
  const CIRC     = 540.35;

  let shownScore = 0;   // last painted number
  let raf = null;

  /* ── verdict table ─────────────────────────────────────── */
  const STATES = {
    reject:   { title: "Automatic rejection",  text: "A red flag is registered. Score is irrelevant now — the spec says processing stops here." },
    approve:  { title: "Meets full specification", text: "65 out of 65 weighted units. No triggers. This file may proceed to forever." },
    prospect: { title: "Strong prospect",       text: "Minor deviations noted against spec. Recommend continued observation and more time together." },
    provisional:{ title: "Provisional file",    text: "Incomplete evidence. Candidate shows promise but has not cleared the baseline yet." },
    under:    { title: "Under specification",   text: "Does not meet the required baseline. Politely: next. The heart keeps its standards." },
    pending:  { title: "Awaiting data",         text: "Tick the sheet to generate a compliance verdict." }
  };

  /* ── scoring ───────────────────────────────────────────── */
  function tally() {
    const t = { personality: 0, relationship: 0, physical: 0, flags: 0 };
    let weighted = 0, bonus = 0;

    boxes.forEach(b => {
      const g = b.dataset.group;
      if (!b.checked) return;
      if (g === "flags") { t.flags++; return; }
      if (b.dataset.optional) { bonus++; return; }
      t[g]++;
      weighted += WEIGHT[g];
    });

    return { t, weighted, bonus, score: Math.min(100, Math.round((weighted / MAX) * 100)) };
  }

  function animateTo(target) {
    cancelAnimationFrame(raf);
    const from = shownScore, dur = 650, start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * e);
      scoreEl.textContent = v;
      pillScore.textContent = v + "%";
      if (p < 1) raf = requestAnimationFrame(step);
      else shownScore = target;
    };
    raf = requestAnimationFrame(step);
  }

  function sparkles() {
    const glyphs = ["✦", "♥", "✧", "♥", "✦"];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = glyphs[i % glyphs.length];
      s.style.setProperty("--dx", (Math.random() * 180 - 90).toFixed(0) + "px");
      s.style.setProperty("--dy", (Math.random() * 40 + 40).toFixed(0) + "px");
      s.style.setProperty("--rot", (Math.random() * 160 - 80).toFixed(0) + "deg");
      s.style.animationDelay = (i * 35) + "ms";
      verdict.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  let lastState = "pending";

  function paint(state, name) {
    verdict.dataset.state = state;
    vTitle.textContent = STATES[state].title;
    vText.textContent  = STATES[state].text;

    const stampWord = state === "reject" ? "Rejected"
                    : state === "approve" ? "Approved" : "";
    if (stampWord) {
      stamp.textContent = stampWord;
      stamp.classList.remove("is-in");
      void stamp.offsetWidth;               // restart animation
      stamp.classList.add("is-in");
    } else {
      stamp.classList.remove("is-in");
    }

    if (state !== lastState) {
      if (state === "reject") {
        verdict.classList.remove("is-shake");
        void verdict.offsetWidth;
        verdict.classList.add("is-shake");
      }
      if (state === "approve") sparkles();
      lastState = state;
    }
  }

  function recalc() {
    const { t, weighted, bonus, score } = tally();

    // section tallies
    ["personality", "relationship", "physical", "flags"].forEach(g => {
      const el = $("#t-" + g);
      if (el) el.textContent = t[g];
      const gEl = $("#g-" + g);
      if (gEl) gEl.textContent = t[g] + "/" + DENOM[g];
      const stat = $('.stat[data-stat="' + g + '"]');
      if (stat) stat.querySelector(".stat__bar i").style.setProperty("--w", (t[g] / DENOM[g]) * 100 + "%");
    });

    bonusTag.classList.toggle("on", bonus > 0);

    // gauge
    fill.style.strokeDashoffset = CIRC * (1 - score / 100);
    const danger = t.flags > 0;
    gauge.style.setProperty("--gauge", danger ? "var(--flag)" : "var(--ink)");
    fill.style.stroke = danger ? "var(--flag)" : score >= 92 ? "var(--green)" : "var(--ink)";
    animateTo(score);

    // verdict
    let state;
    if (danger) state = "reject";
    else if (score >= 92) state = "approve";
    else if (score >= 75) state = "prospect";
    else if (score >= 50) state = "provisional";
    else if (weighted === 0) state = "pending";
    else state = "under";

    const name = nameIn.value.trim();
    vName.textContent = name || "unnamed candidate";
    paint(state, name);

    save();
  }

  /* ── S-01: height is measured, not an opinion ──────────── */
  function applyHeight() {
    const v = parseFloat(hgtIn.value);
    const box = byId["c-S-01"];
    if (Number.isNaN(v)) {
      box.checked = false;
      s01note.textContent = "— awaiting height in intake";
      return;
    }
    if (v > BARE) {
      box.checked = true;
      s01note.textContent = "— " + v + " cm, clears the bar by " + (v - BARE) + " cm";
    } else {
      box.checked = false;
      s01note.textContent = "— " + v + " cm, " + (BARE - v) + " cm short of the bar";
    }
  }

  /* ── persistence ───────────────────────────────────────── */
  const KEY = "fhs-sheet-v1";
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        checked: boxes.filter(b => b.checked).map(b => b.id),
        name: nameIn.value,
        height: hgtIn.value
      }));
    } catch (e) { /* private mode */ }
  }

  function load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return; }
    if (!data) return;
    nameIn.value = data.name || "";
    hgtIn.value  = data.height || "";
    applyHeight();
    (data.checked || []).forEach(id => { if (byId[id] && id !== "c-S-01") byId[id].checked = true; });
  }

  /* ── demo + reset ──────────────────────────────────────── */
  function fillSample() {
    nameIn.value = "Candidate #001";
    hgtIn.value = "178";
    applyHeight();
    boxes.forEach(b => { if (b.dataset.group !== "flags") b.checked = true; });
    recalc();
    gauge.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearSheet() {
    boxes.forEach(b => { b.checked = false; });
    nameIn.value = "";
    hgtIn.value = "";
    applyHeight();
    recalc();
  }

  /* ── reveal on scroll ──────────────────────────────────── */
  function initReveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window) || location.search.includes("flat")) {
      els.forEach(e => e.classList.add("in")); return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const sibs = Array.from(el.parentElement.children).filter(c => c.classList.contains("reveal"));
        el.style.transitionDelay = (Math.min(sibs.indexOf(el), 7) * 55) + "ms";
        el.classList.add("in");
        obs.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    els.forEach(e => io.observe(e));
  }

  /* ── mobile pill ───────────────────────────────────────── */
  function initPill() {
    const rail = $("#rail"), pill = $("#pill");
    if (!rail || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([e]) => {
      pill.classList.toggle("on", !e.isIntersecting);
      pill.setAttribute("aria-hidden", String(e.isIntersecting));
    }, { threshold: 0.15 }).observe(rail);
  }

  /* ── wiring ────────────────────────────────────────────── */
  boxes.forEach(b => b.addEventListener("change", recalc));
  hgtIn.addEventListener("input", () => { applyHeight(); recalc(); });
  nameIn.addEventListener("input", recalc);
  $("#demoBtn").addEventListener("click", fillSample);
  $("#resetBtn").addEventListener("click", clearSheet);
  $("#printBtn").addEventListener("click", () => window.print());

  const today = new Date();
  $("#today").textContent = today.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  $("#metaDate").textContent = "Rev 1.0 · " + today.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });

  load();
  applyHeight();
  if (location.search.includes("demo")) fillSample();
  recalc();
  shownScore = Number(scoreEl.textContent);
  initReveal();
  initPill();
})();
