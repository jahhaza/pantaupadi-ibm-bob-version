/**
 * script.js — PantauPadi Dashboard
 * Vanilla JavaScript, tanpa framework.
 * Semua visualisasi mengambil data dari data/dashboard_data.json
 *
 * Alur utama:
 *  1. loadData()       → fetch JSON
 *  2. initDashboard()  → seed semua section
 *  3. Setiap fungsi render* bertanggung jawab pada satu komponen
 */

/* ============================================================
   0. CONSTANTS & HELPERS
   ============================================================ */

/** Palet warna konsisten seluruh dashboard */
const COLORS = {
  low:    '#22c55e',
  medium: '#f59e0b',
  high:   '#ef4444',
  brand:  '#166534',
  // opacity 40% varian untuk grid / fill
  lowBg:    'rgba(34,197,94,0.15)',
  mediumBg: 'rgba(245,158,11,0.15)',
  highBg:   'rgba(239,68,68,0.15)',
};

/** Default Chart.js options yang dipasang global sekali */
function setChartDefaults() {
  Chart.defaults.font.family = '-apple-system, "Segoe UI", system-ui, sans-serif';
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = '#6b7280';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding      = 10;
}

/**
 * Kembalikan class badge sesuai label risiko
 * @param {'low'|'medium'|'high'} label
 * @returns {string}
 */
function badgeClass(label) {
  const map = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };
  return `badge ${map[label] || 'badge-medium'}`;
}

/**
 * Format angka ribuan
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return n.toLocaleString('id-ID');
}

/** Registry chart agar bisa di-destroy sebelum re-render */
const chartRegistry = {};

/**
 * Buat atau timpa chart pada canvas
 * @param {string} id       — id elemen canvas
 * @param {'bar'|'doughnut'|'line'} type
 * @param {object} data
 * @param {object} options
 */
function renderChart(id, type, data, options) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  // Hancurkan instance lama jika ada
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
  }

  chartRegistry[id] = new Chart(canvas, { type, data, options });
}

/* ============================================================
   1. FETCH DATA
   ============================================================ */

/**
 * Muat data JSON dari file lokal.
 * Menggunakan fetch(); untuk membuka lewat file:// gunakan server lokal
 * (mis. Live Server VSCode / `npx serve .`)
 */
async function loadData() {
  try {
    const response = await fetch('data/dashboard_data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Gagal memuat data:', err);
    document.body.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p class="text-4xl mb-4">⚠️</p>
          <h2 class="text-xl font-bold text-slate-700 mb-2">Gagal Memuat Data</h2>
          <p class="text-slate-500 text-sm">Buka dashboard melalui web server lokal.<br>
          Jalankan: <code class="bg-slate-100 px-1 rounded">npx serve .</code> di folder ini.</p>
        </div>
      </div>`;
    return null;
  }
}

/* ============================================================
   2. KPI CARDS
   ============================================================ */

/**
 * Isi angka pada empat KPI card di atas
 * @param {object} data — seluruh objek JSON
 */
function renderKPI(data) {
  const { totalObservasi, distribusiRisiko } = data.ringkasan;

  document.getElementById('kpi-total').textContent = fmt(totalObservasi);

  distribusiRisiko.forEach(item => {
    const key = item.label.toLowerCase();
    const el  = document.getElementById(`kpi-${key}`);
    if (el) el.textContent = `${item.persen}%`;
  });
}

/* ============================================================
   3. FORECAST — Month tabs & Doughnut
   ============================================================ */

/** State aktif bulan yang dipilih (indeks 0-3) */
let activeMonth = 0;

/**
 * Bangun tombol tab bulan prediksi
 * @param {object[]} distribusi — array distribusiPrediksi
 * @param {Function} onSelect   — callback(monthIndex)
 */
function buildMonthTabs(distribusi, onSelect) {
  const container = document.getElementById('month-tabs');
  container.innerHTML = '';

  distribusi.forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = item.bulan;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    btn.dataset.idx = idx;

    btn.addEventListener('click', () => {
      // Toggle class active
      container.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      activeMonth = idx;
      onSelect(idx);
    });

    container.appendChild(btn);
  });
}

/**
 * Render doughnut chart distribusi risiko 1 bulan
 * @param {object} item — satu baris distribusiPrediksi
 */
function renderDoughnut(item) {
  const total = item.low + item.medium + item.high;

  renderChart('chart-doughnut', 'doughnut', {
    labels: ['Low', 'Medium', 'High'],
    datasets: [{
      data: [item.low, item.medium, item.high],
      backgroundColor: [COLORS.low, COLORS.medium, COLORS.high],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6,
    }]
  }, {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.raw} wilayah (${((ctx.raw / total) * 100).toFixed(1)}%)`
        }
      }
    }
  });

  // Update custom legend
  const legend = document.getElementById('doughnut-legend');
  legend.innerHTML = [
    { label: 'Low',    val: item.low,    cls: 'low'    },
    { label: 'Medium', val: item.medium, cls: 'medium' },
    { label: 'High',   val: item.high,   cls: 'high'   },
  ].map(l => `
    <span class="flex items-center gap-1">
      <span class="legend-dot" style="background:${COLORS[l.cls]}"></span>
      <span>${l.label}: <strong>${l.val}</strong></span>
    </span>
  `).join('');
}

/**
 * Render bar chart distribusi prediksi per bulan (semua 4 bulan sekaligus)
 * @param {object[]} distribusi
 */
function renderForecastBar(distribusi) {
  renderChart('chart-forecast-bar', 'bar', {
    labels: distribusi.map(d => d.bulan),
    datasets: [
      { label: 'Low',    data: distribusi.map(d => d.low),    backgroundColor: COLORS.low,    borderRadius: 4, borderSkipped: false },
      { label: 'Medium', data: distribusi.map(d => d.medium), backgroundColor: COLORS.medium, borderRadius: 4, borderSkipped: false },
      { label: 'High',   data: distribusi.map(d => d.high),   backgroundColor: COLORS.high,   borderRadius: 4, borderSkipped: false },
    ]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { stacked: false, grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { stepSize: 5 },
        title: { display: true, text: 'Jumlah Wilayah', font: { size: 11 } }
      }
    }
  });
}

/* ============================================================
   4. TABEL PREDIKSI WILAYAH
   ============================================================ */

/** Cache seluruh data prediksi untuk fitur search */
let allPrediksi = [];

/**
 * Render baris tabel prediksi, bisa difilter
 * @param {object[]} data      — array prediksiDetail
 * @param {string}   filterKey — 'mei'|'juni'|'juli'|'agustus' (untuk highlight)
 * @param {string}   search    — string pencarian (opsional)
 */
function renderTabelPrediksi(data, filterKey = 'mei', search = '') {
  const tbody   = document.getElementById('tbody-prediksi');
  const bulanEl = document.getElementById('tabel-bulan-label');
  const labelMap = { mei: 'Mei 2026', juni: 'Juni 2026', juli: 'Juli 2026', agustus: 'Agustus 2026' };

  if (bulanEl) bulanEl.textContent = labelMap[filterKey] || filterKey;

  const filtered = search
    ? data.filter(d => d.wilayah.toLowerCase().includes(search.toLowerCase()))
    : data;

  tbody.innerHTML = filtered.map(row => `
    <tr>
      <td class="td-cell font-semibold text-slate-700">${row.wilayah}</td>
      <td class="td-cell text-center"><span class="${badgeClass(row.mei)}">${row.mei}</span></td>
      <td class="td-cell text-center"><span class="${badgeClass(row.juni)}">${row.juni}</span></td>
      <td class="td-cell text-center"><span class="${badgeClass(row.juli)}">${row.juli}</span></td>
      <td class="td-cell text-center"><span class="${badgeClass(row.agustus)}">${row.agustus}</span></td>
      <td class="td-cell hidden md:table-cell text-slate-500 text-xs max-w-xs">${row.faktor_dominan}</td>
      <td class="td-cell hidden lg:table-cell text-center">${row.HTH}</td>
      <td class="td-cell hidden lg:table-cell text-center">${row.rasio_KAT.toFixed(3)}</td>
      <td class="td-cell hidden md:table-cell text-slate-500 text-xs max-w-xs">${row.rekomendasi}</td>
    </tr>
  `).join('');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="td-cell text-center text-slate-400 py-8">Tidak ada data ditemukan</td></tr>`;
  }
}

/* ============================================================
   5. CHART HISTORIS: Risiko per Tahun (Stacked Bar)
   ============================================================ */

function renderRisikoTahun(data) {
  const { labels, low, medium, high } = data.risikoPerTahun;

  renderChart('chart-risiko-tahun', 'bar', {
    labels,
    datasets: [
      { label: 'Low (%)',    data: low,    backgroundColor: COLORS.low,    borderRadius: 3, stack: 'risiko' },
      { label: 'Medium (%)', data: medium, backgroundColor: COLORS.medium, borderRadius: 3, stack: 'risiko' },
      { label: 'High (%)',   data: high,   backgroundColor: COLORS.high,   borderRadius: 3, stack: 'risiko' },
    ]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        grid: { color: '#f1f5f9' },
        ticks: { callback: v => v + '%' },
        title: { display: true, text: 'Persentase (%)', font: { size: 11 } }
      }
    }
  });
}

/* ============================================================
   6. CHART TREN IKLIM (Line)
   ============================================================ */

function renderTrenIklim(data) {
  const { labels, avgClimateScore, avgFinalScore, avgHTH } = data.trendTahunan;

  renderChart('chart-tren-iklim', 'line', {
    labels,
    datasets: [
      {
        label: 'Climate Score',
        data: avgClimateScore,
        borderColor: COLORS.high,
        backgroundColor: COLORS.highBg,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Final Score',
        data: avgFinalScore,
        borderColor: COLORS.brand,
        backgroundColor: 'rgba(22,101,52,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderDash: [4, 3],
      },
      {
        label: 'HTH Rata-rata (hari)',
        data: avgHTH,
        borderColor: COLORS.medium,
        backgroundColor: COLORS.mediumBg,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y2',
      },
    ]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top' } },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        title: { display: true, text: 'Skor', font: { size: 11 } }
      },
      y2: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'HTH (hari)', font: { size: 11 } }
      }
    }
  });
}

/* ============================================================
   7. CHART BULAN RAWAN (Bar)
   ============================================================ */

function renderBulanRawan(data) {
  const { labels, persenHighRisk } = data.bulanRawan;

  // Warnai batang merah saat >40%, kuning >15%, hijau sisanya
  const barColors = persenHighRisk.map(v =>
    v > 40 ? COLORS.high : v > 15 ? COLORS.medium : COLORS.low
  );

  renderChart('chart-bulan-rawan', 'bar', {
    labels,
    datasets: [{
      label: '% High Risk',
      data: persenHighRisk,
      backgroundColor: barColors,
      borderRadius: 4,
      borderSkipped: false,
    }]
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => ` ${ctx.raw.toFixed(1)}% wilayah berisiko tinggi` }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        max: 60,
        grid: { color: '#f1f5f9' },
        ticks: { callback: v => v + '%' },
        title: { display: true, text: '% High Risk', font: { size: 11 } }
      }
    }
  });
}

/* ============================================================
   8. CHART FAKTOR DOMINAN (Horizontal Bar)
   ============================================================ */

function renderFaktorDominan(data) {
  // Urutkan terbesar ke terkecil
  const sorted  = [...data.faktorDominan].sort((a, b) => b.jumlah - a.jumlah);
  const labels  = sorted.map(d => d.faktor);
  const values  = sorted.map(d => d.jumlah);

  // Gradient hijau-kuning berdasar posisi
  const bgColors = labels.map((_, i) => {
    const ratio = i / (labels.length - 1);
    // lerp dari brand (#166534) ke medium (#f59e0b)
    return i < 3 ? COLORS.brand
         : i < 6 ? COLORS.medium
         :         COLORS.low;
  });

  renderChart('chart-faktor', 'bar', {
    labels,
    datasets: [{
      label: 'Jumlah Observasi',
      data: values,
      backgroundColor: bgColors,
      borderRadius: 4,
      borderSkipped: false,
    }]
  }, {
    indexAxis: 'y',           // horizontal bar
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${fmt(ctx.raw)} observasi`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        title: { display: true, text: 'Jumlah Observasi', font: { size: 11 } }
      },
      y: { grid: { display: false } }
    }
  });
}

/* ============================================================
   9. CHART TOP WILAYAH HIGH RISK (Horizontal Bar)
   ============================================================ */

function renderTopWilayah(data) {
  const top     = data.topWilayahHighRisk;
  const labels  = top.map(d => d.wilayah);
  const values  = top.map(d => d.persen);

  renderChart('chart-top-wilayah', 'bar', {
    labels,
    datasets: [{
      label: '% High Risk Historis',
      data: values,
      backgroundColor: values.map(v =>
        v >= 39 ? COLORS.high : v >= 37 ? '#f97316' : COLORS.medium
      ),
      borderRadius: 5,
      borderSkipped: false,
    }]
  }, {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => {
            const item = top[ctx.dataIndex];
            return ` ${ctx.raw}% (${item.jumlah} dari ${item.total} obs)`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 50,
        grid: { color: '#f1f5f9' },
        ticks: { callback: v => v + '%' },
        title: { display: true, text: '% High Risk', font: { size: 11 } }
      },
      y: { grid: { display: false } }
    }
  });
}

/* ============================================================
   10. SEARCH & INTERAKSI TABEL
   ============================================================ */

/**
 * Daftarkan event listener untuk input pencarian wilayah
 * @param {object[]} prediksiDetail
 */
function initSearch(prediksiDetail) {
  const input = document.getElementById('search-wilayah');
  const bulanKeys = ['mei', 'juni', 'juli', 'agustus'];

  input.addEventListener('input', () => {
    renderTabelPrediksi(prediksiDetail, bulanKeys[activeMonth], input.value.trim());
  });
}

/* ============================================================
   11. INIT DASHBOARD — entry point setelah data dimuat
   ============================================================ */

/**
 * Orkestrasi semua fungsi render
 * @param {object} data — parsed JSON
 */
function initDashboard(data) {
  // Pasang defaults Chart.js
  setChartDefaults();

  // KPI
  renderKPI(data);

  // Cache prediksi untuk search
  allPrediksi = data.prediksiDetail;

  // Tabs bulan (callback re-render doughnut + tabel saat tab berubah)
  buildMonthTabs(data.distribusiPrediksi, (idx) => {
    const bulanKeys = ['mei', 'juni', 'juli', 'agustus'];
    renderDoughnut(data.distribusiPrediksi[idx]);
    renderTabelPrediksi(allPrediksi, bulanKeys[idx], document.getElementById('search-wilayah').value.trim());
  });

  // Forecast charts
  renderDoughnut(data.distribusiPrediksi[0]);
  renderForecastBar(data.distribusiPrediksi);

  // Tabel awal (Mei)
  renderTabelPrediksi(allPrediksi, 'mei');

  // Search
  initSearch(allPrediksi);

  // Historis
  renderRisikoTahun(data);
  renderTrenIklim(data);
  renderBulanRawan(data);
  renderFaktorDominan(data);

  // Top wilayah
  renderTopWilayah(data);
}

/* ============================================================
   12. MAIN — muat data lalu jalankan dashboard
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const data = await loadData();
  if (data) initDashboard(data);
});
