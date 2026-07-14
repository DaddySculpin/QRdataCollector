// QR Data Analytics Client Application Logic

// Application State
let state = {
  activeTab: 'dashboard',
  filters: {
    appId: '',
    experienceType: '',
    eventType: '',
    startDate: '',
    endDate: ''
  },
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 1
  },
  sorting: {
    sortBy: 'timestamp',
    sortOrder: 'desc'
  },
  charts: {
    trend: null,
    experience: null,
    eventType: null
  },
  eventsList: [] // Cache for currently loaded page events
};

// DOM Content Loaded - Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Set default dates for filters (optional, let's keep it empty for all-time view initially)
  initCharts();
  loadDashboardData();
  
  // Apply initial preset to simulator
  applyPreset('start');

  // Handle escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
});

// Tab Navigation Manager
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Update Content Cards
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`content-${tabId}`).classList.add('active');

  // Auto reload when switching back to dashboard to catch simulated actions
  if (tabId === 'dashboard') {
    loadDashboardData();
  }
}

// Fetch stats and update dashboard
async function loadDashboardData() {
  // Read filter values from UI
  state.filters.appId = document.getElementById('filter-app-id').value;
  state.filters.experienceType = document.getElementById('filter-experience-type').value;
  state.filters.startDate = document.getElementById('filter-start-date').value;
  state.filters.endDate = document.getElementById('filter-end-date').value;

  // Build query string
  const params = new URLSearchParams();
  if (state.filters.appId) params.append('appId', state.filters.appId);
  if (state.filters.experienceType) params.append('experienceType', state.filters.experienceType);
  if (state.filters.startDate) params.append('startDate', state.filters.startDate);
  if (state.filters.endDate) params.append('endDate', state.filters.endDate);

  try {
    const response = await fetch(`/api/dashboard/stats?${params.toString()}`);
    if (!response.ok) throw new Error('Network error fetching dashboard stats');
    
    const stats = await response.json();
    
    updateKPIs(stats.summary);
    updateFilterOptions(stats.meta);
    updateCharts(stats);
    
    // Once stats are loaded, load the matching individual event records
    loadDashboardEvents();

  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    showToast('Failed to retrieve analytics data from server.', 'error');
  }
}

// Update KPI Summary Metrics
function updateKPIs(summary) {
  document.getElementById('kpi-total-events').innerText = summary.totalEvents.toLocaleString();
  document.getElementById('kpi-qr-scans').innerText = summary.qrScans.toLocaleString();
  document.getElementById('kpi-app-events').innerText = summary.appEvents.toLocaleString();
  document.getElementById('kpi-active-apps').innerText = summary.activeAppsCount.toLocaleString();

  // Ratios
  const qrRatio = summary.totalEvents > 0 ? Math.round((summary.qrScans / summary.totalEvents) * 100) : 0;
  const appRatio = summary.totalEvents > 0 ? Math.round((summary.appEvents / summary.totalEvents) * 100) : 0;

  document.getElementById('kpi-qr-ratio').innerText = `${qrRatio}% of total scans`;
  document.getElementById('kpi-app-ratio').innerText = `${appRatio}% of telemetry`;
}

// Update filter dropdown items dynamically based on dataset
function updateFilterOptions(meta) {
  const appIdSelect = document.getElementById('filter-app-id');
  const expTypeSelect = document.getElementById('filter-experience-type');

  const currentAppId = appIdSelect.value;
  const currentExpType = expTypeSelect.value;

  // Reset except first option
  appIdSelect.innerHTML = '<option value="">All Applications</option>';
  expTypeSelect.innerHTML = '<option value="">All Experiences</option>';

  meta.appIds.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.innerText = id;
    if (id === currentAppId) opt.selected = true;
    appIdSelect.appendChild(opt);
  });

  meta.experienceTypes.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.innerText = type;
    if (type === currentExpType) opt.selected = true;
    expTypeSelect.appendChild(opt);
  });

  // Event Type filter in the ledger table header
  const evtTypeSelect = document.getElementById('filter-event-type');
  const currentEvtType = evtTypeSelect.value;
  evtTypeSelect.innerHTML = '<option value="">All Types</option>';
  meta.eventTypes.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.innerText = type;
    if (type === currentEvtType) opt.selected = true;
    evtTypeSelect.appendChild(opt);
  });
}

// Fetch individual event log records
async function loadDashboardEvents() {
  state.filters.eventType = document.getElementById('filter-event-type').value;

  const params = new URLSearchParams({
    page: state.pagination.page,
    limit: state.pagination.limit,
    sortBy: state.sorting.sortBy,
    sortOrder: state.sorting.sortOrder
  });

  if (state.filters.appId) params.append('appId', state.filters.appId);
  if (state.filters.experienceType) params.append('experienceType', state.filters.experienceType);
  if (state.filters.eventType) params.append('eventType', state.filters.eventType);
  if (state.filters.startDate) params.append('startDate', state.filters.startDate);
  if (state.filters.endDate) params.append('endDate', state.filters.endDate);

  const tbody = document.getElementById('events-table-body');
  tbody.innerHTML = `<tr><td colspan="6" class="table-loading">Loading events dataset...</td></tr>`;

  try {
    const response = await fetch(`/api/dashboard/events?${params.toString()}`);
    if (!response.ok) throw new Error('Network error fetching events log');

    const data = await response.json();
    state.eventsList = data.results;
    
    // Update pagination variables
    state.pagination.totalPages = data.totalPages || 1;
    document.getElementById('current-page').innerText = state.pagination.page;
    document.getElementById('total-pages').innerText = state.pagination.totalPages;

    // Enable/disable page buttons
    document.getElementById('prev-page-btn').disabled = state.pagination.page <= 1;
    document.getElementById('next-page-btn').disabled = state.pagination.page >= state.pagination.totalPages;

    // Log count text update
    const startIdx = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
    const endIdx = Math.min(data.page * data.limit, data.total);
    document.getElementById('log-count').innerText = `Showing ${startIdx} to ${endIdx} of ${data.total} logged interactions`;

    renderEventsTable(data.results);
  } catch (error) {
    console.error('Error loading events list:', error);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load log ledger.</td></tr>`;
  }
}

// Render data table rows
function renderEventsTable(events) {
  const tbody = document.getElementById('events-table-body');
  tbody.innerHTML = '';

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No matching events found for the active criteria.</td></tr>`;
    return;
  }

  events.forEach(e => {
    const tr = document.createElement('tr');
    
    // Date format
    const date = new Date(e.timestamp);
    const dateFormatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Payload preview: summarize nicely
    let payloadPreview = '';
    const keys = Object.keys(e.eventData);
    if (keys.length === 0) {
      payloadPreview = '<span class="text-muted">Empty payload</span>';
    } else {
      // Create a small readable string from key-value pairs
      const parts = keys.slice(0, 2).map(k => {
        let val = e.eventData[k];
        if (typeof val === 'object') val = JSON.stringify(val);
        if (typeof val === 'string' && val.length > 20) val = val.substring(0, 18) + '...';
        return `<span style="color:var(--text-muted)">${k}:</span> ${val}`;
      });
      payloadPreview = parts.join(', ');
      if (keys.length > 2) payloadPreview += '...';
    }

    // Determine badge class for event types
    let typeClass = 'badge-evt';
    if (e.eventType === 'qr_scan') typeClass = 'badge-qr';
    else if (e.eventType === 'app_start') typeClass = 'badge-app';

    tr.innerHTML = `
      <td>${dateFormatted}</td>
      <td><span class="badge badge-app">${escapeHTML(e.appId)}</span></td>
      <td><span class="badge badge-exp">${escapeHTML(e.experienceType)}</span></td>
      <td><span class="badge ${typeClass}">${escapeHTML(e.eventType)}</span></td>
      <td class="code-font" style="font-size: 0.8rem;">${payloadPreview}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewEventDetails('${e.id}')">Inspect</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Interactive table column sorting
function toggleSort(field) {
  if (state.sorting.sortBy === field) {
    state.sorting.sortOrder = state.sorting.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.sorting.sortBy = field;
    state.sorting.sortOrder = 'desc'; // Default to newest/highest first
  }

  // Update UI headers indicators
  document.querySelectorAll('.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (icon) {
      icon.innerHTML = '';
      icon.className = 'sort-icon';
    }
  });

  const activeTh = document.querySelector(`th[onclick="toggleSort('${field}')"]`);
  if (activeTh) {
    const icon = activeTh.querySelector('.sort-icon') || document.createElement('span');
    icon.className = `sort-icon ${state.sorting.sortOrder}`;
    icon.innerHTML = state.sorting.sortOrder === 'asc' ? '▲' : '▼';
    if (!activeTh.querySelector('.sort-icon')) {
      activeTh.appendChild(icon);
    }
  }

  state.pagination.page = 1; // Reset to page 1 on sort change
  loadDashboardEvents();
}

// Pagination controls
function changePage(direction) {
  const newPage = state.pagination.page + direction;
  if (newPage >= 1 && newPage <= state.pagination.totalPages) {
    state.pagination.page = newPage;
    loadDashboardEvents();
  }
}

// Open telemetry payload inspect modal
function viewEventDetails(eventId) {
  const event = state.eventsList.find(e => e.id === eventId);
  if (!event) return;

  document.getElementById('modal-event-id').innerText = event.id;
  document.getElementById('modal-event-ip').innerText = event.ip || '127.0.0.1';
  document.getElementById('modal-event-ua').innerText = event.userAgent || 'Unknown Client';
  document.getElementById('modal-event-json').innerText = JSON.stringify(event.eventData, null, 2);

  document.getElementById('details-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('details-modal').classList.remove('open');
}

// Reset Dashboard Filters
function resetFilters() {
  document.getElementById('filter-app-id').value = '';
  document.getElementById('filter-experience-type').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-event-type').value = '';
  
  state.filters = { appId: '', experienceType: '', eventType: '', startDate: '', endDate: '' };
  state.pagination.page = 1;
  
  loadDashboardData();
  showToast('Dashboard filters cleared.', 'info');
}

// Clear all data from the database
async function clearDatabasePrompt() {
  if (confirm('⚠️ WARNING: Are you sure you want to permanently delete all logged events from the database? This action cannot be undone.')) {
    try {
      const response = await fetch('/api/dashboard/clear', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to wipe data.');
      
      const result = await response.json();
      if (result.success) {
        showToast('Database wiped successfully.', 'success');
        
        // Reset filters in memory and UI to clean dropdown arrays
        document.getElementById('filter-app-id').value = '';
        document.getElementById('filter-experience-type').value = '';
        document.getElementById('filter-event-type').value = '';
        state.filters = { appId: '', experienceType: '', eventType: '', startDate: '', endDate: '' };
        state.pagination.page = 1;
        
        // Reload data to show empty statistics
        loadDashboardData();
      }
    } catch (err) {
      console.error('Reset database error:', err);
      showToast('Wipe operation failed.', 'error');
    }
  }
}

// Initializing ApexCharts
function initCharts() {
  const chartFont = {
    fontFamily: 'Outfit, sans-serif',
    colors: '#94a3b8'
  };

  // 1. Daily Trend Area Chart Options
  const trendOptions = {
    series: [
      { name: 'QR Scans', data: [] },
      { name: 'App Interactions', data: [] }
    ],
    chart: {
      type: 'area',
      height: '100%',
      width: '100%',
      toolbar: { show: false },
      background: 'transparent',
      foreColor: '#94a3b8',
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    colors: ['#06b6d4', '#6366f1'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    grid: { borderColor: 'rgba(255, 255, 255, 0.06)' },
    xaxis: {
      type: 'datetime',
      labels: { style: chartFont },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: chartFont },
      title: { text: 'Interactions Count', style: chartFont }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#f8fafc' },
      markers: { radius: 12 }
    },
    tooltip: { theme: 'dark' }
  };
  state.charts.trend = new ApexCharts(document.getElementById('trend-chart'), trendOptions);
  state.charts.trend.render();

  // 2. Experience Donut Chart Options
  const expOptions = {
    series: [],
    labels: [],
    chart: {
      type: 'donut',
      height: '100%',
      background: 'transparent',
      foreColor: '#94a3b8'
    },
    colors: ['#6366f1', '#a855f7', '#06b6d4', '#ec4899', '#10b981'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', fontFamily: 'Outfit', color: '#94a3b8' },
            value: { show: true, fontSize: '20px', fontFamily: 'Outfit', fontWeight: 600, color: '#f8fafc' },
            total: {
              show: true,
              label: 'Total',
              color: '#94a3b8',
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString();
              }
            }
          }
        }
      }
    },
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      labels: { colors: '#f8fafc' },
      markers: { radius: 12 }
    },
    tooltip: { theme: 'dark' }
  };
  state.charts.experience = new ApexCharts(document.getElementById('experience-chart'), expOptions);
  state.charts.experience.render();

  // 3. Event Types Bar Chart Options (Horizontal)
  const evtOptions = {
    series: [{ name: 'Log Count', data: [] }],
    chart: {
      type: 'bar',
      height: '100%',
      background: 'transparent',
      foreColor: '#94a3b8',
      toolbar: { show: false }
    },
    colors: ['#a855f7'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '60%'
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        gradientToColors: ['#ec4899'],
        stops: [0, 100]
      }
    },
    dataLabels: { enabled: false },
    grid: { borderColor: 'rgba(255, 255, 255, 0.06)' },
    xaxis: {
      labels: { style: chartFont },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: chartFont }
    },
    tooltip: { theme: 'dark' }
  };
  state.charts.eventType = new ApexCharts(document.getElementById('event-type-chart'), evtOptions);
  state.charts.eventType.render();
}

// Update ApexCharts series and categories
function updateCharts(stats) {
  // 1. Trend chart update
  const dates = stats.trend.map(t => t.date);
  const scansData = stats.trend.map(t => ({ x: t.date, y: t.qrScans }));
  const appData = stats.trend.map(t => ({ x: t.date, y: t.appEvents }));

  state.charts.trend.updateSeries([
    { name: 'QR Scans', data: scansData },
    { name: 'App Interactions', data: appData }
  ]);

  // 2. Experience share update
  const expKeys = Object.keys(stats.distributions.experienceTypes);
  const expValues = Object.values(stats.distributions.experienceTypes);
  
  state.charts.experience.updateOptions({
    labels: expKeys.length > 0 ? expKeys : ['No data'],
    series: expValues.length > 0 ? expValues : [0]
  });

  // 3. Event types frequency update
  const evtKeys = Object.keys(stats.distributions.eventTypes);
  const evtValues = Object.values(stats.distributions.eventTypes);

  // Combine into sorting array to sort highest to lowest
  const combined = evtKeys.map((key, index) => ({
    key: key,
    val: evtValues[index]
  })).sort((a, b) => b.val - a.val);

  state.charts.eventType.updateOptions({
    xaxis: {
      categories: combined.map(c => formatEventLabel(c.key))
    }
  });
  state.charts.eventType.updateSeries([{
    name: 'Log Count',
    data: combined.map(c => c.val)
  }]);
}


// SIMULATOR FUNCTIONALITY

// Generate Trackable QR Code
function generateQRCode(event) {
  event.preventDefault();

  const appId = document.getElementById('qr-app-id').value.trim();
  const expType = document.getElementById('qr-exp-type').value.trim();
  const redirect = document.getElementById('qr-redirect').value.trim();

  // Construct URL matching our server routes
  const host = window.location.origin;
  const trackingUrl = `${host}/qr?appId=${encodeURIComponent(appId)}&expType=${encodeURIComponent(expType)}&redirect=${encodeURIComponent(redirect)}&source=qr_code`;

  // Render QR Code using qrcode.js
  const qrContainer = document.getElementById('qrcode-render');
  qrContainer.innerHTML = ''; // Clear previous

  try {
    new QRCode(qrContainer, {
      text: trackingUrl,
      width: 120,
      height: 120,
      colorDark: '#070c19',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    document.getElementById('qr-tracking-url').value = trackingUrl;
    document.getElementById('qr-visit-btn').href = trackingUrl;
    document.getElementById('qr-output-section').style.display = 'flex';

    showToast('Redirect QR code generated successfully!', 'success');
  } catch (err) {
    console.error('QR Generator Error:', err);
    showToast('Failed to render QR Code graphic.', 'error');
  }
}

// Copy URL link to clipboard
function copyQRTrackingUrl() {
  const urlInput = document.getElementById('qr-tracking-url');
  urlInput.select();
  urlInput.setSelectionRange(0, 99999); // Mobile compatibility

  navigator.clipboard.writeText(urlInput.value)
    .then(() => {
      showToast('Tracking URL copied to clipboard!', 'success');
    })
    .catch(() => {
      showToast('Failed to copy. Copy input manually.', 'error');
    });
}

// Apply Event Presets inside simulator panel
function applyPreset(type) {
  const appIdInput = document.getElementById('sim-app-id');
  const expTypeInput = document.getElementById('sim-exp-type');
  const evtTypeInput = document.getElementById('sim-event-type');
  const payloadInput = document.getElementById('sim-event-data');

  switch (type) {
    case 'start':
      appIdInput.value = 'retail-store-kiosk';
      expTypeInput.value = 'coupon_deals';
      evtTypeInput.value = 'app_start';
      payloadInput.value = JSON.stringify({
        deviceType: "tablet",
        os: "Android",
        browser: "Chrome WebView",
        kioskModeActive: true
      }, null, 2);
      break;
    case 'survey':
      appIdInput.value = 'product-feedback';
      expTypeInput.value = 'feedback_form';
      evtTypeInput.value = 'question_response';
      payloadInput.value = JSON.stringify({
        questionId: "q5",
        question: "How satisfied are you with check-out speed?",
        responseScore: 9,
        comments: "Very fast and seamless payment process!"
      }, null, 2);
      break;
    case 'ar_interact':
      appIdInput.value = 'museum-expo-guide';
      expTypeInput.value = 'ar_exhibit';
      evtTypeInput.value = 'ar_trigger';
      payloadInput.value = JSON.stringify({
        triggerId: "mona_lisa_painting",
        userDistanceMeters: 1.5,
        infoNodeOpened: "historical_timeline",
        cameraAccessGranted: true
      }, null, 2);
      break;
    case 'exit':
      appIdInput.value = 'museum-expo-guide';
      expTypeInput.value = 'ar_exhibit';
      evtTypeInput.value = 'app_exit';
      payloadInput.value = JSON.stringify({
        durationSeconds: 245,
        userScansCompleted: 4,
        batteryDrainPct: 3
      }, null, 2);
      break;
  }
}

// Submit simulated app events to server
async function fireSimulatedEvent(event) {
  event.preventDefault();

  const appId = document.getElementById('sim-app-id').value.trim();
  const experienceType = document.getElementById('sim-exp-type').value.trim();
  const eventType = document.getElementById('sim-event-type').value.trim();
  const payloadString = document.getElementById('sim-event-data').value.trim();

  // Validate payload JSON format
  let eventData = {};
  try {
    eventData = JSON.parse(payloadString);
  } catch (err) {
    showToast('Invalid JSON payload schema. Fix formatting syntax.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId,
        experienceType,
        eventType,
        eventData
      })
    });

    if (!response.ok) {
      const errRes = await response.json();
      throw new Error(errRes.error || 'Server error recording event');
    }

    showToast('Simulated event dispatched successfully!', 'success');
  } catch (err) {
    console.error('Simulator Submit error:', err);
    showToast(`Simulation Failed: ${err.message}`, 'error');
  }
}

// Helper: Toast Manager
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (type === 'error') {
    icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else {
    icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // Set automatic self destruct after 4 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Helper: escape input text to prevent XSS issues
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

// Helper: prettify snake_case labels for chart axes
function formatEventLabel(str) {
  if (!str) return '';
  return str.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
}
