(() => {
  'use strict';

  /* ---------- Constants ---------- */

  const STORAGE_KEY = 'rrx-focus-v1';
  const BREAK_PRESETS = [5, 10, 15];
  const RING_RADIUS = 158;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const DEFAULT_SETTINGS = {
    defaultFocus: 25,
    breakMinutes: 5,
    sound: true,
    notify: false,
    celebration: true,
  };

  const FALLBACK_CELEBRATIONS = [
    { id: 21, group: 'A', text: '握紧拳头，说「nice！」' },
    { id: 7, group: 'C', text: '展露一个大大的微笑' },
    { id: 43, group: 'D', text: '给自己击掌' },
  ];

  const FALLBACK_CELEBRATION_GROUP = {
    name: '专注后庆祝',
    icon: 'sparkles',
    color: '#e7bd72',
    cue: '就现在，真实地做一次。',
  };

  const QUOTE_FALLBACK = {
    morning: ['今天会是美好的一天。'],
    before: ['坐下就算赢。'],
    during: ['一次只做一件事。'],
    stuck: ['再试一次，就一次。'],
  };

  const QUOTES = buildQuoteLibrary(window.RRX_QUOTES);

  const IDLE_HEADLINE = '把注意力，放在一件事上。';
  const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

  const CATEGORY_COLORS = [
    '#3e7057', '#c7674f', '#d2a04a', '#547c8c',
    '#7c6b95', '#8a6e4b', '#4f7a70', '#b06a7d',
  ];

  const DEFAULT_CATEGORIES = [
    { id: 'cat-study', name: '学习', color: '#3e7057' },
    { id: 'cat-work', name: '工作', color: '#547c8c' },
    { id: 'cat-exercise', name: '运动', color: '#c7674f' },
    { id: 'cat-reading', name: '阅读', color: '#d2a04a' },
  ];

  const UNCATEGORIZED_KEY = '__uncategorized__';
  const UNCATEGORIZED_COLOR = '#b7afa2';
  const UNCATEGORIZED_NAME = '未分类';

  /* ---------- State & storage ---------- */

  let storageAvailable = true;
  let state = loadState();
  let bootAt = Date.now();
  let currentView = 'focus';
  let dailyDate = startOfDay(new Date());
  let selectedDailyCategoryId = null;
  let weekStart = startOfWeekMonday(new Date());
  let heatmapMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let confirmAction = null;
  let scheduleDraft = null;
  let durationDraft = DEFAULT_SETTINGS.defaultFocus;
  let startDialogMinutes = DEFAULT_SETTINGS.defaultFocus;
  let startDialogContinue = false;
  let lastCompletionContinueAfterCountdown = false;
  let deferredInstallPrompt = null;
  let audioCtx = null;
  let lastCompletionMinutes = DEFAULT_SETTINGS.defaultFocus;
  let lastSeenDay = dateKey(new Date());
  let lastTitle = '';
  let idleQuote = '';
  let sessionQuote = '';
  let pauseQuote = '';
  let currentSessionId = null;
  let categoryEditingId = null;
  let categoryDraftColor = CATEGORY_COLORS[0];
  let celebrationHistory = [];
  let celebrationOnDone = null;
  let celebrationPreview = false;
  let celebrationCloseTimer = null;
  let celebrationReturnFocus = null;
  let checkinRevealTimer = null;
  let checkinRevealClosing = false;
  let checkinRevealReturnFocus = null;

  /* ---------- Tiny DOM helpers ---------- */

  const $id = (id) => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    focusView: $id('focusView'),
    statsView: $id('statsView'),
    navItems: qsa('.nav-item'),
    viewButtons: qsa('[data-view]'),
    greeting: $id('greeting'),
    focusHeadline: $id('focusHeadline'),
    timerCard: $id('timerCard'),
    timerModeLabel: $id('timerModeLabel'),
    durationControl: $id('durationControl'),
    durationControlValue: $id('durationControlValue'),
    durationDialog: $id('durationDialog'),
    durationForm: $id('durationForm'),
    durationPresetButtons: qsa('#durationPresetGrid button'),
    customMinutes: $id('customMinutes'),
    customMinus: $id('customMinus'),
    customPlus: $id('customPlus'),
    durationError: $id('durationError'),
    startDialog: $id('startDialog'),
    startDurationLabel: $id('startDurationLabel'),
    startOvertimePicker: qsa('#startOvertimePicker button'),
    startOvertimeHint: $id('startOvertimeHint'),
    startConfirmBtn: $id('startConfirmBtn'),
    clockDisplay: $id('clockDisplay'),
    clockCaption: $id('clockCaption'),
    progressRing: $id('progressRing'),
    idleActions: $id('idleActions'),
    runningActions: $id('runningActions'),
    idleNote: $id('idleNote'),
    checkinCard: $id('checkinCard'),
    checkinTitle: $id('checkinTitle'),
    checkinHint: $id('checkinHint'),
    checkinBtn: $id('checkinBtn'),
    checkinReveal: $id('checkinReveal'),
    checkinRevealTitle: $id('checkinRevealTitle'),
    checkinRevealText: $id('checkinRevealText'),
    checkinRevealMeta: $id('checkinRevealMeta'),
    checkinRevealClose: $id('checkinRevealClose'),
    checkinRevealSparks: $id('checkinRevealSparks'),
    focusQuote: $id('focusQuote'),
    focusQuoteText: $id('focusQuoteText'),
    focusQuoteTag: $id('focusQuoteTag'),
    focusQuoteNext: $id('focusQuoteNext'),
    startNowBtn: $id('startNowBtn'),
    scheduleBtn: $id('scheduleBtn'),
    pauseBtn: $id('pauseBtn'),
    pauseBtnLabel: $id('pauseBtnLabel'),
    pauseIconUse: document.querySelector('#pauseBtn use'),
    endBtn: $id('endBtn'),
    scheduleStrip: $id('scheduleStrip'),
    scheduleTitle: $id('scheduleTitle'),
    scheduleMeta: $id('scheduleMeta'),
    scheduleStartBtn: $id('scheduleStartBtn'),
    cancelScheduleBtn: $id('cancelScheduleBtn'),
    todayMinutes: $id('todayMinutes'),
    todayStarts: $id('todayStarts'),
    todayCompleted: $id('todayCompleted'),
    metricTotal: $id('metricTotal'),
    metricTotalUnit: $id('metricTotalUnit'),
    metricTotalHint: $id('metricTotalHint'),
    metricStarts: $id('metricStarts'),
    metricCompleted: $id('metricCompleted'),
    metricCompletionHint: $id('metricCompletionHint'),
    metricStreak: $id('metricStreak'),
    metricStreakHint: $id('metricStreakHint'),
    distributionPanel: $id('distributionPanel'),
    periodTitle: $id('periodTitle'),
    periodRange: $id('periodRange'),
    periodPrevBtn: $id('periodPrevBtn'),
    periodNextBtn: $id('periodNextBtn'),
    periodDateInput: $id('periodDateInput'),
    periodTodayBtn: $id('periodTodayBtn'),
    distributionChart: $id('distributionChart'),
    distributionSummary: $id('distributionSummary'),
    distributionBackBtn: $id('distributionBackBtn'),
    distributionListTitle: $id('distributionListTitle'),
    distributionRange: $id('distributionRange'),
    distributionTotal: $id('distributionTotal'),
    categoryList: $id('categoryList'),
    distributionEmpty: $id('distributionEmpty'),
    distributionInsight: $id('distributionInsight'),
    heatmapMonthLabel: $id('heatmapMonthLabel'),
    heatmapPrevBtn: $id('heatmapPrevBtn'),
    heatmapNextBtn: $id('heatmapNextBtn'),
    heatmapDateInput: $id('heatmapDateInput'),
    monthGrid: $id('monthGrid'),
    heatmapFoot: $id('heatmapFoot'),
    chartTooltip: $id('chartTooltip'),
    weekChart: $id('weekChart'),
    weekSubtitle: $id('weekSubtitle'),
    weekPrevBtn: $id('weekPrevBtn'),
    weekNextBtn: $id('weekNextBtn'),
    weekDateInput: $id('weekDateInput'),
    weekTodayBtn: $id('weekTodayBtn'),
    exportBtn: $id('exportBtn'),
    exportBtnSettings: $id('exportBtnSettings'),
    clearDataBtn: $id('clearDataBtn'),
    settingsBtn: $id('settingsBtn'),
    settingsDialog: $id('settingsDialog'),
    breakButtons: qsa('#breakDurationPicker button'),
    manageCategoriesBtn: $id('manageCategoriesBtn'),
    categorySummary: $id('categorySummary'),
    soundToggle: $id('soundToggle'),
    notifyToggle: $id('notifyToggle'),
    notificationHint: $id('notificationHint'),
    scheduleDialog: $id('scheduleDialog'),
    scheduleForm: $id('scheduleForm'),
    scheduleDayButtons: qsa('#scheduleDayPicker button'),
    scheduleDurationButtons: qsa('#scheduleDurationPicker button'),
    scheduleOvertimePicker: qsa('#scheduleOvertimePicker button'),
    scheduleCustomMinutes: $id('scheduleCustomMinutes'),
    scheduleTime: $id('scheduleTime'),
    scheduleError: $id('scheduleError'),
    installAppBtn: $id('installAppBtn'),
    installHint: $id('installHint'),
    completeDialog: $id('completeDialog'),
    completionMark: $id('completionMark'),
    completeEyebrow: $id('completeEyebrow'),
    completeTitle: $id('completeTitle'),
    completeSummary: $id('completeSummary'),
    sessionCompleteActions: $id('sessionCompleteActions'),
    sessionCategoryChips: $id('sessionCategoryChips'),
    sessionDetailInput: $id('sessionDetailInput'),
    sessionManageCategoriesBtn: $id('sessionManageCategoriesBtn'),
    breakBtn: $id('breakBtn'),
    againBtn: $id('againBtn'),
    completeClose: $id('completeClose'),
    categoryDialog: $id('categoryDialog'),
    categoryManageList: $id('categoryManageList'),
    categoryForm: $id('categoryForm'),
    categoryNameInput: $id('categoryNameInput'),
    categorySubmitBtn: $id('categorySubmitBtn'),
    categoryColorSwatches: $id('categoryColorSwatches'),
    categoryCancelEdit: $id('categoryCancelEdit'),
    categoryFormLabel: $id('categoryFormLabel'),
    categoryError: $id('categoryError'),
    confirmDialog: $id('confirmDialog'),
    confirmTitle: $id('confirmTitle'),
    confirmMessage: $id('confirmMessage'),
    confirmOk: $id('confirmOk'),
    confirmCancel: $id('confirmCancel'),
    celebrationDialog: $id('celebrationDialog'),
    celebrationSky: $id('celebrationSky'),
    celebrationKicker: $id('celebrationKicker'),
    celebrationGroup: $id('celebrationGroup'),
    celebrationText: $id('celebrationText'),
    celebrationCue: $id('celebrationCue'),
    celebrationMedallionUse: document.querySelector('#celebrationMedallion use'),
    celebrationDoneBtn: $id('celebrationDoneBtn'),
    celebrationAnotherBtn: $id('celebrationAnotherBtn'),
    celebrationSkipBtn: $id('celebrationSkipBtn'),
    celebrationToggle: $id('celebrationToggle'),
    celebrationCount: $id('celebrationCount'),
    celebrationPreviewBtn: $id('celebrationPreviewBtn'),
    toastHost: $id('toastHost'),
  };

  if (!els.focusView || !els.statsView) return;

  /* ---------- Initialization ---------- */

  init();

  function init() {
    enforceStoredNotificationState();
    bindEvents();
    syncSettingsUI();
    syncDurationControl();
    updateGreeting();
    idleQuote = pickQuote('before');
    renderToday();
    renderCheckin();
    renderTimer();
    updateScheduleUI();
    markOverdueOnBoot();
    tick();
    window.setInterval(tick, 500);

    registerServiceWorker();
    updateInstallUI();

    if (!storageAvailable) {
      window.setTimeout(() => {
        toast('浏览器限制了本地保存，本次记录可能在关闭页面后丢失。');
      }, 1100);
    }
  }

  function loadState() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      return freshState();
    }

    if (!raw) return freshState();

    try {
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn('日日新：本地数据读取失败，已使用新的数据。', error);
      return freshState();
    }
  }

  function freshState() {
    return {
      version: 1,
      sessions: [],
      categories: defaultCategories(),
      active: null,
      schedule: null,
      checkins: {},
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  function defaultCategories() {
    return DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (storageAvailable) {
        storageAvailable = false;
        toast('浏览器限制了本地保存，本次记录可能在关闭页面后丢失。');
      }
    }
  }

  function normalizeState(raw) {
    const base = freshState();
    if (!raw || typeof raw !== 'object') return base;

    const settings = raw.settings && typeof raw.settings === 'object' ? { ...base.settings, ...raw.settings } : base.settings;
    const focusMinutes = Number(settings.defaultFocus);
    settings.defaultFocus = Number.isFinite(focusMinutes)
      ? Math.min(180, Math.max(1, Math.round(focusMinutes)))
      : 25;
    settings.breakMinutes = BREAK_PRESETS.includes(Number(settings.breakMinutes)) ? Number(settings.breakMinutes) : 5;
    settings.sound = Boolean(settings.sound);
    settings.notify = Boolean(settings.notify);
    settings.celebration = settings.celebration !== false;

    const sessions = Array.isArray(raw.sessions)
      ? raw.sessions.map(normalizeSession).filter(Boolean)
      : [];
    const categories = normalizeCategories(raw.categories);

    return {
      version: 1,
      sessions,
      categories,
      active: normalizeActive(raw.active),
      schedule: normalizeSchedule(raw.schedule),
      checkins: normalizeCheckins(raw.checkins),
      settings,
    };
  }

  function normalizeCategories(raw) {
    if (!Array.isArray(raw) || !raw.length) return defaultCategories();

    const categories = [];
    const usedIds = new Set();
    const usedNames = new Set();

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const name = String(item.name || '').trim().slice(0, 12);
      if (!name) continue;
      const normalizedName = name.toLocaleLowerCase();
      if (usedNames.has(normalizedName)) continue;

      let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `cat-${uid()}`;
      if (usedIds.has(id)) id = `cat-${uid()}`;
      const color = /^#[0-9a-f]{6}$/i.test(String(item.color || ''))
        ? String(item.color)
        : CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];

      categories.push({ id, name, color });
      usedIds.add(id);
      usedNames.add(normalizedName);

      if (categories.length >= 12) break;
    }

    return categories.length ? categories : defaultCategories();
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const startedAt = Number(raw.startedAt);
    const focusedSeconds = Number(raw.focusedSeconds);
    if (!Number.isFinite(startedAt) || !Number.isFinite(focusedSeconds) || focusedSeconds <= 0) return null;

    let endedAt = Number(raw.endedAt);
    if (!Number.isFinite(endedAt) || endedAt < startedAt) endedAt = startedAt + focusedSeconds * 1000;

    let spans = normalizeSpans(raw.spans);
    if (!spans.length) {
      spans = [{ start: startedAt, end: startedAt + focusedSeconds * 1000 }];
    }

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      mode: 'focus',
      startedAt,
      endedAt,
      plannedSeconds: Math.max(1, Math.round(Number(raw.plannedSeconds) || focusedSeconds)),
      focusedSeconds: Math.max(1, Math.round(focusedSeconds)),
      completed: Boolean(raw.completed),
      source: raw.source === 'scheduled' ? 'scheduled' : 'now',
      categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : null,
      detail: typeof raw.detail === 'string' ? raw.detail.trim().slice(0, 80) : '',
      continueAfterCountdown: Boolean(raw.continueAfterCountdown),
      spans,
    };
  }

  function normalizeSpans(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((span) => {
        if (!span || typeof span !== 'object') return null;
        const start = Number(span.start);
        const end = Number(span.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return { start, end };
      })
      .filter(Boolean);
  }

  function normalizeActive(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.mode !== 'focus' && raw.mode !== 'break') return null;

    const plannedSeconds = Number(raw.plannedSeconds);
    const startedAt = Number(raw.startedAt);
    if (!Number.isFinite(plannedSeconds) || plannedSeconds <= 0) return null;
    if (!Number.isFinite(startedAt)) return null;

    const spans = normalizeSpans(raw.spans);
    let status = raw.status === 'paused' ? 'paused' : 'running';
    let currentSpanStart = Number.isFinite(Number(raw.currentSpanStart)) ? Number(raw.currentSpanStart) : null;

    if (status === 'running' && !currentSpanStart) status = 'paused';
    if (status === 'paused') currentSpanStart = null;

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      mode: raw.mode,
      plannedSeconds: Math.max(1, Math.round(plannedSeconds)),
      source: raw.source === 'scheduled' ? 'scheduled' : 'now',
      startedAt,
      status,
      overtime: Boolean(raw.overtime),
      continueAfterCountdown: Boolean(raw.continueAfterCountdown),
      spans,
      currentSpanStart,
    };
  }

  function normalizeSchedule(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const at = Number(raw.at);
    const minutes = Number(raw.minutes);
    if (!Number.isFinite(at) || !Number.isFinite(minutes) || minutes <= 0) return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      at,
      minutes: Math.min(180, Math.max(1, Math.round(minutes))),
      continueAfterCountdown: Boolean(raw.continueAfterCountdown),
      createdAt: Number(raw.createdAt) || Date.now(),
      overdueNotified: Boolean(raw.overdueNotified),
    };
  }

  function normalizeCheckins(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const result = {};
    for (const [key, value] of Object.entries(raw)) {
      const date = parseDateInputValue(key);
      if (!date || dateKey(date) !== key) continue;
      if (!value || typeof value !== 'object') continue;

      const at = Number(value.at);
      const text = String(value.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!Number.isFinite(at) || !text) continue;

      result[key] = { at, text };
    }

    pruneCheckinMap(result);
    return result;
  }

  function pruneCheckinMap(map) {
    const keys = Object.keys(map).sort();
    while (keys.length > 400) delete map[keys.shift()];
  }

  function pruneCheckins() {
    pruneCheckinMap(state.checkins);
  }

  /* ---------- Quote library ---------- */

  function buildQuoteLibrary(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const library = {};

    for (const group of ['morning', 'before', 'during', 'stuck']) {
      const seen = new Set();
      const list = Array.isArray(source[group]) ? source[group] : [];

      library[group] = list.reduce((quotes, item) => {
        const text = String(item || '').replace(/\s+/g, ' ').trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          quotes.push(text);
        }
        return quotes;
      }, []);

      if (!library[group].length) library[group] = QUOTE_FALLBACK[group].slice();
    }

    return library;
  }

  function pickQuote(group, previous = '') {
    const pool = QUOTES[group] || [];
    if (!pool.length) return '';

    const candidates = pool.length > 1 ? pool.filter((text) => text !== previous) : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  }

  function pickMorningQuote() {
    const pool = QUOTES.morning;
    if (!pool.length) return '';

    const recentKeys = Object.keys(state.checkins).sort().slice(-pool.length);
    const used = new Set(
      recentKeys
        .map((key) => state.checkins[key] && state.checkins[key].text)
        .filter(Boolean)
    );
    const available = pool.filter((text) => !used.has(text));
    const candidates = available.length ? available : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  }

  function checkinStreak() {
    let cursor = startOfDay(new Date());
    if (!state.checkins[dateKey(cursor)]) cursor = addDays(cursor, -1);

    let streak = 0;
    while (state.checkins[dateKey(cursor)] && streak < 3660) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function hasCheckedInToday() {
    return Boolean(state.checkins[dateKey(new Date())]);
  }

  /* ---------- Dates & formatting ---------- */

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date;
  }

  function sameDay(a, b) {
    const first = new Date(a);
    const second = new Date(b);
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function dateKey(value) {
    const date = new Date(value);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatHHMM(value) {
    const date = new Date(value);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function parseDateInputValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function formatClock(totalSeconds) {
    const safe = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }

  function formatDurationCN(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    if (safe <= 0) return '0 分钟';
    const minutes = Math.round(safe / 60);
    if (minutes < 1) return '不足 1 分钟';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} 分钟`;
    return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    if (totalSeconds <= 30) return '马上开始';
    const minutes = Math.ceil(totalSeconds / 60);
    if (minutes < 60) return `还有 ${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours < 24) return rest ? `还有 ${hours} 小时 ${rest} 分` : `还有 ${hours} 小时`;
    return `还有 ${Math.ceil(hours / 24)} 天`;
  }

  function formatScheduleWhen(at) {
    const date = new Date(at);
    const today = new Date();
    let dayLabel;
    if (sameDay(date, today)) dayLabel = '今天';
    else if (sameDay(date, addDays(today, 1))) dayLabel = '明天';
    else if (date.getFullYear() === today.getFullYear()) dayLabel = `${date.getMonth() + 1}月${date.getDate()}日`;
    else dayLabel = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    return `${dayLabel} ${formatHHMM(date)}`;
  }

  function formatDateTimeCSV(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  }

  function uid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (error) {
      /* fall through */
    }
    return `rrx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /* ---------- Timer maths ---------- */

  function totalSpanSeconds(spans) {
    return (spans || []).reduce((total, span) => total + Math.max(0, span.end - span.start) / 1000, 0);
  }

  function getElapsedSeconds(active = state.active, at = Date.now()) {
    if (!active) return 0;
    let milliseconds = 0;
    for (const span of active.spans || []) {
      milliseconds += Math.max(0, span.end - span.start);
    }
    if (active.status === 'running' && active.currentSpanStart != null) {
      milliseconds += Math.max(0, at - active.currentSpanStart);
    }
    return milliseconds / 1000;
  }

  function closeCurrentSpan(active, at) {
    if (!active || active.currentSpanStart == null) return;
    const start = Number(active.currentSpanStart);
    const end = Math.max(start, at);
    if (end > start) active.spans.push({ start, end });
    active.currentSpanStart = null;
  }

  function trimSpans(spans, targetSeconds) {
    let remaining = Math.max(0, targetSeconds);
    const result = [];
    for (const span of spans || []) {
      if (remaining <= 0) break;
      const duration = Math.max(0, (span.end - span.start) / 1000);
      if (duration <= 0) continue;
      const take = Math.min(duration, remaining);
      result.push({ start: span.start, end: span.start + take * 1000 });
      remaining -= take;
    }
    return result;
  }

  /* ---------- Rendering: timer ---------- */

  function renderTimer() {
    const active = state.active;
    const isActive = Boolean(active);
    const isBreak = Boolean(active && active.mode === 'break');
    const isPaused = Boolean(active && active.status === 'paused');
    const isOvertime = Boolean(active && active.mode === 'focus' && active.overtime);

    els.timerCard.classList.toggle('is-running', Boolean(active && active.status === 'running' && !isBreak));
    els.timerCard.classList.toggle('is-paused', isPaused);
    els.timerCard.classList.toggle('is-break', isBreak);
    els.timerCard.classList.toggle('is-overtime', isOvertime);
    els.clockDisplay.classList.toggle('is-overtime', isOvertime);
    els.durationControl.hidden = isActive;
    els.idleActions.hidden = isActive;
    els.runningActions.hidden = !isActive;
    els.idleNote.hidden = isActive;
    if (els.checkinCard) els.checkinCard.hidden = isActive || hasCheckedInToday();

    if (!active) {
      els.timerModeLabel.textContent = '准备专注';
      els.clockCaption.textContent = '准备好，就从现在开始';
      els.focusHeadline.textContent = IDLE_HEADLINE;
      els.pauseBtnLabel.textContent = '暂停';
      setPauseIcon(false);
      updateTimerDisplay();
      renderFocusQuote();
      return;
    }

    if (isBreak) {
      els.timerModeLabel.textContent = isPaused ? '休息已暂停' : '休息中';
      els.clockCaption.textContent = '让眼睛离开屏幕，慢慢呼吸';
      els.focusHeadline.textContent = '让身心，松一松。';
    } else if (isOvertime) {
      els.timerModeLabel.textContent = isPaused ? '正计时已暂停' : '正计时中';
      els.clockCaption.textContent = isPaused
        ? '加时暂停，准备好再继续'
        : '计划已完成，继续积累也很好';
      els.focusHeadline.textContent = '再往前一点，也很好。';
    } else if (isPaused) {
      els.timerModeLabel.textContent = '专注已暂停';
      els.clockCaption.textContent = '停下来也没关系，准备好再继续';
      els.focusHeadline.textContent = '停一下，再继续。';
    } else {
      els.timerModeLabel.textContent = active.source === 'scheduled' ? '预约专注中' : '专注中';
      els.clockCaption.textContent = active.source === 'scheduled'
        ? '这是提前约好的时间，慢慢进入'
        : '只做眼前这一件事，其他先放一放';
      els.focusHeadline.textContent = '只做这一件事。';
    }

    els.pauseBtnLabel.textContent = isPaused ? '继续' : '暂停';
    setPauseIcon(isPaused);
    updateTimerDisplay();
    renderFocusQuote();
  }

  function setPauseIcon(isPaused) {
    if (els.pauseIconUse) els.pauseIconUse.setAttribute('href', isPaused ? '#i-play' : '#i-pause');
  }

  function updateTimerDisplay() {
    const active = state.active;
    const plannedSeconds = active ? active.plannedSeconds : state.settings.defaultFocus * 60;
    const elapsed = active ? getElapsedSeconds(active) : 0;
    const isOvertime = Boolean(active && active.mode === 'focus' && active.overtime);
    let clockText;
    let fraction;

    if (isOvertime) {
      const overtimeSeconds = Math.max(0, elapsed - plannedSeconds);
      clockText = `+${formatClock(overtimeSeconds)}`;
      fraction = 1;
      const overtimeCeil = Math.max(0, Math.ceil(overtimeSeconds));
      els.clockDisplay.setAttribute(
        'aria-label',
        `已加时 ${Math.floor(overtimeCeil / 60)} 分 ${overtimeCeil % 60} 秒`
      );
    } else {
      const remaining = active ? Math.max(0, plannedSeconds - elapsed) : plannedSeconds;
      fraction = plannedSeconds > 0 ? Math.max(0, Math.min(1, remaining / plannedSeconds)) : 1;
      clockText = formatClock(remaining);
      const ariaRemaining = Math.max(0, Math.ceil(remaining));
      els.clockDisplay.setAttribute(
        'aria-label',
        active
          ? `剩余 ${Math.floor(ariaRemaining / 60)} 分 ${ariaRemaining % 60} 秒`
          : `${state.settings.defaultFocus} 分钟`
      );
    }

    if (els.clockDisplay.textContent !== clockText) els.clockDisplay.textContent = clockText;

    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    els.progressRing.style.strokeDashoffset = offset.toFixed(2);

    let title;
    if (active) {
      const label = isOvertime
        ? (active.status === 'paused' ? '正计时暂停' : '正计时中')
        : active.status === 'paused'
          ? (active.mode === 'break' ? '休息暂停' : '专注暂停')
          : (active.mode === 'break' ? '休息中' : '专注中');
      title = `${clockText} · ${label} | 日日新`;
    } else if (currentView === 'stats') {
      title = '专注统计 · 日日新';
    } else {
      title = '日日新 · 专注时钟';
    }

    if (title !== lastTitle) {
      document.title = title;
      lastTitle = title;
    }
  }

  function syncDurationControl() {
    if (!els.durationControl) return;
    const minutes = state.settings.defaultFocus;
    els.durationControlValue.textContent = String(minutes);
    els.durationControl.setAttribute('aria-label', `选择专注时长，当前 ${minutes} 分钟`);
  }

  function syncDurationDialogSelection(value = durationDraft) {
    els.durationPresetButtons.forEach((button) => {
      const selected = Number(button.dataset.minutes) === Number(value);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function setSelected(buttons, value) {
    buttons.forEach((button) => {
      const selected = Number(button.dataset.minutes) === Number(value);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  /* ---------- Rendering: today ---------- */

  function renderToday() {
    const dayStart = startOfDay(new Date()).getTime();
    const dayEnd = addDays(new Date(dayStart), 1).getTime();

    let seconds = 0;
    let starts = 0;
    let completed = 0;

    for (const session of state.sessions) {
      if (session.startedAt >= dayStart && session.startedAt < dayEnd) {
        starts += 1;
        if (session.completed) completed += 1;
      }
      seconds += secondsInRange(session, dayStart, dayEnd);
    }

    els.todayMinutes.textContent = String(Math.round(seconds / 60));
    els.todayStarts.textContent = String(starts);
    els.todayCompleted.textContent = String(completed);
  }

  function secondsInRange(session, start, end) {
    let seconds = 0;
    for (const span of session.spans || []) {
      const from = Math.max(span.start, start);
      const to = Math.min(span.end, end);
      if (to > from) seconds += (to - from) / 1000;
    }
    return seconds;
  }

  /* ---------- Morning check-in ---------- */

  function renderCheckin() {
    if (!els.checkinCard) return;

    const now = new Date();
    const checked = Boolean(state.checkins[dateKey(now)]);

    els.checkinCard.hidden = checked || Boolean(state.active);
    if (checked) return;

    const streak = checkinStreak();
    const hour = now.getHours();
    els.checkinTitle.textContent = hour >= 5 && hour < 11 ? '早安打卡' : '今日打卡';
    els.checkinBtn.hidden = false;
    els.checkinHint.textContent = streak > 0
      ? `已经连续打卡 ${streak} 天，今天也来一句。`
      : '每天一句，给自己一个开始。';
  }

  function checkIn() {
    const now = new Date();
    const key = dateKey(now);
    if (state.checkins[key]) {
      renderCheckin();
      return;
    }

    const text = pickMorningQuote();
    if (!text) {
      toast('还没有可用的打卡句子。');
      return;
    }

    state.checkins[key] = { at: Date.now(), text };
    pruneCheckins();
    saveState();
    renderCheckin();
    showCheckinReveal({
      text,
      at: state.checkins[key].at,
      streak: checkinStreak(),
    });
  }

  function showCheckinReveal({ text, at, streak }) {
    if (!els.checkinReveal) return;

    if (checkinRevealTimer) {
      window.clearTimeout(checkinRevealTimer);
      checkinRevealTimer = null;
    }

    checkinRevealClosing = false;
    checkinRevealReturnFocus = els.startNowBtn || document.activeElement;

    const date = new Date(at);
    const hour = new Date().getHours();
    els.checkinRevealTitle.textContent = hour >= 5 && hour < 11 ? '早安，今天' : '今日打卡';
    els.checkinRevealText.textContent = text;
    els.checkinRevealMeta.textContent = `${date.getMonth() + 1}月${date.getDate()}日 · ${
      streak > 1 ? `连续打卡 ${streak} 天` : '连续打卡第 1 天'
    }`;

    els.checkinReveal.hidden = false;
    document.body.classList.add('is-checkin-reveal');
    spawnCheckinSparks();
    void els.checkinReveal.offsetWidth;
    els.checkinReveal.classList.remove('is-leaving');
    els.checkinReveal.classList.add('is-visible');

    window.setTimeout(() => {
      if (!checkinRevealClosing && !els.checkinReveal.hidden && els.checkinRevealClose) {
        els.checkinRevealClose.focus();
      }
    }, 80);

    checkinRevealTimer = window.setTimeout(() => {
      hideCheckinReveal();
    }, prefersReducedMotion() ? 4200 : 6200);
  }

  function hideCheckinReveal() {
    if (!els.checkinReveal || els.checkinReveal.hidden || checkinRevealClosing) return;

    checkinRevealClosing = true;
    if (checkinRevealTimer) {
      window.clearTimeout(checkinRevealTimer);
      checkinRevealTimer = null;
    }

    els.checkinReveal.classList.remove('is-visible');
    els.checkinReveal.classList.add('is-leaving');

    window.setTimeout(() => {
      els.checkinReveal.hidden = true;
      els.checkinReveal.classList.remove('is-leaving');
      if (els.checkinRevealSparks) els.checkinRevealSparks.textContent = '';
      document.body.classList.remove('is-checkin-reveal');
      checkinRevealClosing = false;

      const target = checkinRevealReturnFocus;
      checkinRevealReturnFocus = null;
      if (
        target &&
        target.isConnected &&
        target.getClientRects().length &&
        typeof target.focus === 'function'
      ) {
        target.focus();
      } else if (els.startNowBtn) {
        els.startNowBtn.focus();
      }
    }, prefersReducedMotion() ? 0 : 320);
  }

  function spawnCheckinSparks() {
    const host = els.checkinRevealSparks;
    if (!host) return;

    host.textContent = '';
    if (prefersReducedMotion()) return;

    const fragment = document.createDocumentFragment();
    const count = window.innerWidth < 640 ? 10 : 16;

    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement('i');
      spark.className = 'checkin-spark';
      spark.style.left = `${6 + Math.random() * 88}%`;
      spark.style.top = `${22 + Math.random() * 58}%`;
      spark.style.setProperty('--size', `${2 + Math.random() * 4}px`);
      spark.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 70}px`);
      spark.style.setProperty('--delay', `${Math.random() * 0.9}s`);
      spark.style.setProperty('--duration', `${3.2 + Math.random() * 2.6}s`);
      fragment.appendChild(spark);
    }

    host.appendChild(fragment);
  }

  /* ---------- Focus encouragement ---------- */

  function renderFocusQuote() {
    if (!els.focusQuote) return;

    if (
      (els.celebrationDialog && els.celebrationDialog.open) ||
      (els.completeDialog && els.completeDialog.open)
    ) {
      els.focusQuote.hidden = true;
      return;
    }

    const active = state.active;
    if (active && active.mode === 'break') {
      els.focusQuote.hidden = true;
      return;
    }

    let text;
    let tag;
    let canRefresh = false;

    if (!active) {
      if (!idleQuote) idleQuote = pickQuote('before');
      text = idleQuote;
      tag = '开始前';
      canRefresh = true;
    } else if (active.status === 'paused') {
      if (!pauseQuote) pauseQuote = pickQuote('stuck', sessionQuote);
      text = pauseQuote;
      tag = '暂停时';
    } else {
      if (!sessionQuote) sessionQuote = pickQuote('during');
      text = sessionQuote;
      tag = active.overtime ? '正计时中' : '专注中';
    }

    if (!text) {
      els.focusQuote.hidden = true;
      return;
    }

    els.focusQuote.hidden = false;
    els.focusQuoteText.textContent = `「${text}」`;
    els.focusQuoteTag.textContent = tag;
    els.focusQuoteNext.hidden = !canRefresh;
  }

  function refreshIdleQuote() {
    idleQuote = pickQuote('before', idleQuote);
    if (!state.active) renderFocusQuote();
  }

  /* ---------- Duration dialog ---------- */

  function openDurationDialog() {
    durationDraft = state.settings.defaultFocus;
    els.customMinutes.value = String(durationDraft);
    els.durationError.hidden = true;
    els.durationError.textContent = '';
    syncDurationDialogSelection();
    openDialog(els.durationDialog);
  }

  function setDurationDraft(minutes) {
    const value = Math.max(1, Math.min(180, Math.round(Number(minutes) || state.settings.defaultFocus)));
    durationDraft = value;
    els.customMinutes.value = String(value);
    els.durationError.hidden = true;
    syncDurationDialogSelection(value);
  }

  function readCustomDurationInput() {
    const raw = String(els.customMinutes.value || '').trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function handleCustomDurationInput() {
    const value = readCustomDurationInput();
    els.durationError.hidden = true;

    if (value === null) {
      durationDraft = null;
      syncDurationDialogSelection(-1);
      return;
    }

    durationDraft = value;
    syncDurationDialogSelection(value);
  }

  function adjustCustomDuration(delta) {
    const current = readCustomDurationInput();
    const base = current === null ? state.settings.defaultFocus : current;
    setDurationDraft(base + delta);
  }

  function submitDuration(event) {
    event.preventDefault();
    const raw = readCustomDurationInput();
    const minutes = raw === null ? NaN : Math.round(raw);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      els.durationError.textContent = '专注时长需要在 1–180 分钟之间。';
      els.durationError.hidden = false;
      return;
    }

    state.settings.defaultFocus = minutes;
    saveState();
    syncDurationControl();
    if (!state.active) updateTimerDisplay();
    closeDialog(els.durationDialog);
    toast(`专注时长设为 ${minutes} 分钟。`);
  }

  /* ---------- Start dialog ---------- */

  function openStartDialog({ minutes = state.settings.defaultFocus, continueAfterCountdown = false } = {}) {
    if (state.active) return;
    startDialogMinutes = Math.min(180, Math.max(1, Math.round(Number(minutes) || state.settings.defaultFocus)));
    startDialogContinue = Boolean(continueAfterCountdown);
    els.startDurationLabel.textContent = `${startDialogMinutes} 分钟`;
    syncStartOvertimeChoice();
    openDialog(els.startDialog);
  }

  function syncStartOvertimeChoice() {
    els.startOvertimePicker.forEach((button) => {
      const selected = (button.dataset.value === 'true') === startDialogContinue;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    els.startOvertimeHint.textContent = startDialogContinue
      ? '到点不会打断，自动转为正计时；加时也计入统计。'
      : '到点响铃，记录完成后再选择分类。';
  }

  function confirmStartDialog() {
    const minutes = startDialogMinutes;
    const continueAfterCountdown = startDialogContinue;
    closeDialog(els.startDialog);
    startFocus(minutes, 'now', { continueAfterCountdown });
  }

  /* ---------- Timer actions ---------- */

  function startFocus(minutes, source = 'now', { continueAfterCountdown = false } = {}) {
    if (state.active) {
      toast('现在正在一段专注里，先把眼前这一轮完成吧。');
      return;
    }

    const safeMinutes = Math.min(180, Math.max(1, Math.round(Number(minutes) || state.settings.defaultFocus)));
    const now = Date.now();

    state.active = {
      id: uid(),
      mode: 'focus',
      plannedSeconds: Math.round(safeMinutes * 60),
      source: source === 'scheduled' ? 'scheduled' : 'now',
      startedAt: now,
      status: 'running',
      overtime: false,
      continueAfterCountdown: Boolean(continueAfterCountdown),
      spans: [],
      currentSpanStart: now,
    };

    if (state.schedule && (source === 'scheduled' || now >= state.schedule.at)) {
      state.schedule = null;
    }

    sessionQuote = pickQuote('during', sessionQuote);
    pauseQuote = '';

    primeAudio();
    saveState();
    if (currentView !== 'focus') switchView('focus');
    renderTimer();
    updateScheduleUI();
  }

  function startBreak(minutes) {
    if (state.active) return;
    const safeMinutes = Math.min(60, Math.max(1, Math.round(Number(minutes) || state.settings.breakMinutes)));
    const now = Date.now();

    state.active = {
      id: uid(),
      mode: 'break',
      plannedSeconds: Math.round(safeMinutes * 60),
      source: 'now',
      startedAt: now,
      status: 'running',
      overtime: false,
      spans: [],
      currentSpanStart: now,
    };

    sessionQuote = '';
    pauseQuote = '';

    primeAudio();
    saveState();
    if (currentView !== 'focus') switchView('focus');
    renderTimer();
    updateScheduleUI();
  }

  function togglePause() {
    const active = state.active;
    if (!active) return;

    if (active.status === 'running') {
      closeCurrentSpan(active, Date.now());
      active.status = 'paused';
      pauseQuote = active.mode === 'focus' ? pickQuote('stuck', pauseQuote) : '';
    } else {
      active.status = 'running';
      active.currentSpanStart = Date.now();
      pauseQuote = '';
    }

    saveState();
    renderTimer();
  }

  function requestEnd() {
    const active = state.active;
    if (!active) return;

    if (active.mode === 'break') {
      state.active = null;
      sessionQuote = '';
      pauseQuote = '';
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('休息结束，准备回到专注。');
      return;
    }

    const elapsed = getElapsedSeconds(active);
    if (elapsed < 60) {
      state.active = null;
      sessionQuote = '';
      pauseQuote = '';
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('不足 1 分钟，本次不计入统计。');
      return;
    }

    const overtimeSeconds = active.overtime ? Math.max(0, elapsed - active.plannedSeconds) : 0;
    const overtimeNote = overtimeSeconds >= 30
      ? `（含加时 ${formatDurationCN(overtimeSeconds)}）`
      : '';
    const afterCopy = state.settings.celebration === false
      ? '结束后会记入统计，并让你选择专注分类。'
      : '结束后会先庆祝一下，再记入统计，并让你选择专注分类。';

    openConfirm({
      title: active.overtime ? '结束这次正计时？' : '提前结束专注？',
      message: `已经专注 ${formatDurationCN(elapsed)}${overtimeNote}。${afterCopy}`,
      okLabel: '结束并记录',
      onOk: () => completeActive({ auto: false }),
    });
  }

  function completeActive({ auto = false } = {}) {
    const active = state.active;
    if (!active) return;

    if (active.mode === 'break') {
      const now = Date.now();
      closeCurrentSpan(active, now);
      state.active = null;
      sessionQuote = '';
      pauseQuote = '';
      saveState();
      renderTimer();
      updateScheduleUI();
      if (state.settings.sound) playChime();
      toast('休息结束，慢慢回到专注。');
      sendNotification('休息结束', '准备好，就再开始一轮。');
      return;
    }

    const now = Date.now();
    closeCurrentSpan(active, now);
    const rawElapsed = getElapsedSeconds(active, now);
    const plannedSeconds = active.plannedSeconds;
    const isOvertime = Boolean(active.overtime);
    const completed = auto || rawElapsed >= plannedSeconds - 0.4;

    if (!completed && rawElapsed < 60) {
      state.active = null;
      sessionQuote = '';
      pauseQuote = '';
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('不足 1 分钟，本次不计入统计。');
      return;
    }

    let focusedSeconds;
    let spans;

    if (completed) {
      focusedSeconds = isOvertime
        ? Math.max(plannedSeconds, Math.round(rawElapsed))
        : plannedSeconds;
      spans = trimSpans(active.spans, focusedSeconds);
    } else {
      focusedSeconds = Math.max(1, Math.round(rawElapsed));
      spans = active.spans.map((span) => ({ ...span }));
    }

    const endedAt = spans.length ? spans[spans.length - 1].end : now;

    const session = {
      id: active.id,
      mode: 'focus',
      startedAt: active.startedAt,
      endedAt,
      plannedSeconds,
      focusedSeconds,
      completed,
      source: active.source,
      categoryId: null,
      detail: '',
      continueAfterCountdown: Boolean(active.continueAfterCountdown),
      spans,
    };

    state.sessions.push(session);
    state.active = null;
    sessionQuote = '';
    pauseQuote = '';
    lastCompletionMinutes = Math.round(plannedSeconds / 60);
    lastCompletionContinueAfterCountdown = Boolean(active.continueAfterCountdown);

    if (state.schedule && now >= state.schedule.at) {
      state.schedule.overdueNotified = true;
    }

    saveState();
    renderTimer();
    renderToday();
    updateScheduleUI();

    if (!els.statsView.hidden) renderStats();

    if (auto) {
      if (state.settings.sound) playChime();
      sendNotification('专注完成', `这一轮 ${formatDurationCN(focusedSeconds)}，起来活动一下吧。`);
    }

    celebrateAfterFocus(session, { auto, edit: false });
  }

  function showSessionDialog(session, { auto = false, edit = false } = {}) {
    if (!session) return;
    closeAllDialogs(els.completeDialog);

    currentSessionId = session.id;
    const overtimeSeconds = Math.max(0, session.focusedSeconds - session.plannedSeconds);
    const overtimeCopy = overtimeSeconds >= 30 ? `（含加时 ${formatDurationCN(overtimeSeconds)}）` : '';
    const partial = !edit && !session.completed;

    els.completeDialog.classList.toggle('is-editing', edit);
    els.completionMark.style.display = edit ? 'none' : '';
    els.sessionCompleteActions.hidden = edit || partial;
    els.completeClose.className = edit || partial ? 'btn btn-primary' : 'dialog-dismiss';
    els.completeClose.textContent = '保存并关闭';

    if (edit) {
      els.completeEyebrow.textContent = '修改记录';
      els.completeTitle.textContent = '这条专注记录';
      els.completeSummary.textContent = `${formatRecordRange(session)} · ${formatDurationCN(session.focusedSeconds)}${overtimeCopy}`;
    } else if (auto) {
      els.completeEyebrow.textContent = '专注完成';
      els.completeTitle.textContent = '这一轮，完成了。';
      els.completeSummary.textContent = `专注了 ${formatDurationCN(session.focusedSeconds)}${overtimeCopy}。给它归个类吧。`;
    } else if (session.completed) {
      els.completeEyebrow.textContent = '专注结束';
      els.completeTitle.textContent = '这一轮，完成了。';
      els.completeSummary.textContent = `专注了 ${formatDurationCN(session.focusedSeconds)}${overtimeCopy}。给它归个类吧。`;
    } else {
      els.completeEyebrow.textContent = '专注结束';
      els.completeTitle.textContent = '这一轮，先到这里。';
      els.completeSummary.textContent = `专注了 ${formatDurationCN(session.focusedSeconds)}。给它归个类，统计会更清楚。`;
    }

    els.breakBtn.textContent = `休息 ${state.settings.breakMinutes} 分钟`;
    els.sessionDetailInput.value = session.detail || '';
    renderSessionCategoryChips();

    if (!els.completeDialog.open) {
      try {
        els.completeDialog.showModal();
      } catch (error) {
        toast('记录已保存，分类窗口打开失败。');
      }
    }
    renderFocusQuote();
  }

  /* ---------- Session classification ---------- */

  function getCurrentSession() {
    if (!currentSessionId) return null;
    return state.sessions.find((session) => session.id === currentSessionId) || null;
  }

  function renderSessionCategoryChips() {
    const session = getCurrentSession();
    if (!session || !els.sessionCategoryChips) return;

    const selected = session.categoryId && getCategoryById(session.categoryId)
      ? session.categoryId
      : UNCATEGORIZED_KEY;

    const chips = state.categories.map((category) => `
      <button class="category-chip${selected === category.id ? ' is-selected' : ''}" type="button" data-session-category="${escapeHTML(category.id)}" aria-pressed="${selected === category.id}">
        <span class="category-dot" style="background:${category.color}"></span>
        ${escapeHTML(category.name)}
      </button>
    `);

    chips.push(`
      <button class="category-chip${selected === UNCATEGORIZED_KEY ? ' is-selected' : ''}" type="button" data-session-category="${UNCATEGORIZED_KEY}" aria-pressed="${selected === UNCATEGORIZED_KEY}">
        <span class="category-dot" style="background:${UNCATEGORIZED_COLOR}"></span>
        ${UNCATEGORIZED_NAME}
      </button>
    `);

    els.sessionCategoryChips.innerHTML = chips.join('');
  }

  function setSessionCategory(key) {
    const session = getCurrentSession();
    if (!session) return;
    session.categoryId = key === UNCATEGORIZED_KEY ? null : key;
    saveState();
    renderSessionCategoryChips();
  }

  function commitSessionDialog() {
    const session = getCurrentSession();
    if (!session) return;

    const detail = String(els.sessionDetailInput.value || '').trim().slice(0, 80);
    if (session.detail !== detail) {
      session.detail = detail;
      saveState();
    }

    currentSessionId = null;
    if (!els.statsView.hidden) renderStats();
  }

  function openSessionEditor(sessionId) {
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    showSessionDialog(session, { edit: true });
  }

  /* ---------- Post-focus celebration ---------- */

  function celebrationList() {
    const list = Array.isArray(window.RRX_CELEBRATIONS) ? window.RRX_CELEBRATIONS : [];
    return list.filter((item) => item && typeof item.text === 'string' && item.text.trim());
  }

  function celebrationGroupMeta(key) {
    const groups = window.RRX_CELEBRATION_GROUPS;
    const meta = groups && typeof groups === 'object' ? groups[key] : null;
    return meta && typeof meta === 'object'
      ? { ...FALLBACK_CELEBRATION_GROUP, ...meta }
      : FALLBACK_CELEBRATION_GROUP;
  }

  function pickCelebration() {
    let pool = celebrationList();
    if (!pool.length) pool = FALLBACK_CELEBRATIONS.slice();
    if (!pool.length) return null;

    const keyOf = (entry) => String(entry.id != null ? entry.id : entry.text);
    const recent = new Set(celebrationHistory);
    let candidates = pool.filter((item) => !recent.has(keyOf(item)));
    if (!candidates.length) {
      celebrationHistory = [];
      candidates = pool;
    }

    const item = candidates[Math.floor(Math.random() * candidates.length)];
    celebrationHistory.push(keyOf(item));
    if (celebrationHistory.length > 12) celebrationHistory = celebrationHistory.slice(-12);
    return item;
  }

  function celebrationSessionKicker(session) {
    if (!session) return '专注结束';
    const overtime = Math.max(0, session.focusedSeconds - session.plannedSeconds);
    const overtimeCopy = overtime >= 30 ? ` · 加时 ${formatDurationCN(overtime)}` : '';
    return `专注 ${formatDurationCN(session.focusedSeconds)}${overtimeCopy} · ${session.completed ? '完成' : '提前结束'}`;
  }

  function renderCelebration(item) {
    if (!item || !els.celebrationDialog) return;
    const group = celebrationGroupMeta(item.group);
    els.celebrationDialog.dataset.group = String(item.group || '');
    els.celebrationDialog.style.setProperty('--celebration-accent', group.color);
    els.celebrationGroup.textContent = item.group ? `${item.group} · ${group.name}` : group.name;
    els.celebrationText.textContent = item.text;
    els.celebrationCue.textContent = group.cue;
    if (els.celebrationMedallionUse) {
      els.celebrationMedallionUse.setAttribute('href', `#i-${group.icon || 'sparkles'}`);
    }
  }

  function openCelebration({ session = null, preview = false, onDone = null } = {}) {
    if (!els.celebrationDialog) return false;
    const item = pickCelebration();
    if (!item) return false;

    if (celebrationCloseTimer) {
      window.clearTimeout(celebrationCloseTimer);
      celebrationCloseTimer = null;
    }

    celebrationPreview = Boolean(preview);
    celebrationOnDone = typeof onDone === 'function' ? onDone : null;

    els.celebrationDialog.classList.remove('is-closing');
    els.celebrationKicker.textContent = preview
      ? `随机预览 · 共 ${celebrationList().length || FALLBACK_CELEBRATIONS.length} 种`
      : celebrationSessionKicker(session);
    els.celebrationDoneBtn.textContent = preview ? '知道了' : '我庆祝完了';
    els.celebrationSkipBtn.hidden = preview;
    renderCelebration(item);

    if (!preview) closeAllDialogs(els.celebrationDialog);
    if (!els.celebrationDialog.open) {
      celebrationReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    openDialog(els.celebrationDialog);
    renderFocusQuote();
    document.body.classList.add('is-celebrating');
    spawnCelebrationConfetti();

    window.setTimeout(() => {
      if (els.celebrationDialog.open) els.celebrationDoneBtn.focus();
    }, 60);

    return true;
  }

  function celebrateAfterFocus(session, options = {}) {
    if (state.settings.celebration === false) {
      showSessionDialog(session, options);
      return;
    }

    const opened = openCelebration({
      session,
      onDone: () => showSessionDialog(session, options),
    });
    if (!opened) showSessionDialog(session, options);
  }

  function finishCelebration() {
    const dialog = els.celebrationDialog;
    if (!dialog || !dialog.open || dialog.classList.contains('is-closing')) return;

    dialog.classList.add('is-closing');
    const wait = prefersReducedMotion() ? 0 : 200;
    celebrationCloseTimer = window.setTimeout(() => {
      celebrationCloseTimer = null;
      closeDialog(dialog);
    }, wait);
  }

  function rerollCelebration() {
    const dialog = els.celebrationDialog;
    if (!dialog || !dialog.open || dialog.classList.contains('is-closing')) return;

    const item = pickCelebration();
    if (!item) return;

    renderCelebration(item);
    els.celebrationText.classList.remove('is-swapping');
    void els.celebrationText.offsetWidth;
    els.celebrationText.classList.add('is-swapping');
    window.setTimeout(() => els.celebrationText.classList.remove('is-swapping'), 450);
    spawnCelebrationConfetti();
  }

  function handleCelebrationClosed() {
    if (!els.celebrationDialog) return;

    if (celebrationCloseTimer) {
      window.clearTimeout(celebrationCloseTimer);
      celebrationCloseTimer = null;
    }

    els.celebrationDialog.classList.remove('is-closing');
    document.body.classList.remove('is-celebrating');
    if (els.celebrationSky) els.celebrationSky.textContent = '';

    const done = celebrationOnDone;
    const wasPreview = celebrationPreview;
    const target = celebrationReturnFocus;
    celebrationOnDone = null;
    celebrationPreview = false;
    celebrationReturnFocus = null;
    if (typeof done === 'function') {
      done();
    } else if (wasPreview && target && target.isConnected && typeof target.focus === 'function') {
      target.focus();
    }
    renderFocusQuote();
  }

  function prefersReducedMotion() {
    return window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  }

  function spawnCelebrationConfetti() {
    const sky = els.celebrationSky;
    if (!sky) return;

    sky.textContent = '';
    if (prefersReducedMotion()) return;

    const group = celebrationGroupMeta(els.celebrationDialog.dataset.group);
    const palette = [group.color, '#f6dfa6', '#eab7a0', '#a9c9b1', '#fbf2dc', '#cf9a5d'];
    const compact = window.innerWidth < 640;
    const count = compact ? 22 : 36;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement('i');
      piece.className = 'confetti';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${4 + Math.random() * 5}px`;
      piece.style.height = `${6 + Math.random() * 7}px`;
      piece.style.background = palette[index % palette.length];
      piece.style.borderRadius = Math.random() > 0.72 ? '50%' : '2px';
      piece.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 140}px`);
      piece.style.setProperty('--spin', `${Math.round((Math.random() * 2 - 1) * 900)}deg`);
      piece.style.setProperty('--duration', `${5 + Math.random() * 4}s`);
      piece.style.setProperty('--delay', `${-Math.random() * 9}s`);
      fragment.appendChild(piece);
    }

    const sparks = compact ? 5 : 8;
    for (let index = 0; index < sparks; index += 1) {
      const spark = document.createElement('i');
      spark.className = 'celebration-spark';
      spark.style.left = `${8 + Math.random() * 84}%`;
      spark.style.setProperty('--size', `${2 + Math.random() * 3}px`);
      spark.style.setProperty('--duration', `${5 + Math.random() * 4}s`);
      spark.style.setProperty('--delay', `${-Math.random() * 6}s`);
      fragment.appendChild(spark);
    }

    sky.appendChild(fragment);
  }

  /* ---------- Category manager ---------- */

  function syncCategorySummary() {
    if (!els.categorySummary) return;
    els.categorySummary.textContent = state.categories.length
      ? state.categories.map((category) => category.name).join('、')
      : '还没有分类';
  }

  function openCategoryDialog() {
    categoryEditingId = null;
    resetCategoryForm();
    renderCategoryManager();
    openDialog(els.categoryDialog);
  }

  function resetCategoryForm() {
    categoryEditingId = null;
    categoryDraftColor = CATEGORY_COLORS.find((color) =>
      !state.categories.some((category) => category.color === color)
    ) || CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length];
    els.categoryNameInput.value = '';
    els.categoryFormLabel.textContent = '添加分类';
    els.categorySubmitBtn.textContent = '添加';
    els.categoryCancelEdit.hidden = true;
    els.categoryError.hidden = true;
    els.categoryError.textContent = '';
    renderCategoryColorSwatches();
  }

  function renderCategoryColorSwatches() {
    els.categoryColorSwatches.innerHTML = CATEGORY_COLORS.map((color) => `
      <button class="color-swatch${color === categoryDraftColor ? ' is-selected' : ''}" type="button" data-color="${color}" style="background:${color}" aria-label="选择颜色 ${color}" aria-pressed="${color === categoryDraftColor}"></button>
    `).join('');
  }

  function renderCategoryManager() {
    if (!els.categoryManageList) return;

    if (!state.categories.length) {
      els.categoryManageList.innerHTML = '<div class="category-empty">还没有分类，先添加一个吧。</div>';
    } else {
      els.categoryManageList.innerHTML = state.categories.map((category) => {
        const usage = state.sessions.filter((session) => session.categoryId === category.id).length;
        return `
          <div class="category-manage-row">
            <span class="category-dot" style="background:${category.color}"></span>
            <button class="category-manage-name" type="button" data-edit-category="${escapeHTML(category.id)}"><span>${escapeHTML(category.name)}</span></button>
            <span class="category-manage-usage">${usage} 次</span>
            <button class="category-manage-delete" type="button" data-delete-category="${escapeHTML(category.id)}" aria-label="删除 ${escapeHTML(category.name)}" title="删除分类">
              <svg class="icon" aria-hidden="true"><use href="#i-x"></use></svg>
            </button>
          </div>
        `;
      }).join('');
    }

    renderCategoryColorSwatches();
  }

  function beginCategoryEdit(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return;
    categoryEditingId = category.id;
    categoryDraftColor = category.color;
    els.categoryNameInput.value = category.name;
    els.categoryFormLabel.textContent = '修改分类';
    els.categorySubmitBtn.textContent = '保存修改';
    els.categoryCancelEdit.hidden = false;
    els.categoryError.hidden = true;
    renderCategoryColorSwatches();
    els.categoryNameInput.focus();
  }

  function submitCategory(event) {
    event.preventDefault();
    const name = String(els.categoryNameInput.value || '').trim().slice(0, 12);
    if (!name) {
      els.categoryError.textContent = '先给分类起个名字吧。';
      els.categoryError.hidden = false;
      return;
    }

    const duplicate = state.categories.some((category) =>
      category.id !== categoryEditingId &&
      category.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (duplicate) {
      els.categoryError.textContent = '这个分类已经存在了。';
      els.categoryError.hidden = false;
      return;
    }

    if (!categoryEditingId && state.categories.length >= 12) {
      els.categoryError.textContent = '最多可以添加 12 个分类。';
      els.categoryError.hidden = false;
      return;
    }

    if (categoryEditingId) {
      const category = getCategoryById(categoryEditingId);
      if (category) {
        category.name = name;
        category.color = categoryDraftColor;
        toast('分类已更新。');
      }
    } else {
      state.categories.push({
        id: `cat-${uid()}`,
        name,
        color: categoryDraftColor,
      });
      toast('分类已添加。');
    }

    saveState();
    syncCategorySummary();
    renderCategoryManager();
    if (!els.statsView.hidden) renderStats();
    renderSessionCategoryChips();
    resetCategoryForm();
  }

  function deleteCategory(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return;
    if (state.categories.length <= 1) {
      toast('至少保留一个分类。');
      return;
    }

    const usage = state.sessions.filter((session) => session.categoryId === category.id).length;
    openConfirm({
      title: `删除「${category.name}」？`,
      message: usage
        ? `有 ${usage} 条专注记录正在使用这个分类，删除后会归入「未分类」。`
        : '删除后可以从头重新建立，确定删除吗？',
      okLabel: '删除分类',
      onOk: () => {
        state.categories = state.categories.filter((item) => item.id !== category.id);
        state.sessions.forEach((session) => {
          if (session.categoryId === category.id) session.categoryId = null;
        });
        if (selectedDailyCategoryId === category.id) selectedDailyCategoryId = null;
        if (categoryEditingId === category.id) resetCategoryForm();
        saveState();
        syncCategorySummary();
        renderCategoryManager();
        renderSessionCategoryChips();
        if (!els.statsView.hidden) renderStats();
        toast('分类已删除。');
      },
    });
  }

  /* ---------- Schedule ---------- */

  function defaultScheduleDraft() {
    const now = new Date();
    const target = new Date(now.getTime() + 30 * 60 * 1000);
    target.setSeconds(0, 0);
    const rest = target.getMinutes() % 5;
    if (rest) target.setMinutes(target.getMinutes() + (5 - rest));

    const day = sameDay(target, now) ? 'today' : 'tomorrow';
    return {
      day,
      time: formatHHMM(target),
      minutes: state.settings.defaultFocus,
      continueAfterCountdown: false,
    };
  }

  function openScheduleDialog() {
    scheduleDraft = defaultScheduleDraft();
    els.scheduleTime.value = scheduleDraft.time;
    els.scheduleCustomMinutes.value = String(scheduleDraft.minutes);
    els.scheduleError.hidden = true;
    els.scheduleError.textContent = '';
    syncScheduleDraftUI();
    openDialog(els.scheduleDialog);
  }

  function syncScheduleDraftUI() {
    els.scheduleDayButtons.forEach((button) => {
      const selected = button.dataset.day === scheduleDraft.day;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (document.activeElement !== els.scheduleCustomMinutes) {
      els.scheduleCustomMinutes.value = String(scheduleDraft.minutes);
    }
    setSelected(els.scheduleDurationButtons, scheduleDraft.minutes);
    els.scheduleOvertimePicker.forEach((button) => {
      const selected = (button.dataset.value === 'true') === Boolean(scheduleDraft.continueAfterCountdown);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function handleScheduleDayChange(day) {
    scheduleDraft.day = day;

    if (day === 'today') {
      const now = new Date();
      const current = parseTimeValue(els.scheduleTime.value, now);
      if (!current || current.getTime() <= now.getTime() + 60000) {
        let candidate = new Date(now.getTime() + 30 * 60 * 1000);
        if (!sameDay(candidate, now)) {
          candidate = new Date(now);
          candidate.setHours(23, 59, 0, 0);
        }
        els.scheduleTime.value = formatHHMM(candidate);
      }
    }

    els.scheduleError.hidden = true;
    syncScheduleDraftUI();
  }

  function parseTimeValue(value, baseDate) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function submitSchedule(event) {
    event.preventDefault();
    const time = els.scheduleTime.value;
    const now = new Date();
    const rawDuration = Number(els.scheduleCustomMinutes.value);
    const minutes = Math.round(rawDuration);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      showScheduleError('专注时长需要在 1–180 分钟之间。');
      return;
    }

    scheduleDraft.minutes = minutes;

    if (!time) {
      showScheduleError('请选择一个开始时间。');
      return;
    }

    let target = parseTimeValue(time, now);
    if (!target) {
      showScheduleError('时间格式不对，请重新选择。');
      return;
    }

    if (scheduleDraft.day === 'tomorrow') target = addDays(target, 1);

    if (target.getTime() <= now.getTime() + 15000) {
      showScheduleError('这个时间已经过去了，换一个时间，或者选明天吧。');
      return;
    }

    state.schedule = {
      id: uid(),
      at: target.getTime(),
      minutes,
      continueAfterCountdown: Boolean(scheduleDraft.continueAfterCountdown),
      createdAt: Date.now(),
      overdueNotified: false,
    };

    saveState();
    updateScheduleUI();
    closeDialog(els.scheduleDialog);
    toast(`已预约 ${formatScheduleWhen(target.getTime())} · ${minutes} 分钟专注。`);
  }

  function showScheduleError(message) {
    els.scheduleError.textContent = message;
    els.scheduleError.hidden = false;
  }

  function updateScheduleUI() {
    const schedule = state.schedule;
    if (!schedule) {
      els.scheduleStrip.hidden = true;
      els.scheduleStartBtn.hidden = true;
      return;
    }

    const now = Date.now();
    const due = now >= schedule.at;
    els.scheduleStrip.hidden = false;
    els.scheduleStrip.classList.toggle('is-overdue', due);

    if (due) {
      els.scheduleTitle.textContent = '预约时间已到';
      els.scheduleMeta.textContent = state.active
        ? '先完成当前这一轮，再开始也可以'
        : `${formatScheduleWhen(schedule.at)} · ${schedule.minutes} 分钟${schedule.continueAfterCountdown ? ' · 正计时' : ''}，现在开始吗？`;
      els.scheduleStartBtn.hidden = Boolean(state.active);
    } else {
      els.scheduleTitle.textContent = `已预约 ${formatScheduleWhen(schedule.at)}`;
      els.scheduleMeta.textContent = `${formatCountdown(schedule.at - now)} · ${schedule.minutes} 分钟专注${schedule.continueAfterCountdown ? ' · 继续正计时' : ''}`;
      els.scheduleStartBtn.hidden = true;
    }
  }

  function startScheduledFocus() {
    const schedule = state.schedule;
    if (!schedule) return;
    if (state.active) {
      toast('先完成当前这一轮，再开始预约的专注。');
      return;
    }
    const minutes = schedule.minutes;
    const continueAfterCountdown = Boolean(schedule.continueAfterCountdown);
    state.schedule = null;
    startFocus(minutes, 'scheduled', { continueAfterCountdown });
    toast(`预约的 ${minutes} 分钟专注，开始了。`);
  }

  function cancelSchedule() {
    if (!state.schedule) return;
    state.schedule = null;
    saveState();
    updateScheduleUI();
    toast('预约已取消。');
  }

  function checkScheduleAutoStart() {
    const schedule = state.schedule;
    if (!schedule || schedule.overdueNotified) return;
    if (els.celebrationDialog && els.celebrationDialog.open) return;
    if (els.checkinReveal && !els.checkinReveal.hidden) return;

    const now = Date.now();
    if (now < schedule.at) return;

    if (state.active) {
      schedule.overdueNotified = true;
      saveState();
      updateScheduleUI();
      toast('预约时间到了，先完成眼前的专注。');
      sendNotification('预约时间到了', '先完成眼前的专注，之后再开始也可以。');
      return;
    }

    if (schedule.at < bootAt - 1000) {
      schedule.overdueNotified = true;
      saveState();
      updateScheduleUI();
      return;
    }

    if (document.querySelector('dialog[open]')) {
      schedule.overdueNotified = true;
      saveState();
      updateScheduleUI();
      sendNotification('预约时间到了', '现在可以开始这段专注。');
      return;
    }

    if (now - schedule.at > 2 * 60 * 1000) {
      schedule.overdueNotified = true;
      saveState();
      updateScheduleUI();
      toast('预约时间已经过了，现在开始也可以。');
      sendNotification('预约时间到了', '现在可以开始这段专注。');
      return;
    }

    const minutes = schedule.minutes;
    const continueAfterCountdown = Boolean(schedule.continueAfterCountdown);
    state.schedule = null;
    startFocus(minutes, 'scheduled', { continueAfterCountdown });
    toast('预约时间到，专注开始。');
    sendNotification('专注开始', '这是你提前约好的时间，慢慢进入。');
  }

  function markOverdueOnBoot() {
    if (!state.schedule) return;
    if (Date.now() < state.schedule.at) return;

    state.schedule.overdueNotified = true;
    saveState();
    window.setTimeout(() => {
      if (!state.schedule) return;
      toast(state.active ? '预约时间已到，先完成当前专注。' : '预约时间已到，现在开始吗？');
    }, 700);
  }

  /* ---------- Stats ---------- */

  function renderStats() {
    const totalSeconds = state.sessions.reduce((sum, session) => sum + session.focusedSeconds, 0);
    const starts = state.sessions.length;
    const completed = state.sessions.filter((session) => session.completed).length;
    const daily = buildDailySecondsMap();
    const activeDays = Array.from(daily.values()).filter((seconds) => seconds > 0).length;
    const streak = calculateStreak(daily);

    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const rest = totalMinutes % 60;
      els.metricTotal.textContent = String(hours);
      els.metricTotalUnit.textContent = rest ? `小时 ${rest} 分` : '小时';
    } else {
      els.metricTotal.textContent = String(totalMinutes);
      els.metricTotalUnit.textContent = '分钟';
    }

    els.metricTotalHint.textContent = starts
      ? `${activeDays} 天有专注 · ${starts} 次启动`
      : '从第一个番茄开始累计';
    els.metricStarts.textContent = String(starts);
    els.metricCompleted.textContent = String(completed);
    els.metricCompletionHint.textContent = starts
      ? `完成率 ${Math.round((completed / starts) * 100)}%`
      : '完成一轮，就记下一个番茄';

    els.metricStreak.textContent = String(streak);
    if (!streak) {
      els.metricStreakHint.textContent = '今天也来点亮一格';
    } else if (daily.get(dateKey(new Date())) > 0) {
      els.metricStreakHint.textContent = '今天已点亮，继续保持';
    } else {
      els.metricStreakHint.textContent = '今天还没开始，别让火苗断了';
    }

    renderDailyPanel();
    renderWeek(daily);
    renderMonthHeatmap(daily);
  }

  function buildDailySecondsMap() {
    const map = new Map();
    for (const session of state.sessions) {
      for (const span of session.spans || []) {
        addSpanToDailyMap(span, map);
      }
    }
    return map;
  }

  function addSpanToDailyMap(span, map) {
    let cursor = span.start;
    const end = span.end;
    let guard = 0;

    while (cursor < end && guard < 5000) {
      const dayStart = startOfDay(new Date(cursor)).getTime();
      const nextDay = addDays(new Date(dayStart), 1).getTime();
      const segmentEnd = Math.min(end, nextDay);
      const seconds = (segmentEnd - cursor) / 1000;

      if (seconds > 0) {
        const key = dateKey(new Date(cursor));
        map.set(key, (map.get(key) || 0) + seconds);
      }

      cursor = segmentEnd;
      guard += 1;
    }
  }

  function calculateStreak(daily) {
    let cursor = startOfDay(new Date());
    if (!(daily.get(dateKey(cursor)) > 0)) {
      cursor = addDays(cursor, -1);
      if (!(daily.get(dateKey(cursor)) > 0)) return 0;
    }

    let streak = 0;
    while ((daily.get(dateKey(cursor)) || 0) > 0 && streak < 3660) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function heatLevel(seconds) {
    const minutes = seconds / 60;
    if (minutes <= 0) return 0;
    if (minutes < 20) return 1;
    if (minutes < 40) return 2;
    if (minutes < 80) return 3;
    return 4;
  }

  function renderMonthHeatmap(daily) {
    const today = startOfDay(new Date());
    const selectedMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), 1);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (selectedMonth.getTime() > currentMonth.getTime()) heatmapMonth = currentMonth;

    const year = heatmapMonth.getFullYear();
    const month = heatmapMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = (firstDay.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < leading; i += 1) {
      const blank = document.createElement('span');
      blank.className = 'month-day is-empty';
      blank.setAttribute('aria-hidden', 'true');
      cells.push(blank);
    }

    let monthSeconds = 0;
    let activeDays = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const seconds = daily.get(dateKey(date)) || 0;
      const isFuture = date.getTime() > today.getTime();
      const level = heatLevel(seconds);
      const minutes = Math.round(seconds / 60);
      const dateText = `${year}年${month + 1}月${day}日`;
      const tip = seconds > 0
        ? `${dateText} · 专注 ${formatDurationCN(seconds)}`
        : `${dateText} · 没有专注记录`;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `month-day level-${level}${isFuture ? ' is-future' : ''}${sameDay(date, today) ? ' is-today' : ''}`;
      cell.dataset.date = dateKey(date);
      cell.dataset.tip = tip;
      cell.disabled = isFuture;
      cell.setAttribute('aria-label', tip);

      const number = document.createElement('span');
      number.className = 'day-number';
      number.textContent = String(day);
      cell.appendChild(number);

      if (minutes > 0) {
        const amount = document.createElement('span');
        amount.className = 'day-minutes';
        amount.textContent = `${minutes} 分`;
        cell.appendChild(amount);
      }

      if (!isFuture) {
        monthSeconds += seconds;
        if (seconds > 0) activeDays += 1;
        cell.addEventListener('click', () => selectDailyDate(date));
      }

      cells.push(cell);
    }

    els.monthGrid.replaceChildren(...cells);
    els.monthGrid.setAttribute(
      'aria-label',
      monthSeconds > 0
        ? `${year}年${month + 1}月专注热力图，共专注${formatDurationCN(monthSeconds)}，活跃${activeDays}天。`
        : `${year}年${month + 1}月暂无专注记录。`
    );

    els.heatmapMonthLabel.textContent = `${year}年${month + 1}月`;
    els.heatmapMonthLabel.title = sameDay(selectedMonth, currentMonth) ? '本月' : '回到本月';
    els.heatmapNextBtn.disabled = selectedMonth.getTime() >= currentMonth.getTime();
    els.heatmapPrevBtn.disabled = false;
    els.heatmapDateInput.value = dateKey(selectedMonth);
    els.heatmapDateInput.max = dateKey(new Date());
    els.heatmapFoot.textContent = monthSeconds > 0
      ? `${month + 1}月 · ${activeDays} 天有专注 · 共 ${formatDurationCN(monthSeconds)}`
      : `${month + 1}月还没有专注记录，开始第一个番茄，给今天点一盏灯。`;

    hideHeatTooltip();
  }

  function selectDailyDate(date) {
    dailyDate = startOfDay(date);
    selectedDailyCategoryId = null;
    updateDailyControls();
    renderDailyPanel();
    if (els.distributionPanel) {
      els.distributionPanel.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }

  function startOfWeekMonday(value) {
    const date = startOfDay(value);
    const day = (date.getDay() + 6) % 7;
    return addDays(date, -day);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  function getCategoryById(id) {
    return state.categories.find((category) => category.id === id) || null;
  }

  function categoryDisplayForSession(session) {
    const category = session.categoryId ? getCategoryById(session.categoryId) : null;
    return category
      ? { key: category.id, name: category.name, color: category.color }
      : { key: UNCATEGORIZED_KEY, name: UNCATEGORIZED_NAME, color: UNCATEGORIZED_COLOR };
  }

  function formatWeekSpan(start, endExclusive) {
    const last = addDays(endExclusive, -1);
    const sameYear = start.getFullYear() === last.getFullYear();
    const prefix = sameYear ? '' : `${start.getFullYear()}年`;
    if (start.getMonth() === last.getMonth()) {
      return `${prefix}${start.getMonth() + 1}月${start.getDate()}日–${last.getDate()}日`;
    }
    return `${prefix}${start.getMonth() + 1}月${start.getDate()}日–${last.getMonth() + 1}月${last.getDate()}日`;
  }

  function formatDayLabel(date) {
    return sameDay(date, new Date()) ? '今天' : `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatDayRange(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEKDAYS_SHORT[date.getDay()]}`;
  }

  function updateDailyControls() {
    const today = startOfDay(new Date());
    if (dailyDate.getTime() > today.getTime()) dailyDate = today;

    els.periodTitle.textContent = formatDayLabel(dailyDate);
    els.periodRange.textContent = formatDayRange(dailyDate);
    els.periodDateInput.value = dateKey(dailyDate);
    els.periodDateInput.max = dateKey(today);
    els.periodNextBtn.disabled = dailyDate.getTime() >= today.getTime();
    els.periodTodayBtn.hidden = dailyDate.getTime() >= today.getTime();
    els.periodTodayBtn.textContent = '回到今天';
  }

  function moveDailyDate(direction) {
    const today = startOfDay(new Date());
    let next = addDays(dailyDate, direction);
    if (next.getTime() > today.getTime()) next = today;
    dailyDate = next;
    selectedDailyCategoryId = null;
    updateDailyControls();
    renderDailyPanel();
  }

  function updateWeekControls() {
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeekMonday(today);
    weekStart = startOfWeekMonday(weekStart);
    if (weekStart.getTime() > currentWeekStart.getTime()) weekStart = currentWeekStart;

    els.weekDateInput.value = dateKey(weekStart);
    els.weekDateInput.max = dateKey(today);
    els.weekNextBtn.disabled = weekStart.getTime() >= currentWeekStart.getTime();
    els.weekTodayBtn.hidden = weekStart.getTime() >= currentWeekStart.getTime();
  }

  function moveWeek(direction) {
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeekMonday(today);
    weekStart = startOfWeekMonday(addDays(weekStart, direction * 7));
    if (weekStart.getTime() > currentWeekStart.getTime()) weekStart = currentWeekStart;
    updateWeekControls();
    renderWeek(buildDailySecondsMap());
  }

  function buildCategoryGroups(start, end) {
    const map = new Map();

    for (const session of state.sessions) {
      const seconds = secondsInRange(session, start.getTime(), end.getTime());
      if (seconds <= 0.5) continue;

      const category = categoryDisplayForSession(session);
      let group = map.get(category.key);
      if (!group) {
        group = { ...category, seconds: 0, count: 0 };
        map.set(category.key, group);
      }
      group.seconds += seconds;
      group.count += 1;
    }

    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
  }

  function donutMarkup(segments, totalSeconds, clickable) {
    const visible = segments.filter((segment) => segment.seconds > 0.01);
    let svg = '<svg viewBox="0 0 190 190" aria-hidden="true">';
    svg += '<circle class="donut-track" cx="95" cy="95" r="76"></circle>';

    if (totalSeconds > 0) {
      let offset = 0;
      const gap = visible.length > 1 ? 0.7 : 0;
      for (const segment of visible) {
        const percentage = (segment.seconds / totalSeconds) * 100;
        const dash = Math.max(0.1, percentage - gap);
        const keyAttribute = clickable
          ? ` data-category-key="${escapeHTML(segment.key)}"`
          : '';
        svg += `<circle class="donut-segment${clickable ? ' is-donut-clickable' : ''}" cx="95" cy="95" r="76" pathLength="100" stroke="${segment.color}" stroke-dasharray="${dash.toFixed(2)} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 95 95)"${keyAttribute}><title>${escapeHTML(segment.name)} ${Math.round(segment.seconds / 60)} 分钟</title></circle>`;
        offset += percentage;
      }
    }

    svg += '</svg>';
    const centerValue = totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : 0;
    return `${svg}<div class="donut-center"><strong>${centerValue}</strong><span>分钟</span></div>`;
  }

  function categoryRowsMarkup(groups, totalSeconds) {
    return groups.map((group) => {
      const percentage = totalSeconds > 0 ? Math.round((group.seconds / totalSeconds) * 100) : 0;
      return `<button class="category-row" type="button" data-category-key="${escapeHTML(group.key)}">
        <span class="category-dot" style="background:${group.color}"></span>
        <span class="category-copy"><strong>${escapeHTML(group.name)}</strong><span>${group.count} 次</span></span>
        <span class="category-value"><strong>${formatDurationCN(group.seconds)}</strong><span>${percentage}%</span></span>
        <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
      </button>`;
    }).join('');
  }

  function dailySessionRowsMarkup(start, end, categoryKey) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const category = categoryDisplayForSession({ categoryId: categoryKey === UNCATEGORIZED_KEY ? null : categoryKey });

    const entries = state.sessions
      .filter((session) => categoryDisplayForSession(session).key === categoryKey)
      .map((session) => {
        const seconds = secondsInRange(session, startMs, endMs);
        return {
          session,
          seconds,
          from: Math.max(session.startedAt, startMs),
          to: Math.min(session.endedAt, endMs),
        };
      })
      .filter((entry) => entry.seconds > 0.5 && entry.to > entry.from)
      .sort((a, b) => a.session.startedAt - b.session.startedAt);

    return entries.map((entry) => {
      const session = entry.session;
      const overtimeSeconds = Math.max(0, session.focusedSeconds - session.plannedSeconds);
      const flags = [session.completed ? '完成' : '提前结束'];
      if (overtimeSeconds >= 30) flags.push('含加时');
      if (session.source === 'scheduled') flags.push('预约');
      const detail = session.detail.trim() || '未填写具体内容';
      const timeRange = `${formatHHMM(entry.from)}–${formatHHMM(entry.to)}`;

      return `<button class="daily-record-row" type="button" data-session-id="${escapeHTML(session.id)}" aria-label="${escapeHTML(timeRange)}，${escapeHTML(detail)}，${formatDurationCN(entry.seconds)}">
        <span class="category-dot" style="background:${category.color}"></span>
        <span class="daily-record-main">
          <span class="daily-record-top"><strong>${timeRange}</strong><span>${formatDurationCN(entry.seconds)}</span></span>
          <span class="daily-record-bottom">${escapeHTML(detail)} · ${flags.join(' · ')}</span>
        </span>
        <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>
      </button>`;
    }).join('');
  }

  function renderDailyPanel() {
    updateDailyControls();

    const start = startOfDay(dailyDate);
    const end = addDays(start, 1);
    const groups = buildCategoryGroups(start, end);
    const totalSeconds = groups.reduce((sum, group) => sum + group.seconds, 0);
    const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
    const selectedGroup = selectedDailyCategoryId
      ? groups.find((group) => group.key === selectedDailyCategoryId) || null
      : null;

    if (selectedDailyCategoryId && !selectedGroup) selectedDailyCategoryId = null;

    const viewSeconds = selectedGroup ? selectedGroup.seconds : totalSeconds;
    const viewCount = selectedGroup ? selectedGroup.count : totalCount;

    els.distributionChart.innerHTML = donutMarkup(groups, totalSeconds, true);
    els.distributionChart.setAttribute(
      'aria-label',
      totalSeconds > 0
        ? `每日专注分类，共 ${formatDurationCN(totalSeconds)}。`
        : '今天暂无专注记录。'
    );

    els.distributionSummary.textContent = totalCount
      ? `共 ${totalCount} 次专注 · 平均 ${Math.max(1, Math.round(totalSeconds / 60 / totalCount))} 分钟`
      : '共 0 次专注';

    els.distributionBackBtn.hidden = !selectedGroup;
    els.distributionListTitle.textContent = selectedGroup ? selectedGroup.name : '全部分类';
    els.distributionRange.textContent = selectedGroup
      ? `按时间顺序 · ${viewCount} 次`
      : formatDayRange(start);
    els.distributionTotal.textContent = formatDurationCN(viewSeconds);

    if (!selectedGroup && totalSeconds > 0) {
      els.categoryList.innerHTML = categoryRowsMarkup(groups, totalSeconds);
      els.categoryList.setAttribute('aria-label', '每日专注分类列表');
    } else if (selectedGroup) {
      els.categoryList.innerHTML = dailySessionRowsMarkup(start, end, selectedGroup.key);
      els.categoryList.setAttribute('aria-label', `${selectedGroup.name}的专注记录`);
    } else {
      els.categoryList.innerHTML = '';
      els.categoryList.setAttribute('aria-label', '暂无专注记录');
    }

    els.distributionEmpty.hidden = totalSeconds > 0;
    if (totalSeconds <= 0) {
      els.distributionEmpty.textContent = '这一天还没有专注记录。';
    }

    if (totalSeconds > 0) {
      if (selectedGroup) {
        els.distributionInsight.innerHTML = `共 <strong>${viewCount}</strong> 次 · 累计 <strong>${formatDurationCN(viewSeconds)}</strong>`;
      } else {
        const top = groups[0];
        els.distributionInsight.innerHTML = `共 <strong>${totalCount}</strong> 次专注 · 最投入 <strong>${escapeHTML(top.name)}</strong> ${formatDurationCN(top.seconds)}`;
      }
      els.distributionInsight.hidden = false;
    } else {
      els.distributionInsight.hidden = true;
    }

    hideHeatTooltip();
  }

  function renderWeek(daily) {
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeekMonday(today);
    weekStart = startOfWeekMonday(weekStart);
    if (weekStart.getTime() > currentWeekStart.getTime()) weekStart = currentWeekStart;
    updateWeekControls();

    const days = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(weekStart, offset);
      days.push({
        date,
        seconds: daily.get(dateKey(date)) || 0,
      });
    }

    const maxSeconds = Math.max(25 * 60, ...days.map((day) => day.seconds));
    const totalSeconds = days.reduce((sum, day) => sum + day.seconds, 0);

    els.weekChart.innerHTML = days.map((day) => {
      const isToday = sameDay(day.date, today);
      const isFuture = day.date.getTime() > today.getTime();
      const minutes = Math.round(day.seconds / 60);
      const height = day.seconds > 0
        ? Math.max(4, Math.min(100, (day.seconds / maxSeconds) * 100))
        : 0;
      const label = isToday ? '今天' : `周${WEEKDAYS_SHORT[day.date.getDay()]}`;
      const statusText = isFuture
        ? '尚未到来'
        : day.seconds > 0 ? `专注 ${formatDurationCN(day.seconds)}` : '没有专注';
      const title = `${day.date.getMonth() + 1}月${day.date.getDate()}日 · ${statusText}`;

      return `
        <button class="week-col${isFuture ? ' is-future' : ' is-clickable'}${isToday ? ' is-today' : ''}${day.seconds <= 0 ? ' is-zero' : ''}" type="button" data-week-date="${dateKey(day.date)}" title="${title}" aria-label="${title}，查看当天每日专注"${isFuture ? ' disabled' : ''}>
          <span class="week-value">${minutes}</span>
          <div class="week-bar-wrap">
            <div class="week-bar" style="height:${height.toFixed(1)}%"></div>
          </div>
          <span class="week-label">${label}</span>
        </button>
      `;
    }).join('');

    const isCurrent = weekStart.getTime() === currentWeekStart.getTime();
    const span = formatWeekSpan(weekStart, addDays(weekStart, 7));
    els.weekSubtitle.textContent = `${isCurrent ? '本周 · ' : ''}${span}${totalSeconds > 0 ? ` · 共 ${formatDurationCN(totalSeconds)}` : ' · 暂无专注'}`;
  }

  function formatRecordDay(date) {
    const now = new Date();
    if (sameDay(date, now)) return '今天';
    if (sameDay(date, addDays(now, -1))) return '昨天';
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatRecordRange(session) {
    const start = new Date(session.startedAt);
    const end = new Date(session.endedAt);
    const startTime = formatHHMM(start);
    const endTime = formatHHMM(end);
    if (sameDay(start, end)) return `${formatRecordDay(start)} ${startTime}–${endTime}`;
    return `${formatRecordDay(start)} ${startTime}–${end.getMonth() + 1}月${end.getDate()}日 ${endTime}`;
  }

  /* ---------- Heatmap tooltip ---------- */

  function showHeatTooltip(cell) {
    if (!cell || cell.classList.contains('is-future') || !cell.dataset.tip) return;

    const tooltip = els.chartTooltip;
    tooltip.textContent = cell.dataset.tip;
    tooltip.hidden = false;

    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.transform = 'translate(-50%, calc(-100% - 9px))';

    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    if (tooltipRect.left < 8) left += 8 - tooltipRect.left;
    if (tooltipRect.right > window.innerWidth - 8) left -= tooltipRect.right - (window.innerWidth - 8);
    tooltip.style.left = `${left}px`;

    if (tooltipRect.top < 8) {
      tooltip.style.top = `${rect.bottom + 9}px`;
      tooltip.style.transform = 'translate(-50%, 0)';
    }
  }

  function hideHeatTooltip() {
    if (els.chartTooltip) els.chartTooltip.hidden = true;
  }

  /* ---------- CSV ---------- */

  function exportCSV() {
    const sessions = [...state.sessions].sort((a, b) => a.startedAt - b.startedAt);
    if (!sessions.length) {
      toast('还没有专注记录可以导出。');
      return;
    }

    const rows = [
      ['开始时间', '结束时间', '计划时长（分钟）', '实际专注（分钟）', '加时（分钟）', '状态', '启动方式', '专注分类', '具体内容'],
      ...sessions.map((session) => [
        formatDateTimeCSV(session.startedAt),
        formatDateTimeCSV(session.endedAt),
        String(Math.round(session.plannedSeconds / 60)),
        (session.focusedSeconds / 60).toFixed(1),
        (Math.max(0, session.focusedSeconds - session.plannedSeconds) / 60).toFixed(1),
        session.completed ? '完成' : '提前结束',
        session.source === 'scheduled' ? '预约' : '立即',
        categoryDisplayForSession(session).name,
        session.detail || '',
      ]),
    ];

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `日日新-专注记录-${dateKey(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`已导出 ${sessions.length} 条专注记录。`);
  }

  function csvCell(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  /* ---------- Settings & notifications ---------- */

  function syncSettingsUI() {
    setSelected(els.breakButtons, state.settings.breakMinutes);
    els.soundToggle.checked = state.settings.sound;
    if (els.celebrationToggle) els.celebrationToggle.checked = state.settings.celebration !== false;
    if (els.celebrationCount) {
      const total = celebrationList().length || FALLBACK_CELEBRATIONS.length;
      els.celebrationCount.textContent = `共 ${total} 种`;
    }
    syncCategorySummary();
    syncNotificationUI();
    updateInstallUI();
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOSDevice() {
    const userAgent = window.navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  function updateInstallUI() {
    if (!els.installAppBtn || !els.installHint) return;

    if (isStandalone()) {
      els.installAppBtn.hidden = true;
      els.installHint.textContent = '已安装，可以从主屏幕直接打开。';
      return;
    }

    if (deferredInstallPrompt) {
      els.installAppBtn.hidden = false;
      els.installAppBtn.textContent = '安装';
      els.installHint.textContent = '像 App 一样从主屏幕打开，离线也能计时。';
      return;
    }

    els.installAppBtn.hidden = true;

    if (isIOSDevice()) {
      els.installHint.textContent = '在 Safari 中点「分享」→「添加到主屏幕」。';
    } else {
      els.installHint.textContent = '用手机浏览器打开后，可通过浏览器菜单添加到主屏幕。';
    }
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      updateInstallUI();
      toast(isIOSDevice() ? '在 Safari 中点击分享，再选「添加到主屏幕」。' : '请通过浏览器菜单添加到主屏幕。');
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === 'accepted') toast('已添加到主屏幕。');
    } catch (error) {
      toast('安装没有完成，可以从浏览器菜单再试一次。');
    }

    updateInstallUI();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
        /* Offline mode is optional; the timer still works without it. */
      });
    });
  }

  function syncNotificationUI() {
    const supported = supportsNotifications();
    const permission = getNotificationPermission();

    if (state.settings.notify && permission !== 'granted') state.settings.notify = false;

    els.notifyToggle.checked = Boolean(state.settings.notify && permission === 'granted');
    els.notifyToggle.disabled = !supported || permission === 'denied';

    if (!supported) {
      els.notificationHint.textContent = '当前浏览器不支持桌面通知，到点仍会在页面内提醒。';
    } else if (permission === 'denied') {
      els.notificationHint.textContent = '浏览器已阻止通知，可以在网站设置中重新允许。';
    } else if (permission === 'granted' && state.settings.notify) {
      els.notificationHint.textContent = '桌面通知已开启，到点或完成时会通知你。';
    } else if (permission === 'granted') {
      els.notificationHint.textContent = '已获得通知权限，打开开关即可使用。';
    } else {
      els.notificationHint.textContent = '开启后，预约到点或完成时会通知你。';
    }
  }

  function enforceStoredNotificationState() {
    if (!state.settings.notify) return;
    if (getNotificationPermission() !== 'granted') {
      state.settings.notify = false;
    }
  }

  function supportsNotifications() {
    return typeof window.Notification !== 'undefined';
  }

  function getNotificationPermission() {
    if (!supportsNotifications()) return 'unsupported';
    try {
      return window.Notification.permission;
    } catch (error) {
      return 'denied';
    }
  }

  async function handleNotifyToggle() {
    const want = els.notifyToggle.checked;

    if (!want) {
      state.settings.notify = false;
      saveState();
      syncNotificationUI();
      return;
    }

    if (!supportsNotifications()) {
      state.settings.notify = false;
      syncNotificationUI();
      toast('这个浏览器不支持桌面通知，页面内提醒仍然有效。');
      return;
    }

    els.notifyToggle.disabled = true;

    try {
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }

      if (permission === 'granted') {
        state.settings.notify = true;
        saveState();
      } else {
        state.settings.notify = false;
        toast('浏览器没有允许通知，页面内提醒仍然有效。');
      }
    } catch (error) {
      state.settings.notify = false;
      toast('桌面通知开启失败，页面内提醒仍然有效。');
    }

    els.notifyToggle.disabled = false;
    syncNotificationUI();
  }

  function sendNotification(title, body) {
    if (!state.settings.notify || getNotificationPermission() !== 'granted') return;

    try {
      const iconUrl = new URL('icon.svg', window.location.href).href;
      new window.Notification(title, {
        body,
        icon: iconUrl,
        tag: 'rrx-focus',
      });
    } catch (error) {
      /* Notifications are a bonus; the in-app reminder still works. */
    }
  }

  function primeAudio() {
    if (!state.settings.sound) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch (error) {
      audioCtx = null;
    }
  }

  function playChime() {
    primeAudio();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime + 0.02;
      const notes = [523.25, 659.25, 783.99];

      notes.forEach((frequency, index) => {
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const start = now + index * 0.16;

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.1, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.75);
      });
    } catch (error) {
      /* Sound is optional. */
    }
  }

  /* ---------- Confirm & dialogs ---------- */

  function openConfirm({ title, message, okLabel = '确认', onOk }) {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmOk.textContent = okLabel;
    els.confirmOk.className = 'btn btn-danger';
    confirmAction = onOk;
    openDialog(els.confirmDialog);
    window.setTimeout(() => els.confirmCancel.focus(), 30);
  }

  function openDialog(dialog) {
    if (dialog.open) return;
    try {
      dialog.showModal();
    } catch (error) {
      // Some older browsers only allow one modal at a time.
      closeAllDialogs(dialog);
      try {
        dialog.showModal();
      } catch (fallbackError) {
        dialog.setAttribute('open', '');
      }
    }
  }

  function closeDialog(dialog) {
    if (dialog.open) dialog.close();
  }

  function closeAllDialogs(except = null) {
    qsa('dialog[open]').forEach((dialog) => {
      if (dialog !== except) dialog.close();
    });
  }

  /* ---------- Toasts ---------- */

  function toast(message) {
    if (!els.toastHost) return;

    while (els.toastHost.children.length >= 3) {
      els.toastHost.firstElementChild.remove();
    }

    const element = document.createElement('div');
    element.className = 'toast';
    const dot = document.createElement('span');
    dot.className = 'toast-dot';
    const text = document.createElement('span');
    text.textContent = message;
    element.append(dot, text);
    els.toastHost.appendChild(element);

    window.setTimeout(() => {
      element.classList.add('is-leaving');
      window.setTimeout(() => element.remove(), 240);
    }, 3200);
  }

  /* ---------- Greeting & day rollover ---------- */

  function updateGreeting() {
    const hour = new Date().getHours();
    let text;
    if (hour < 5) text = '夜深了，慢慢来';
    else if (hour < 11) text = '早上好，今天也慢慢来';
    else if (hour < 14) text = '中午好，给自己一点安静';
    else if (hour < 18) text = '下午好，把心收回来';
    else text = '晚上好，今天也慢慢来';
    els.greeting.textContent = text;
  }

  function checkDayRollover() {
    const today = dateKey(new Date());
    if (today === lastSeenDay) return;
    lastSeenDay = today;
    renderToday();
    renderCheckin();
    updateGreeting();
    idleQuote = pickQuote('before', idleQuote);
    if (!state.active) renderFocusQuote();
    if (!els.statsView.hidden) renderStats();
  }

  /* ---------- Views ---------- */

  function switchView(view, { scroll = true } = {}) {
    if (view !== 'focus' && view !== 'stats') return;
    currentView = view;

    els.focusView.hidden = view !== 'focus';
    els.statsView.hidden = view !== 'stats';
    els.focusView.classList.toggle('is-active', view === 'focus');
    els.statsView.classList.toggle('is-active', view === 'stats');

    els.navItems.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    if (view === 'stats') {
      selectedDailyCategoryId = null;
      renderStats();
    }

    updateTimerDisplay();

    if (scroll) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  /* ---------- Main tick ---------- */

  function tick() {
    const now = Date.now();
    checkDayRollover();

    if (state.active) {
      if (state.active.status === 'running') {
        const elapsed = getElapsedSeconds(state.active, now);
        if (elapsed + 0.001 >= state.active.plannedSeconds && !state.active.overtime) {
          if (state.active.mode === 'focus' && state.active.continueAfterCountdown) {
            state.active.overtime = true;
            saveState();
            renderTimer();
            toast('计划完成，已转为正计时。');
            sendNotification('计划完成', '已自动转为正计时，结束时记得选择分类。');
          } else {
            completeActive({ auto: true });
          }
        } else {
          updateTimerDisplay();
        }
      } else {
        updateTimerDisplay();
      }
    }

    updateScheduleUI();
    checkScheduleAutoStart();
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    els.viewButtons.forEach((button) => {
      button.addEventListener('click', () => switchView(button.dataset.view));
    });

    els.durationControl.addEventListener('click', openDurationDialog);
    els.durationPresetButtons.forEach((button) => {
      button.addEventListener('click', () => setDurationDraft(Number(button.dataset.minutes)));
    });
    els.customMinus.addEventListener('click', () => adjustCustomDuration(-5));
    els.customPlus.addEventListener('click', () => adjustCustomDuration(5));
    els.customMinutes.addEventListener('input', handleCustomDurationInput);
    els.durationForm.addEventListener('submit', submitDuration);

    els.startNowBtn.addEventListener('click', () => openStartDialog());
    els.startOvertimePicker.forEach((button) => {
      button.addEventListener('click', () => {
        startDialogContinue = button.dataset.value === 'true';
        syncStartOvertimeChoice();
      });
    });
    els.startConfirmBtn.addEventListener('click', confirmStartDialog);
    if (els.checkinBtn) els.checkinBtn.addEventListener('click', checkIn);
    if (els.checkinRevealClose) els.checkinRevealClose.addEventListener('click', hideCheckinReveal);
    if (els.checkinReveal) {
      els.checkinReveal.addEventListener('click', (event) => {
        if (event.target === els.checkinReveal) hideCheckinReveal();
      });
    }
    if (els.focusQuoteNext) els.focusQuoteNext.addEventListener('click', refreshIdleQuote);
    els.scheduleBtn.addEventListener('click', openScheduleDialog);
    els.pauseBtn.addEventListener('click', togglePause);
    els.endBtn.addEventListener('click', requestEnd);
    els.scheduleStartBtn.addEventListener('click', startScheduledFocus);
    els.cancelScheduleBtn.addEventListener('click', cancelSchedule);

    els.settingsBtn.addEventListener('click', () => {
      syncSettingsUI();
      openDialog(els.settingsDialog);
    });

    els.breakButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.settings.breakMinutes = Number(button.dataset.minutes) || 5;
        saveState();
        setSelected(els.breakButtons, state.settings.breakMinutes);
      });
    });

    els.manageCategoriesBtn.addEventListener('click', openCategoryDialog);

    els.soundToggle.addEventListener('change', () => {
      state.settings.sound = els.soundToggle.checked;
      saveState();
      if (state.settings.sound) playChime();
    });

    els.notifyToggle.addEventListener('change', handleNotifyToggle);

    if (els.celebrationToggle) {
      els.celebrationToggle.addEventListener('change', () => {
        state.settings.celebration = els.celebrationToggle.checked;
        saveState();
      });
    }

    if (els.celebrationPreviewBtn) {
      els.celebrationPreviewBtn.addEventListener('click', () => openCelebration({ preview: true }));
    }

    if (els.celebrationDialog) {
      els.celebrationDoneBtn.addEventListener('click', finishCelebration);
      els.celebrationAnotherBtn.addEventListener('click', rerollCelebration);
      els.celebrationSkipBtn.addEventListener('click', finishCelebration);
      els.celebrationDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finishCelebration();
      });
      els.celebrationDialog.addEventListener('close', handleCelebrationClosed);
    }

    els.exportBtn.addEventListener('click', exportCSV);
    els.exportBtnSettings.addEventListener('click', exportCSV);

    els.clearDataBtn.addEventListener('click', () => {
      openConfirm({
        title: '清空专注记录？',
        message: '所有历史专注记录会被删除，统计也会归零。当前设置、分类、预约和正在进行的计时不受影响。此操作无法撤销。',
        okLabel: '清空记录',
        onOk: () => {
          state.sessions = [];
          selectedDailyCategoryId = null;
          saveState();
          renderToday();
          renderStats();
          toast('专注记录已清空。');
        },
      });
    });

    els.periodPrevBtn.addEventListener('click', () => moveDailyDate(-1));
    els.periodNextBtn.addEventListener('click', () => moveDailyDate(1));
    els.periodTodayBtn.addEventListener('click', () => {
      dailyDate = startOfDay(new Date());
      selectedDailyCategoryId = null;
      updateDailyControls();
      renderDailyPanel();
    });

    els.periodDateInput.addEventListener('change', () => {
      const date = parseDateInputValue(els.periodDateInput.value);
      if (!date) {
        updateDailyControls();
        return;
      }
      const today = startOfDay(new Date());
      dailyDate = startOfDay(date);
      if (dailyDate.getTime() > today.getTime()) dailyDate = today;
      selectedDailyCategoryId = null;
      updateDailyControls();
      renderDailyPanel();
    });

    els.distributionBackBtn.addEventListener('click', () => {
      selectedDailyCategoryId = null;
      renderDailyPanel();
    });

    els.categoryList.addEventListener('click', (event) => {
      const sessionRow = event.target.closest('[data-session-id]');
      if (sessionRow) {
        openSessionEditor(sessionRow.dataset.sessionId);
        return;
      }
      const row = event.target.closest('[data-category-key]');
      if (!row) return;
      selectedDailyCategoryId = row.dataset.categoryKey;
      renderDailyPanel();
    });

    els.distributionChart.addEventListener('click', (event) => {
      const segment = event.target.closest('[data-category-key]');
      if (!segment) return;
      selectedDailyCategoryId = segment.dataset.categoryKey;
      renderDailyPanel();
    });

    els.weekPrevBtn.addEventListener('click', () => moveWeek(-1));
    els.weekNextBtn.addEventListener('click', () => moveWeek(1));
    els.weekTodayBtn.addEventListener('click', () => {
      weekStart = startOfWeekMonday(new Date());
      updateWeekControls();
      renderWeek(buildDailySecondsMap());
    });

    els.weekDateInput.addEventListener('change', () => {
      const date = parseDateInputValue(els.weekDateInput.value);
      if (!date) {
        updateWeekControls();
        return;
      }
      const currentWeekStart = startOfWeekMonday(new Date());
      weekStart = startOfWeekMonday(date);
      if (weekStart.getTime() > currentWeekStart.getTime()) weekStart = currentWeekStart;
      updateWeekControls();
      renderWeek(buildDailySecondsMap());
    });

    els.weekChart.addEventListener('click', (event) => {
      const column = event.target.closest('[data-week-date]');
      if (!column || column.disabled) return;
      const date = parseDateInputValue(column.dataset.weekDate);
      if (date) selectDailyDate(date);
    });

    els.heatmapPrevBtn.addEventListener('click', () => {
      heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() - 1, 1);
      renderMonthHeatmap(buildDailySecondsMap());
    });

    els.heatmapNextBtn.addEventListener('click', () => {
      if (els.heatmapNextBtn.disabled) return;
      heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() + 1, 1);
      renderMonthHeatmap(buildDailySecondsMap());
    });

    els.heatmapMonthLabel.addEventListener('click', () => {
      const now = new Date();
      heatmapMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      renderMonthHeatmap(buildDailySecondsMap());
    });

    els.heatmapDateInput.addEventListener('change', () => {
      const date = parseDateInputValue(els.heatmapDateInput.value);
      if (!date) {
        renderMonthHeatmap(buildDailySecondsMap());
        return;
      }
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let selected = new Date(date.getFullYear(), date.getMonth(), 1);
      if (selected.getTime() > currentMonth.getTime()) selected = currentMonth;
      heatmapMonth = selected;
      renderMonthHeatmap(buildDailySecondsMap());
    });

    els.sessionCategoryChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-session-category]');
      if (!chip) return;
      setSessionCategory(chip.dataset.sessionCategory);
    });

    els.sessionDetailInput.addEventListener('input', () => {
      const session = getCurrentSession();
      if (!session) return;
      session.detail = String(els.sessionDetailInput.value || '').slice(0, 80);
      saveState();
    });

    els.sessionManageCategoriesBtn.addEventListener('click', openCategoryDialog);

    els.breakBtn.addEventListener('click', () => {
      commitSessionDialog();
      closeDialog(els.completeDialog);
      startBreak(state.settings.breakMinutes);
    });

    els.againBtn.addEventListener('click', () => {
      const minutes = lastCompletionMinutes || state.settings.defaultFocus;
      const continueAfterCountdown = lastCompletionContinueAfterCountdown;
      commitSessionDialog();
      closeDialog(els.completeDialog);
      openStartDialog({ minutes, continueAfterCountdown });
    });

    els.completeClose.addEventListener('click', () => closeDialog(els.completeDialog));
    els.completeDialog.addEventListener('close', () => {
      commitSessionDialog();
      renderFocusQuote();
    });

    els.categoryForm.addEventListener('submit', submitCategory);

    els.categoryManageList.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit-category]');
      if (edit) {
        beginCategoryEdit(edit.dataset.editCategory);
        return;
      }
      const remove = event.target.closest('[data-delete-category]');
      if (remove) deleteCategory(remove.dataset.deleteCategory);
    });

    els.categoryColorSwatches.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-color]');
      if (!swatch) return;
      categoryDraftColor = swatch.dataset.color;
      renderCategoryColorSwatches();
    });

    els.categoryCancelEdit.addEventListener('click', resetCategoryForm);
    els.categoryNameInput.addEventListener('input', () => {
      els.categoryError.hidden = true;
    });
    els.categoryDialog.addEventListener('close', () => {
      syncCategorySummary();
      renderSessionCategoryChips();
    });

    els.confirmOk.addEventListener('click', () => {
      const action = confirmAction;
      confirmAction = null;
      closeDialog(els.confirmDialog);
      if (typeof action === 'function') action();
    });

    els.confirmCancel.addEventListener('click', () => closeDialog(els.confirmDialog));
    els.confirmDialog.addEventListener('close', () => {
      confirmAction = null;
    });

    qsa('[data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = $id(button.dataset.close);
        if (dialog) closeDialog(dialog);
      });
    });

    [els.durationDialog, els.startDialog, els.scheduleDialog, els.settingsDialog, els.confirmDialog, els.categoryDialog, els.completeDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
    });

    els.scheduleForm.addEventListener('submit', submitSchedule);

    els.scheduleDayButtons.forEach((button) => {
      button.addEventListener('click', () => handleScheduleDayChange(button.dataset.day));
    });

    els.scheduleDurationButtons.forEach((button) => {
      button.addEventListener('click', () => {
        scheduleDraft.minutes = Number(button.dataset.minutes) || 25;
        els.scheduleCustomMinutes.value = String(scheduleDraft.minutes);
        setSelected(els.scheduleDurationButtons, scheduleDraft.minutes);
        els.scheduleError.hidden = true;
      });
    });

    els.scheduleCustomMinutes.addEventListener('input', () => {
      const value = Number(els.scheduleCustomMinutes.value);
      if (Number.isFinite(value)) scheduleDraft.minutes = value;
      setSelected(els.scheduleDurationButtons, Number.isFinite(value) ? value : -1);
      els.scheduleError.hidden = true;
    });

    els.scheduleOvertimePicker.forEach((button) => {
      button.addEventListener('click', () => {
        scheduleDraft.continueAfterCountdown = button.dataset.value === 'true';
        syncScheduleDraftUI();
      });
    });

    els.scheduleTime.addEventListener('input', () => {
      els.scheduleError.hidden = true;
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      updateInstallUI();
      toast('已安装到主屏幕。');
    });

    els.installAppBtn.addEventListener('click', installApp);

    els.monthGrid.addEventListener('pointerover', (event) => {
      const cell = event.target.closest('.month-day');
      if (cell && els.monthGrid.contains(cell)) showHeatTooltip(cell);
    });

    els.monthGrid.addEventListener('pointerout', (event) => {
      const cell = event.target.closest('.month-day');
      if (cell && els.monthGrid.contains(cell)) hideHeatTooltip();
    });

    els.monthGrid.addEventListener('pointerup', hideHeatTooltip);
    window.addEventListener('scroll', hideHeatTooltip, { passive: true });
    window.addEventListener('resize', hideHeatTooltip);
    document.addEventListener('keydown', (event) => {
      if (!els.checkinReveal || els.checkinReveal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        hideCheckinReveal();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (els.checkinRevealClose) els.checkinRevealClose.focus();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }
})();
