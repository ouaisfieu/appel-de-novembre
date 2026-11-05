/* BOUM : simulateur « l'équation impossible » et graphiques. Sans dépendance. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const fmt = v => nf.format(Math.round(v * 100) / 100);
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- Toast & partage ---------- */
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function share(text) {
    const url = location.href;
    if (navigator.share) { navigator.share({ title: "BOUM · l'équation impossible", text, url }).catch(() => {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(text + "\n" + url) : Promise.reject())
      .then(() => toast("Lien copié"), () => toast(url));
  }

  /* ---------- Simulateur ---------- */
  let D = null;
  const state = { on: new Set(), variant: 0 };

  const amountOf = (m) => {
    if (m.variantes) return m.variantes[state.variant].v;
    return m.montant;
  };
  const structOf = (m) => (typeof m.structurel === "number" ? m.structurel : amountOf(m));

  function evaluate(set) {
    let total = 0, recettes = 0;
    const byPayer = {};
    for (const m of D.mesures) {
      if (!set.has(m.id)) continue;
      const v = structOf(m);
      total += v;
      if (m.recette) recettes += v;
      if (m.payeur) byPayer[m.payeur] = (byPayer[m.payeur] || 0) + v;
    }
    const boom = {};
    for (const a of D.acteurs) {
      const reasons = [];
      for (const r of a.regles) {
        if (r.type === "any" && r.mesures.some(id => set.has(id))) reasons.push(r);
        if (r.type === "recettes_max" && recettes > r.seuil + 1e-9) reasons.push(r);
        if (r.type === "total_min" && total < r.seuil - 1e-9) reasons.push(r);
      }
      if (reasons.length) boom[a.id] = reasons;
    }
    return { total, recettes, byPayer, boom };
  }

  function renderMeasures() {
    const root = $("[data-measures]");
    root.innerHTML = D.mesures.map(m => {
      const p = m.payeur ? D.payeurs[m.payeur] : null;
      const zero = typeof m.structurel === "number" && m.structurel === 0;
      const variant = m.variantes ? `<span class="pill" style="cursor:pointer" data-variant role="button" tabindex="0" title="Changer d'estimation">Estimation : ${esc(m.variantes[state.variant].label)} ⇄</span>` : "";
      return `<label class="m${state.on.has(m.id) ? " on" : ""}" data-id="${esc(m.id)}">
        <input type="checkbox" ${state.on.has(m.id) ? "checked" : ""} aria-describedby="d-${esc(m.id)}">
        <span class="nm">${esc(m.nom)}</span>
        <span class="amt${zero ? " zero" : ""}" data-amt>${fmt(amountOf(m))} <small>Md€</small></span>
        <span class="dt" id="d-${esc(m.id)}">${esc(m.detail)}</span>
        <span class="meta">
          ${p ? `<span class="pill"><span class="sw" style="background:${p.couleur}"></span>${esc(p.label)}</span>` : `<span class="pill">Effet sur le déficit : 0</span>`}
          <span>Proposé par : ${esc(m.propose)}</span>
          ${variant}
          ${m.src.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("")}
        </span>
      </label>`;
    }).join("");

    $$(".m", root).forEach(el => {
      const id = el.dataset.id;
      $("input", el).addEventListener("change", e => {
        e.target.checked ? state.on.add(id) : state.on.delete(id);
        el.classList.toggle("on", e.target.checked);
        update(true);
      });
    });
    const v = $("[data-variant]", root);
    if (v) {
      const flip = e => {
        e.preventDefault(); e.stopPropagation();
        const m = D.mesures.find(x => x.variantes);
        state.variant = (state.variant + 1) % m.variantes.length;
        renderMeasures(); update(true); proof();
        const nv = $("[data-variant]"); nv && nv.focus();
      };
      v.addEventListener("click", flip);
      v.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") flip(e); });
    }
  }

  let prevBoom = new Set();
  function update(animate) {
    const r = evaluate(state.on);
    const obj = D.objectif;
    $("[data-total]").textContent = fmt(r.total);

    // Jauge segmentée par payeur (ordre fixe des catégories)
    const fill = $("[data-fill]");
    const order = Object.keys(D.payeurs);
    const w = Math.min(r.total / obj, 1) * 100;
    fill.style.width = w + "%";
    fill.innerHTML = order.filter(k => r.byPayer[k] > 0).map(k =>
      `<i style="flex:${r.byPayer[k]} 1 0;background:${D.payeurs[k].couleur}" title="${esc(D.payeurs[k].label)} : ${fmt(r.byPayer[k])} Md€"></i>`).join("");
    $("[data-gauge-label]").setAttribute("aria-label", `${fmt(r.total)} sur ${obj} milliards`);

    $("[data-legend]").innerHTML = order.map(k =>
      `<li><span class="sw" style="background:${D.payeurs[k].couleur}"></span>${esc(D.payeurs[k].label)} <span class="v">${fmt(r.byPayer[k] || 0)}</span></li>`).join("");

    // Acteurs
    const now = new Set(Object.keys(r.boom));
    $("[data-actors]").innerHTML = D.acteurs.map(a => {
      const b = r.boom[a.id];
      const fresh = animate && b && !prevBoom.has(a.id);
      const tip = b ? b.map(x => x.raison).join(" ") : (a.camp === "rue" ? "Aucune ligne rouge syndicale franchie." : "Aucune ligne rouge franchie.");
      return `<div class="actor${a.camp === "rue" ? " rue" : ""}${b ? " boom" : ""}" title="${esc(tip)}" ${fresh ? "" : 'style="animation:none"'}>
        <span class="an" title="${esc(a.nom)}">${esc(innerWidth < 981 && a.court ? a.court : a.nom)}</span>
        <span class="st"><span aria-hidden="true">${b ? "✕" : "✓"}</span><span class="lbl"> ${b ? "Boum" : "Tient"}</span></span>
      </div>`;
    }).join("");
    prevBoom = now;

    // Verdict
    const maj = D.acteurs.filter(a => a.camp === "majorite" && r.boom[a.id]);
    const rue = D.acteurs.filter(a => a.camp === "rue" && r.boom[a.id]);
    const v = $("[data-verdict]");
    if (!state.on.size) {
      v.innerHTML = `<b>Cochez des mesures.</b> Tous les montants sont sourcés. Le simulateur indique qui paie, et qui quitte la table.`;
    } else {
      const manque = obj - r.total;
      let head;
      if (maj.length) head = `<span class="boomline">Boum.</span>Votre budget fait sauter : <b>${maj.map(a => a.nom).join(", ")}</b>.`;
      else head = `<span class="okline">Ça passe ?</span>Aucune ligne rouge de la majorité n'est franchie.`;
      const reach = manque > 0.005 ? ` Il manque <b>${fmt(manque)} Md€</b> pour atteindre l'objectif.` : ` Objectif atteint (${fmt(r.total)} Md€).`;
      const street = rue.length ? ` Dans la rue, la <b>${rue.map(a => a.nom).join(", ")}</b> voit une de ses lignes rouges franchie.` : "";
      const reasons = [...maj, ...rue].map(a => r.boom[a.id].map(x =>
        `<li><b>${esc(a.nom)}</b> : ${esc(x.raison)} <a class="src" href="${esc(x.src)}" target="_blank" rel="noopener">source ↗</a></li>`).join("")).join("");
      v.innerHTML = head + reach + street + (reasons ? `<ul class="reasons">${reasons}</ul>` : "");
    }
    const rm = $("[data-reasons-m]");
    if (rm) {
      const list = $(".reasons", v);
      rm.hidden = !list;
      rm.innerHTML = list ? `<b class="ui small">Pourquoi ça saute</b><ul class="reasons">${list.innerHTML}</ul>` : "";
    }

    // État dans l'URL (partageable)
    const ids = D.mesures.filter(m => state.on.has(m.id)).map(m => m.id).join(",");
    const h = ids ? `#m=${ids}${state.variant ? "&f=" + state.variant : ""}` : "";
    if (location.hash !== h && (location.hash.startsWith("#m=") || h)) history.replaceState(null, "", h || location.pathname);
  }

  function proof() {
    const ms = D.mesures, n = ms.length;
    const majIds = D.acteurs.filter(a => a.camp === "majorite").map(a => a.id);
    const partners = majIds.filter(id => id !== "nva");
    let combos = 0, reach = 0, reachClean = 0, bestClean = 0, bestSet = [];
    for (let mask = 0; mask < (1 << n); mask++) {
      const set = new Set();
      for (let i = 0; i < n; i++) if (mask & (1 << i)) set.add(ms[i].id);
      const r = evaluate(set);
      combos++;
      const ok = r.total >= D.objectif - 1e-9;
      if (ok) reach++;
      const clean = majIds.every(id => !r.boom[id]);
      if (ok && clean) reachClean++;
      const partnersClean = partners.every(id => !r.boom[id]);
      if (partnersClean && r.total > bestClean + 1e-9) { bestClean = r.total; bestSet = [...set]; }
    }
    const names = bestSet.filter(id => structOf(ms.find(m => m.id === id)) > 0).map(id => ms.find(m => m.id === id).nom.split(" :")[0].split(" (")[0]);
    const est = ms.find(m => m.variantes);
    $("[data-proof]").innerHTML = `
      <h3>La preuve par l'exhaustivité</h3>
      <p>J'ai testé les <span class="num">${combos}</span> combinaisons possibles de ces ${n} mesures${est ? `, avec l'estimation « ${esc(est.variantes[state.variant].label)} » de l'impôt sur la fortune` : ""}.
      <span class="num">${reach}</span> atteignent 10 Md€. <strong>${reachClean === 0 ? "Aucune" : reachClean} ne passe sans faire sauter au moins un parti de la majorité.</strong></p>
      <p>Si l'on veut épargner le MR, Vooruit, Les Engagés et le CD&V, le maximum possible est de <span class="num">${fmt(bestClean)} Md€</span>${names.length ? ` (${names.map(esc).join(", ")})` : ""}. Cela représente ${Math.round(bestClean / D.objectif * 100)} % de l'objectif.</p>
      <p class="muted small">Ce n'est pas une démonstration que tout accord est impossible : il suffit qu'un parti renonce à une ligne rouge, ou que de nouvelles mesures arrivent sur la table. Mais c'est exactement ce que la crise exige, et c'est ce que personne n'a encore accepté de faire.</p>`;
  }

  const PRESETS = {
    dewever: ["sante", "lts", "pcompl", "larges", "bnp"],
    urgence: ["index"],
    larges: ["pcompl", "larges", "foot", "fortune"],
    vide: []
  };

  function initSim(data) {
    D = data;
    // Variantes de l'impôt sur la fortune
    const f = D.mesures.find(m => m.id === "fortune");
    if (f && !f.variantes) f.variantes = [{ label: "Bureau du Plan, 4,7", v: 4.7 }, { label: "UCLouvain, ~10", v: 10 }];
    // État initial depuis l'URL
    const mm = location.hash.match(/m=([a-z,]+)/), ff = location.hash.match(/f=(\d)/);
    if (mm) mm[1].split(",").forEach(id => { if (D.mesures.some(m => m.id === id)) state.on.add(id); });
    if (ff && f) state.variant = Math.min(+ff[1], f.variantes.length - 1);
    renderMeasures(); update(false); proof();

    $$("[data-preset]").forEach(b => b.addEventListener("click", () => {
      state.on = new Set(PRESETS[b.dataset.preset] || []);
      renderMeasures(); update(true);
    }));
  }

  /* ---------- Graphiques ---------- */
  function el(name, attrs = {}, parent) {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.append(n);
    return n;
  }
  function tipFor(card) {
    const tip = $(".tip", card);
    return {
      show(x, y, html) { tip.innerHTML = html; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on"); },
      hide() { tip.classList.remove("on"); }
    };
  }
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function chartDeficit() {
    const card = $("#deficit-card"), host = $("[data-chart=deficit]", card);
    if (!host) return;
    const data = [[2026, 4.9], [2027, 5.1], [2028, 5.2], [2029, 5.7], [2030, 6.2], [2031, 6.3]];
    const W = 640, H = 230, m = { t: 16, r: 46, b: 28, l: 34 };
    const x = yr => m.l + (yr - 2026) / 5 * (W - m.l - m.r);
    const y = v => m.t + (1 - v / 7) * (H - m.t - m.b);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Déficit public projeté de 4,9 % du PIB en 2026 à 6,3 % en 2031" }, host);
    const ink2 = css("--muted"), line = css("--line"), red = css("--red"), ink = css("--ink"), bg = css("--bg-2");
    for (const g of [0, 2, 4, 6]) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(g), y2: y(g), stroke: line, "stroke-width": 1 }, svg);
      const t = el("text", { x: m.l - 8, y: y(g) + 4, "text-anchor": "end", fill: ink2, "font-size": 11, "font-family": "Archivo, sans-serif" }, svg); t.textContent = g + " %";
    }
    el("line", { x1: m.l, x2: W - m.r, y1: y(3), y2: y(3), stroke: ink2, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, svg);
    const ref = el("text", { x: W - m.r + 4, y: y(3) + 4, fill: ink2, "font-size": 11, "font-family": "Archivo, sans-serif" }, svg); ref.textContent = "3 %";
    data.forEach(([yr]) => { const t = el("text", { x: x(yr), y: H - 8, "text-anchor": "middle", fill: ink2, "font-size": 11, "font-family": "Archivo, sans-serif" }, svg); t.textContent = yr; });
    el("path", { d: data.map(([a, b], i) => (i ? "L" : "M") + x(a) + " " + y(b)).join(""), fill: "none", stroke: red, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    data.forEach(([a, b], i) => {
      el("circle", { cx: x(a), cy: y(b), r: 4.5, fill: red, stroke: bg, "stroke-width": 2 }, svg);
      if (i === 0 || i === data.length - 1) {
        const t = el("text", { x: x(a) + (i ? 10 : 0), y: y(b) - 12, "text-anchor": i ? "start" : "middle", fill: ink, "font-size": 13, "font-weight": 800, "font-family": "Archivo, sans-serif" }, svg);
        t.textContent = String(b).replace(".", ",") + " %";
      }
    });
    // Couche de survol
    const cross = el("line", { y1: m.t, y2: H - m.b, stroke: ink2, "stroke-width": 1, opacity: 0 }, svg);
    const hit = el("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: "transparent" }, svg);
    const tip = tipFor(card);
    const move = ev => {
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) / rc.width * W;
      let best = data[0]; for (const d of data) if (Math.abs(x(d[0]) - px) < Math.abs(x(best[0]) - px)) best = d;
      cross.setAttribute("x1", x(best[0])); cross.setAttribute("x2", x(best[0])); cross.setAttribute("opacity", 1);
      const cr = card.getBoundingClientRect();
      tip.show(rc.left - cr.left + x(best[0]) / W * rc.width, rc.top - cr.top + y(best[1]) / H * rc.height, `${best[0]} · déficit ${String(best[1]).replace(".", ",")} % du PIB`);
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); tip.hide(); });
  }

  function chartRue() {
    const card = $("#rue-card"), host = $("[data-chart=rue]", card);
    if (!host) return;
    const data = [
      ["14 oct. 2025", 80000, 140000, ""],
      ["12 mars 2026", 80000, 100000, "+"],
      ["12 mai 2026", 40000, 75000, ""],
      ["9 oct. 2026", 30000, 50000, ""]
    ];
    const W = 640, row = 46, m = { t: 8, r: 70, b: 26, l: 104 };
    const H = m.t + data.length * row + m.b;
    const max = 150000;
    const x = v => m.l + v / max * (W - m.l - m.r);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Participation aux manifestations nationales, en baisse de 80 000-140 000 en octobre 2025 à 30 000-50 000 en octobre 2026" }, host);
    const ink2 = css("--muted"), line = css("--line"), fuse = css("--fuse"), ink = css("--ink");
    for (const g of [0, 50000, 100000, 150000]) {
      el("line", { x1: x(g), x2: x(g), y1: m.t, y2: H - m.b, stroke: line, "stroke-width": 1 }, svg);
      const t = el("text", { x: x(g), y: H - 8, "text-anchor": "middle", fill: ink2, "font-size": 11, "font-family": "Archivo, sans-serif" }, svg); t.textContent = g ? (g / 1000) + " k" : "0";
    }
    const tip = tipFor(card);
    data.forEach(([lab, lo, hi, plus], i) => {
      const cy = m.t + i * row + row / 2;
      const t = el("text", { x: m.l - 12, y: cy + 4, "text-anchor": "end", fill: ink, "font-size": 12.5, "font-weight": 700, "font-family": "Archivo, sans-serif" }, svg); t.textContent = lab;
      el("rect", { x: x(lo), y: cy - 6, width: Math.max(x(hi) - x(lo), 4), height: 12, rx: 4, fill: fuse }, svg);
      const v = el("text", { x: x(hi) + 8, y: cy + 4, fill: ink2, "font-size": 11.5, "font-family": "Archivo, sans-serif" }, svg);
      v.textContent = `${lo / 1000}–${hi / 1000}${plus} k`;
      const hit = el("rect", { x: m.l, y: cy - row / 2, width: W - m.l, height: row, fill: "transparent" }, svg);
      hit.addEventListener("pointerenter", () => {
        const rc = svg.getBoundingClientRect(), cr = card.getBoundingClientRect();
        tip.show(rc.left - cr.left + (x(lo) + x(hi)) / 2 / W * rc.width, rc.top - cr.top + (cy - 6) / H * rc.height,
          `${lab} : ${lo.toLocaleString("fr-BE")} (police) – ${hi.toLocaleString("fr-BE")}${plus} (organisateurs)`);
      });
      hit.addEventListener("pointerleave", () => tip.hide());
    });
  }

  /* ---------- Démarrage ---------- */
  chartDeficit();
  chartRue();
  fetch("data/mesures.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(initSim)
    .catch(err => {
      console.error(err);
      $("[data-measures]").innerHTML = `<p class="muted ui">Impossible de charger les mesures. En local, lancez <code>python3 -m http.server</code> à la racine du site.</p>`;
    });

  $$("[data-share]").forEach(b => b.addEventListener("click", () => {
    let text = "BOUM. Trouvez 10 milliards sans faire sauter une ligne rouge.";
    if (D && state.on.size) {
      const r = evaluate(state.on);
      const maj = D.acteurs.filter(a => a.camp === "majorite" && r.boom[a.id]).map(a => a.nom);
      text = `Mon budget : ${fmt(r.total)} Md€ sur 10. ${maj.length ? "Il fait sauter : " + maj.join(", ") + "." : "Aucune ligne rouge franchie."}`;
    }
    share(text);
  }));
})();
