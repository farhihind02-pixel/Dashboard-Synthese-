/**
 * charts.js — Graphiques SGTM
 */
let kpiDonutChart=null, blocChart=null;
let ssDonutMainChart=null, ssDonutSubChart=null;
let rpeDonutChart=null;

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
}

function getBlocData(byBloc, blocs) {
  const labels = blocs.map(b => b === 'TGCC' ? 'Bloc TGCC' : `Bloc ${b}`);
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
  return {
    responsive:true, maintainAspectRatio:false, animation:{duration:400},
    onClick:(evt,els)=>{ if(els.length&&window.onBlocClick) window.onBlocClick(blocChart.data.labels[els[0].index].replace('Bloc ','')); },
    plugins:{
      legend:{ display:true, position:'bottom', labels:{font:{size:10},boxWidth:10,padding:6,color:'#6B6B6B'} },
      tooltip:{ callbacks:{ label:ctx=> ` ${ctx.parsed.y.toLocaleString('fr-FR')} unités` } },
    },
    scales:{
      x:{ grid:{display:false}, ticks:{font:{size:10},color:'#888'} },
      y:{ grid:{color:'#F0EFED'}, ticks:{font:{size:10},color:'#AAA'} },
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
    const label = b === 'TGCC' ? 'Bloc TGCC' : `Bloc ${b}`;
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
function renderSecteursDeSecteur(stats) {
  if (!stats) return;
  const { leve, aLever, aModeliser, aCreer } = stats;
  const total = leve.count + aLever.count + aModeliser.count + aCreer.count;
  const pct = (c) => total > 0 ? Math.round((c / total) * 100) : 0;
  const combinedCount = leve.count + aModeliser.count;
  const combinedPct   = pct(combinedCount);

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const fmt = n => (n || 0).toLocaleString('fr-FR') + ' réservations';

  setText('ssCalloutPct',   combinedPct + ' %');
  setText('ssCalloutCount', fmt(combinedCount));

  setText('ssPctALever',   pct(aLever.count) + ' %');
  setText('ssCountALever', fmt(aLever.count));
  setText('ssPctACreer',   pct(aCreer.count) + ' %');
  setText('ssCountACreer', fmt(aCreer.count));

  setText('ssPctLeve',       total > 0 ? (leve.count / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : '0 %');
  setText('ssCountLeve',     fmt(leve.count));
  setText('ssPctAModeliser', total > 0 ? (aModeliser.count / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : '0 %');
  setText('ssCountAModeliser', fmt(aModeliser.count));

  setText('ssTotal', fmt(total));

  // Donut principal : À lever / À créer sur chantier / (Levé + À modéliser combinés)
  const ctxMain = document.getElementById('ssDonutMain');
  if (ctxMain) {
    if (ssDonutMainChart) { ssDonutMainChart.destroy(); ssDonutMainChart = null; }
    ssDonutMainChart = new Chart(ctxMain, {
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
  const ctxSub = document.getElementById('ssDonutSub');
  if (ctxSub) {
    if (ssDonutSubChart) { ssDonutSubChart.destroy(); ssDonutSubChart = null; }
    ssDonutSubChart = new Chart(ctxSub, {
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
// ── Réservations par état (donut simple + légende) ────────────────────────────
function renderReservationsParEtat(stats) {
  if (!stats) return;
  const { leve, aLever, aModeliser, aCreer } = stats;
  const total = leve.count + aLever.count + aModeliser.count + aCreer.count;

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const fmtPct = (c) => total > 0 ? (c / total * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '0';
  const fmtLine = (c) => `${c.toLocaleString('fr-FR')} · ${fmtPct(c)} %`;

  setText('rpeTotalNum', total.toLocaleString('fr-FR'));
  setText('rpeValLeve',       fmtLine(leve.count));
  setText('rpeValALever',     fmtLine(aLever.count));
  setText('rpeValAModeliser', fmtLine(aModeliser.count));
  setText('rpeValACreer',     fmtLine(aCreer.count));

  const ctx = document.getElementById('rpeDonut');
  if (!ctx) return;
  if (rpeDonutChart) { rpeDonutChart.destroy(); rpeDonutChart = null; }
  rpeDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Levé', 'À lever', 'À modéliser', 'À créer sur chantier'],
      datasets: [{
        data: [leve.count, aLever.count, aModeliser.count, aCreer.count],
        backgroundColor: ['#22b07d', '#E87722', '#4A78D9', '#D93077'],
        borderWidth: 3, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%', animation: { duration: 700 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } },
    },
  });
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