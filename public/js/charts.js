/**
 * charts.js — Graphiques SGTM
 */
let kpiDonutChart=null, blocChart=null;
// rpeDonutChart → rpeDonutOuterChart + rpeDonutInnerChart

const SGTM_BLOCS = new Set(['1','2','3']);
const TGCC_BLOCS = new Set(['TGCC']);

function initCharts(stats) {
  initKpiDonut(stats);
  updateKPIs(stats);
}

function updateCharts(stats) {
  if (!stats) return;
  updateKPIs(stats);
  updateKpiDonut(stats);
}

function initKpiDonut(stats) {
  const ctx = document.getElementById('kpiDonut');
  if (!ctx) return;
  if (kpiDonutChart) { kpiDonutChart.destroy(); kpiDonutChart=null; }
  const pct = stats.pctGlobal||0;
  kpiDonutChart = new Chart(ctx, {
    type:'doughnut',
    data:{ datasets:[{ data:[pct,100-pct], backgroundColor:['#B8960C','#E5E2DC'], borderWidth:0 }] },
    options:{ responsive:true, cutout:'80%', animation:{duration:700}, plugins:{legend:{display:false},tooltip:{enabled:false}} },
  });
}

function updateKpiDonut(stats) {
  if (!kpiDonutChart) return;
  const pct=stats.pctGlobal||0;
  kpiDonutChart.data.datasets[0].data=[pct,100-pct];
  kpiDonutChart.update();
}

function updateKPIs(stats) {
  // calculé dans updateActivityBars
}

// ── Avancement par activité ───────────────────────────────────────────────────
// Unités Réalisées / Unité Totale = uniquement les éléments ME_ELEMENT TYPE = GD
function updateActivityBars(elements, elementsForGlobal) {
  // ── Compteur ID_TOPO ──────────────────────────────────────────────────────
  const topoCount = (elements || []).filter(el => el.idTopo && String(el.idTopo).trim() !== '').length;
  const kpiTopo = document.getElementById('kpiTopoCount');
  if (kpiTopo) kpiTopo.textContent = topoCount.toLocaleString('fr-FR');

  // ── KPI Réservations (ID_TOPO non vide) ──────────────────────────────────
  const totalReservations = (elements || []).filter(el => el.idTopo && el.idTopo !== '').length;
  const kpiRes = document.getElementById('kpiReservationsTotal');
  if (kpiRes) kpiRes.textContent = totalReservations > 0 ? `— ${totalReservations.toLocaleString('fr-FR')} réservations` : '';

  const stats = computeActivityStats(elements || []);
  const set  = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setW = (id,v) => { const el=document.getElementById(id); if(el) el.style.width=v+'%'; };

  set('ferrPct', `${stats.ferr.pct}%`); setW('ferrBar', stats.ferr.pct);
  set('coulPct', `${stats.coul.pct}%`); setW('coulBar', stats.coul.pct);
  set('posePct', `${stats.pose.pct}%`); setW('poseBar', stats.pose.pct);

  // ── Unités Réalisées / Unité Totale ──────────────────────────────────────
  // Filtrés sur ME_ELEMENT TYPE = 'GD' uniquement
  const els   = elements || [];
  const elsGD = els.filter(el => el.elementType === 'GD');

  const unitesRealisees = elsGD.filter(el => el.pose === 1).length;
  const uniteTotale     = elsGD.filter(el => el.pose === 0 || el.pose === 1).length;
  set('kpiUnitesRealisees', unitesRealisees.toLocaleString('fr-FR'));
  set('kpiUniteTotale',     uniteTotale.toLocaleString('fr-FR'));

  // ── % Avancement Global (roue) ────────────────────────────────────────────
  // Ignore le filtre Grue — filtre GD aussi
  const elsGlobal   = (elementsForGlobal || elements || []).filter(el => el.elementType === 'GD');
  const realiseGlobal = elsGlobal.filter(el => el.pose === 1).length;
  const totalGlobal   = elsGlobal.filter(el => el.pose === 0 || el.pose === 1).length;
  const pctGlobal     = totalGlobal > 0 ? Math.round((realiseGlobal / totalGlobal) * 100) : 0;
  set('kpiPct', `${pctGlobal}%`);
  updateKpiDonutValue(pctGlobal);

  updateEnterprise(elements);
  updateBlocChartData(elements);
  renderBlocActivityTable(elements);
}

function updateKpiDonutValue(pct) {
  if (!kpiDonutChart) return;
  kpiDonutChart.data.datasets[0].data = [pct, 100 - pct];
  kpiDonutChart.update();
}

function updateEnterprise(elements) {
  let sgtmReal=0, sgtmTot=0, tgccReal=0, tgccTot=0;
  for (const el of (elements || [])) {
    if (el.pose !== 0 && el.pose !== 1) continue;
    if (SGTM_BLOCS.has(el.bloc)) { sgtmTot++; if (el.pose === 1) sgtmReal++; }
    if (TGCC_BLOCS.has(el.bloc)) { tgccTot++; if (el.pose === 1) tgccReal++; }
  }
  const sgtmPct = sgtmTot>0 ? Math.round(sgtmReal/sgtmTot*100) : 0;
  const tgccPct = tgccTot>0 ? Math.round(tgccReal/tgccTot*100) : 0;
  const set  = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setW = (id,v) => { const el=document.getElementById(id); if(el) el.style.width=v+'%'; };
  set('sgtmPct',`${sgtmPct}%`); setW('sgtmBar',sgtmPct);
  set('tgccPct',`${tgccPct}%`); setW('tgccBar',tgccPct);
}

function computeBlocUnitStats(elements) {
  const byBloc = {};
  for (const el of (elements || [])) {
    if (el.pose !== 0 && el.pose !== 1) continue;
    if (!el.bloc) continue;
    if (!byBloc[el.bloc]) byBloc[el.bloc] = { total: 0, realise: 0 };
    byBloc[el.bloc].total++;
    if (el.pose === 1) byBloc[el.bloc].realise++;
  }
  return byBloc;
}

function initBlocChart(elements) {
  const ctx = document.getElementById('blocChart');
  if (!ctx) return;
  if (blocChart) { blocChart.destroy(); blocChart=null; }
  const byBloc = computeBlocUnitStats(elements);
  if (!Object.keys(byBloc).length) return;
  const blocs = Object.keys(byBloc).sort();
  const {labels,datasets} = getBlocData(byBloc, blocs);
  blocChart = new Chart(ctx, { type:'bar', data:{labels,datasets}, options:getBlocOptions() });
  blocChart._rawBlocs = blocs; // valeurs brutes ('1','2','3'...) pour le clic, indépendant du libellé affiché
}

function getBlocData(byBloc, blocs) {
  const labels = blocs.map(b => getBlocLabel(b));
  return {
    labels,
    datasets: [
      { label:'Unités Réalisé', data: blocs.map(b => byBloc[b]?.realise || 0),
        backgroundColor:'#B8960C', borderRadius:4, borderSkipped:false },
      { label:'Unités Totale',  data: blocs.map(b => byBloc[b]?.total   || 0),
        backgroundColor:'#1a1a18', borderRadius:4, borderSkipped:false },
    ]
  };
}

function getBlocOptions() {
  const dark = document.body.classList.contains('dark-theme');
  const legendColor = dark ? '#9BA0AC' : '#6B6B6B';
  const tickColor   = dark ? '#7A8090' : '#888';
  const tickColor2  = dark ? '#9BA0AC' : '#AAA';
  const gridColor   = dark ? '#2A2E38' : '#F0EFED';
  return {
    responsive:true, maintainAspectRatio:false, animation:{duration:400},
    onClick:(evt,els)=>{ if(els.length&&window.onBlocClick) window.onBlocClick(blocChart._rawBlocs?.[els[0].index] ?? blocChart.data.labels[els[0].index]); },
    plugins:{
      legend:{ display:true, position:'bottom', labels:{font:{size:10},boxWidth:10,padding:6,color:legendColor} },
      tooltip:{ callbacks:{ label:ctx=> ` ${ctx.parsed.y.toLocaleString('fr-FR')} unités` } },
    },
    scales:{
      x:{ grid:{display:false}, ticks:{font:{size:10},color:tickColor} },
      y:{ grid:{color:gridColor}, ticks:{font:{size:10},color:tickColor2} },
    },
  };
}

window.updateBlocChart = function() {
  updateBlocChartData(AppState.filteredElements || AppState.allElements);
};

function updateBlocChartData(elements) {
  const byBloc = computeBlocUnitStats(elements);
  if (!Object.keys(byBloc).length) { if (blocChart) { blocChart.destroy(); blocChart=null; } return; }
  if (!blocChart) { initBlocChart(elements); return; }
  const blocs = Object.keys(byBloc).sort();
  const {labels,datasets} = getBlocData(byBloc, blocs);
  blocChart.data.labels = labels;
  blocChart.data.datasets = datasets;
  blocChart.update();
}

function renderBlocActivityTable(elements) {
  const tbody  = document.getElementById('blocActivityBody');
  const footer = document.getElementById('tableFooter');
  if (!tbody) return;

  const byBloc = computeBlocActivityStats(elements || []);
  const blocs  = Object.keys(byBloc).sort((a, b) => {
    if (a === 'TGCC') return 1;
    if (b === 'TGCC') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  tbody.innerHTML = blocs.map(b => {
    const d = byBloc[b];
    const label = getBlocLabel(b);
    return `<tr data-bloc="${b}" onclick="if(window.onBlocClick)window.onBlocClick('${b}')">
      <td><strong>${label}</strong></td>
      <td style="color:#D93025;font-weight:700">${d.ferrPct}%</td>
      <td style="color:#3B82C4;font-weight:700">${d.coulPct}%</td>
      <td style="color:#B8960C;font-weight:700">${d.posePct}%</td>
      <td style="color:#B8960C;font-weight:800">${d.posePct}%</td>
    </tr>`;
  }).join('');

  const g = computeActivityStats(elements || []);
  tbody.innerHTML += `<tr style="background:#eef7f1;font-weight:700;cursor:default" onclick="event.stopPropagation()">
    <td>TOTAL</td>
    <td style="color:#D93025">${g.ferr.pct}%</td>
    <td style="color:#3B82C4">${g.coul.pct}%</td>
    <td style="color:#B8960C">${g.pose.pct}%</td>
    <td style="color:#B8960C">${g.pose.pct}%</td>
  </tr>`;

  if (footer) footer.textContent = `${blocs.length} bloc(s)`;
}

// ── Secteurs de secteur (donuts État) ──────────────────────────────────────────
// Génère le contenu du widget "Lecture synthétique" dans un jeu d'éléments donné
// (préfixe d'id). Utilisé pour afficher le MÊME widget à deux endroits du
// dashboard : la carte autonome en haut de page (préfixe 'ssTop') et la page 1
// du carousel "SECTEURS DE SECTEUR" (préfixe historique 'ss').
let ssDonutCharts = {}; // { [prefix]: { main: Chart, sub: Chart } }

function renderSecteursDeSecteurInto(stats, prefix) {
  if (!stats) return;
  const { leve, aLever, aModeliser, aCreer } = stats;
  const total = leve.count + aLever.count + aModeliser.count + aCreer.count;
  const pct = (c) => total > 0 ? Math.round((c / total) * 100) : 0;
  const combinedCount = leve.count + aModeliser.count;
  const combinedPct   = pct(combinedCount);

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const fmt = n => (n || 0).toLocaleString('fr-FR') + ' réservations';

  setText(prefix + 'CalloutPct',   combinedPct + ' %');
  setText(prefix + 'CalloutCount', fmt(combinedCount));

  setText(prefix + 'PctALever',   pct(aLever.count) + ' %');
  setText(prefix + 'CountALever', fmt(aLever.count));
  setText(prefix + 'PctACreer',   pct(aCreer.count) + ' %');
  setText(prefix + 'CountACreer', fmt(aCreer.count));

  setText(prefix + 'PctLeve',       total > 0 ? (leve.count / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : '0 %');
  setText(prefix + 'CountLeve',     fmt(leve.count));
  setText(prefix + 'PctAModeliser', total > 0 ? (aModeliser.count / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : '0 %');
  setText(prefix + 'CountAModeliser', fmt(aModeliser.count));

  setText(prefix + 'Total', fmt(total));

  if (!ssDonutCharts[prefix]) ssDonutCharts[prefix] = { main: null, sub: null };
  const store = ssDonutCharts[prefix];

  // Donut principal : À lever / À créer sur chantier / (Levé + À modéliser combinés)
  const ctxMain = document.getElementById(prefix + 'DonutMain');
  if (ctxMain) {
    if (store.main) { store.main.destroy(); store.main = null; }
    store.main = new Chart(ctxMain, {
      type: 'doughnut',
      data: {
        labels: ['À lever', 'À créer sur chantier', 'Levé + À modéliser'],
        datasets: [{
          data: [aLever.count, aCreer.count, combinedCount],
          backgroundColor: ['#E87722', '#D93077', '#D9C68A'],
          borderWidth: 2, borderColor: '#fff',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%', animation: { duration: 700 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } },
      },
    });
  }

  // Donut secondaire : détail Levé / À modéliser (composition du "Levé + À modéliser")
  const ctxSub = document.getElementById(prefix + 'DonutSub');
  if (ctxSub) {
    if (store.sub) { store.sub.destroy(); store.sub = null; }
    store.sub = new Chart(ctxSub, {
      type: 'doughnut',
      data: {
        labels: ['Levé', 'À modéliser'],
        datasets: [{
          data: [leve.count, aModeliser.count],
          backgroundColor: ['#22b07d', '#4A78D9'],
          borderWidth: 2, borderColor: '#fff',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '55%', animation: { duration: 700 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } },
      },
    });
  }
}

function renderSecteursDeSecteur(stats) {
  // Page 1 du carousel "SECTEURS DE SECTEUR"
  renderSecteursDeSecteurInto(stats, 'ss');
}
// ── Réservations par état (donut simple + légende) ────────────────────────────
let rpeDonutOuterChart = null;
let rpeDonutInnerChart = null;

function renderReservationsParEtat(stats) {
  if (!stats) return;
  const { leve, aLever, aModeliser, aCreer, theorique, aConfirmer } = stats;

  const aVenir    = { count: 0 };
  const enAttente = aLever;
  // Total = somme de tous les états (leve - 2 pour exclure les 2 parasites)
  const leveCorr  = leve.count - 2;
  const total = leveCorr + enAttente.count + aModeliser.count + aCreer.count + (theorique?.count || 0) + aVenir.count;

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const fmtPct  = (c) => total > 0 ? (c / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '0';
  const fmtLine = (c) => `${c.toLocaleString('fr-FR')} · ${fmtPct(c)} %`;

  setText('rpeTotalNum',       total.toLocaleString('fr-FR'));
  setText('rpeTotalCount',     total.toLocaleString('fr-FR'));
  setText('rpeValLeve',        fmtLine(leveCorr));
  setText('rpeValALever',      fmtLine(enAttente.count));
  setText('rpeValAModeliser',  fmtLine(aModeliser.count));
  setText('rpeValACreer',      fmtLine(aCreer.count));
  setText('rpeValTheorique',   fmtLine(theorique?.count || 0));
  setText('rpeValAVenir',      fmtLine(aVenir.count));
  setText('rpeValAConfirmer',  fmtLine(aConfirmer?.count || 0));
  setText('rpeValResteALever', fmtLine(enAttente.count + aVenir.count));
  setText('rpeValLeveeTopo',   fmtLine(leveCorr + aModeliser.count));

  // ── Cercle EXTÉRIEUR (État détaillé) ─────────────────────────────────────
  const ctxOuter = document.getElementById('rpeDonutOuter');
  if (ctxOuter) {
    if (rpeDonutOuterChart) { rpeDonutOuterChart.destroy(); rpeDonutOuterChart = null; }
    rpeDonutOuterChart = new Chart(ctxOuter, {
      type: 'doughnut',
      data: {
        labels: ['À créer sur chantier', 'Théorique', 'En attente', 'À venir', 'Levée', 'À modéliser'],
        datasets: [{
          data: [aCreer.count, theorique?.count || 0, enAttente.count, aVenir.count, leveCorr, aModeliser.count],
          backgroundColor: ['#D93077', '#9B59B6', '#E87722', '#B8960C', '#22b07d', '#4A78D9'],
          borderWidth: 3, borderColor: '#fff',
          weight: 1,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '55%',
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed.toLocaleString('fr-FR')} (${fmtPct(c.parsed)} %)` } }
        },
      },
    });
  }

  // ── Cercle INTÉRIEUR (État Global) ───────────────────────────────────────
  const ctxInner = document.getElementById('rpeDonutInner');
  if (ctxInner) {
    if (rpeDonutInnerChart) { rpeDonutInnerChart.destroy(); rpeDonutInnerChart = null; }
    const aConfirmerCount = aConfirmer?.count || 0;
    const resteALever     = enAttente.count + aVenir.count;
    const leveeTopo       = leveCorr + aModeliser.count;
    rpeDonutInnerChart = new Chart(ctxInner, {
      type: 'doughnut',
      data: {
        labels: ['À confirmer', 'Reste à lever', 'Levée TOPO'],
        datasets: [{
          data: [aConfirmerCount, resteALever, leveeTopo],
          backgroundColor: ['#E91E8C', '#FF8C00', '#00CC88'],
          borderWidth: 3, borderColor: '#fff',
          weight: 0.6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '75%',
        animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed.toLocaleString('fr-FR')} (${fmtPct(c.parsed)} %)` } }
        },
      },
    });
  }
}

// ── Type / Orientation / Type × Orientation (barres + tableau croisé) ─────────
const TO_BAR_COLORS = ['#C9A227', '#1a1a1a', '#6B7280', '#4A78D9', '#22b07d', '#E87722', '#D93077'];

function renderTypeOrientationBars(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = list.length ? list[0][1] : 1;
  el.innerHTML = list.map(([label, count], i) => {
    const color = TO_BAR_COLORS[i % TO_BAR_COLORS.length];
    const widthPct = max > 0 ? Math.round((count / max) * 100) : 0;
    return `
      <div class="to-bar-row">
        <span class="to-bar-label">${label}</span>
        <div class="to-bar-track"><div class="to-bar-fill" style="width:${widthPct}%;background:${color}"></div></div>
        <span class="to-bar-val">${count.toLocaleString('fr-FR')}</span>
      </div>`;
  }).join('') || '<div class="to-sub">Aucune donnée</div>';
}

function renderTypeOrientationCrossTable(toStats) {
  const head = document.getElementById('toCrossHead');
  const body = document.getElementById('toCrossBody');
  if (!head || !body) return;

  const { typeList, orientationNames, cross } = toStats;

  head.innerHTML = `<th>TYPE</th>` +
    orientationNames.map(o => `<th>${o}</th>`).join('') +
    `<th>TOTAL</th>`;

  body.innerHTML = typeList.map(([type, total]) => {
    const cells = orientationNames.map(o => `<td>${(cross[type]?.[o] || 0).toLocaleString('fr-FR')}</td>`).join('');
    return `<tr><td><strong>${type}</strong></td>${cells}<td><strong>${total.toLocaleString('fr-FR')}</strong></td></tr>`;
  }).join('') || `<tr><td colspan="${orientationNames.length + 2}">Aucune donnée</td></tr>`;
}

function renderTypeOrientation(elements) {
  const toStats = computeTypeOrientationStats(elements);
  renderTypeOrientationBars('toTypeBars', toStats.typeList);
  renderTypeOrientationBars('toOrientationBars', toStats.orientationList);
  renderTypeOrientationCrossTable(toStats);
}

// ── État × Type / État × Orientation (page 3 du carousel) ─────────────────────
function renderEtatCrossTable(headId, bodyId, cols, byEtat) {
  const head = document.getElementById(headId);
  const body = document.getElementById(bodyId);
  if (!head || !body) return;

  head.innerHTML = `<th>ÉTAT</th>` + cols.map(c => `<th>${c.toUpperCase()}</th>`).join('') + `<th>TOTAL</th>`;

  body.innerHTML = ETAT_ORDER.map(etat => {
    const row = byEtat[etat] || {};
    const total = cols.reduce((sum, c) => sum + (row[c] || 0), 0);
    const cells = cols.map(c => `<td>${(row[c] || 0).toLocaleString('fr-FR')}</td>`).join('');
    const color = ETAT_DOT_COLORS[etat] || '#9AA0A6';
    return `
      <tr>
        <td><span class="eo-dot" style="background:${color}"></span><span style="color:${color}">${etat}</span></td>
        ${cells}
        <td><strong>${total.toLocaleString('fr-FR')}</strong></td>
      </tr>`;
  }).join('');
}

function renderEtatCross(elements) {
  const stats = computeEtatCrossStats(elements);
  renderEtatCrossTable('eoTypeHead', 'eoTypeBody', stats.typeCols, stats.byEtatType);
  renderEtatCrossTable('eoOrientationHead', 'eoOrientationBody', stats.orientCols, stats.byEtatOrient);
}


// ── Levées Topo (rangée principale, thème clair) ──────────────────────────────
function renderTopoKpis(stats) {
  if (!stats) return;
  const { leve, aLever, aModeliser, aCreer } = stats;
  const total = leve.count + aLever.count + aModeliser.count + aCreer.count;
  const pct = (c) => total > 0 ? (c / total * 100) : 0;
  const fmtPct = (c) => pct(c).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setWidth = (id, w) => { const el = document.getElementById(id); if (el) el.style.width = w + '%'; };

  const leveesTopoCount = (leve.count - 2) + aModeliser.count;
setText('topoLeveesTopoNum', leveesTopoCount.toLocaleString('fr-FR'));
  setText('topoLeveesTopoSub', `${fmtPct(leveesTopoCount)} % · levées + à modéliser`);
  setWidth('topoProgressLeve', fmtPct(leve.count));
  setWidth('topoProgressModeliser', fmtPct(aModeliser.count));

  setText('topoLeveNum', (leve.count - 2).toLocaleString('fr-FR'));
  setText('topoLeveSub', `${fmtPct(leve.count)} %`);

  setText('topoALeverNum', aLever.count.toLocaleString('fr-FR'));
  setText('topoALeverSub', `${fmtPct(aLever.count)} %`);

  setText('topoAModeliserNum', aModeliser.count.toLocaleString('fr-FR'));
  setText('topoAModeliserSub', `${fmtPct(aModeliser.count)} %`);

  setText('topoACreerNum', aCreer.count.toLocaleString('fr-FR'));
  setText('topoACreerSub', `${fmtPct(aCreer.count)} %`);

  // ── États sans paramètre dédié pour l'instant ──────────────────────────────
  // "En attente" reprend la valeur de "À lever" (demandé explicitement).
  setText('topoEnAttenteNum', aLever.count.toLocaleString('fr-FR'));
  setText('topoEnAttenteSub', `${fmtPct(aLever.count)} %`);

  // "À confirmer" = À créer + Théorique
  const aConfirmerStats = stats.aConfirmer || { count: 0 };
  setText('topoAConfirmerNum', aConfirmerStats.count.toLocaleString('fr-FR'));
  setText('topoAConfirmerSub', `${fmtPct(aConfirmerStats.count)} %`);

  // "À venir" : pas de paramètre source pour l'instant → 0 en attendant.
  setText('topoAVenirNum', '0');
  setText('topoAVenirSub', '0 %');

  // "Théorique" = éléments avec Res_État = 'Théorique'
  const theoriqueStats = stats.theorique || { count: 0 };
  setText('topoTheoriqueNum', theoriqueStats.count.toLocaleString('fr-FR'));
  setText('topoTheoriqueSub', `${fmtPct(theoriqueStats.count)} %`);
}

// ── Réservations par zone (page 4) ─────────────────────────────────────────────
let rzDonutChart = null;
const RZ_PALETTE = ['#22b07d', '#E87722', '#4A78D9', '#D93077', '#C9A227', '#6B7280', '#17A2B8', '#8E44AD', '#2ECC71', '#E74C3C', '#3498DB', '#F39C12'];

function renderZoneDonut(elements) {
  const zoneStats = computeZoneStats(elements);
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setText('rzTotalNum', zoneStats.total.toLocaleString('fr-FR'));
  setText('rzZoneCountBadge', `${zoneStats.list.length} zone${zoneStats.list.length > 1 ? 's' : ''}`);

  const legend = document.getElementById('rzLegend');
  if (legend) {
    legend.innerHTML = zoneStats.list.map(([zone, count], i) => {
      const color = RZ_PALETTE[i % RZ_PALETTE.length];
      const pct = zoneStats.total > 0 ? (count / zoneStats.total * 100) : 0;
      return `
        <div class="rz-legend-item">
          <span class="rz-dot" style="background:${color}"></span>
          <span class="rz-legend-label">Zone ${zone}</span>
          <span class="rz-legend-count">${count.toLocaleString('fr-FR')}</span>
          <span class="rz-legend-pct">${pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</span>
        </div>`;
    }).join('') || '<div class="rz-sub">Aucune donnée</div>';
  }

  const ctx = document.getElementById('rzDonut');
  if (!ctx) return;
  if (rzDonutChart) { rzDonutChart.destroy(); rzDonutChart = null; }
  rzDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: zoneStats.list.map(([zone]) => `Zone ${zone}`),
      datasets: [{
        data: zoneStats.list.map(([, count]) => count),
        backgroundColor: zoneStats.list.map((_, i) => RZ_PALETTE[i % RZ_PALETTE.length]),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%', animation: { duration: 700 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } },
    },
  });
}

// ── Surface cumulée (page 4) ───────────────────────────────────────────────────
let scCurrentGroupBy = 'orientation';
let scCurrentElements = [];
const SC_GROUP_LABELS = { etat: 'État', zone: 'Zone', type: 'Type', orientation: 'Orientation' };

function fmtM2(v) {
  return (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' m²';
}

window.scSetGroupBy = function(groupBy) {
  scCurrentGroupBy = groupBy;
  document.querySelectorAll('#scTabs .sc-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.group === groupBy);
  });
  renderSurfaceCumulee(scCurrentElements);
};

function renderSurfaceCumulee(elements) {
  scCurrentElements = elements || [];
  const stats = computeSurfaceStats(scCurrentElements, scCurrentGroupBy);
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setText('scTotalSurface', fmtM2(stats.totalSurface));
  setText('scAvgSurface', fmtM2(stats.avgSurface));
  setText('scDimsAvailable', `${stats.withDims.toLocaleString('fr-FR')} / ${stats.totalCount.toLocaleString('fr-FR')}`);

  const bars = document.getElementById('scBars');
  if (!bars) return;
  const maxSurface = stats.list.length ? stats.list[0].surface : 1;
  const colorFor = (i) => RZ_PALETTE[i % RZ_PALETTE.length];

  bars.innerHTML = stats.list.map((item, i) => {
    const widthPct = maxSurface > 0 ? Math.round((item.surface / maxSurface) * 100) : 0;
    return `
      <div class="sc-bar-row">
        <div class="sc-bar-top">
          <div>
            <div class="sc-bar-name">${item.label}</div>
            <div class="sc-bar-meta">${item.count.toLocaleString('fr-FR')} réservations · ${item.pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de la surface</div>
          </div>
          <div class="sc-bar-right">
            <div class="sc-bar-val">${fmtM2(item.surface)}</div>
            <div class="sc-bar-pct">${item.pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</div>
          </div>
        </div>
        <div class="sc-bar-track">
          <div class="sc-bar-bg"><div class="sc-bar-fill" style="width:${widthPct}%;background:${colorFor(i)}"></div></div>
        </div>
      </div>`;
  }).join('') || '<div class="rz-sub">Aucune donnée de surface disponible (Res_B / Res_H manquants).</div>';
}