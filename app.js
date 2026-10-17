(() => {
  'use strict';

  /* ---------- Constants ---------- */

  const STORAGE_KEY = 'rrx-focus-v1';
  const BREAK_PRESETS = [5, 10, 15];
  const PAGE_SIZE = 30;
  const HEAT_WEEKS = 53;
  const RING_RADIUS = 158;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  const DEFAULT_SETTINGS = {
    defaultFocus: 25,
    breakMinutes: 5,
    sound: true,
    notify: false,
  };

  const IDLE_HEADLINE = '把注意力，放在一件事上。';
  const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
  const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日'];

  const PIE_PERIODS = [
    { key: 'morning', label: '早晨', range: '05:00–09:00', color: '#d2a04a', ranges: [[300, 540]] },
    { key: 'forenoon', label: '上午', range: '09:00–12:00', color: '#3d7057', ranges: [[540, 720]] },
    { key: 'afternoon', label: '下午', range: '12:00–18:00', color: '#8bb39a', ranges: [[720, 1080]] },
    { key: 'evening', label: '晚上', range: '18:00–05:00', color: '#c76c53', ranges: [[1080, 1440], [0, 300]] },
  ];

  /* ---------- State & storage ---------- */

  let storageAvailable = true;
  let state = loadState();
  let bootAt = Date.now();
  let currentView = 'focus';
  let pieDate = startOfDay(new Date());
  let recordsShown = PAGE_SIZE;
  let confirmAction = null;
  let scheduleDraft = null;
  let durationDraft = DEFAULT_SETTINGS.defaultFocus;
  let deferredInstallPrompt = null;
  let audioCtx = null;
  let lastCompletionMinutes = DEFAULT_SETTINGS.defaultFocus;
  let lastSeenDay = dateKey(new Date());
  let lastTitle = '';
  let heatmapPinnedRight = true;

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
    clockDisplay: $id('clockDisplay'),
    clockCaption: $id('clockCaption'),
    progressRing: $id('progressRing'),
    idleActions: $id('idleActions'),
    runningActions: $id('runningActions'),
    idleNote: $id('idleNote'),
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
    heatmap: $id('heatmap'),
    heatmapScroll: document.querySelector('.heatmap-scroll'),
    heatmapFoot: $id('heatmapFoot'),
    chartTooltip: $id('chartTooltip'),
    pieChart: $id('pieChart'),
    pieLegend: $id('pieLegend'),
    pieEmpty: $id('pieEmpty'),
    pieInsight: $id('pieInsight'),
    piePrevBtn: $id('piePrevBtn'),
    pieNextBtn: $id('pieNextBtn'),
    pieDateLabel: $id('pieDateLabel'),
    weekChart: $id('weekChart'),
    weekSubtitle: $id('weekSubtitle'),
    recordsList: $id('recordsList'),
    recordsCount: $id('recordsCount'),
    recordsMoreBtn: $id('recordsMoreBtn'),
    exportBtn: $id('exportBtn'),
    exportBtnSettings: $id('exportBtnSettings'),
    clearDataBtn: $id('clearDataBtn'),
    settingsBtn: $id('settingsBtn'),
    settingsDialog: $id('settingsDialog'),
    breakButtons: qsa('#breakDurationPicker button'),
    soundToggle: $id('soundToggle'),
    notifyToggle: $id('notifyToggle'),
    notificationHint: $id('notificationHint'),
    scheduleDialog: $id('scheduleDialog'),
    scheduleForm: $id('scheduleForm'),
    scheduleDayButtons: qsa('#scheduleDayPicker button'),
    scheduleDurationButtons: qsa('#scheduleDurationPicker button'),
    scheduleCustomMinutes: $id('scheduleCustomMinutes'),
    scheduleTime: $id('scheduleTime'),
    scheduleError: $id('scheduleError'),
    installAppBtn: $id('installAppBtn'),
    installHint: $id('installHint'),
    completeDialog: $id('completeDialog'),
    completeSummary: $id('completeSummary'),
    breakBtn: $id('breakBtn'),
    againBtn: $id('againBtn'),
    completeClose: $id('completeClose'),
    confirmDialog: $id('confirmDialog'),
    confirmTitle: $id('confirmTitle'),
    confirmMessage: $id('confirmMessage'),
    confirmOk: $id('confirmOk'),
    confirmCancel: $id('confirmCancel'),
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
    renderTimer();
    renderToday();
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
      active: null,
      schedule: null,
      settings: { ...DEFAULT_SETTINGS },
    };
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

    const sessions = Array.isArray(raw.sessions)
      ? raw.sessions.map(normalizeSession).filter(Boolean)
      : [];

    return {
      version: 1,
      sessions,
      active: normalizeActive(raw.active),
      schedule: normalizeSchedule(raw.schedule),
      settings,
    };
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
      createdAt: Number(raw.createdAt) || Date.now(),
      overdueNotified: Boolean(raw.overdueNotified),
    };
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

  function formatPieDate(date) {
    const today = new Date();
    if (sameDay(date, today)) return '今天';
    if (sameDay(date, addDays(today, -1))) return '昨天';
    if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${String(date.getFullYear()).slice(-2)}年${date.getMonth() + 1}月`;
  }

  function formatFullDate(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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

    els.timerCard.classList.toggle('is-running', Boolean(active && active.status === 'running' && !isBreak));
    els.timerCard.classList.toggle('is-paused', isPaused);
    els.timerCard.classList.toggle('is-break', isBreak);
    els.durationControl.hidden = isActive;
    els.idleActions.hidden = isActive;
    els.runningActions.hidden = !isActive;
    els.idleNote.hidden = isActive;

    if (!active) {
      els.timerModeLabel.textContent = '准备专注';
      els.clockCaption.textContent = '准备好，就从现在开始';
      els.focusHeadline.textContent = IDLE_HEADLINE;
      els.pauseBtnLabel.textContent = '暂停';
      setPauseIcon(false);
      updateTimerDisplay();
      return;
    }

    if (isBreak) {
      els.timerModeLabel.textContent = isPaused ? '休息已暂停' : '休息中';
      els.clockCaption.textContent = '让眼睛离开屏幕，慢慢呼吸';
      els.focusHeadline.textContent = '让身心，松一松。';
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
  }

  function setPauseIcon(isPaused) {
    if (els.pauseIconUse) els.pauseIconUse.setAttribute('href', isPaused ? '#i-play' : '#i-pause');
  }

  function updateTimerDisplay() {
    const active = state.active;
    const plannedSeconds = active ? active.plannedSeconds : state.settings.defaultFocus * 60;
    const remaining = active ? Math.max(0, plannedSeconds - getElapsedSeconds(active)) : plannedSeconds;
    const fraction = plannedSeconds > 0 ? Math.max(0, Math.min(1, remaining / plannedSeconds)) : 1;

    const clockText = formatClock(remaining);
    if (els.clockDisplay.textContent !== clockText) els.clockDisplay.textContent = clockText;

    const ariaRemaining = Math.max(0, Math.ceil(remaining));
    els.clockDisplay.setAttribute(
      'aria-label',
      active
        ? `剩余 ${Math.floor(ariaRemaining / 60)} 分 ${ariaRemaining % 60} 秒`
        : `${state.settings.defaultFocus} 分钟`
    );

    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    els.progressRing.style.strokeDashoffset = offset.toFixed(2);

    let title;
    if (active) {
      const label = active.status === 'paused'
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

  /* ---------- Timer actions ---------- */

  function startFocus(minutes, source = 'now') {
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
      spans: [],
      currentSpanStart: now,
    };

    if (state.schedule && (source === 'scheduled' || now >= state.schedule.at)) {
      state.schedule = null;
    }

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
      spans: [],
      currentSpanStart: now,
    };

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
    } else {
      active.status = 'running';
      active.currentSpanStart = Date.now();
    }

    saveState();
    renderTimer();
  }

  function requestEnd() {
    const active = state.active;
    if (!active) return;

    if (active.mode === 'break') {
      state.active = null;
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('休息结束，准备回到专注。');
      return;
    }

    const elapsed = getElapsedSeconds(active);
    if (elapsed < 60) {
      state.active = null;
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('不足 1 分钟，本次不计入统计。');
      return;
    }

    openConfirm({
      title: '提前结束专注？',
      message: `已经专注 ${formatDurationCN(elapsed)}。结束后，这段时间会记入统计。`,
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
    const completed = auto || rawElapsed >= plannedSeconds - 0.4;

    if (!completed && rawElapsed < 60) {
      state.active = null;
      saveState();
      renderTimer();
      updateScheduleUI();
      toast('不足 1 分钟，本次不计入统计。');
      return;
    }

    const focusedSeconds = completed ? plannedSeconds : Math.max(1, Math.round(rawElapsed));
    const spans = completed ? trimSpans(active.spans, plannedSeconds) : active.spans.map((span) => ({ ...span }));
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
      spans,
    };

    state.sessions.push(session);
    state.active = null;
    lastCompletionMinutes = Math.round(plannedSeconds / 60);

    if (state.schedule && now >= state.schedule.at) {
      state.schedule.overdueNotified = true;
    }

    saveState();
    renderTimer();
    renderToday();
    updateScheduleUI();

    if (!els.statsView.hidden) renderStats();

    if (completed) {
      if (auto) {
        if (state.settings.sound) playChime();
        sendNotification('专注完成', `这一轮 ${formatDurationCN(focusedSeconds)}，起来活动一下吧。`);
        showCompletionDialog(session);
      } else {
        toast(`已记录 ${formatDurationCN(focusedSeconds)}专注。`);
      }
    } else {
      toast(`提前结束，已记录 ${formatDurationCN(focusedSeconds)}专注。`);
    }
  }

  function showCompletionDialog(session) {
    closeAllDialogs(els.completeDialog);
    els.completeSummary.textContent = `专注了 ${formatDurationCN(session.focusedSeconds)}。起身走走，喝口水。`;
    els.breakBtn.textContent = `休息 ${state.settings.breakMinutes} 分钟`;

    if (!els.completeDialog.open) {
      try {
        els.completeDialog.showModal();
      } catch (error) {
        toast('这一轮完成了，休息一下吧。');
      }
    }
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
        : `${formatScheduleWhen(schedule.at)} · ${schedule.minutes} 分钟，现在开始吗？`;
      els.scheduleStartBtn.hidden = Boolean(state.active);
    } else {
      els.scheduleTitle.textContent = `已预约 ${formatScheduleWhen(schedule.at)}`;
      els.scheduleMeta.textContent = `${formatCountdown(schedule.at - now)} · ${schedule.minutes} 分钟专注`;
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
    state.schedule = null;
    startFocus(minutes, 'scheduled');
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
    state.schedule = null;
    startFocus(minutes, 'scheduled');
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

    renderHeatmap(daily);
    renderPie();
    renderWeek(daily);
    renderRecords();
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

  function renderHeatmap(daily) {
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeekMonday(today);
    const firstWeekStart = addDays(currentWeekStart, -(HEAT_WEEKS - 1) * 7);

    const monthsEl = document.createElement('div');
    monthsEl.className = 'heatmap-months';

    let previousMonth = null;
    for (let week = 0; week < HEAT_WEEKS; week += 1) {
      const thursday = addDays(firstWeekStart, week * 7 + 3);
      const month = thursday.getMonth();
      if (month !== previousMonth) {
        const label = document.createElement('span');
        label.className = 'heatmap-month';
        label.style.gridColumnStart = String(week + 1);
        label.textContent = `${month + 1}月`;
        monthsEl.appendChild(label);
        previousMonth = month;
      }
    }

    const weekdaysEl = document.createElement('div');
    weekdaysEl.className = 'heatmap-weekdays';
    WEEKDAY_LABELS.forEach((label) => {
      const item = document.createElement('span');
      item.textContent = label;
      weekdaysEl.appendChild(item);
    });

    const gridEl = document.createElement('div');
    gridEl.className = 'heatmap-grid';

    let rangeSeconds = 0;
    let activeDays = 0;

    for (let week = 0; week < HEAT_WEEKS; week += 1) {
      const weekEl = document.createElement('div');
      weekEl.className = 'heatmap-week';

      for (let day = 0; day < 7; day += 1) {
        const date = addDays(firstWeekStart, week * 7 + day);
        const seconds = daily.get(dateKey(date)) || 0;
        const future = date.getTime() > today.getTime();
        const cell = document.createElement('span');
        cell.className = `heat-cell level-${heatLevel(seconds)}${future ? ' is-future' : ''}`;

        if (future) {
          cell.setAttribute('aria-hidden', 'true');
        } else {
          rangeSeconds += seconds;
          if (seconds > 0) activeDays += 1;

          const dateText = `${date.getMonth() + 1}月${date.getDate()}日`;
          const tip = seconds > 0
            ? `${dateText} · 专注 ${formatDurationCN(seconds)}`
            : `${dateText} · 没有专注记录`;
          cell.dataset.tip = tip;
          cell.setAttribute('role', 'img');
          cell.setAttribute('aria-label', tip);
        }

        weekEl.appendChild(cell);
      }

      gridEl.appendChild(weekEl);
    }

    const body = document.createElement('div');
    body.className = 'heatmap-body';
    body.append(weekdaysEl, gridEl);

    els.heatmap.replaceChildren(monthsEl, body);
    els.heatmap.setAttribute(
      'aria-label',
      rangeSeconds > 0 ? `过去一年专注热力图，共专注${formatDurationCN(rangeSeconds)}，活跃${activeDays}天。` : '过去一年暂无专注记录。'
    );

    els.heatmapFoot.textContent = rangeSeconds > 0
      ? `过去一年 · ${activeDays} 天有专注 · 共 ${formatDurationCN(rangeSeconds)}`
      : '还没有专注记录，开始第一个番茄，给今天点一盏灯。';

    hideHeatTooltip();
    heatmapPinnedRight = true;
    window.requestAnimationFrame(() => {
      if (els.heatmapScroll) els.heatmapScroll.scrollLeft = els.heatmapScroll.scrollWidth;
    });
  }

  function startOfWeekMonday(value) {
    const date = startOfDay(value);
    const day = (date.getDay() + 6) % 7;
    return addDays(date, -day);
  }

  function renderPie() {
    const today = startOfDay(new Date());
    if (pieDate.getTime() > today.getTime()) pieDate = today;

    const dayStart = pieDate.getTime();
    const dayEnd = addDays(pieDate, 1).getTime();
    const periods = PIE_PERIODS.map((period) => ({
      ...period,
      seconds: 0,
    }));
    let sessionCount = 0;

    for (const session of state.sessions) {
      let overlapsDay = false;
      for (const span of session.spans || []) {
        if (span.end > dayStart && span.start < dayEnd) {
          overlapsDay = true;
          break;
        }
      }
      if (overlapsDay) sessionCount += 1;

      for (const period of periods) {
        period.seconds += secondsInMinuteRanges(session.spans, dayStart, period.ranges);
      }
    }

    const totalSeconds = periods.reduce((sum, period) => sum + period.seconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    const visible = periods.filter((period) => period.seconds > 0.01);

    let svg = '<svg viewBox="0 0 190 190" aria-hidden="true">';
    svg += '<circle class="donut-track" cx="95" cy="95" r="76"></circle>';

    if (totalSeconds > 0) {
      let offset = 0;
      const gap = visible.length > 1 ? 0.7 : 0;
      for (const period of periods) {
        if (period.seconds <= 0) continue;
        const percentage = (period.seconds / totalSeconds) * 100;
        const dash = Math.max(0.1, percentage - gap);
        svg += `<circle class="donut-segment" cx="95" cy="95" r="76" pathLength="100" stroke="${period.color}" stroke-dasharray="${dash.toFixed(2)} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 95 95)"><title>${period.label} ${Math.round(period.seconds / 60)} 分钟</title></circle>`;
        offset += percentage;
      }
    }

    svg += '</svg>';

    const centerValue = totalSeconds > 0 ? Math.max(1, totalMinutes) : 0;
    els.pieChart.innerHTML = `${svg}<div class="donut-center"><strong>${centerValue}</strong><span>分钟</span></div>`;
    els.pieChart.setAttribute(
      'aria-label',
      totalSeconds > 0 ? `每日专注分布，共 ${formatDurationCN(totalSeconds)}。` : '每日专注分布，暂无记录。'
    );

    els.pieLegend.innerHTML = periods.map((period) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${period.color}"></span>
        <div class="legend-copy">
          <strong>${period.label}</strong>
          <span>${period.range}</span>
        </div>
        <span class="legend-value">${Math.round(period.seconds / 60)} 分</span>
      </div>
    `).join('');

    if (totalSeconds > 0) {
      const peak = periods.reduce((best, period) => (period.seconds > best.seconds ? period : best), periods[0]);
      els.pieInsight.innerHTML = `共 <strong>${sessionCount}</strong> 次专注 · 最投入 <strong>${peak.label}</strong> ${Math.round(peak.seconds / 60)} 分钟`;
      els.pieInsight.hidden = false;
    } else {
      els.pieInsight.hidden = true;
    }

    els.pieEmpty.hidden = totalSeconds > 0;
    els.pieDateLabel.textContent = formatPieDate(pieDate);
    els.pieDateLabel.title = `${formatFullDate(pieDate)}，点击回到今天`;
    els.pieNextBtn.disabled = pieDate.getTime() >= today.getTime();
    hideHeatTooltip();
  }

  function secondsInMinuteRanges(spans, dayStart, ranges) {
    let seconds = 0;
    for (const span of spans || []) {
      for (const range of ranges) {
        const from = Math.max(span.start, dayStart + range[0] * 60000);
        const to = Math.min(span.end, dayStart + range[1] * 60000);
        if (to > from) seconds += (to - from) / 1000;
      }
    }
    return seconds;
  }

  function renderWeek(daily) {
    const today = startOfDay(new Date());
    const days = [];

    for (let offset = -6; offset <= 0; offset += 1) {
      const date = addDays(today, offset);
      days.push({
        date,
        seconds: daily.get(dateKey(date)) || 0,
      });
    }

    const maxSeconds = Math.max(25 * 60, ...days.map((day) => day.seconds));
    const totalSeconds = days.reduce((sum, day) => sum + day.seconds, 0);

    els.weekChart.innerHTML = days.map((day, index) => {
      const isToday = index === days.length - 1;
      const isYesterday = index === days.length - 2;
      const minutes = Math.round(day.seconds / 60);
      const height = day.seconds > 0
        ? Math.max(4, Math.min(100, (day.seconds / maxSeconds) * 100))
        : 0;
      const label = isToday ? '今天' : isYesterday ? '昨天' : `周${WEEKDAYS_SHORT[day.date.getDay()]}`;
      const title = `${day.date.getMonth() + 1}月${day.date.getDate()}日 · ${day.seconds > 0 ? `专注 ${formatDurationCN(day.seconds)}` : '没有专注'}`;

      return `
        <div class="week-col${isToday ? ' is-today' : ''}${day.seconds <= 0 ? ' is-zero' : ''}" title="${title}">
          <span class="week-value">${minutes}</span>
          <div class="week-bar-wrap">
            <div class="week-bar" style="height:${height.toFixed(1)}%"></div>
          </div>
          <span class="week-label">${label}</span>
        </div>
      `;
    }).join('');

    els.weekSubtitle.textContent = totalSeconds > 0
      ? `近 7 天共专注 ${formatDurationCN(totalSeconds)}`
      : '从今天开始，留下第一格。';
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

  function renderRecords() {
    const sorted = [...state.sessions].sort((a, b) => b.endedAt - a.endedAt);
    els.recordsCount.textContent = `${sorted.length} 条`;

    if (!sorted.length) {
      els.recordsList.innerHTML = `
        <div class="records-empty">
          <span class="empty-mark"><svg class="icon" aria-hidden="true"><use href="#i-leaf"></use></svg></span>
          <p>还没有专注记录，从第一个番茄开始吧。</p>
          <button class="btn btn-secondary" type="button" data-go-focus>去专注</button>
        </div>
      `;
      els.recordsMoreBtn.hidden = true;
      return;
    }

    const visible = sorted.slice(0, recordsShown);
    els.recordsList.innerHTML = visible.map((session) => {
      const minutes = Math.max(1, Math.round(session.focusedSeconds / 60));
      const subParts = [session.completed ? '完整完成' : '提前结束'];
      if (session.source === 'scheduled') subParts.push('预约开始');
      return `
        <div class="record-row">
          <div class="record-main">
            <span class="record-dot${session.completed ? ' is-complete' : ''}" aria-hidden="true"></span>
            <div class="record-copy">
              <strong>${formatRecordRange(session)}</strong>
              <span>${subParts.join(' · ')}</span>
            </div>
          </div>
          <div class="record-side">
            <span class="record-duration">${minutes} 分钟</span>
            <span class="record-badge${session.completed ? ' is-complete' : ''}">${session.completed ? '完成' : '提前'}</span>
          </div>
        </div>
      `;
    }).join('');

    const remaining = sorted.length - visible.length;
    if (remaining > 0) {
      els.recordsMoreBtn.hidden = false;
      els.recordsMoreBtn.textContent = `显示更多（还有 ${remaining} 条）`;
    } else {
      els.recordsMoreBtn.hidden = true;
    }
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
      ['开始时间', '结束时间', '计划时长（分钟）', '实际专注（分钟）', '状态', '启动方式'],
      ...sessions.map((session) => [
        formatDateTimeCSV(session.startedAt),
        formatDateTimeCSV(session.endedAt),
        String(Math.round(session.plannedSeconds / 60)),
        (session.focusedSeconds / 60).toFixed(1),
        session.completed ? '完成' : '提前结束',
        session.source === 'scheduled' ? '预约' : '立即',
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
      navigator.serviceWorker.register('./sw.js').catch(() => {
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
    if (!dialog.open) dialog.showModal();
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
    updateGreeting();
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
      recordsShown = PAGE_SIZE;
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
        if (elapsed + 0.001 >= state.active.plannedSeconds) {
          completeActive({ auto: true });
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

    els.startNowBtn.addEventListener('click', () => startFocus(state.settings.defaultFocus, 'now'));
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

    els.soundToggle.addEventListener('change', () => {
      state.settings.sound = els.soundToggle.checked;
      saveState();
      if (state.settings.sound) playChime();
    });

    els.notifyToggle.addEventListener('change', handleNotifyToggle);

    els.exportBtn.addEventListener('click', exportCSV);
    els.exportBtnSettings.addEventListener('click', exportCSV);

    els.clearDataBtn.addEventListener('click', () => {
      openConfirm({
        title: '清空专注记录？',
        message: '所有历史专注记录会被删除，统计也会归零。当前设置、预约和正在进行的计时不受影响。此操作无法撤销。',
        okLabel: '清空记录',
        onOk: () => {
          state.sessions = [];
          saveState();
          renderToday();
          renderStats();
          toast('专注记录已清空。');
        },
      });
    });

    els.piePrevBtn.addEventListener('click', () => {
      pieDate = addDays(pieDate, -1);
      renderPie();
    });

    els.pieNextBtn.addEventListener('click', () => {
      const today = startOfDay(new Date());
      const next = addDays(pieDate, 1);
      if (next.getTime() > today.getTime()) return;
      pieDate = next;
      renderPie();
    });

    els.pieDateLabel.addEventListener('click', () => {
      pieDate = startOfDay(new Date());
      renderPie();
    });

    els.recordsMoreBtn.addEventListener('click', () => {
      recordsShown += PAGE_SIZE;
      renderRecords();
    });

    els.recordsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-go-focus]');
      if (button) switchView('focus');
    });

    els.breakBtn.addEventListener('click', () => {
      closeDialog(els.completeDialog);
      startBreak(state.settings.breakMinutes);
    });

    els.againBtn.addEventListener('click', () => {
      closeDialog(els.completeDialog);
      startFocus(lastCompletionMinutes || state.settings.defaultFocus, 'now');
    });

    els.completeClose.addEventListener('click', () => closeDialog(els.completeDialog));

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

    [els.durationDialog, els.scheduleDialog, els.settingsDialog, els.confirmDialog].forEach((dialog) => {
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

    els.heatmap.addEventListener('pointerover', (event) => {
      const cell = event.target.closest('.heat-cell');
      if (cell && els.heatmap.contains(cell)) showHeatTooltip(cell);
    });

    els.heatmap.addEventListener('pointerout', (event) => {
      const cell = event.target.closest('.heat-cell');
      if (cell && els.heatmap.contains(cell)) hideHeatTooltip();
    });

    els.heatmap.addEventListener('pointerup', hideHeatTooltip);
    els.heatmapScroll.addEventListener('scroll', () => {
      hideHeatTooltip();
      heatmapPinnedRight =
        els.heatmapScroll.scrollLeft + els.heatmapScroll.clientWidth >= els.heatmapScroll.scrollWidth - 8;
    }, { passive: true });
    window.addEventListener('scroll', hideHeatTooltip, { passive: true });
    window.addEventListener('resize', () => {
      hideHeatTooltip();
      if (!els.statsView.hidden && heatmapPinnedRight) {
        window.requestAnimationFrame(() => {
          els.heatmapScroll.scrollLeft = els.heatmapScroll.scrollWidth;
        });
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }
})();
