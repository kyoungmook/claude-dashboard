const CHART_DEFAULTS = {
  color: '#9ca3af',
  borderColor: '#374151',
  font: { family: 'system-ui, sans-serif' },
};

Chart.defaults.color = CHART_DEFAULTS.color;
Chart.defaults.borderColor = CHART_DEFAULTS.borderColor;

/* Destroy existing Chart instance on the same canvas before creating a new one */
function destroyIfExists(canvasId) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
}

function createLineChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyIfExists(canvasId);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: config.labels,
      datasets: config.datasets.map(ds => ({
        ...ds,
        borderWidth: 2,
        pointRadius: 1,
        pointHoverRadius: 4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#1f2937' } },
      },
    },
  });
}

function createBarChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyIfExists(canvasId);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: config.labels,
      datasets: config.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
      },
      scales: {
        x: {
          grid: { display: false },
          stacked: config.stacked || false,
        },
        y: {
          beginAtZero: true,
          grid: { color: '#1f2937' },
          stacked: config.stacked || false,
        },
      },
    },
  });
}

function createHorizontalBarChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyIfExists(canvasId);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: config.labels,
      datasets: config.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#1f2937' } },
        y: { grid: { display: false } },
      },
    },
  });
}

function createDoughnutChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  destroyIfExists(canvasId);

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: config.labels,
      datasets: [{
        data: config.data,
        backgroundColor: config.colors || ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 16 },
        },
      },
    },
  });
}

function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}
