/* Appel de novembre : JS sans dépendance ni build.
   Les données vivent dans /data/*.json et s'éditent à la main. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const page = document.body.dataset.page || "";
  const NOW = new Date();

  const fmt = {
    long: new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    day: new Intl.DateTimeFormat("fr-BE", { day: "numeric" }),
    mon: new Intl.DateTimeFormat("fr-BE", { month: "short" }),
    wd: new Intl.DateTimeFormat("fr-BE", { weekday: "short" }),
    dm: new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }),
    full: new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }),
    stamp: new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
  };

  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const parseDay = s => new Date(s.length === 10 ? s + "T12:00:00+01:00" : s);
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);

  async function getJSON(path) {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(path + " → " + r.status);
    return r.json();
  }

  function fail(el, err) {
    if (!el) return;
    console.error(err);
    el.innerHTML = `<p class="empty">Données indisponibles. Si vous ouvrez le fichier en local, lancez un petit serveur (<code>python3 -m http.server</code>).</p>`;
  }

  /* ---------- Thème ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  };
  const savedTheme = store.get("adn-theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $$("[data-theme-toggle]").forEach(btn => btn.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("adn-theme", next);
  }));

  /* ---------- Menu mobile ---------- */
  const menuBtn = $(".menu-btn"), nav = $(".nav");
  if (menuBtn && nav) menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  /* ---------- Partage ---------- */
  const toast = msg => {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  };
  $$("[data-share]").forEach(b => b.addEventListener("click", async () => {
    const data = { title: document.title, text: "Appel de novembre : crise politique et mobilisation en front commun syndical", url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch { /* annulé */ } return; }
    try { await navigator.clipboard.writeText(location.href); toast("Lien copié"); } catch { toast(location.href); }
  }));

  /* ---------- Compte à rebours ---------- */
  function countdown(target) {
    const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const n = Math.round((day(target) - day(NOW)) / 86400000);
    if (n < 0) return "Passé";
    if (n === 0) return "Aujourd'hui";
    if (n === 1) return "Demain";
    return `J-${n}`;
  }

  /* ---------- Bandeau d'état (toutes pages) ---------- */
  const alertEl = $("[data-alert]");
  const etatP = getJSON("data/etat.json");
  etatP.then(etat => {
    if (alertEl) {
      $("[data-alert-text]", alertEl).textContent = etat.bandeau;
      const st = $("[data-alert-stamp]", alertEl);
      if (st) st.textContent = "Mis à jour le " + fmt.stamp.format(new Date(etat.maj));
    }
  }).catch(() => { if (alertEl) alertEl.hidden = true; });

  /* ---------- Accueil ---------- */
  const agEl = $("[data-agenda]");
  if (agEl) {
    getJSON("data/agenda.json").then(items => {
      const upcoming = items.filter(i => new Date(i.date) >= new Date(NOW.getTime() - 86400000));
      const list = upcoming.length ? upcoming : items.slice(-2);
      agEl.innerHTML = list.map(i => {
        const dt = new Date(i.date);
        const heure = i.heure_inconnue ? "Heure et lieu de rendez-vous : à confirmer" : i.sans_heure ? "" : dt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
        return `<article class="rdv ${esc(i.couleur)}">
          <div class="rdv-top">
            <div class="rdv-date" aria-hidden="true"><span class="w">${esc(fmt.wd.format(dt))}</span><span class="d">${fmt.day.format(dt)}</span><span class="m">${esc(fmt.mon.format(dt))}</span></div>
            <div class="rdv-body">
              <div class="countdown">${esc(countdown(dt))} · ${esc(i.type)}</div>
              <h3>${esc(i.titre)}</h3>
              <p>${esc(i.texte)}</p>
              <div class="rdv-meta"><span><span class="sr-only">Date : </span>${esc(fmt.long.format(dt))}</span><span>${esc(i.lieu)}</span>${heure ? `<span>${esc(heure)}</span>` : ""}<a href="${esc(i.src)}" rel="noopener" target="_blank">Source : ${esc(host(i.src))}</a></div>
            </div>
          </div>
        </article>`;
      }).join("");
    }).catch(e => fail(agEl, e));
  }

  if (page === "accueil") {
    etatP.then(etat => {
      const since = $("[data-since]");
      if (since) {
        const n = Math.max(0, daysBetween(parseDay(etat.depuis), NOW));
        since.textContent = "J+" + n;
      }
      const t = $("[data-etat-titre]"); if (t) t.textContent = etat.titre;
      const r = $("[data-etat-resume]"); if (r) r.textContent = etat.resume;
      const steps = $("[data-etapes]");
      if (steps) {
        let nextMarked = false;
        steps.innerHTML = etat.etapes.map(s => {
          const d = parseDay(s.date);
          const done = d < new Date(NOW.toDateString());
          let cls = done ? "done" : "";
          if (!done && !nextMarked) { cls = "next"; nextMarked = true; }
          return `<li class="${cls}"><span class="when">${esc(s.label)}</span><span>${esc(s.texte)} <a href="${esc(s.src)}" target="_blank" rel="noopener" class="small">[${esc(host(s.src))}]</a></span></li>`;
        }).join("");
      }
      const bl = $("[data-blocages]");
      if (bl) bl.innerHTML = etat.blocages.map(b => `<li><strong>${esc(b.sujet)} :</strong> ${esc(b.texte)}</li>`).join("");
      const sc = $("[data-scenarios]");
      if (sc) sc.innerHTML = etat.scenarios.map(b => `<li><strong>${esc(b.nom)} :</strong> ${esc(b.texte)}</li>`).join("");
      const sb = $("[data-sources-blocages]");
      if (sb) sb.innerHTML = "Sources : " + etat.sources_blocages.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(", ");
    }).catch(e => fail($("[data-etapes]"), e));
  }

  /* ---------- Chronologie ---------- */
  if (page === "chronologie") {
    const root = $("[data-timeline]");
    const search = $("[data-search]");
    const chips = $$("[data-filter]");
    const keyOnly = $("[data-key]");
    const count = $("[data-count]");
    const CAT = { syndical: ["Mobilisation", "red"], gouvernement: ["Gouvernement", ""], social: ["Impact social", "green"], justice: ["Justice", "blue"] };
    let data = [], cat = "tous", onlyKey = false, q = "";

    const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    function render() {
      const nq = norm(q);
      const items = data.filter(e =>
        (cat === "tous" || e.cat === cat) &&
        (!onlyKey || e.key) &&
        (!nq || norm(e.titre + " " + e.texte).includes(nq))
      );
      count.textContent = `${items.length} évènement${items.length > 1 ? "s" : ""}`;
      if (!items.length) { root.innerHTML = `<li class="empty">Aucun évènement ne correspond.</li>`; return; }
      let html = "", year = null, todayDone = false;
      for (const e of items) {
        const d = parseDay(e.date);
        const y = d.getFullYear();
        if (y !== year) { html += `<li><span class="year">${y}</span></li>`; year = y; }
        if (!todayDone && d > NOW) {
          html += `<li class="ev today-marker" aria-label="Aujourd'hui"><div class="today-line">Aujourd'hui · ${esc(fmt.full.format(NOW))}</div></li>`;
          todayDone = true;
        }
        const [lab, col] = CAT[e.cat] || [e.cat, ""];
        const future = d > NOW ? " future" : "";
        html += `<li class="ev${e.key ? " key" : ""}${future}" data-cat="${esc(e.cat)}">
          <div class="ev-date">${esc(e.label || fmt.dm.format(d))}</div>
          <div class="ev-dot" aria-hidden="true"></div>
          <div class="ev-card">
            <div class="ev-tags"><span class="tag ${col}">${esc(lab)}</span>${e.key ? '<span class="tag solid">Temps fort</span>' : ""}${future ? '<span class="tag">À venir</span>' : ""}</div>
            <h3>${esc(e.titre)}</h3>
            <p>${esc(e.texte)}</p>
            <div class="ev-src">${(e.src || []).map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("")}</div>
          </div>
        </li>`;
      }
      root.innerHTML = html;
    }

    getJSON("data/chronologie.json").then(d => {
      data = d.sort((a, b) => a.date.localeCompare(b.date));
      const h = location.hash.replace("#", "");
      if (CAT[h]) { cat = h; chips.forEach(c => c.setAttribute("aria-pressed", String(c.dataset.filter === h))); }
      render();
    }).catch(e => fail(root, e));

    chips.forEach(c => c.addEventListener("click", () => {
      cat = c.dataset.filter;
      chips.forEach(x => x.setAttribute("aria-pressed", String(x === c)));
      render();
    }));
    keyOnly && keyOnly.addEventListener("click", () => {
      onlyKey = !onlyKey; keyOnly.setAttribute("aria-pressed", String(onlyKey)); render();
    });
    search && search.addEventListener("input", () => { q = search.value; render(); });
  }

  /* ---------- Sources ---------- */
  if (page === "sources") {
    const root = $("[data-sources]");
    const search = $("[data-search]");
    let groups = {};
    Promise.all([getJSON("data/sources.json"), getJSON("data/chronologie.json")]).then(([extra, chrono]) => {
      const seen = new Set();
      const all = [];
      extra.forEach(s => { if (!seen.has(s.u)) { seen.add(s.u); all.push(s); } });
      chrono.forEach(e => (e.src || []).forEach(([t, u]) => {
        if (seen.has(u)) return; seen.add(u);
        all.push({ cat: "Cités dans la chronologie", who: t, t: e.titre, u, d: e.date });
      }));
      groups = all.reduce((acc, s) => ((acc[s.cat] ||= []).push(s), acc), {});
      draw("");
      const c = $("[data-count]"); if (c) c.textContent = `${all.length} sources`;
    }).catch(e => fail(root, e));

    function draw(q) {
      const nq = q.toLowerCase();
      const order = ["Crise politique", "Mobilisation", "Pensions", "Chômage & CPAS", "Salaires", "Budget & fiscalité", "Documents officiels", "Cités dans la chronologie", "Voir aussi"];
      const cats = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
      root.innerHTML = cats.map(c => {
        const list = groups[c].filter(s => !nq || (s.t + s.who + s.u).toLowerCase().includes(nq));
        if (!list.length) return "";
        return `<h3 class="mt-2">${esc(c)} <span class="muted small">(${list.length})</span></h3>
          <ul class="src-list">${list.map(s => `<li><span class="who">${esc(s.who)} · ${esc(host(s.u))}</span><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>${s.d ? ` <span class="d">· ${esc(s.d)}</span>` : ""}</li>`).join("")}</ul>`;
      }).join("") || `<p class="empty">Aucune source ne correspond.</p>`;
    }
    search && search.addEventListener("input", () => draw(search.value));
  }

  /* ---------- Barres animées ---------- */
  const fills = $$(".bar-fill[data-w]");
  if (fills.length) {
    const go = el => { el.style.width = el.dataset.w + "%"; };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { go(e.target); io.unobserve(e.target); } }), { threshold: .3 });
      fills.forEach(f => io.observe(f));
    } else fills.forEach(go);
  }

  /* ---------- Année du pied de page ---------- */
  $$("[data-year]").forEach(el => { el.textContent = NOW.getFullYear(); });
})();
