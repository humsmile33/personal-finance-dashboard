/**
 * Shinhan SOL Personal Wealth & Macro Cash Flow Dashboard Engine
 * Production-ready, dynamically scalable for 2023-2026+
 */

(function () {
  'use strict';

  // --- Category Color Palette (Unified across all charts & drilldowns) ---
  const CATEGORY_COLORS = {
    '식비': '#0046FF',              // Shinhan Blue
    '외식비': '#FF5A5F',            // Coral Red
    '구매비': '#7C3AED',            // Purple
    '교통비': '#06B6D4',            // Cyan
    '문화여가비': '#F59E0B',        // Amber
    '의료/건강': '#16A55C',         // Emerald Green
    '교육/학습/보육': '#E11D48',     // Crimson Red (Requested)
    '가족행사비': '#EC4899',        // Pink
    '고정비_주거_통신_보험': '#475569', // Dark Slate
    '고정보험(생명.연금.실비)': '#0284C7', // Sky Blue
    '기타지출': '#8B5CF6',          // Violet
    '대인관계': '#D97706',          // Warm Amber
    '월경조사비': '#A855F7',         // Lavender
    '미분류': '#94A3B8'             // Gray
  };

  function getCategoryColor(cat) {
    return CATEGORY_COLORS[cat] || '#3B82F6';
  }

  // Subcategory Distinct Color Palette
  const SUBCAT_PALETTE = [
    '#0046FF', '#FF5A5F', '#16A55C', '#F59E0B', 
    '#7C3AED', '#06B6D4', '#EC4899', '#64748B', 
    '#E11D48', '#10B981', '#3B82F6', '#8B5CF6',
    '#14B8A6', '#F97316', '#6366F1'
  ];

  // Custom Chart.js Plugin: Draws 0% Dashed Baseline & YoY Data Value Labels (Annotation 2)
  const yoyLinePlugin = {
    id: 'yoyLinePlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!scales || !scales.yRate || !chartArea) return;
      const { left, right, top, bottom } = chartArea;
      const yRate = scales.yRate;

      // 1. Draw 0% dashed baseline across the entire chart area
      const zeroY = yRate.getPixelForValue(0);
      if (zeroY >= top && zeroY <= bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#94A3B8'; // clearly visible thin dashed line
        ctx.moveTo(left, zeroY);
        ctx.lineTo(right, zeroY);
        ctx.stroke();

        // 0% Baseline Tag
        ctx.setLineDash([]);
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('0% 기준선', right - 6, zeroY - 3);
        ctx.restore();
      }

      // 2. Draw Data Value Badges on every point of the YoY growth rate line
      const lineDatasetIndex = chart.data.datasets.findIndex(d => d.type === 'line' || d.yAxisID === 'yRate');
      if (lineDatasetIndex >= 0) {
        const meta = chart.getDatasetMeta(lineDatasetIndex);
        const dataset = chart.data.datasets[lineDatasetIndex];
        ctx.save();
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.textAlign = 'center';

        meta.data.forEach((element, index) => {
          const val = dataset.data[index];
          if (val !== null && val !== undefined && !isNaN(val)) {
            const { x, y } = element;
            const sign = val > 0 ? '+' : '';
            const text = `${sign}${val.toFixed(1)}%`;
            const textWidth = ctx.measureText(text).width;
            const badgeW = textWidth + 10;
            const badgeH = 18;
            const badgeX = x - badgeW / 2;
            const badgeY = val >= 0 ? Math.max(top + 4, y - 24) : Math.min(bottom - badgeH - 4, y + 8);

            // Rounded badge background (Blue for +, Coral for -)
            ctx.fillStyle = val >= 0 ? 'rgba(0, 70, 255, 0.95)' : 'rgba(255, 90, 95, 0.95)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
            } else {
              ctx.rect(badgeX, badgeY, badgeW, badgeH);
            }
            ctx.fill();

            // Text
            ctx.fillStyle = '#FFFFFF';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, badgeY + badgeH / 2);
          }
        });
        ctx.restore();
      }

      // 3. Draw Column Total Value on top of each vertical bar (Annotation 1)
      const barDatasets = chart.data.datasets.filter(d => (d.type === 'bar' || !d.type) && d.yAxisID !== 'yRate');
      if (barDatasets.length > 0 && scales.x && scales.y) {
        const numCols = chart.data.labels ? chart.data.labels.length : 0;
        ctx.save();
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#0F172A';

        for (let i = 0; i < numCols; i++) {
          let colSum = 0;
          barDatasets.forEach(d => {
            const v = d.data[i];
            if (v !== null && v !== undefined && !isNaN(v)) {
              colSum += v;
            }
          });

          if (colSum > 0) {
            const barX = scales.x.getPixelForTick(i);
            const barY = scales.y.getPixelForValue(colSum);
            const text = Math.round(colSum).toLocaleString('ko-KR');

            // Draw crisp white halo around text to ensure readability above any bar or gridline
            const labelY = Math.max(top + 14, barY - 4);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.strokeText(text, barX, labelY);
            ctx.fillText(text, barX, labelY);
          }
        }
        ctx.restore();
      }
    }
  };

  // Custom Chart.js Plugin: Draws Data Value at the end of each horizontal bar (Annotation 2)
  const horizontalBarDataLabelsPlugin = {
    id: 'horizontalBarDataLabelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!scales || !scales.x || !scales.y || !chartArea) return;
      const { left, right } = chartArea;

      const meta = chart.getDatasetMeta(0);
      const dataset = chart.data.datasets[0];
      if (!dataset || !dataset.data) return;

      ctx.save();
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textBaseline = 'middle';

      dataset.data.forEach((val, idx) => {
        if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
          const text = Math.round(val).toLocaleString('ko-KR');
          const textWidth = ctx.measureText(text).width;
          const barEl = meta && meta.data ? meta.data[idx] : null;
          const barX = barEl ? barEl.x : scales.x.getPixelForValue(val);
          const barY = barEl ? barEl.y : scales.y.getPixelForTick(idx);

          let labelX = barX + 6;
          let textColor = '#0F172A';
          let useHalo = true;

          // If text extends beyond chart right margin, draw inside bar with white text
          if (labelX + textWidth > right - 4) {
            labelX = Math.max(left + 6, barX - textWidth - 6);
            textColor = '#FFFFFF';
            useHalo = false;
          }

          ctx.textAlign = 'left';
          ctx.fillStyle = textColor;
          if (useHalo) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.strokeText(text, labelX, barY);
          }
          ctx.fillText(text, labelX, barY);
        }
      });
      ctx.restore();
    }
  };

  // --- Global Application State ---
  const state = {
    selectedYears: ['ALL'], // 'ALL' or array of year strings e.g. ['2025', '2026']
    selectedPeriod: 'ALL',  // 'ALL', 'Q1'..'Q4', '01'..'12'
    timeView: 'YEARLY',     // 'YEARLY' (연도별 총합) or 'QUARTERLY' (분기별 추산)
    quarterTargetYear: '2026', // Active year for quarterly breakdown
    metricMode: 'TOTAL',    // 'TOTAL' (기간 총계 - default) or 'AVG' (월평균 정규화)
    familyEntity: 'ALL',    // 'ALL', 'Shared', 'Yeongheum', 'Hyeonjeong', 'Chowon'
    excludeReimbursement: true,  // [✓] 실질수입 기준 (환급금 분리)
    excludeReconciliation: true, // [✓] 자산조정 분리 (자산추가, 차액 제외)
    activeTab: 'home',
    homeChartMode: 'timeline',   // 'timeline' or 'annual'
    cfMatrixView: 'years',       // 'years' or 'months'
    cfMatrixSearch: '',
    drilldownCategory: null,     // null = view all major categories, string = specific category
    yoyCategory: null,           // null = view all major categories, string = specific category
    explorer: {
      search: '',
      type: 'ALL',
      category: 'ALL',
      payment: 'ALL',
      sortField: 'date',
      sortAsc: false,
      page: 1,
      pageSize: 25
    }
  };

  // Chart instances registry for proper destruction/re-rendering
  const charts = {};

  // Color Constants (Shinhan SOL Palette)
  const COLORS = {
    primary: '#0046FF',
    primarySubtle: 'rgba(0, 70, 255, 0.12)',
    navy: '#001A66',
    coral: '#FF5A5F',
    coralSubtle: 'rgba(255, 90, 95, 0.12)',
    emerald: '#16A55C',
    emeraldSubtle: 'rgba(22, 165, 92, 0.12)',
    amber: '#F59E0B',
    purple: '#7C3AED',
    cyan: '#06B6D4',
    slate: '#64748B',
    border: '#E5E8EE'
  };

  // Formatters
  function formatKRW(val) {
    if (val === undefined || val === null || isNaN(val)) return '₩0';
    const abs = Math.abs(Math.round(val));
    const sign = val < 0 ? '-' : '';
    return `${sign}₩${abs.toLocaleString('ko-KR')}`;
  }

  function formatCompactKRW(val) {
    if (val === undefined || val === null || isNaN(val)) return '0원';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 100000000) {
      const eok = abs / 100000000;
      return `${sign}${eok.toFixed(eok >= 10 ? 1 : 2)}억 원`;
    }
    if (abs >= 10000) {
      const man = abs / 10000;
      return `${sign}${Math.round(man).toLocaleString('ko-KR')}만 원`;
    }
    return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
  }

  function formatPercent(val) {
    if (val === undefined || val === null || isNaN(val)) return '0.0%';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  }

  // --- Dynamic Initialization ---
  function init() {
    try {
      const cached = localStorage.getItem('SOL_FINANCE_DATA_OVERRIDE');
      if (cached) {
        window.FINANCE_DATA = JSON.parse(cached);
        console.log('Loaded user synchronized finance data from LocalStorage:', window.FINANCE_DATA.transactions.length);
      }
    } catch (e) {
      console.warn('Could not read cached override:', e);
    }

    if (!window.FINANCE_DATA) {
      console.error('FINANCE_DATA not found. Trying to fetch finance_data.json...');
      fetch('finance_data.json')
        .then(r => r.json())
        .then(data => {
          window.FINANCE_DATA = data;
          bootstrap();
        })
        .catch(err => {
          alert('데이터 로드 실패: ' + err.message);
        });
      return;
    }
    bootstrap();
  }

  function bootstrap() {
    const data = window.FINANCE_DATA;
    renderYearFilterButtons(data.metadata.availableYears);
    populateExplorerCategoryFilter();
    setupEventListeners();
    updateDashboard();
  }

  // Render Year Buttons dynamically for 2023-2026 and future 2027+
  function renderYearFilterButtons(years) {
    const container = document.getElementById('yearFilterGroup');
    if (!container) return;
    
    let html = `<button class="filter-chip ${state.selectedYears.includes('ALL') ? 'active' : ''}" data-year="ALL">전체 (${years[0]}~${years[years.length - 1]}+)</button>`;
    years.forEach(y => {
      const isActive = !state.selectedYears.includes('ALL') && state.selectedYears.includes(y);
      html += `<button class="filter-chip ${isActive ? 'active' : ''}" data-year="${y}">${y}년</button>`;
    });
    container.innerHTML = html;

    // Attach click events to year chips
    container.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const y = btn.getAttribute('data-year');
        if (y === 'ALL') {
          state.selectedYears = ['ALL'];
          state.quarterTargetYear = '2026';
        } else {
          if (state.selectedYears.includes('ALL')) {
            state.selectedYears = [y];
            state.quarterTargetYear = y;
          } else {
            // Toggle
            if (state.selectedYears.includes(y)) {
              state.selectedYears = state.selectedYears.filter(x => x !== y);
              if (state.selectedYears.length === 0) {
                state.selectedYears = ['ALL'];
                state.quarterTargetYear = '2026';
              } else {
                state.quarterTargetYear = state.selectedYears[state.selectedYears.length - 1];
              }
            } else {
              state.selectedYears.push(y);
              state.quarterTargetYear = y;
            }
          }
        }
        renderYearFilterButtons(years);
        updateDashboard();
      });
    });
  }

  // Populate Explorer Category Filter Dropdown
  function populateExplorerCategoryFilter() {
    const select = document.getElementById('explorerCategoryFilter');
    if (!select) return;

    const txs = window.FINANCE_DATA.transactions;
    const catCounts = {};
    txs.forEach(t => {
      if (t.type === '지출' && t.category) {
        catCounts[t.category] = (catCounts[t.category] || 0) + 1;
      }
    });

    const sortedCats = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a]);

    let html = `<option value="ALL">대분류: 전체</option>`;
    sortedCats.forEach(cat => {
      html += `<option value="${cat}">${cat} (${catCounts[cat]}건)</option>`;
    });
    select.innerHTML = html;
  }

  // Setup Event Listeners for Filters & Navigation
  function setupEventListeners() {
    // 5 Tab Navigation
    document.querySelectorAll('.sol-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Jump buttons in Hero Panel
    document.querySelectorAll('[data-jump-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-jump-tab');
        switchTab(tab);
      });
    });

    // Period / Time View Filter (연도별 vs 분기별) - Annotation 3
    function setTimeView(mode) {
      state.timeView = mode;
      document.querySelectorAll('#timeViewFilter .seg-btn, #yoyTimeViewTabs .seg-btn').forEach(b => {
        if (b.getAttribute('data-time-view') === mode) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      updateDashboard();
    }

    document.querySelectorAll('#timeViewFilter .seg-btn, #yoyTimeViewTabs .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-time-view');
        setTimeView(mode);
      });
    });

    // Metric Mode Toggle (기간 총계 / 월평균)
    document.querySelectorAll('#metricModeFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#metricModeFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.metricMode = btn.getAttribute('data-mode');
        updateDashboard();
      });
    });

    // Family Member Filter
    document.querySelectorAll('#entityFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#entityFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.familyEntity = btn.getAttribute('data-entity');
        updateDashboard();
      });
    });

    // Sanitization Checkboxes
    const chkReimb = document.getElementById('chkExcludeReimbursement');
    if (chkReimb) {
      chkReimb.checked = state.excludeReimbursement;
      chkReimb.addEventListener('change', () => {
        state.excludeReimbursement = chkReimb.checked;
        updateDashboard();
      });
    }

    const chkRecon = document.getElementById('chkExcludeReconciliation');
    if (chkRecon) {
      chkRecon.checked = state.excludeReconciliation;
      chkRecon.addEventListener('change', () => {
        state.excludeReconciliation = chkRecon.checked;
        updateDashboard();
      });
    }

    // Home Combo Chart Mode Toggle (Timeline / Annual)
    document.querySelectorAll('#homeChartModeFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#homeChartModeFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.homeChartMode = btn.getAttribute('data-chart-mode');
        renderHomeComboChart();
      });
    });

    // Cashflow Matrix View Toggle (Years / Months)
    document.querySelectorAll('#cfMatrixViewFilter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#cfMatrixViewFilter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.cfMatrixView = btn.getAttribute('data-matrix-view');
        renderCashflowMatrixTable();
      });
    });

    // Cashflow Matrix Search Input
    const matrixSearch = document.getElementById('cfMatrixSearch');
    if (matrixSearch) {
      matrixSearch.addEventListener('input', e => {
        state.cfMatrixSearch = e.target.value.trim().toLowerCase();
        renderCashflowMatrixTable();
      });
    }

    // Tab 4: Reset YoY Category Drilldown Button
    const btnResetYoY = document.getElementById('btnResetYoYCategory');
    if (btnResetYoY) {
      btnResetYoY.addEventListener('click', () => {
        state.yoyCategory = null;
        if (state.timeView === 'QUARTERLY') {
          renderQuarterlyMacroShiftChart();
          renderQuarterlyDetailComboChart();
        } else {
          renderYoYMacroShiftChart();
          renderYoYDetailComboChart();
        }
      });
    }

    // Tab 5: Reset Category Drilldown Button (Annotation 3)
    const btnResetDrill = document.getElementById('btnResetDrilldown');
    if (btnResetDrill) {
      btnResetDrill.addEventListener('click', () => {
        state.drilldownCategory = null;
        state.explorer.category = 'ALL';
        state.explorer.page = 1;
        const catSelect = document.getElementById('explorerCategoryFilter');
        if (catSelect) catSelect.value = 'ALL';
        renderCategoryDrilldown();
        renderExplorerTable();
      });
    }

    // Tab 5: Remove Explorer Active Category Pill (Annotation 1)
    const btnRemoveExpCat = document.getElementById('btnRemoveExplorerCategory');
    if (btnRemoveExpCat) {
      btnRemoveExpCat.addEventListener('click', () => {
        state.drilldownCategory = null;
        state.explorer.category = 'ALL';
        state.explorer.page = 1;
        const catSelect = document.getElementById('explorerCategoryFilter');
        if (catSelect) catSelect.value = 'ALL';
        renderCategoryDrilldown();
        renderExplorerTable();
      });
    }

    // Explorer Category Filter Select Dropdown
    const expCat = document.getElementById('explorerCategoryFilter');
    if (expCat) {
      expCat.addEventListener('change', e => {
        state.explorer.category = e.target.value;
        state.drilldownCategory = (e.target.value === 'ALL' ? null : e.target.value);
        state.explorer.page = 1;
        renderCategoryDrilldown();
        renderExplorerTable();
      });
    }

    // Explorer Search and Filters
    const expSearch = document.getElementById('explorerSearch');
    if (expSearch) {
      expSearch.addEventListener('input', e => {
        state.explorer.search = e.target.value.trim().toLowerCase();
        state.explorer.page = 1;
        renderExplorerTable();
      });
    }

    const expType = document.getElementById('explorerTypeFilter');
    if (expType) {
      expType.addEventListener('change', e => {
        state.explorer.type = e.target.value;
        state.explorer.page = 1;
        renderExplorerTable();
      });
    }

    const expPayment = document.getElementById('explorerPaymentFilter');
    if (expPayment) {
      expPayment.addEventListener('change', e => {
        state.explorer.payment = e.target.value;
        state.explorer.page = 1;
        renderExplorerTable();
      });
    }

    // Explorer Pagination
    const btnPrev = document.getElementById('btnPrevPage');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (state.explorer.page > 1) {
          state.explorer.page--;
          renderExplorerTable();
        }
      });
    }

    const btnNext = document.getElementById('btnNextPage');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        state.explorer.page++;
        renderExplorerTable();
      });
    }

    // Setup Dataset Upload & Sync Modal
    setupUploadModalListeners();
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.sol-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
    // Trigger render for the active tab
    renderActiveTab();
  }

  // --- Filtering & Core Metrics Calculation ---
  function getFilteredTransactions() {
    const all = window.FINANCE_DATA.transactions;
    return all.filter(t => {
      // 1. Year filter
      if (!state.selectedYears.includes('ALL')) {
        if (!state.selectedYears.includes(t.year)) return false;
      }

      // 2. Period filter
      if (state.selectedPeriod !== 'ALL') {
        if (state.selectedPeriod.startsWith('Q')) {
          if (t.quarter !== state.selectedPeriod) return false;
        } else {
          // Month '01'..'12'
          const mStr = String(t.month).padStart(2, '0');
          if (mStr !== state.selectedPeriod) return false;
        }
      }

      // 3. Family Entity filter
      if (state.familyEntity !== 'ALL') {
        if (t.entity !== state.familyEntity) return false;
      }

      // 4. Reconciliation filter
      if (state.excludeReconciliation && t.isReconciliation) {
        return false;
      }

      return true;
    });
  }

  // Calculate active divisor months for fair normalization
  function getActiveMonthDivisor() {
    const activeMap = window.FINANCE_DATA.metadata.activeMonths;
    const availYears = window.FINANCE_DATA.metadata.availableYears;
    const targetYears = state.selectedYears.includes('ALL') ? availYears : state.selectedYears;

    if (state.selectedPeriod === 'ALL') {
      let totalMonths = 0;
      targetYears.forEach(y => {
        totalMonths += (activeMap[y] || 12);
      });
      return totalMonths || 1;
    } else if (state.selectedPeriod.startsWith('Q')) {
      return targetYears.length * 3;
    } else {
      return targetYears.length * 1;
    }
  }

  function calculateMacroMetrics(txs) {
    let rawIncome = 0;
    let realIncome = 0;
    let reimbursement = 0;
    let rawExpense = 0;
    let pureInvestment = 0;
    let cashback = 0;
    let dividendInterest = 0;

    txs.forEach(t => {
      if (t.type === '수입') {
        rawIncome += t.amount;
        if (t.isReimbursement) {
          reimbursement += t.amount;
        } else {
          realIncome += t.amount;
        }
        if (t.category === '기타수입_카드사 은행 캐시백') cashback += t.amount;
        if (t.category === '금융수입_이사소득_배당') dividendInterest += t.amount;
      } else if (t.type === '지출') {
        // Net living consumption is -sum(amount)
        rawExpense += t.amount;
      } else if (t.type === '이체') {
        if (t.isPureInvestment) {
          pureInvestment += Math.abs(t.amount);
        }
      }
    });

    const incomeToUse = state.excludeReimbursement ? realIncome : rawIncome;
    const netLivingExpense = -rawExpense; // negative values become positive spending
    const netFreeCashFlow = incomeToUse - netLivingExpense;
    const savingsCapacityRate = incomeToUse > 0 ? (netFreeCashFlow / incomeToUse) * 100 : 0;
    const investmentRate = incomeToUse > 0 ? (pureInvestment / incomeToUse) * 100 : 0;
    const financialYieldTotal = cashback + dividendInterest;

    const divisor = getActiveMonthDivisor();

    return {
      rawIncome,
      realIncome,
      reimbursement,
      incomeToUse,
      netLivingExpense,
      netFreeCashFlow,
      pureInvestment,
      savingsCapacityRate,
      investmentRate,
      cashback,
      dividendInterest,
      financialYieldTotal,
      divisor,
      // Monthly averages
      avgIncome: incomeToUse / divisor,
      avgExpense: netLivingExpense / divisor,
      avgInvestment: pureInvestment / divisor,
      avgNetCashFlow: netFreeCashFlow / divisor
    };
  }

  // --- Update Dashboard ---
  function updateDashboard() {
    renderActiveTab();
  }

  function renderActiveTab() {
    switch (state.activeTab) {
      case 'home':
        renderTabHome();
        break;
      case 'cashflow':
        renderTabCashflow();
        break;
      case 'invest':
        renderTabInvest();
        break;
      case 'yoy':
        renderTabYoY();
        break;
      case 'explorer':
        renderTabExplorer();
        break;
    }
  }

  // ==========================================================================
  // TAB 1: [● 홈 | 종합 재무현황]
  // ==========================================================================
  function renderTabHome() {
    const txs = getFilteredTransactions();
    const metrics = calculateMacroMetrics(txs);

    // 1. Update Hero Banner
    const heroBalance = document.getElementById('heroBalance');
    if (heroBalance) {
      const valToDisplay = state.metricMode === 'AVG' ? metrics.avgNetCashFlow : metrics.netFreeCashFlow;
      heroBalance.textContent = formatKRW(valToDisplay);
    }
    const heroSavingsBadge = document.getElementById('heroSavingsBadge');
    if (heroSavingsBadge) {
      heroSavingsBadge.textContent = `저축·투자 잉여율 ${metrics.savingsCapacityRate.toFixed(1)}%`;
    }

    // 2. Update Top 5 Executive KPI Cards
    const kpi1Val = document.getElementById('kpiRealIncomeVal');
    const kpi1Sub = document.getElementById('kpiRealIncomeSub');
    if (kpi1Val && kpi1Sub) {
      kpi1Val.textContent = state.metricMode === 'AVG' ? formatKRW(metrics.avgIncome) : formatKRW(metrics.incomeToUse);
      kpi1Sub.textContent = state.metricMode === 'AVG' ? `총 ${formatCompactKRW(metrics.incomeToUse)}` : `월평균 ${formatCompactKRW(metrics.avgIncome)}`;
    }

    const kpi2Val = document.getElementById('kpiExpenseVal');
    const kpi2Sub = document.getElementById('kpiExpenseSub');
    if (kpi2Val && kpi2Sub) {
      kpi2Val.textContent = state.metricMode === 'AVG' ? formatKRW(metrics.avgExpense) : formatKRW(metrics.netLivingExpense);
      const ratio = metrics.incomeToUse > 0 ? (metrics.netLivingExpense / metrics.incomeToUse) * 100 : 0;
      kpi2Sub.textContent = `소득 대비 지출 ${ratio.toFixed(1)}%`;
    }

    const kpi3Val = document.getElementById('kpiInvestVal');
    const kpi3Sub = document.getElementById('kpiInvestSub');
    if (kpi3Val && kpi3Sub) {
      kpi3Val.textContent = state.metricMode === 'AVG' ? formatKRW(metrics.avgInvestment) : formatKRW(metrics.pureInvestment);
      kpi3Sub.textContent = `소득 대비 투자율 ${metrics.investmentRate.toFixed(1)}%`;
    }

    const kpi4Val = document.getElementById('kpiCashFlowVal');
    const kpi4Sub = document.getElementById('kpiCashFlowSub');
    if (kpi4Val && kpi4Sub) {
      kpi4Val.textContent = state.metricMode === 'AVG' ? formatKRW(metrics.avgNetCashFlow) : formatKRW(metrics.netFreeCashFlow);
      kpi4Sub.textContent = `저축 여력률 ${metrics.savingsCapacityRate.toFixed(1)}%`;
    }

    const kpi5Val = document.getElementById('kpiYieldVal');
    const kpi5Sub = document.getElementById('kpiYieldSub');
    if (kpi5Val && kpi5Sub) {
      kpi5Val.textContent = formatKRW(metrics.financialYieldTotal);
      kpi5Sub.textContent = `캐시백 ${formatCompactKRW(metrics.cashback)} + 배당 ${formatCompactKRW(metrics.dividendInterest)}`;
    }

    // 3. Render Multi-Year Financial Trajectory Combo Chart
    renderHomeComboChart();

    // 4. Render Asset Snapshot Distribution
    renderHomeAssetSnapshot();
  }

  function renderHomeComboChart() {
    const ctx = document.getElementById('homeComboChart');
    if (!ctx) return;

    if (charts.homeCombo) charts.homeCombo.destroy();

    const txs = getFilteredTransactions();

    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let investData = [];
    let rateData = [];

    if (state.homeChartMode === 'annual') {
      // Annual Aggregate View
      const availYears = window.FINANCE_DATA.metadata.availableYears;
      const targetYears = state.selectedYears.includes('ALL') ? availYears : state.selectedYears;

      labels = targetYears.map(y => `${y}년`);
      targetYears.forEach(y => {
        const yTxs = txs.filter(t => t.year === y);
        const yMetrics = calculateMacroMetrics(yTxs);
        if (state.metricMode === 'AVG') {
          incomeData.push(yMetrics.avgIncome);
          expenseData.push(yMetrics.avgExpense);
          investData.push(yMetrics.avgInvestment);
        } else {
          incomeData.push(yMetrics.incomeToUse);
          expenseData.push(yMetrics.netLivingExpense);
          investData.push(yMetrics.pureInvestment);
        }
        rateData.push(yMetrics.savingsCapacityRate);
      });
    } else {
      // Chronological Timeline View (YYYY-MM)
      const monthsSet = new Set(txs.map(t => t.yearMonth).filter(Boolean));
      const sortedMonths = Array.from(monthsSet).sort();

      labels = sortedMonths;
      sortedMonths.forEach(ym => {
        const ymTxs = txs.filter(t => t.yearMonth === ym);
        let inc = 0;
        let exp = 0;
        let inv = 0;
        ymTxs.forEach(t => {
          if (t.type === '수입') {
            if (state.excludeReimbursement ? t.isRealIncome : true) inc += t.amount;
          } else if (t.type === '지출') {
            exp += t.amount;
          } else if (t.type === '이체' && t.isPureInvestment) {
            inv += Math.abs(t.amount);
          }
        });
        const netExp = -exp;
        const rate = inc > 0 ? ((inc - netExp) / inc) * 100 : 0;
        incomeData.push(inc);
        expenseData.push(netExp);
        investData.push(inv);
        rateData.push(rate);
      });
    }

    charts.homeCombo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '실질 수입 (Income)',
            data: incomeData,
            backgroundColor: COLORS.primary,
            borderRadius: 4,
            order: 2,
            yAxisID: 'y'
          },
          {
            label: '순소비 지출 (Expense)',
            data: expenseData,
            backgroundColor: COLORS.coral,
            borderRadius: 4,
            order: 3,
            yAxisID: 'y'
          },
          {
            label: '순투자 적립 (Investment)',
            data: investData,
            backgroundColor: COLORS.emerald,
            borderRadius: 4,
            order: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: '저축·투자율 (Savings Rate %)',
            data: rateData,
            borderColor: COLORS.navy,
            backgroundColor: COLORS.navy,
            borderWidth: 2.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            tension: 0.25,
            order: 1,
            yAxisID: 'yRate'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', weight: '700', size: 12 }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.yAxisID === 'yRate') {
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
                }
                return `${ctx.dataset.label}: ${formatKRW(ctx.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Pretendard', weight: '600', size: 11 } }
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: COLORS.border },
            ticks: {
              font: { family: 'Pretendard', weight: '600', size: 11 },
              callback: val => formatCompactKRW(val)
            }
          },
          yRate: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            min: -50,
            max: 100,
            ticks: {
              font: { family: 'Pretendard', weight: '700', size: 11 },
              callback: val => `${val}%`
            }
          }
        }
      }
    });
  }

  function renderHomeAssetSnapshot() {
    const container = document.getElementById('homeAssetSnapshotGrid');
    if (!container) return;

    // Use latest available year (2026) for balance sheet snapshot
    const summaries = window.FINANCE_DATA.annualSummaries;
    const latestYear = '2026';
    const bs = summaries[latestYear]?.balanceSheet || [];

    let realEstate = 0;
    let pension = 0;
    let insurance = 0;
    let liquid = 0;
    let totalAssets = 1410634901; // Latest audited total from Section 3

    bs.forEach(item => {
      const cat = item.category || '';
      const amt = item.amount || 0;
      if (cat.includes('부동산')) realEstate += amt;
      else if (cat.includes('연금')) pension += amt;
      else if (cat.includes('보험')) insurance += amt;
      else if (cat.includes('자유입출금') || cat.includes('저축성') || cat.includes('전자금융') || cat.includes('투자성') || cat.includes('현금')) {
        liquid += amt;
      }
    });

    const items = [
      { title: '부동산 (실물 자산)', val: realEstate, share: (realEstate / totalAssets) * 100, note: '시범한빛마을한화꿈에그린' },
      { title: '보험 자산 (원리금/해약환급)', val: insurance, share: (insurance / totalAssets) * 100, note: '알리안츠 종신 / 암보험' },
      { title: '연금 자산 (IRP & DC)', val: pension, share: (pension / totalAssets) * 100, note: '개인형 IRP / 현대DC' },
      { title: '금융·유동성 자산', val: liquid, share: (liquid / totalAssets) * 100, note: '예금 / ISA / 주식 / 예수금' }
    ];

    container.innerHTML = items.map(item => `
      <div class="asset-pill-card">
        <div class="asset-pill-card-title">${item.title}</div>
        <div class="asset-pill-card-val">${formatCompactKRW(item.val)}</div>
        <div class="asset-pill-card-share">비중 ${item.share.toFixed(1)}% · <span style="color:var(--text-tertiary);">${item.note}</span></div>
      </div>
    `).join('');
  }

  // ==========================================================================
  // TAB 2: [◇ 현금흐름 상세] (Section 2 Matrix & Waterfall)
  // ==========================================================================
  function renderTabCashflow() {
    renderCashflowWaterfallChart();
    renderIncomeStructureChart();
    renderCashflowMatrixTable();
  }

  function renderCashflowWaterfallChart() {
    const ctx = document.getElementById('cfWaterfallChart');
    if (!ctx) return;

    if (charts.cfWaterfall) charts.cfWaterfall.destroy();

    const txs = getFilteredTransactions();
    const monthsSet = new Set(txs.map(t => t.yearMonth).filter(Boolean));
    const sortedMonths = Array.from(monthsSet).sort();

    const surplusData = [];
    const deficitData = [];

    sortedMonths.forEach(ym => {
      const ymTxs = txs.filter(t => t.yearMonth === ym);
      let inc = 0;
      let exp = 0;
      ymTxs.forEach(t => {
        if (t.type === '수입') {
          if (state.excludeReimbursement ? t.isRealIncome : true) inc += t.amount;
        } else if (t.type === '지출') {
          exp += t.amount;
        }
      });
      const netExp = -exp;
      const netSurplus = inc - netExp;
      if (netSurplus >= 0) {
        surplusData.push(netSurplus);
        deficitData.push(0);
      } else {
        surplusData.push(0);
        deficitData.push(netSurplus);
      }
    });

    charts.cfWaterfall = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedMonths,
        datasets: [
          {
            label: '월간 흑자 (Surplus +)',
            data: surplusData,
            backgroundColor: COLORS.primary,
            borderRadius: 4
          },
          {
            label: '월간 적자 (Deficit -)',
            data: deficitData,
            backgroundColor: COLORS.coral,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', weight: '700' } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatKRW(ctx.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: COLORS.border },
            ticks: { callback: val => formatCompactKRW(val) }
          }
        }
      }
    });
  }

  function renderIncomeStructureChart() {
    const ctx = document.getElementById('incomeStructureChart');
    if (!ctx) return;

    if (charts.incomeStructure) charts.incomeStructure.destroy();

    const availYears = window.FINANCE_DATA.metadata.availableYears;
    const allTxs = window.FINANCE_DATA.transactions;

    const salaryData = [];
    const businessData = [];
    const yieldData = [];
    const reimbData = [];
    const otherData = [];

    availYears.forEach(y => {
      const yTxs = allTxs.filter(t => t.year === y && t.type === '수입');
      let sal = 0, biz = 0, yld = 0, rem = 0, oth = 0;
      yTxs.forEach(t => {
        const cat = t.category;
        if (cat.includes('급여') || cat.includes('상여') || cat.includes('퇴직')) {
          sal += t.amount;
        } else if (cat.includes('사업수입')) {
          biz += t.amount;
        } else if (cat.includes('배당') || cat.includes('캐시백')) {
          yld += t.amount;
        } else if (t.isReimbursement) {
          rem += t.amount;
        } else {
          oth += t.amount;
        }
      });
      salaryData.push(sal);
      businessData.push(biz);
      yieldData.push(yld);
      reimbData.push(rem);
      otherData.push(oth);
    });

    charts.incomeStructure = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: availYears.map(y => `${y}년`),
        datasets: [
          { label: '근로/상여소득', data: salaryData, backgroundColor: COLORS.primary },
          { label: '사업소득', data: businessData, backgroundColor: COLORS.purple },
          { label: '금융/캐시백수익', data: yieldData, backgroundColor: COLORS.emerald },
          { label: '보전 환급금', data: reimbData, backgroundColor: COLORS.amber },
          { label: '기타/용돈', data: otherData, backgroundColor: COLORS.slate }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', weight: '700' } } },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${formatKRW(ctx.raw)}` }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            grid: { color: COLORS.border },
            ticks: { callback: val => formatCompactKRW(val) }
          }
        }
      }
    });
  }

  function renderCashflowMatrixTable() {
    const tableHeader = document.getElementById('cfMatrixHeader');
    const tableBody = document.getElementById('cfMatrixBody');
    if (!tableHeader || !tableBody) return;

    const summaries = window.FINANCE_DATA.annualSummaries;
    const availYears = window.FINANCE_DATA.metadata.availableYears;

    // Collect all unique cash flow items across years
    const itemMap = new Map();

    availYears.forEach(y => {
      const cf = summaries[y]?.cashFlow || [];
      cf.forEach(row => {
        if (!itemMap.has(row.item)) {
          itemMap.set(row.item, {});
        }
        itemMap.get(row.item)[y] = row;
      });
    });

    let items = Array.from(itemMap.keys());
    if (state.cfMatrixSearch) {
      items = items.filter(it => it.toLowerCase().includes(state.cfMatrixSearch));
    }

    if (state.cfMatrixView === 'years') {
      // Columns: 항목 | 2023 총계(월평균) | 2024 총계(월평균) | 2025 총계(월평균) | 2026 총계(월평균) | 최근 YoY 증감
      tableHeader.innerHTML = `
        <tr>
          <th>항목명</th>
          ${availYears.map(y => `<th class="text-right">${y}년 (${state.metricMode === 'AVG' ? '월평균' : '총계'})</th>`).join('')}
          <th class="text-right">최근 YoY 변동</th>
        </tr>
      `;

      let rowsHtml = '';
      items.forEach(item => {
        const rowData = itemMap.get(item);
        const isHighlightInc = item === '월수입 총계';
        const isHighlightExp = item === '월지출 총계';
        const isHighlightNet = item === '순수입 총계';
        
        let rowClass = '';
        if (isHighlightInc) rowClass = 'row-highlight-income';
        else if (isHighlightExp) rowClass = 'row-highlight-expense';
        else if (isHighlightNet) rowClass = 'row-highlight-net';

        let cellsHtml = '';
        const vals = [];
        availYears.forEach(y => {
          const entry = rowData[y];
          if (!entry) {
            cellsHtml += `<td class="text-right" style="color:var(--text-tertiary);">-</td>`;
            vals.push(0);
          } else {
            const val = state.metricMode === 'AVG' ? entry.monthlyAvg : entry.total;
            vals.push(val);
            cellsHtml += `<td class="text-right ${isHighlightInc ? 'num-income' : isHighlightExp ? 'num-expense' : ''}">${formatKRW(val)}</td>`;
          }
        });

        // Compute YoY change between last two years (2025 vs 2026 normalized)
        const vPrev = vals[vals.length - 2] || 0;
        const vCurr = vals[vals.length - 1] || 0;
        const diff = vCurr - vPrev;
        const pct = vPrev !== 0 ? (diff / Math.abs(vPrev)) * 100 : 0;
        const deltaClass = diff >= 0 ? 'positive' : 'negative';

        cellsHtml += `
          <td class="text-right">
            <span class="kpi-delta ${deltaClass}">${diff >= 0 ? '+' : ''}${formatCompactKRW(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>
          </td>
        `;

        rowsHtml += `
          <tr class="${rowClass}">
            <td><strong>${item}</strong></td>
            ${cellsHtml}
          </tr>
        `;
      });
      tableBody.innerHTML = rowsHtml;
    } else {
      // Monthly view for latest year (2026 or selected year)
      const targetYear = state.selectedYears.includes('ALL') ? '2026' : state.selectedYears[0];
      const monthCols = ['01','02','03','04','05','06','07','08','09','10','11','12'];

      tableHeader.innerHTML = `
        <tr>
          <th>항목 (${targetYear}년)</th>
          <th class="text-right">총계</th>
          <th class="text-right">월평균</th>
          ${monthCols.map(m => `<th class="text-right">${m}월</th>`).join('')}
        </tr>
      `;

      let rowsHtml = '';
      items.forEach(item => {
        const rowData = itemMap.get(item);
        const entry = rowData[targetYear];
        if (!entry) return;

        const isHighlightInc = item === '월수입 총계';
        const isHighlightExp = item === '월지출 총계';
        const isHighlightNet = item === '순수입 총계';
        let rowClass = '';
        if (isHighlightInc) rowClass = 'row-highlight-income';
        else if (isHighlightExp) rowClass = 'row-highlight-expense';
        else if (isHighlightNet) rowClass = 'row-highlight-net';

        let monthsHtml = '';
        monthCols.forEach(m => {
          const ymKey = `${targetYear}-${m}`;
          const val = entry.months ? entry.months[ymKey] : 0;
          monthsHtml += `<td class="text-right ${val === 0 ? 'text-tertiary' : ''}">${val ? formatKRW(val) : '-'}</td>`;
        });

        rowsHtml += `
          <tr class="${rowClass}">
            <td><strong>${item}</strong></td>
            <td class="text-right font-bold">${formatKRW(entry.total)}</td>
            <td class="text-right font-bold">${formatKRW(entry.monthlyAvg)}</td>
            ${monthsHtml}
          </tr>
        `;
      });
      tableBody.innerHTML = rowsHtml;
    }
  }

  // ==========================================================================
  // TAB 3: [📈 투자·자산 변동] (Wealth Inflows & Balance Sheet)
  // ==========================================================================
  function renderTabInvest() {
    renderCumulativeInvestChart();
    renderAssetPortfolioChart();
    renderReconciliationTable();
  }

  function renderCumulativeInvestChart() {
    const ctx = document.getElementById('investCumulativeChart');
    if (!ctx) return;

    if (charts.investCumulative) charts.investCumulative.destroy();

    const txs = window.FINANCE_DATA.transactions;
    const investTxs = txs.filter(t => t.type === '이체' && t.isPureInvestment).sort((a,b) => a.date.localeCompare(b.date));

    const monthMap = new Map();
    investTxs.forEach(t => {
      const ym = t.yearMonth;
      monthMap.set(ym, (monthMap.get(ym) || 0) + Math.abs(t.amount));
    });

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const monthlyVals = [];
    const cumulativeVals = [];
    let runningTotal = 0;

    sortedMonths.forEach(ym => {
      const amt = monthMap.get(ym);
      runningTotal += amt;
      monthlyVals.push(amt);
      cumulativeVals.push(runningTotal);
    });

    charts.investCumulative = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedMonths,
        datasets: [
          {
            label: '월별 투자 집행액 (Monthly)',
            data: monthlyVals,
            backgroundColor: COLORS.emerald,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: '누적 투자 집행액 (Cumulative)',
            data: cumulativeVals,
            borderColor: COLORS.primary,
            backgroundColor: COLORS.primary,
            borderWidth: 2.5,
            pointRadius: 4,
            yAxisID: 'yCum'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', weight: '700' } } },
          tooltip: {
            callbacks: { label: ctx => `${ctx.dataset.label}: ${formatKRW(ctx.raw)}` }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: COLORS.border },
            ticks: { callback: val => formatCompactKRW(val) }
          },
          yCum: {
            position: 'right',
            grid: { display: false },
            ticks: { callback: val => formatCompactKRW(val) }
          }
        }
      }
    });
  }

  function renderAssetPortfolioChart() {
    const ctx = document.getElementById('assetPortfolioChart');
    if (!ctx) return;

    if (charts.assetPortfolio) charts.assetPortfolio.destroy();

    const summaries = window.FINANCE_DATA.annualSummaries;
    const bs2026 = summaries['2026']?.balanceSheet || [];

    const catSums = {};
    bs2026.forEach(it => {
      const cat = it.category || '기타';
      if (['총자산', '순자산', '부채'].includes(cat)) return;
      catSums[cat] = (catSums[cat] || 0) + (it.amount || 0);
    });

    const labels = Object.keys(catSums);
    const dataVals = labels.map(k => catSums[k]);

    charts.assetPortfolio = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataVals,
            backgroundColor: [
              COLORS.primary,
              COLORS.purple,
              COLORS.emerald,
              COLORS.amber,
              COLORS.coral,
              COLORS.cyan,
              COLORS.slate
            ],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { family: 'Pretendard', weight: '600', size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.label}: ${formatCompactKRW(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderReconciliationTable() {
    const tableBody = document.getElementById('reconTableBody');
    if (!tableBody) return;

    const txs = window.FINANCE_DATA.transactions;
    const recons = txs.filter(t => t.isReconciliation).sort((a,b) => b.date.localeCompare(a.date));

    if (recons.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px;">자산조정 내역이 없습니다.</td></tr>`;
      return;
    }

    tableBody.innerHTML = recons.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><span class="sol-badge sol-badge-navy">${r.year}년</span></td>
        <td><strong>${r.merchant}</strong></td>
        <td>${r.payment || '-'}</td>
        <td class="text-right font-bold ${r.amount >= 0 ? 'num-income' : 'num-expense'}">${formatKRW(r.amount)}</td>
        <td>${r.memo || '-'}</td>
        <td><span class="sol-badge sol-badge-primary">회계보정</span></td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // TAB 4: [📊 연도별 재무비교 & 대분류 드릴다운 복합차트] (Annotation 4)
  // ==========================================================================
  function renderTabYoY() {
    renderYoYTimeViewControls();
    if (state.timeView === 'QUARTERLY') {
      renderQuarterlyMacroShiftChart();
      renderQuarterlyDetailComboChart();
      renderQuarterlyScorecardTable();
    } else {
      renderYoYMacroShiftChart();
      renderYoYDetailComboChart();
      renderYoYScorecardTable();
    }
  }

  // Synchronize Tab 4 Time View Tabs & Target Year Selector (Annotation 3)
  function renderYoYTimeViewControls() {
    const tabs = document.querySelectorAll('#yoyTimeViewTabs .seg-btn');
    tabs.forEach(btn => {
      if (btn.getAttribute('data-time-view') === state.timeView) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const wrapper = document.getElementById('yoyQuarterYearWrapper');
    const chipsContainer = document.getElementById('yoyQuarterYearChips');
    if (!wrapper || !chipsContainer) return;

    if (state.timeView === 'QUARTERLY') {
      wrapper.style.display = 'inline-flex';
      const availYears = window.FINANCE_DATA.metadata.availableYears;
      const activeYear = state.quarterTargetYear || '2026';

      let html = '';
      availYears.forEach(y => {
        const isActive = y === activeYear;
        html += `<button class="filter-chip ${isActive ? 'active' : ''}" data-target-year="${y}" style="font-size:12px; padding:3px 9px; border-radius:9999px;">${y}년</button>`;
      });
      chipsContainer.innerHTML = html;

      chipsContainer.querySelectorAll('button[data-target-year]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.quarterTargetYear = btn.getAttribute('data-target-year');
          renderTabYoY();
        });
      });
    } else {
      wrapper.style.display = 'none';
    }
  }

  // Quick 1-Click Category Filter Chips for YoY / QoQ Shift
  function renderYoYCategoryChips(categories) {
    const container = document.getElementById('yoyCategoryChips');
    if (!container) return;

    let html = `
      <button class="filter-chip ${!state.yoyCategory ? 'active' : ''}" data-yoy-cat="ALL" style="font-size:12px; padding:4px 10px; margin-right:4px; margin-bottom:4px; border-radius: 9999px;">
        전체보기 (종합)
      </button>
    `;

    categories.forEach(cat => {
      const isActive = state.yoyCategory === cat;
      const color = getCategoryColor(cat);
      html += `
        <button class="filter-chip ${isActive ? 'active' : ''}" data-yoy-cat="${cat}" style="font-size:12px; padding:4px 10px; margin-right:4px; margin-bottom:4px; border-radius: 9999px; border-color: ${isActive ? color : 'var(--color-border)'}; ${isActive ? `background:${color}15; color:${color}; font-weight:700;` : ''}">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:5px; vertical-align:middle;"></span>${cat}
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('button[data-yoy-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-yoy-cat');
        if (cat === 'ALL' || state.yoyCategory === cat) {
          state.yoyCategory = null;
        } else {
          state.yoyCategory = cat;
        }
        if (state.timeView === 'QUARTERLY') {
          renderQuarterlyMacroShiftChart();
          renderQuarterlyDetailComboChart();
        } else {
          renderYoYMacroShiftChart();
          renderYoYDetailComboChart();
        }
      });
    });
  }

  // Left Chart: Yearly Macro categories comparison (Respects selectedYears and metricMode)
  function renderYoYMacroShiftChart() {
    const ctx = document.getElementById('yoyMacroShiftChart');
    const badgeEl = document.getElementById('yoySelectedBadge');
    const resetBtn = document.getElementById('btnResetYoYCategory');
    const titleEl = document.getElementById('yoyMacroShiftTitle');
    const subtitleEl = document.getElementById('yoyMacroShiftSubtitle');
    if (!ctx) return;

    if (charts.yoyMacroShift) charts.yoyMacroShift.destroy();

    const availYears = window.FINANCE_DATA.metadata.availableYears;
    const activeMap = window.FINANCE_DATA.metadata.activeMonths;
    const txs = window.FINANCE_DATA.transactions;

    // Respect selected years (Annotation 1)
    const targetYears = state.selectedYears.includes('ALL') ? availYears : state.selectedYears;

    const isAvg = state.metricMode === 'AVG';
    const metricLabel = isAvg ? '월평균 (정규화)' : '연간 총합';

    if (titleEl) {
      titleEl.textContent = `연도별 주요 대분류 지출 비교 (클릭 시 드릴다운)`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `${targetYears.join(', ')}년 ${metricLabel} 비교 · 카테고리를 클릭하면 우측 차트에 해당 대분류만 드릴다운되어 연도별 소분류와 증감률이 표시됩니다.`;
    }

    // Derive ALL expense categories present in transactions, sorted by total amount
    const catMap = {};
    txs.filter(t => t.type === '지출').forEach(t => {
      const c = t.category || '기타';
      catMap[c] = (catMap[c] || 0) + Math.abs(t.amount);
    });
    const categories = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);

    renderYoYCategoryChips(categories);

    if (badgeEl && resetBtn) {
      if (state.yoyCategory) {
        badgeEl.style.display = 'inline-flex';
        badgeEl.textContent = `${state.yoyCategory} 선택됨`;
        const color = getCategoryColor(state.yoyCategory);
        badgeEl.style.backgroundColor = `${color}20`;
        badgeEl.style.color = color;
        badgeEl.style.border = `1px solid ${color}`;
        resetBtn.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
        resetBtn.style.display = 'none';
      }
    }

    const datasets = targetYears.map((y, idx) => {
      const divisor = isAvg ? (activeMap[y] || 12) : 1;
      const yTxs = txs.filter(t => t.year === y && t.type === '지출');

      const data = categories.map(cat => {
        const catSum = yTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        return catSum / divisor;
      });

      const bgColors = categories.map(cat => {
        const baseColor = [COLORS.slate, COLORS.purple, COLORS.coral, COLORS.primary][availYears.indexOf(y) % 4];
        if (state.yoyCategory) {
          return cat === state.yoyCategory ? baseColor : `${baseColor}30`;
        }
        return baseColor;
      });

      return {
        label: `${y}년 (${metricLabel})`,
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
      };
    });

    charts.yoyMacroShift = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event) => {
          const points = charts.yoyMacroShift.getElementsAtEventForMode(
            event,
            'nearest',
            { axis: 'y', intersect: false },
            true
          );
          if (points && points.length > 0) {
            const index = points[0].index;
            const clickedCat = categories[index];
            if (state.yoyCategory === clickedCat) {
              state.yoyCategory = null;
            } else {
              state.yoyCategory = clickedCat;
            }
            renderYoYMacroShiftChart();
            renderYoYDetailComboChart();
          }
        },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', weight: '700' } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatKRW(ctx.raw)} (클릭 시 우측 상세 드릴다운)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: COLORS.border },
            ticks: { callback: val => formatCompactKRW(val) }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // Right Chart: Yearly Detail Stacked Bar + Growth Rate Combo Chart (Annotations 1 & 2)
  function renderYoYDetailComboChart() {
    const ctx = document.getElementById('yoyDetailComboChart');
    const titleEl = document.getElementById('yoyDetailTitle');
    const subtitleEl = document.getElementById('yoyDetailSubtitle');
    if (!ctx) return;

    if (charts.yoyDetailCombo) charts.yoyDetailCombo.destroy();

    const availYears = window.FINANCE_DATA.metadata.availableYears;
    const activeMap = window.FINANCE_DATA.metadata.activeMonths;
    const txs = window.FINANCE_DATA.transactions.filter(t => t.type === '지출');

    // Respect selected years (Annotation 1)
    const targetYears = state.selectedYears.includes('ALL') ? availYears : state.selectedYears;

    const datasets = [];
    const yearlyTotals = {};
    let growthRates = [];

    const isAvg = state.metricMode === 'AVG';
    const metricLabel = isAvg ? '월평균' : '연간 총합';

    if (state.yoyCategory) {
      // --- Case 1: Specific Category Drilled Down (e.g. '식비', '구매비') ---
      if (titleEl) titleEl.textContent = `[${state.yoyCategory}] 연도별 변동 현황 및 소분류 구성 (${metricLabel} YoY 복합차트)`;
      if (subtitleEl) subtitleEl.textContent = `각 연도별 소분류 지출(스택 막대) 및 전년 대비 증감률(선 그래프, 0% 기준선)`;

      const catTxs = txs.filter(t => t.category === state.yoyCategory);

      // Find top subcategories
      const subcatTotals = {};
      catTxs.forEach(t => {
        const sub = t.subcategory || '미분류';
        subcatTotals[sub] = (subcatTotals[sub] || 0) + Math.abs(t.amount);
      });

      const sortedSubcats = Object.keys(subcatTotals).sort((a,b) => subcatTotals[b] - subcatTotals[a]);
      const topSubcats = sortedSubcats.slice(0, 7);
      const hasOther = sortedSubcats.length > 7;

      // Compute total for category per year (Annotation 2: True totals without unexpected dividing)
      targetYears.forEach(y => {
        const divisor = isAvg ? (activeMap[y] || 12) : 1;
        const ySum = catTxs.filter(t => t.year === y).reduce((s, t) => s + Math.abs(t.amount), 0);
        yearlyTotals[y] = ySum / divisor;
      });

      // Subcategory Stacked Bars
      topSubcats.forEach((sub, sIdx) => {
        const color = SUBCAT_PALETTE[sIdx % SUBCAT_PALETTE.length];
        const data = targetYears.map(y => {
          const divisor = isAvg ? (activeMap[y] || 12) : 1;
          const sum = catTxs.filter(t => t.year === y && (t.subcategory || '미분류') === sub)
                            .reduce((s, t) => s + Math.abs(t.amount), 0);
          return sum / divisor;
        });

        datasets.push({
          type: 'bar',
          label: sub,
          data: data,
          backgroundColor: color,
          stack: 'yoyStack',
          borderRadius: 3,
          order: 2,
          yAxisID: 'y'
        });
      });

      // Other subcategories if any
      if (hasOther) {
        const otherSubs = new Set(sortedSubcats.slice(7));
        const otherData = targetYears.map(y => {
          const divisor = isAvg ? (activeMap[y] || 12) : 1;
          const sum = catTxs.filter(t => t.year === y && otherSubs.has(t.subcategory || '미분류'))
                            .reduce((s, t) => s + Math.abs(t.amount), 0);
          return sum / divisor;
        });
        datasets.push({
          type: 'bar',
          label: '기타 소분류',
          data: otherData,
          backgroundColor: '#94A3B8',
          stack: 'yoyStack',
          borderRadius: 3,
          order: 2,
          yAxisID: 'y'
        });
      }

      // Growth Rate Line (%) on Secondary Y-Axis
      growthRates = targetYears.map((y, idx) => {
        if (idx === 0) {
          const yIdx = availYears.indexOf(y);
          if (yIdx > 0) {
            const prevY = availYears[yIdx - 1];
            const pDivisor = isAvg ? (activeMap[prevY] || 12) : 1;
            const prevVal = catTxs.filter(t => t.year === prevY).reduce((s, t) => s + Math.abs(t.amount), 0) / pDivisor;
            const currVal = yearlyTotals[y] || 0;
            if (prevVal > 0) return ((currVal - prevVal) / prevVal) * 100;
          }
          return null;
        }
        const prevY = targetYears[idx - 1];
        const prevVal = yearlyTotals[prevY] || 0;
        const currVal = yearlyTotals[y] || 0;
        if (prevVal === 0) return 0;
        return ((currVal - prevVal) / prevVal) * 100;
      });

      datasets.push({
        type: 'line',
        label: `${state.yoyCategory} 전년 대비 증감률 (%)`,
        data: growthRates,
        borderColor: COLORS.navy,
        backgroundColor: COLORS.navy,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: COLORS.navy,
        pointBorderWidth: 2.5,
        tension: 0.2,
        order: 1,
        yAxisID: 'yRate'
      });

    } else {
      // --- Case 2: All 1-Level Categories Stacked (Default) ---
      if (titleEl) titleEl.textContent = `전체 대분류별 연도별 지출 비중 및 증감률 (${metricLabel} YoY 복합차트)`;
      if (subtitleEl) subtitleEl.textContent = `1레벨 대분류별 연도별 지출 구성(스택 막대) 및 총소비지출 전년 대비 증감률(선 그래프, 0% 기준선)`;

      const catMap = {};
      txs.forEach(t => {
        const c = t.category || '기타';
        catMap[c] = (catMap[c] || 0) + Math.abs(t.amount);
      });
      const majorCats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);

      targetYears.forEach(y => {
        const divisor = isAvg ? (activeMap[y] || 12) : 1;
        const ySum = txs.filter(t => t.year === y).reduce((s, t) => s + Math.abs(t.amount), 0);
        yearlyTotals[y] = ySum / divisor;
      });

      majorCats.forEach(cat => {
        const color = getCategoryColor(cat);
        const data = targetYears.map(y => {
          const divisor = isAvg ? (activeMap[y] || 12) : 1;
          const sum = txs.filter(t => t.year === y && t.category === cat)
                         .reduce((s, t) => s + Math.abs(t.amount), 0);
          return sum / divisor;
        });

        datasets.push({
          type: 'bar',
          label: cat,
          data: data,
          backgroundColor: color,
          stack: 'allCats',
          borderRadius: 2,
          order: 2,
          yAxisID: 'y'
        });
      });

      growthRates = targetYears.map((y, idx) => {
        if (idx === 0) {
          const yIdx = availYears.indexOf(y);
          if (yIdx > 0) {
            const prevY = availYears[yIdx - 1];
            const pDivisor = isAvg ? (activeMap[prevY] || 12) : 1;
            const prevVal = txs.filter(t => t.year === prevY).reduce((s, t) => s + Math.abs(t.amount), 0) / pDivisor;
            const currVal = yearlyTotals[y] || 0;
            if (prevVal > 0) return ((currVal - prevVal) / prevVal) * 100;
          }
          return null;
        }
        const prevY = targetYears[idx - 1];
        const prevVal = yearlyTotals[prevY] || 0;
        const currVal = yearlyTotals[y] || 0;
        if (prevVal === 0) return 0;
        return ((currVal - prevVal) / prevVal) * 100;
      });

      datasets.push({
        type: 'line',
        label: '총소비지출 전년 대비 증감률 (%)',
        data: growthRates,
        borderColor: COLORS.navy,
        backgroundColor: COLORS.navy,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: COLORS.navy,
        pointBorderWidth: 2.5,
        tension: 0.2,
        order: 1,
        yAxisID: 'yRate'
      });
    }

    const validRates = growthRates.filter(r => r !== null && !isNaN(r));
    const minR = validRates.length ? Math.min(...validRates) : -25;
    const maxR = validRates.length ? Math.max(...validRates) : 25;
    const bound = Math.ceil(Math.max(Math.abs(minR), Math.abs(maxR), 25) * 1.25 / 10) * 10;
    const maxYTotal = Math.max(...Object.values(yearlyTotals), 1);

    charts.yoyDetailCombo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: targetYears.map(y => `${y}년`),
        datasets: datasets
      },
      plugins: [yoyLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', weight: '700', size: 11 }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.yAxisID === 'yRate') {
                  return `${ctx.dataset.label}: ${ctx.raw !== null ? `${ctx.raw > 0 ? '+' : ''}${ctx.raw.toFixed(1)}%` : '-'}`;
                }
                const total = yearlyTotals[targetYears[ctx.dataIndex]] || 1;
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.dataset.label}: ${formatKRW(ctx.raw)} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: COLORS.border },
            suggestedMax: Math.ceil(maxYTotal * 1.15),
            ticks: { callback: val => formatCompactKRW(val) }
          },
          yRate: {
            position: 'right',
            grid: { display: false },
            suggestedMin: -bound,
            suggestedMax: bound,
            ticks: { 
              callback: val => `${val > 0 ? '+' : ''}${val.toFixed(0)}%`,
              font: { family: 'Pretendard', weight: '600', size: 10 }
            }
          }
        }
      }
    });
  }

  // Yearly Financial Scorecard Table (Respects selectedYears and metricMode)
  function renderYoYScorecardTable() {
    const tableHeader = document.getElementById('yoyScorecardHeader');
    const tableBody = document.getElementById('yoyScorecardBody');
    const titleEl = document.getElementById('yoyScorecardTitle');
    const subtitleEl = document.getElementById('yoyScorecardSubtitle');
    if (!tableHeader || !tableBody) return;

    const availYears = window.FINANCE_DATA.metadata.availableYears;
    const allTxs = window.FINANCE_DATA.transactions;
    const activeMap = window.FINANCE_DATA.metadata.activeMonths;

    const targetYears = state.selectedYears.includes('ALL') ? availYears : state.selectedYears;

    const isAvg = state.metricMode === 'AVG';
    const metricLabel = isAvg ? '정규화 월평균' : '연간 총합';

    if (titleEl) {
      titleEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>연도별 핵심 재무 성과표 (Executive Financial Scorecard)`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `${targetYears.join(', ')}년 ${metricLabel} 실질소득, 순소비지출, 잉여현금흐름, 저축률의 다년도 비교 및 변동률`;
    }

    tableHeader.innerHTML = `
      <tr>
        <th>재무 지표</th>
        ${targetYears.map(y => `<th class="text-right">${y}년 (${isAvg ? `월평균/${activeMap[y]}개월` : '연간 총액'})</th>`).join('')}
        <th class="text-right">최근 YoY 변동</th>
      </tr>
    `;

    const yearlyMetrics = targetYears.map(y => {
      const yTxs = allTxs.filter(t => t.year === y);
      return calculateMacroMetrics(yTxs);
    });

    const rows = [
      {
        name: '실질 총수입 (Real Income)',
        getVal: m => isAvg ? m.avgIncome : m.incomeToUse,
        isIncome: true
      },
      {
        name: '순소비 지출 (Net Living Expense)',
        getVal: m => isAvg ? m.avgExpense : m.netLivingExpense,
        isExpense: true
      },
      {
        name: '잉여 현금흐름 (Free Cash Flow)',
        getVal: m => isAvg ? m.avgNetCashFlow : m.netFreeCashFlow,
        isNet: true
      },
      {
        name: '순투자 적립액 (Pure Investment)',
        getVal: m => isAvg ? m.avgInvestment : m.pureInvestment,
        isInvest: true
      },
      {
        name: '저축·투자 여력률 (%)',
        getVal: m => m.savingsCapacityRate,
        isRate: true
      },
      {
        name: '캐시백 및 금융수익',
        getVal: m => m.financialYieldTotal,
        isIncome: true
      }
    ];

    tableBody.innerHTML = rows.map(r => {
      const vals = yearlyMetrics.map(m => r.getVal(m));
      const vPrev = vals[vals.length - 2] || 0;
      const vCurr = vals[vals.length - 1] || 0;
      const diff = vCurr - vPrev;
      const pct = vPrev !== 0 ? (diff / Math.abs(vPrev)) * 100 : 0;
      const deltaClass = diff >= 0 ? 'positive' : 'negative';

      return `
        <tr>
          <td><strong>${r.name}</strong></td>
          ${vals.map(v => `<td class="text-right font-bold ${r.isIncome ? 'num-income' : r.isExpense ? 'num-expense' : r.isInvest ? 'num-invest' : ''}">${r.isRate ? `${v.toFixed(1)}%` : formatKRW(v)}</td>`).join('')}
          <td class="text-right">
            <span class="kpi-delta ${deltaClass}">${diff >= 0 ? '+' : ''}${r.isRate ? `${diff.toFixed(1)}%p` : formatCompactKRW(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Left Chart: Quarterly Macro Categories Comparison (Annotation 3)
  function renderQuarterlyMacroShiftChart() {
    const ctx = document.getElementById('yoyMacroShiftChart');
    const badgeEl = document.getElementById('yoySelectedBadge');
    const resetBtn = document.getElementById('btnResetYoYCategory');
    const titleEl = document.getElementById('yoyMacroShiftTitle');
    const subtitleEl = document.getElementById('yoyMacroShiftSubtitle');
    if (!ctx) return;

    if (charts.yoyMacroShift) charts.yoyMacroShift.destroy();

    const targetYear = state.quarterTargetYear || '2026';
    const txs = window.FINANCE_DATA.transactions.filter(t => t.year === targetYear && t.type === '지출');

    if (titleEl) {
      titleEl.textContent = `${targetYear}년 주요 대분류 분기별 지출 비교 (클릭 시 드릴다운)`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `${targetYear}년 1분기~4분기 지출액 비교 · 카테고리를 클릭하면 우측 차트에 해당 대분류만 드릴다운되어 분기별 소분류와 증감률이 표시됩니다.`;
    }

    const catMap = {};
    txs.forEach(t => {
      const c = t.category || '기타';
      catMap[c] = (catMap[c] || 0) + Math.abs(t.amount);
    });
    const categories = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);

    renderYoYCategoryChips(categories);

    if (badgeEl && resetBtn) {
      if (state.yoyCategory) {
        badgeEl.style.display = 'inline-flex';
        badgeEl.textContent = `${state.yoyCategory} 선택됨`;
        const color = getCategoryColor(state.yoyCategory);
        badgeEl.style.backgroundColor = `${color}20`;
        badgeEl.style.color = color;
        badgeEl.style.border = `1px solid ${color}`;
        resetBtn.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
        resetBtn.style.display = 'none';
      }
    }

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterLabels = ['1분기 (1~3월)', '2분기 (4~6월)', '3분기 (7~9월)', targetYear === '2026' ? '4분기 (10월)' : '4분기 (10~12월)'];
    const quarterColors = ['#64748B', '#06B6D4', '#FF5A5F', '#0046FF'];

    const datasets = quarters.map((q, qIdx) => {
      const qTxs = txs.filter(t => t.quarter === q);
      const data = categories.map(cat => {
        return qTxs.filter(t => t.category === cat).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      });

      const bgColors = categories.map(cat => {
        const baseColor = quarterColors[qIdx];
        if (state.yoyCategory) {
          return cat === state.yoyCategory ? baseColor : `${baseColor}30`;
        }
        return baseColor;
      });

      return {
        label: quarterLabels[qIdx],
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
      };
    });

    charts.yoyMacroShift = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event) => {
          const points = charts.yoyMacroShift.getElementsAtEventForMode(
            event,
            'nearest',
            { axis: 'y', intersect: false },
            true
          );
          if (points && points.length > 0) {
            const index = points[0].index;
            const clickedCat = categories[index];
            if (state.yoyCategory === clickedCat) {
              state.yoyCategory = null;
            } else {
              state.yoyCategory = clickedCat;
            }
            renderQuarterlyMacroShiftChart();
            renderQuarterlyDetailComboChart();
          }
        },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Pretendard', weight: '700' } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatKRW(ctx.raw)} (클릭 시 우측 상세 드릴다운)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: COLORS.border },
            ticks: { callback: val => formatCompactKRW(val) }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // Right Chart: Quarterly Detail Stacked Bar + QoQ Growth Rate Combo Chart (Annotation 3)
  function renderQuarterlyDetailComboChart() {
    const ctx = document.getElementById('yoyDetailComboChart');
    const titleEl = document.getElementById('yoyDetailTitle');
    const subtitleEl = document.getElementById('yoyDetailSubtitle');
    if (!ctx) return;

    if (charts.yoyDetailCombo) charts.yoyDetailCombo.destroy();

    const targetYear = state.quarterTargetYear || '2026';
    const txs = window.FINANCE_DATA.transactions.filter(t => t.year === targetYear && t.type === '지출');

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterDisplayNames = ['1분기', '2분기', '3분기', targetYear === '2026' ? '4분기(10월)' : '4분기'];

    const datasets = [];
    const quarterlyTotals = {};
    let growthRates = [];

    if (state.yoyCategory) {
      if (titleEl) titleEl.textContent = `[${state.yoyCategory}] ${targetYear}년 분기별 지출 및 소분류 구성 (QoQ 복합차트)`;
      if (subtitleEl) subtitleEl.textContent = `각 분기별 소분류 지출(세로 스택 막대) 및 전분기 대비 증감률(선 그래프, 0% 기준선)`;

      const catTxs = txs.filter(t => t.category === state.yoyCategory);

      const subcatTotals = {};
      catTxs.forEach(t => {
        const sub = t.subcategory || '미분류';
        subcatTotals[sub] = (subcatTotals[sub] || 0) + Math.abs(t.amount);
      });

      const sortedSubcats = Object.keys(subcatTotals).sort((a,b) => subcatTotals[b] - subcatTotals[a]);
      const topSubcats = sortedSubcats.slice(0, 7);
      const hasOther = sortedSubcats.length > 7;

      quarters.forEach(q => {
        quarterlyTotals[q] = catTxs.filter(t => t.quarter === q).reduce((s, t) => s + Math.abs(t.amount), 0);
      });

      topSubcats.forEach((sub, sIdx) => {
        const color = SUBCAT_PALETTE[sIdx % SUBCAT_PALETTE.length];
        const data = quarters.map(q => {
          return catTxs.filter(t => t.quarter === q && (t.subcategory || '미분류') === sub)
                       .reduce((s, t) => s + Math.abs(t.amount), 0);
        });

        datasets.push({
          type: 'bar',
          label: sub,
          data: data,
          backgroundColor: color,
          stack: 'quarterStack',
          borderRadius: 3,
          order: 2,
          yAxisID: 'y'
        });
      });

      if (hasOther) {
        const otherSubs = new Set(sortedSubcats.slice(7));
        const otherData = quarters.map(q => {
          return catTxs.filter(t => t.quarter === q && otherSubs.has(t.subcategory || '미분류'))
                       .reduce((s, t) => s + Math.abs(t.amount), 0);
        });
        datasets.push({
          type: 'bar',
          label: '기타 소분류',
          data: otherData,
          backgroundColor: '#94A3B8',
          stack: 'quarterStack',
          borderRadius: 3,
          order: 2,
          yAxisID: 'y'
        });
      }

      // QoQ Growth Rate Line (%)
      growthRates = quarters.map((q, idx) => {
        if (idx === 0) return null;
        const prevQ = quarters[idx - 1];
        const prevVal = quarterlyTotals[prevQ] || 0;
        const currVal = quarterlyTotals[q] || 0;
        if (prevVal === 0) return 0;
        return ((currVal - prevVal) / prevVal) * 100;
      });

      datasets.push({
        type: 'line',
        label: `${state.yoyCategory} 전분기 대비 증감률 (%)`,
        data: growthRates,
        borderColor: COLORS.navy,
        backgroundColor: COLORS.navy,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: COLORS.navy,
        pointBorderWidth: 2.5,
        tension: 0.2,
        order: 1,
        yAxisID: 'yRate'
      });

    } else {
      if (titleEl) titleEl.textContent = `${targetYear}년 전체 대분류별 분기별 지출 비중 및 증감률 (QoQ 복합차트)`;
      if (subtitleEl) subtitleEl.textContent = `1레벨 대분류별 분기별 지출 구성(세로 스택 막대) 및 총지출 전분기 대비 증감률(선 그래프, 0% 기준선)`;

      const catMap = {};
      txs.forEach(t => {
        const c = t.category || '기타';
        catMap[c] = (catMap[c] || 0) + Math.abs(t.amount);
      });
      const majorCats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);

      quarters.forEach(q => {
        quarterlyTotals[q] = txs.filter(t => t.quarter === q).reduce((s, t) => s + Math.abs(t.amount), 0);
      });

      majorCats.forEach(cat => {
        const color = getCategoryColor(cat);
        const data = quarters.map(q => {
          return txs.filter(t => t.quarter === q && t.category === cat)
                    .reduce((s, t) => s + Math.abs(t.amount), 0);
        });

        datasets.push({
          type: 'bar',
          label: cat,
          data: data,
          backgroundColor: color,
          stack: 'allCats',
          borderRadius: 2,
          order: 2,
          yAxisID: 'y'
        });
      });

      growthRates = quarters.map((q, idx) => {
        if (idx === 0) return null;
        const prevQ = quarters[idx - 1];
        const prevVal = quarterlyTotals[prevQ] || 0;
        const currVal = quarterlyTotals[q] || 0;
        if (prevVal === 0) return 0;
        return ((currVal - prevVal) / prevVal) * 100;
      });

      datasets.push({
        type: 'line',
        label: '총소비지출 전분기 대비 증감률 (%)',
        data: growthRates,
        borderColor: COLORS.navy,
        backgroundColor: COLORS.navy,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: COLORS.navy,
        pointBorderWidth: 2.5,
        tension: 0.2,
        order: 1,
        yAxisID: 'yRate'
      });
    }

    const validRates = growthRates.filter(r => r !== null && !isNaN(r));
    const minR = validRates.length ? Math.min(...validRates) : -25;
    const maxR = validRates.length ? Math.max(...validRates) : 25;
    const bound = Math.ceil(Math.max(Math.abs(minR), Math.abs(maxR), 25) * 1.25 / 10) * 10;
    const maxQTotal = Math.max(...Object.values(quarterlyTotals), 1);

    charts.yoyDetailCombo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: quarterDisplayNames,
        datasets: datasets
      },
      plugins: [yoyLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Pretendard', weight: '700', size: 11 }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.yAxisID === 'yRate') {
                  return `${ctx.dataset.label}: ${ctx.raw !== null ? `${ctx.raw > 0 ? '+' : ''}${ctx.raw.toFixed(1)}%` : '-'}`;
                }
                const total = quarterlyTotals[quarters[ctx.dataIndex]] || 1;
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.dataset.label}: ${formatKRW(ctx.raw)} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: COLORS.border },
            suggestedMax: Math.ceil(maxQTotal * 1.15),
            ticks: { callback: val => formatCompactKRW(val) }
          },
          yRate: {
            position: 'right',
            grid: { display: false },
            suggestedMin: -bound,
            suggestedMax: bound,
            ticks: { 
              callback: val => `${val > 0 ? '+' : ''}${val.toFixed(0)}%`,
              font: { family: 'Pretendard', weight: '600', size: 10 }
            }
          }
        }
      }
    });
  }

  // Quarterly Financial Scorecard Table (Annotation 3)
  function renderQuarterlyScorecardTable() {
    const tableHeader = document.getElementById('yoyScorecardHeader');
    const tableBody = document.getElementById('yoyScorecardBody');
    const titleEl = document.getElementById('yoyScorecardTitle');
    const subtitleEl = document.getElementById('yoyScorecardSubtitle');
    if (!tableHeader || !tableBody) return;

    const targetYear = state.quarterTargetYear || '2026';
    const allTxs = window.FINANCE_DATA.transactions;
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterNames = ['1분기', '2분기', '3분기', targetYear === '2026' ? '4분기(10월)' : '4분기'];

    if (titleEl) {
      titleEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>${targetYear}년 분기별 핵심 재무 성과표 (Quarterly Scorecard)`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = `${targetYear}년 1분기~4분기 실질소득, 순소비지출, 잉여현금흐름, 저축률의 분기별 추산 및 변동률`;
    }

    tableHeader.innerHTML = `
      <tr>
        <th>재무 지표</th>
        ${quarters.map((q, idx) => `<th class="text-right">${targetYear}년 ${quarterNames[idx]}</th>`).join('')}
        <th class="text-right">최근 QoQ 변동</th>
      </tr>
    `;

    const quarterlyMetrics = quarters.map(q => {
      const qTxs = allTxs.filter(t => t.year === targetYear && t.quarter === q);
      return calculateMacroMetrics(qTxs);
    });

    const rows = [
      {
        name: '실질 총수입 (Real Income)',
        getVal: m => m.incomeToUse,
        isIncome: true
      },
      {
        name: '순소비 지출 (Net Living Expense)',
        getVal: m => m.netLivingExpense,
        isExpense: true
      },
      {
        name: '잉여 현금흐름 (Free Cash Flow)',
        getVal: m => m.netFreeCashFlow,
        isNet: true
      },
      {
        name: '순투자 적립액 (Pure Investment)',
        getVal: m => m.pureInvestment,
        isInvest: true
      },
      {
        name: '저축·투자 여력률 (%)',
        getVal: m => m.savingsCapacityRate,
        isRate: true
      },
      {
        name: '캐시백 및 금융수익',
        getVal: m => m.financialYieldTotal,
        isIncome: true
      }
    ];

    tableBody.innerHTML = rows.map(r => {
      const vals = quarterlyMetrics.map(m => r.getVal(m));
      const vPrev = vals[vals.length - 2] || 0;
      const vCurr = vals[vals.length - 1] || 0;
      const diff = vCurr - vPrev;
      const pct = vPrev !== 0 ? (diff / Math.abs(vPrev)) * 100 : 0;
      const deltaClass = diff >= 0 ? 'positive' : 'negative';

      return `
        <tr>
          <td><strong>${r.name}</strong></td>
          ${vals.map(v => `<td class="text-right font-bold ${r.isIncome ? 'num-income' : r.isExpense ? 'num-expense' : r.isInvest ? 'num-invest' : ''}">${r.isRate ? `${v.toFixed(1)}%` : formatKRW(v)}</td>`).join('')}
          <td class="text-right">
            <span class="kpi-delta ${deltaClass}">${diff >= 0 ? '+' : ''}${r.isRate ? `${diff.toFixed(1)}%p` : formatCompactKRW(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // TAB 5: [☰ 항목별 지출·조회] (Category Drilldown & Explorer) (Annotations 1, 2, 3)
  // ==========================================================================
  function renderTabExplorer() {
    renderCategoryDrilldown();
    renderPaymentMethodShare();
    renderTopMerchants();
    renderExplorerTable();
  }

  function renderCategoryDrilldown() {
    const donutCtx = document.getElementById('drilldownDonutChart');
    const badgeEl = document.getElementById('donutSelectedBadge');
    if (!donutCtx) return;

    if (charts.drilldownDonut) charts.drilldownDonut.destroy();

    const txs = getFilteredTransactions().filter(t => t.type === '지출');

    // Aggregate by category - INCLUDE ALL CATEGORIES (No .slice(0, 8)!)
    const catSums = {};
    txs.forEach(t => {
      const cat = t.category || '기타';
      catSums[cat] = (catSums[cat] || 0) + Math.abs(t.amount);
    });

    const sortedCats = Object.keys(catSums).sort((a,b) => catSums[b] - catSums[a]);
    const topCats = sortedCats; // ALL 14 categories, including 외식비, 의료/건강, 고정보험, etc.
    const topVals = topCats.map(c => catSums[c]);

    // Donut Colors mapped from unified palette
    const sliceColors = topCats.map(c => getCategoryColor(c));

    // Highlight selected slice
    const offsets = topCats.map(c => (state.drilldownCategory === c ? 14 : 0));
    const borderColors = topCats.map(c => (state.drilldownCategory === c ? '#001A66' : '#FFFFFF'));
    const borderWidths = topCats.map(c => (state.drilldownCategory === c ? 3 : 2));

    // Update Donut Active Badge
    if (badgeEl) {
      if (state.drilldownCategory) {
        badgeEl.style.display = 'inline-flex';
        badgeEl.textContent = `${state.drilldownCategory} 선택됨`;
        const col = getCategoryColor(state.drilldownCategory);
        badgeEl.style.backgroundColor = `${col}20`;
        badgeEl.style.color = col;
        badgeEl.style.border = `1px solid ${col}`;
      } else {
        badgeEl.style.display = 'none';
      }
    }

    // Donut Chart
    charts.drilldownDonut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: topCats,
        datasets: [{
          data: topVals,
          backgroundColor: sliceColors,
          borderWidth: borderWidths,
          borderColor: borderColors,
          offset: offsets
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const clickedCat = topCats[index];
            if (state.drilldownCategory === clickedCat) {
              state.drilldownCategory = null; // Toggle off to view all
              state.explorer.category = 'ALL';
            } else {
              state.drilldownCategory = clickedCat;
              state.explorer.category = clickedCat; // Link with explorer table (Annotation 1)
            }
            state.explorer.page = 1;
            const catSelect = document.getElementById('explorerCategoryFilter');
            if (catSelect) catSelect.value = state.explorer.category;
            renderCategoryDrilldown();
            renderExplorerTable();
          }
        },
        plugins: {
          legend: { 
            position: 'right', 
            labels: { 
              font: { family: 'Pretendard', weight: '600', size: 11 },
              boxWidth: 10,
              padding: 6
            } 
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.label}: ${formatKRW(ctx.raw)} (${pct}%) - 클릭 시 상세조회`;
              }
            }
          }
        }
      }
    });

    updateNestedSubcategoryBar(topCats, topVals);
  }

  // Nested Bar Chart (Annotation 2 & Annotation 3)
  function updateNestedSubcategoryBar(topCats, topVals) {
    const barCtx = document.getElementById('drilldownNestedBarChart');
    const titleEl = document.getElementById('drilldownNestedTitle');
    const subtitleEl = document.getElementById('drilldownNestedSubtitle');
    const resetBtn = document.getElementById('btnResetDrilldown');
    if (!barCtx) return;

    if (charts.drilldownBar) charts.drilldownBar.destroy();

    if (!state.drilldownCategory) {
      // --- Annotation 3: Default View when no category is selected -> Show 1-Level Major Categories ---
      if (titleEl) titleEl.textContent = '전체 대분류별 지출 분석 (1레벨 랭킹 · 14개 전체)';
      if (subtitleEl) subtitleEl.textContent = '각 대분류별 지출 규모 · 좌측 도넛 차트 또는 막대를 클릭하면 세부 소분류로 드릴다운됩니다.';
      if (resetBtn) resetBtn.style.display = 'none';

      const barColors = topCats.map(c => getCategoryColor(c));

      charts.drilldownBar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: topCats,
          datasets: [{
            label: '대분류 지출 금액',
            data: topVals,
            backgroundColor: barColors,
            borderRadius: 4
          }]
        },
        plugins: [horizontalBarDataLabelsPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event) => {
            const points = charts.drilldownBar.getElementsAtEventForMode(
              event, 'nearest', { axis: 'y', intersect: false }, true
            );
            if (points && points.length > 0) {
              const index = points[0].index;
              state.drilldownCategory = topCats[index];
              state.explorer.category = state.drilldownCategory;
              state.explorer.page = 1;
              const catSelect = document.getElementById('explorerCategoryFilter');
              if (catSelect) catSelect.value = state.explorer.category;
              renderCategoryDrilldown();
              renderExplorerTable();
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatKRW(ctx.raw)} (클릭 시 소분류 드릴다운)` } }
          },
          scales: {
            x: { 
              grid: { color: COLORS.border }, 
              suggestedMax: Math.ceil(Math.max(...topVals, 1) * 1.15),
              ticks: { callback: val => formatCompactKRW(val) } 
            },
            y: { grid: { display: false } }
          }
        }
      });

    } else {
      // --- Annotation 2: Specific Category Selected -> Bar chart matches EXACT category color! ---
      const categoryColor = getCategoryColor(state.drilldownCategory);

      if (titleEl) {
        titleEl.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${categoryColor}; margin-right:6px;"></span>[${state.drilldownCategory}] 세부 소분류 지출 분석`;
      }
      if (subtitleEl) {
        subtitleEl.textContent = `도넛 차트의 다른 카테고리를 클릭하거나 초기화 버튼으로 전체보기가 가능합니다.`;
      }
      if (resetBtn) {
        resetBtn.style.display = 'inline-flex';
      }

      const txs = getFilteredTransactions().filter(t => t.type === '지출' && t.category === state.drilldownCategory);

      const subcatSums = {};
      txs.forEach(t => {
        const sub = t.subcategory || '미분류';
        subcatSums[sub] = (subcatSums[sub] || 0) + Math.abs(t.amount);
      });

      const sortedSubs = Object.keys(subcatSums).sort((a,b) => subcatSums[b] - subcatSums[a]).slice(0, 10);
      const subVals = sortedSubs.map(s => subcatSums[s]);

      charts.drilldownBar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: sortedSubs,
          datasets: [{
            label: '세부 소분류 지출',
            data: subVals,
            backgroundColor: categoryColor, // EXACT SAME COLOR as category in donut chart!
            borderRadius: 4
          }]
        },
        plugins: [horizontalBarDataLabelsPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatKRW(ctx.raw)}` } }
          },
          scales: {
            x: { 
              grid: { color: COLORS.border }, 
              suggestedMax: Math.ceil(Math.max(...subVals, 1) * 1.15),
              ticks: { callback: val => formatCompactKRW(val) } 
            },
            y: { grid: { display: false } }
          }
        }
      });
    }
  }

  function renderPaymentMethodShare() {
    const ctx = document.getElementById('paymentMethodChart');
    if (!ctx) return;

    if (charts.paymentMethod) charts.paymentMethod.destroy();

    const txs = getFilteredTransactions().filter(t => t.type === '지출');

    const paymentSums = {};
    txs.forEach(t => {
      const pm = t.payment || '기타';
      paymentSums[pm] = (paymentSums[pm] || 0) + Math.abs(t.amount);
    });

    const sortedPM = Object.keys(paymentSums).sort((a,b) => paymentSums[b] - paymentSums[a]).slice(0, 7);
    const dataVals = sortedPM.map(p => paymentSums[p]);

    charts.paymentMethod = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedPM,
        datasets: [{
          label: '결제 금액',
          data: dataVals,
          backgroundColor: COLORS.navy,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatKRW(ctx.raw)}` } }
        },
        scales: {
          x: { grid: { color: COLORS.border }, ticks: { callback: val => formatCompactKRW(val) } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  function renderTopMerchants() {
    const container = document.getElementById('topMerchantsList');
    if (!container) return;

    const txs = getFilteredTransactions().filter(t => t.type === '지출');

    const mSums = {};
    const mCounts = {};
    txs.forEach(t => {
      const m = t.merchant;
      if (!m) return;
      mSums[m] = (mSums[m] || 0) + Math.abs(t.amount);
      mCounts[m] = (mCounts[m] || 0) + 1;
    });

    const top10 = Object.keys(mSums).sort((a,b) => mSums[b] - mSums[a]).slice(0, 10);

    container.innerHTML = top10.map((m, idx) => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:800; font-size:12px; width:20px; color:${idx < 3 ? 'var(--color-primary-500)' : 'var(--text-tertiary)'};">${idx + 1}</span>
          <span style="font-weight:700; font-size:13px; color:var(--text-primary);">${m}</span>
          <span style="font-size:11px; color:var(--text-tertiary);">${mCounts[m]}건</span>
        </div>
        <div style="font-weight:800; font-size:13px; color:var(--text-primary);">${formatCompactKRW(mSums[m])}</div>
      </div>
    `).join('');
  }

  // Transaction Explorer Table (Annotation 1: Linked to Drilldown Category)
  function renderExplorerTable() {
    const tableBody = document.getElementById('explorerTableBody');
    const countEl = document.getElementById('explorerTotalCount');
    const sumEl = document.getElementById('explorerTotalSum');
    const pageNumEl = document.getElementById('explorerPageNum');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const activeTagWrap = document.getElementById('explorerActiveCategoryTag');
    const activeTagName = document.getElementById('explorerCategoryTagName');
    const subtitleEl = document.getElementById('explorerSubtitle');
    const catSelect = document.getElementById('explorerCategoryFilter');
    if (!tableBody) return;

    let filtered = getFilteredTransactions();

    // 1. Linked Category Filter (Annotation 1)
    if (state.explorer.category && state.explorer.category !== 'ALL') {
      filtered = filtered.filter(t => t.category === state.explorer.category);

      if (activeTagWrap && activeTagName) {
        activeTagWrap.style.display = 'inline-flex';
        activeTagName.textContent = `대분류: ${state.explorer.category}`;
        const color = getCategoryColor(state.explorer.category);
        const pill = document.getElementById('btnRemoveExplorerCategory');
        if (pill) {
          pill.style.backgroundColor = `${color}18`;
          pill.style.color = color;
          pill.style.border = `1px solid ${color}`;
        }
      }
      if (subtitleEl) {
        subtitleEl.textContent = `[${state.explorer.category}] 대분류 드릴다운 연동 필터링 적용 중`;
      }
      if (catSelect) {
        catSelect.value = state.explorer.category;
      }
    } else {
      if (activeTagWrap) activeTagWrap.style.display = 'none';
      if (subtitleEl) {
        subtitleEl.textContent = '10,780건 전체 데이터 실시간 검색 및 상단 대분류 드릴다운 연동 필터링';
      }
      if (catSelect) {
        catSelect.value = 'ALL';
      }
    }

    // 2. Secondary Type Filter within Explorer
    if (state.explorer.type !== 'ALL') {
      filtered = filtered.filter(t => t.type === state.explorer.type);
    }

    // 3. Payment Filter within Explorer
    if (state.explorer.payment !== 'ALL') {
      filtered = filtered.filter(t => t.payment === state.explorer.payment);
    }

    // 4. Keyword Search
    if (state.explorer.search) {
      const q = state.explorer.search;
      filtered = filtered.filter(t => 
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (t.memo && t.memo.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.subcategory && t.subcategory.toLowerCase().includes(q))
      );
    }

    // Sort
    filtered.sort((a,b) => {
      let av = a[state.explorer.sortField];
      let bv = b[state.explorer.sortField];
      if (typeof av === 'string') return state.explorer.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return state.explorer.sortAsc ? av - bv : bv - av;
    });

    const totalCount = filtered.length;
    const totalAmount = filtered.reduce((s, t) => s + (t.type === '지출' ? -t.amount : t.amount), 0);

    if (countEl) countEl.textContent = `${totalCount.toLocaleString()}건`;
    if (sumEl) sumEl.textContent = formatKRW(totalAmount);

    const pageSize = state.explorer.pageSize;
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (state.explorer.page > maxPage) state.explorer.page = maxPage;

    if (pageNumEl) pageNumEl.textContent = `${state.explorer.page} / ${maxPage}`;
    if (btnPrev) btnPrev.disabled = state.explorer.page <= 1;
    if (btnNext) btnNext.disabled = state.explorer.page >= maxPage;

    const startIdx = (state.explorer.page - 1) * pageSize;
    const pageRows = filtered.slice(startIdx, startIdx + pageSize);

    if (pageRows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:24px;">조건에 맞는 거래 내역이 없습니다.</td></tr>`;
      return;
    }

    tableBody.innerHTML = pageRows.map(r => {
      let typeBadgeClass = 'sol-badge-navy';
      if (r.type === '수입') typeBadgeClass = 'sol-badge-primary';
      else if (r.type === '지출') typeBadgeClass = 'sol-badge-coral';

      const amtClass = r.type === '수입' ? 'num-income' : r.type === '지출' ? 'num-expense' : 'num-invest';
      const catColor = getCategoryColor(r.category);

      return `
        <tr>
          <td>${r.date}</td>
          <td><span class="sol-badge ${typeBadgeClass}">${r.type}</span></td>
          <td><span style="font-weight:700; color:${catColor};">${r.category}</span></td>
          <td style="color:var(--text-secondary);">${r.subcategory || '-'}</td>
          <td><strong>${r.merchant}</strong></td>
          <td class="text-right font-bold ${amtClass}">${formatKRW(r.amount)}</td>
          <td style="font-size:12px; color:var(--text-secondary);">${r.payment || '-'}</td>
          <td style="font-size:12px; color:var(--text-tertiary);">${r.memo || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // --- File Upload & ZIP Auto-Sync Engine ---
  let selectedUploadFile = null;

  function parseCellDateStr(val) {
    if (!val) return '';
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    const m = s.match(/(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    return s;
  }

  function parseCellTimeStr(val) {
    if (!val) return '00:00';
    if (typeof val === 'number') {
      const totalSec = Math.round(val * 86400);
      const h = Math.floor(totalSec / 3600) % 24;
      const m = Math.floor((totalSec % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const s = String(val).trim();
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    }
    return s;
  }

  function setupUploadModalListeners() {
    const btnOpenUpload = document.getElementById('btnOpenUpload');
    const modalBackdrop = document.getElementById('uploadModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const dropzone = document.getElementById('fileDropzone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('selectedFileInfo');
    const fileNameEl = document.getElementById('selectedFileName');
    const fileSizeEl = document.getElementById('selectedFileSize');
    const btnRemove = document.getElementById('btnRemoveSelectedFile');
    const pwdInput = document.getElementById('zipPasswordInput');
    const btnTogglePwd = document.getElementById('btnTogglePassword');
    const btnProcess = document.getElementById('btnProcessUpload');
    const statusBox = document.getElementById('uploadStatusBox');
    const btnBackup = document.getElementById('btnDownloadBackupJson');
    const btnReset = document.getElementById('btnResetToDefaultData');

    if (!modalBackdrop) return;

    if (btnOpenUpload) {
      btnOpenUpload.addEventListener('click', () => {
        modalBackdrop.classList.add('open');
        if (statusBox) statusBox.style.display = 'none';
      });
    }

    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => modalBackdrop.classList.remove('open'));
    }

    modalBackdrop.addEventListener('click', e => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
    });

    if (btnTogglePwd && pwdInput) {
      btnTogglePwd.addEventListener('click', () => {
        pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
      });
    }

    function setSelectedFile(file) {
      selectedUploadFile = file;
      if (fileInfo && fileNameEl && fileSizeEl) {
        fileInfo.style.display = 'flex';
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
      }
      if (dropzone) dropzone.style.display = 'none';
      if (statusBox) statusBox.style.display = 'none';
    }

    function clearSelectedFile() {
      selectedUploadFile = null;
      if (fileInput) fileInput.value = '';
      if (fileInfo) fileInfo.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      if (statusBox) statusBox.style.display = 'none';
    }

    if (btnRemove) {
      btnRemove.addEventListener('click', clearSelectedFile);
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          setSelectedFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', e => {
        if (e.target.files.length) {
          setSelectedFile(e.target.files[0]);
        }
      });
    }

    if (btnProcess) {
      btnProcess.addEventListener('click', async () => {
        if (!selectedUploadFile) {
          alert('먼저 등록할 파일(.zip, .xlsx, .json)을 선택해주세요.');
          return;
        }
        const pwd = pwdInput ? pwdInput.value.trim() : '1814';
        await processDatasetUpload(selectedUploadFile, pwd);
      });
    }

    if (btnBackup) {
      btnBackup.addEventListener('click', () => {
        const jsonStr = JSON.stringify(window.FINANCE_DATA, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('로컬에 저장된 사용자 업로드 데이터를 초기화하고 원본 데이터로 복원하시겠습니까?')) {
          localStorage.removeItem('SOL_FINANCE_DATA_OVERRIDE');
          location.reload();
        }
      });
    }
  }

  async function processDatasetUpload(file, password) {
    const statusBox = document.getElementById('uploadStatusBox');
    const btnProcess = document.getElementById('btnProcessUpload');

    function setStatus(html, type = 'info') {
      if (!statusBox) return;
      statusBox.style.display = 'block';
      if (type === 'error') {
        statusBox.style.background = 'rgba(255, 90, 95, 0.1)';
        statusBox.style.color = '#DC2626';
        statusBox.style.border = '1px solid rgba(255, 90, 95, 0.4)';
      } else if (type === 'success') {
        statusBox.style.background = 'rgba(16, 185, 129, 0.1)';
        statusBox.style.color = '#059669';
        statusBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      } else {
        statusBox.style.background = 'rgba(0, 70, 255, 0.08)';
        statusBox.style.color = 'var(--color-primary-500)';
        statusBox.style.border = '1px solid rgba(0, 70, 255, 0.2)';
      }
      statusBox.innerHTML = html;
    }

    try {
      if (btnProcess) btnProcess.disabled = true;

      let workbook = null;

      if (file.name.endsWith('.json')) {
        setStatus('JSON 파일을 읽는 중...');
        const text = await file.text();
        const parsed = JSON.parse(text);
        window.FINANCE_DATA = parsed;
        localStorage.setItem('SOL_FINANCE_DATA_OVERRIDE', JSON.stringify(window.FINANCE_DATA));
        bootstrap();
        setStatus('✅ JSON 데이터가 성공적으로 반영되었습니다!', 'success');
        return;
      }

      if (file.name.endsWith('.zip')) {
        setStatus('📦 1단계: 암호화된 ZIP 압축 해제 중 (비밀번호 확인)...');
        if (typeof zip === 'undefined') {
          throw new Error('ZIP 압축 해제 라이브러리가 로드되지 않았습니다.');
        }

        const zipReader = new zip.ZipReader(new zip.BlobReader(file), { password: password });
        let entries;
        try {
          entries = await zipReader.getEntries();
        } catch (e) {
          throw new Error('ZIP 파일 읽기 실패: ' + e.message);
        }

        const xlsxEntry = entries.find(e => e.filename.toLowerCase().endsWith('.xlsx'));
        if (!xlsxEntry) {
          await zipReader.close();
          throw new Error('ZIP 파일 내에 엑셀(.xlsx) 파일이 존재하지 않습니다.');
        }

        let arrayBuffer;
        try {
          const uint8 = await xlsxEntry.getData(new zip.Uint8ArrayWriter());
          arrayBuffer = uint8.buffer;
        } catch (err) {
          await zipReader.close();
          throw new Error(`비밀번호가 일치하지 않거나 압축 해제에 실패했습니다. (입력한 비밀번호: ${password})`);
        }
        await zipReader.close();

        setStatus(`📊 2단계: 엑셀 파일(${xlsxEntry.filename}) 파싱 중...`);
        if (typeof XLSX === 'undefined') {
          throw new Error('엑셀 파싱 라이브러리(SheetJS)가 로드되지 않았습니다.');
        }
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      } else if (file.name.endsWith('.xlsx')) {
        setStatus('📊 1단계: 엑셀 파일 파싱 중...');
        const arrayBuffer = await file.arrayBuffer();
        if (typeof XLSX === 'undefined') {
          throw new Error('엑셀 파싱 라이브러리(SheetJS)가 로드되지 않았습니다.');
        }
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      } else {
        throw new Error('.zip, .xlsx, .json 파일만 업로드 가능합니다.');
      }

      if (!workbook || !workbook.Sheets) {
        throw new Error('유효한 엑셀 시트를 찾을 수 없습니다.');
      }

      // 3. Parse transactions from '가계부 내역'
      const txSheetName = workbook.SheetNames.find(s => s.includes('가계부') || s.includes('내역') || s.includes('수입지출'));
      if (!txSheetName) {
        throw new Error("'가계부 내역' 시트를 찾을 수 없습니다.");
      }

      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[txSheetName], { header: 1, raw: false });
      if (rawRows.length < 2) {
        throw new Error('가계부 내역에 거래 데이터가 존재하지 않습니다.');
      }

      setStatus('🔄 3단계: 거래내역 및 재무현황 분석 중...');
      const reimbItems = new Set(['기타수입_출장비환급', '기타수입_엔빵환급', '기타수입_카드취소환급', '기타수입_보험비환급']);
      const newTxs = [];

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !row[0]) continue;
        const dStr = parseCellDateStr(row[0]);
        const tStr = parseCellTimeStr(row[1]);
        const txType = row[2] ? String(row[2]).trim() : '';
        const cat = row[3] ? String(row[3]).trim() : '';
        const subcat = row[4] ? String(row[4]).trim() : '';
        const merchant = row[5] ? String(row[5]).trim() : '';
        const amtRaw = parseFloat(String(row[6] || 0).replace(/,/g, ''));
        const amount = isNaN(amtRaw) ? 0 : amtRaw;
        const curr = row[7] ? String(row[7]).trim() : 'KRW';
        const pm = row[8] ? String(row[8]).trim() : '';
        const memo = row[9] ? String(row[9]).trim() : '';

        if (!dStr) continue;

        const ym = dStr.slice(0, 7);
        const year = dStr.slice(0, 4);
        const mNum = parseInt(ym.slice(5, 7), 10) || 1;
        const qStr = `Q${Math.floor((mNum - 1) / 3) + 1}`;

        const isReimbursement = (txType === '수입' && (reimbItems.has(cat) || reimbItems.has(subcat)));
        const isRealIncome = (txType === '수입' && !isReimbursement);
        const isPureInvestment = (txType === '이체' && cat === '투자');
        const isReconciliation = (cat === '미분류' && (merchant === '자산 추가' || merchant === '차액'));

        let entity = 'Shared';
        const comb = `${cat} ${subcat} ${merchant} ${memo} ${pm}`;
        if (/초원|쵼니|초원이용품|초원 미래에셋|초원이 농협은행|초원간식|초원취미/.test(comb)) {
          entity = 'Chowon';
        } else if (/현정|조현정|현정급여|현정자금|현정친구|현정취미|현정ISA/.test(comb)) {
          entity = 'Hyeonjeong';
        } else if (/한영흠|영흠|흠 취미|흠취미|흠 강습비|흠회사식사|흠진료|흠 부가급여|흠 비정기|흠 월정기/.test(comb)) {
          entity = 'Yeongheum';
        } else if (isPureInvestment && (/한영흠/.test(comb) || /신한 주거래/.test(pm))) {
          entity = 'Yeongheum';
        }

        newTxs.push({
          id: 0,
          date: dStr,
          time: tStr,
          type: txType,
          category: cat,
          subcategory: subcat,
          merchant: merchant,
          amount: amount,
          currency: curr,
          payment: pm,
          memo: memo,
          year: year,
          yearMonth: ym,
          quarter: qStr,
          month: mNum,
          isReimbursement: isReimbursement,
          isRealIncome: isRealIncome,
          isPureInvestment: isPureInvestment,
          isReconciliation: isReconciliation,
          entity: entity
        });
      }

      const yearsInNew = Array.from(new Set(newTxs.map(t => t.year).filter(Boolean))).sort();
      const targetYear = yearsInNew[yearsInNew.length - 1] || '2026';

      // Compare with existing target year txs
      const oldTargetTxs = (window.FINANCE_DATA.transactions || []).filter(t => t.year === targetYear);
      const existingKeySet = new Set(
        oldTargetTxs.map(t => `${t.date}|${t.time}|${t.type}|${t.category}|${t.subcategory}|${t.merchant}|${Math.round(t.amount)}|${t.payment}`)
      );

      let newCount = 0;
      newTxs.forEach(t => {
        const k = `${t.date}|${t.time}|${t.type}|${t.category}|${t.subcategory}|${t.merchant}|${Math.round(t.amount)}|${t.payment}`;
        if (!existingKeySet.has(k)) newCount++;
      });

      // Merge transactions
      const historicalTxs = (window.FINANCE_DATA.transactions || []).filter(t => t.year !== targetYear);
      const combinedTxs = historicalTxs.concat(newTxs);
      combinedTxs.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
      combinedTxs.forEach((t, i) => t.id = i + 1);

      window.FINANCE_DATA.transactions = combinedTxs;

      // 4. Parse '뱅샐현황' if present
      const sumSheetName = workbook.SheetNames.find(s => s.includes('뱅샐') || s.includes('현황') || s === targetYear);
      if (sumSheetName) {
        const sumRows = XLSX.utils.sheet_to_json(workbook.Sheets[sumSheetName], { header: 1, raw: false });
        const cfItems = [];
        const bsItems = [];
        const insItems = [];
        const invItems = [];

        // Month columns in row 11
        const monthCols = [];
        const r11 = sumRows[10] || [];
        for (let c = 4; c < 16; c++) {
          const h = String(r11[c] || '');
          if (h.startsWith(targetYear)) monthCols.push({ key: h, col: c });
        }

        let section = null;
        let currBsCat = '';

        for (let r = 0; r < sumRows.length; r++) {
          const row = sumRows[r] || [];
          const b = String(row[1] || '').trim();
          if (b === '2.현금흐름현황') { section = 'CF'; continue; }
          if (b === '3.재무현황') { section = 'BS'; continue; }
          if (b === '4.보험현황') { section = 'INS'; continue; }
          if (b === '5.투자현황') { section = 'INV'; continue; }
          if (b === '6.대출현황') { section = 'LOAN'; continue; }

          if (section === 'CF') {
            if (['항목', '최근 1년 동안의 현금흐름을 분석합니다.', ''].includes(b)) continue;
            const monthsVal = {};
            let rowSum = 0;
            monthCols.forEach(mc => {
              const v = parseFloat(String(row[mc.col] || 0).replace(/,/g, '')) || 0;
              monthsVal[mc.key] = v;
              rowSum += v;
            });
            const numM = monthCols.length || 1;
            cfItems.push({
              item: b,
              total: rowSum,
              monthlyAvg: rowSum / numM,
              months: monthsVal
            });
          } else if (section === 'BS') {
            if (['자산', '항목', '데이터를 내보낸 시점의 자산과 부채 상태를 분석합니다.'].includes(b)) continue;
            const c = String(row[2] || '').trim();
            const eRaw = parseFloat(String(row[4] || 0).replace(/,/g, '')) || 0;
            if (b && !['자산', '항목', '총자산', '순자산', '부채'].includes(b)) currBsCat = b;
            if (currBsCat || c || eRaw > 0) {
              if (b === '총자산' || b === '순자산') {
                bsItems.push({ category: b, product: b, amount: eRaw });
              } else if (c || eRaw > 0) {
                bsItems.push({ category: currBsCat || '기타', product: c || currBsCat, amount: eRaw });
              }
            }
          } else if (section === 'INS') {
            if (['금융사', '사용자가 보유한 보험상품 현황을 분석합니다.', '총계', ''].includes(b)) continue;
            const paid = parseFloat(String(row[5] || 0).replace(/,/g, '')) || 0;
            insItems.push({
              company: b,
              name: String(row[2] || '').trim(),
              status: String(row[4] || '').trim(),
              paidTotal: paid
            });
          } else if (section === 'INV') {
            if (['투자상품종류', '사용자가 보유한 투자상품 현황을 분석합니다.', '총계', ''].includes(b)) continue;
            const princ = parseFloat(String(row[5] || 0).replace(/,/g, '')) || 0;
            const val = parseFloat(String(row[6] || 0).replace(/,/g, '')) || 0;
            const ret = parseFloat(String(row[7] || 0).replace(/,/g, '')) || 0;
            invItems.push({
              type: b,
              company: String(row[2] || '').trim(),
              name: String(row[3] || '').trim(),
              principal: princ,
              valuation: val,
              returnRate: ret
            });
          }
        }

        const assetSum = bsItems.filter(i => !['총자산', '순자산', '부채'].includes(i.category))
                                .reduce((s, i) => s + i.amount, 0);
        bsItems.forEach(i => {
          if (['총자산', '순자산'].includes(i.category)) i.amount = assetSum;
        });

        if (!window.FINANCE_DATA.annualSummaries) window.FINANCE_DATA.annualSummaries = {};
        window.FINANCE_DATA.annualSummaries[targetYear] = {
          customer: {
            name: String(sumRows[5]?.[1] || '한영흠').trim(),
            gender: String(sumRows[5]?.[2] || '남').trim(),
            age: parseInt(sumRows[5]?.[3], 10) || 41,
            creditScore: parseInt(sumRows[5]?.[4], 10) || 1000
          },
          cashFlow: cfItems,
          balanceSheet: bsItems,
          insurance: insItems,
          investments: invItems
        };
      }

      // Recompute metadata
      const activeMonths = {};
      const allYears = Array.from(new Set(combinedTxs.map(t => t.year).filter(Boolean))).sort();
      allYears.forEach(y => {
        const ymSet = new Set(combinedTxs.filter(t => t.year === y).map(t => t.yearMonth));
        activeMonths[y] = ymSet.size;
      });

      const merchTotals = {};
      const merchCounts = {};
      combinedTxs.filter(t => t.type === '지출' && t.merchant).forEach(t => {
        merchTotals[t.merchant] = (merchTotals[t.merchant] || 0) + Math.abs(t.amount);
        merchCounts[t.merchant] = (merchCounts[t.merchant] || 0) + 1;
      });

      const topMerchants = Object.keys(merchTotals).map(m => ({
        name: m,
        total: Math.round(merchTotals[m]),
        count: merchCounts[m]
      })).sort((a, b) => b.total - a.total).slice(0, 50);

      window.FINANCE_DATA.metadata.availableYears = allYears;
      window.FINANCE_DATA.metadata.activeMonths = activeMonths;
      window.FINANCE_DATA.topMerchants = topMerchants;
      window.FINANCE_DATA.metadata.lastUpdated = new Date().toISOString().slice(0, 16).replace('T', ' ');

      // Save to localStorage
      localStorage.setItem('SOL_FINANCE_DATA_OVERRIDE', JSON.stringify(window.FINANCE_DATA));

      // Refresh UI
      bootstrap();

      setStatus(`
        <div style="font-weight:700; margin-bottom:4px;">🎉 데이터 동기화 완료!</div>
        <div>• 대상 연도: <strong>${targetYear}년</strong></div>
        <div>• 신규 추가 거래내역: <strong>${newCount}건</strong> (총 거래내역: ${combinedTxs.length.toLocaleString('ko-KR')}건)</div>
        <div>• 대시보드 차트 및 브라우저 로컬 저장소에 즉시 반영되었습니다.</div>
      `, 'success');

    } catch (err) {
      console.error(err);
      setStatus(`❌ 오류 발생: ${err.message}`, 'error');
    } finally {
      if (btnProcess) btnProcess.disabled = false;
    }
  }

  // Export
  window.addEventListener('DOMContentLoaded', init);

})();
