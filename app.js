(function () {
  "use strict";

  // کلیدهای ذخیره‌سازی محلی (کاملاً مستقل از کش فایل‌های نرم‌افزار — در آپدیت‌ها حفظ می‌شوند)
  const APP_VERSION = "2.13";
  const BACKUP_META_KEY = "salar_backup_meta_v1";
  const STORAGE_KEY = "farsi6_emla_app_v1";
  const CUSTOM_STORAGE_KEY = "salar_custom_content_v1";
  const THEME_KEY = "salar_theme_v1";
  const FONT_SCALE_KEY = "salar_font_scale_v3";
  const POST_UPDATE_KEY = "salar_post_update_v1";
  const AUTO_NEXT_DELAY_MS = 1000;

  const MIN_FONT_SCALE = 0.7;
  const MAX_FONT_SCALE = 2.0;
  const FONT_SCALE_STEP = 0.1;
  const MOBILE_DEFAULT_FONT_SCALE = 0.8;
  const DESKTOP_DEFAULT_FONT_SCALE = 1.0;

  // فهرست ۶ پایه‌ی رسمی فارسی دبستان
  const GRADES = [
    { id: "grade1", title: "پایه اول ابتدایی", shortTitle: "فارسی اول", file: "data/grade1.js", ready: true },
    { id: "grade2", title: "پایه دوم ابتدایی", shortTitle: "فارسی دوم", file: "data/grade2.js", ready: true },
    { id: "grade3", title: "پایه سوم ابتدایی", shortTitle: "فارسی سوم", file: "data/grade3.js", ready: true },
    { id: "grade4", title: "پایه چهارم ابتدایی", shortTitle: "فارسی چهارم", file: "data/grade4.js", ready: true },
    { id: "grade5", title: "پایه پنجم ابتدایی", shortTitle: "فارسی پنجم", file: "data/grade5.js", ready: true },
    { id: "grade6", title: "پایه ششم ابتدایی", shortTitle: "فارسی ششم", file: "data/grade6.js", ready: true }
  ];

  // زیربخش‌های پیشنهادی استاندارد فارسی دبستان
  const PRESET_SECTIONS = [
    { id: "family", title: "هم‌خانواده", icon: "🌱" },
    { id: "antonym", title: "متضاد (مخالف)", icon: "🔄" },
    { id: "synonym", title: "هم‌معنی", icon: "🟰" },
    { id: "homophone", title: "کلمات هم‌آوا", icon: "🔊" },
    { id: "grammar", title: "دانش زبانی و نگارش", icon: "📐" },
    { id: "comprehension", title: "درک مطلب", icon: "💡" },
    { id: "proverb", title: "ضرب‌المثل و کنایه", icon: "📜" }
  ];

  const VALID_GRADE_IDS = new Set(GRADES.map((g) => g.id));
  const PRESET_SECTION_IDS = new Set(PRESET_SECTIONS.map((s) => s.id));

  window.SALAR_DATA = window.SALAR_DATA || {};
  const loadedScripts = new Set();

  let state = loadState();
  let customData = loadCustomData();
  let currentTheme = loadTheme();
  let currentFontScale = loadFontScale();
  let deferredInstallPrompt = null;

  // وضعیت تمرین دانش‌آموز
  let activeGrade = null;
  let selectedLesson = null; // id درس یا "all"
  let currentLessons = [];
  let questionMap = new Map();
  let currentQuestionIndex = 0;
  let isAnswered = false;
  let currentSessionId = null;
  let lastFinishedSession = null;
  let toastTimer = null;
  let autoNextTimer = null;

  // وضعیت بخش «طراحی سؤال» (کارتی و مرحله‌به‌مرحله)
  let builderTab = "manage";       // "manage" | "backup"
  let builderStep = "grades";      // "grades" | "lessons" | "sections" | "questions"
  let builderGradeId = null;
  let builderLessonId = null;
  let builderSectionId = null;
  let editingQuestionId = null;
  let lessonFormMode = null;       // "create" | "rename" | null
  let renamingLessonId = null;
  let sectionFormMode = null;      // "create" | "rename" | null
  let renamingSectionId = null;

  // وضعیت پیش‌نمایش بازیابی پشتیبان
  let pendingRestore = null;
  let backupMeta = loadBackupMeta();
  let currentViewName = "grades";
  let isHandlingPopState = false;       // { filename, parsed, summary }

  const el = {
    navBrand: document.getElementById("nav-brand"),
    navLinks: document.getElementById("nav-links"),
    navBtns: document.querySelectorAll(".nav-btn"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),
    btnFullscreen: document.getElementById("btn-fullscreen"),
    btnZoomIn: document.getElementById("btn-zoom-in"),
    btnZoomOut: document.getElementById("btn-zoom-out"),
    btnZoomReset: document.getElementById("btn-zoom-reset"),

    siteBannerWrap: document.getElementById("site-banner-wrap"),
    pageTitle: document.getElementById("page-title"),
    btnTopBack: document.getElementById("btn-top-back"),

    gradesView: document.getElementById("grades-view"),
    gradeHomeView: document.getElementById("grade-home-view"),
    lessonView: document.getElementById("lesson-view"),
    quizView: document.getElementById("quiz-view"),
    resultView: document.getElementById("result-view"),
    builderView: document.getElementById("builder-view"),
    installView: document.getElementById("install-view"),
    aboutView: document.getElementById("about-view"),
    namingView: document.getElementById("naming-view"),

    directInstallCard: document.getElementById("direct-install-card"),
    installHeroDesc: document.getElementById("install-hero-desc"),
    btnPwaInstall: document.getElementById("btn-pwa-install"),
    installActionStatus: document.getElementById("install-action-status"),
    installBoxAndroid: document.getElementById("install-box-android"),
    installBoxIos: document.getElementById("install-box-ios"),
    installBoxWindows: document.getElementById("install-box-windows"),
    btnCheckUpdate: document.getElementById("btn-check-update"),
    appVersionLabel: document.getElementById("app-version-label"),
    updateStatusBox: document.getElementById("update-status-box"),

    resumeCard: document.getElementById("resume-card"),
    resumeBadge: document.getElementById("resume-badge"),
    resumeSubtitle: document.getElementById("resume-subtitle"),
    resumeList: document.getElementById("resume-list"),

    gradesGrid: document.getElementById("grades-grid"),
    lessonsGrid: document.getElementById("lessons-grid"),

    modesGrid: document.getElementById("modes-grid"),
    btnResetLesson: document.getElementById("btn-reset-lesson"),
    btnResetAll: document.getElementById("btn-reset-all"),

    quizTitle: document.getElementById("quiz-title"),
    quizProgressText: document.getElementById("quiz-progress-text"),
    progressBar: document.getElementById("progress-bar"),
    btnBackLesson: document.getElementById("btn-back-lesson"),
    questionLessonTag: document.getElementById("question-lesson-tag"),
    questionPrompt: document.getElementById("question-prompt"),
    optionsContainer: document.getElementById("options-container"),
    feedbackBox: document.getElementById("feedback-box"),
    feedbackStatus: document.getElementById("feedback-status"),
    feedbackHint: document.getElementById("feedback-hint"),
    btnNext: document.getElementById("btn-next"),
    quizPraiseOverlay: document.getElementById("quiz-praise-overlay"),

    resultSticker: document.getElementById("result-sticker"),
    resultSummary: document.getElementById("result-summary"),
    resCorrect: document.getElementById("res-correct"),
    resWrong: document.getElementById("res-wrong"),
    btnRetryMistakes: document.getElementById("btn-retry-mistakes"),
    btnResultLesson: document.getElementById("btn-result-lesson"),

    // عناصر طراحی سؤال (نسخه کارتی ۲.۳)
    tabBuilderManage: document.getElementById("tab-builder-manage"),
    tabBuilderBackup: document.getElementById("tab-builder-backup"),
    builderTotalBadge: document.getElementById("builder-total-badge"),
    builderManagePanel: document.getElementById("builder-manage-panel"),
    builderBackupPanel: document.getElementById("builder-backup-panel"),
    builderBreadcrumb: document.getElementById("builder-breadcrumb"),

    builderStepGrades: document.getElementById("builder-step-grades"),
    builderStepLessons: document.getElementById("builder-step-lessons"),
    builderStepSections: document.getElementById("builder-step-sections"),
    builderStepQuestions: document.getElementById("builder-step-questions"),

    builderGradesGrid: document.getElementById("builder-grades-grid"),
    builderLessonsGrid: document.getElementById("builder-lessons-grid"),
    builderSectionsGrid: document.getElementById("builder-sections-grid"),

    inlineLessonBox: document.getElementById("inline-lesson-box"),
    inlineLessonHeading: document.getElementById("inline-lesson-heading"),
    inputLessonTitle: document.getElementById("input-lesson-title"),
    btnSaveLesson: document.getElementById("btn-save-lesson"),
    btnCancelLesson: document.getElementById("btn-cancel-lesson"),

    inlineSectionBox: document.getElementById("inline-section-box"),
    inlineSectionHeading: document.getElementById("inline-section-heading"),
    presetSectionsWrap: document.getElementById("preset-sections-wrap"),
    presetSectionsChips: document.getElementById("preset-sections-chips"),
    inlineSectionDivider: document.getElementById("inline-section-divider"),
    inputSectionTitle: document.getElementById("input-section-title"),
    btnSaveSection: document.getElementById("btn-save-section"),
    btnCancelSection: document.getElementById("btn-cancel-section"),

    builderQHeading: document.getElementById("builder-q-heading"),
    builderContextSummary: document.getElementById("builder-context-summary"),
    btnToggleQForm: document.getElementById("btn-toggle-q-form"),
    btnBuilderTryQuiz: document.getElementById("btn-builder-try-quiz"),
    btnQuickExportLesson: document.getElementById("btn-quick-export-lesson"),

    builderFormCard: document.getElementById("builder-form-card"),
    builderFormTitle: document.getElementById("builder-form-title"),
    btnCancelEdit: document.getElementById("btn-cancel-edit"),
    questionForm: document.getElementById("question-form"),
    qPrompt: document.getElementById("q-prompt"),
    qCorrect: document.getElementById("q-correct"),
    qWrong1: document.getElementById("q-wrong-1"),
    qWrong2: document.getElementById("q-wrong-2"),
    qWrong3: document.getElementById("q-wrong-3"),
    qHint: document.getElementById("q-hint"),
    btnSubmitQuestion: document.getElementById("btn-submit-question"),

    builderListTitle: document.getElementById("builder-list-title"),
    builderListCount: document.getElementById("builder-list-count"),
    builderQuestionsList: document.getElementById("builder-questions-list"),

    // عناصر تب بارگیری و پشتیبان‌گیری
    statBackupQuestions: document.getElementById("stat-backup-questions"),
    statBackupLessons: document.getElementById("stat-backup-lessons"),
    statBackupSections: document.getElementById("stat-backup-sections"),
    backupReminderBox: document.getElementById("backup-reminder-box"),
    lblBackupScopeAll: document.getElementById("lbl-backup-scope-all"),
    lblBackupScopeLesson: document.getElementById("lbl-backup-scope-lesson"),
    backupLessonPicker: document.getElementById("backup-lesson-picker"),
    backupGradeSelect: document.getElementById("backup-grade-select"),
    backupLessonSelect: document.getElementById("backup-lesson-select"),
    btnExportDownload: document.getElementById("btn-export-download"),
    btnExportShare: document.getElementById("btn-export-share"),
    btnExportCopy: document.getElementById("btn-export-copy"),
    backupStatusBox: document.getElementById("backup-status-box"),

    btnImportTrigger: document.getElementById("btn-import-trigger"),
    btnTogglePasteRestore: document.getElementById("btn-toggle-paste-restore"),
    pasteRestoreBox: document.getElementById("paste-restore-box"),
    inputPasteJson: document.getElementById("input-paste-json"),
    btnParsePastedJson: document.getElementById("btn-parse-pasted-json"),
    btnCancelPasteRestore: document.getElementById("btn-cancel-paste-restore"),
    inputImportFile: document.getElementById("input-import-file"),
    importStatusBox: document.getElementById("import-status-box"),
    restorePreviewBox: document.getElementById("restore-preview-box"),
    restoreFileName: document.getElementById("restore-file-name"),
    restoreFileSummary: document.getElementById("restore-file-summary"),
    lblModeMerge: document.getElementById("lbl-mode-merge"),
    lblModeReplace: document.getElementById("lbl-mode-replace"),
    replaceDangerBox: document.getElementById("replace-danger-box"),
    replaceDangerText: document.getElementById("replace-danger-text"),
    btnBackupBeforeReplace: document.getElementById("btn-backup-before-replace"),
    btnConfirmRestore: document.getElementById("btn-confirm-restore"),
    btnCancelRestore: document.getElementById("btn-cancel-restore"),

    goGradesBtns: document.querySelectorAll(".js-go-grades"),
    goGradeHomeBtns: document.querySelectorAll(".js-go-grade-home"),
    toast: document.getElementById("toast")
  };

  function toPersianDigits(num) {
    return String(num).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  }

  function normalizeText(str) {
    return String(str || "")
      .replace(/\u064a/g, "ی")
      .replace(/\u0643/g, "ک")
      .trim()
      .replace(/\s+/g, " ");
  }

  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\x22/g, "&quot;");
  }

  // --- مدیریت منوی موبایل ---


  // --- مدیریت زوم (پیش‌فرض ۱۰۰٪ در ویندوز/دسکتاپ و ۱۵۰٪ در اندروید و iOS، تا سقف ۲۰۰٪) ---
  function isMobileOS() {
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return isAndroid || isIOS;
  }

  function getDefaultFontScale() {
    return isMobileOS() ? MOBILE_DEFAULT_FONT_SCALE : DESKTOP_DEFAULT_FONT_SCALE;
  }

  function loadFontScale() {
    try {
      const raw = localStorage.getItem(FONT_SCALE_KEY);
      if (raw !== null) {
        const saved = parseFloat(raw);
        if (!Number.isNaN(saved) && saved >= MIN_FONT_SCALE && saved <= MAX_FONT_SCALE) {
          return Math.round(saved * 10) / 10;
        }
      }
    } catch {}
    return getDefaultFontScale();
  }

  function applyFontScale(scale, announce, persist) {
    const clamped = Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, Math.round(scale * 10) / 10));
    currentFontScale = clamped;
    const pct = Math.round(clamped * 100);
    const defPct = Math.round(getDefaultFontScale() * 100);

    document.documentElement.style.setProperty("--font-scale", String(clamped));
    if (el.btnZoomReset) {
      el.btnZoomReset.textContent = `${toPersianDigits(pct)}٪`;
      el.btnZoomReset.title = `بازگرداندن اندازه متن به پیش‌فرض (${toPersianDigits(defPct)}٪)`;
    }
    if (el.btnZoomIn) {
      el.btnZoomIn.disabled = clamped >= MAX_FONT_SCALE;
    }
    if (el.btnZoomOut) {
      el.btnZoomOut.disabled = clamped <= MIN_FONT_SCALE;
    }
    if (persist !== false) {
      try {
        localStorage.setItem(FONT_SCALE_KEY, String(clamped));
      } catch {}
    }
    if (announce) {
      showToast(`اندازه متن: ${toPersianDigits(pct)} درصد`);
    }
  }

  // --- مدیریت تمام‌نما (Fullscreen) ---
  function isFullscreenSupported() {
    const doc = document;
    const root = document.documentElement;
    return Boolean(
      (doc.fullscreenEnabled || doc.webkitFullscreenEnabled) &&
      (root.requestFullscreen || root.webkitRequestFullscreen)
    );
  }

  function isFullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function isStandaloneMobile() {
    const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return Boolean(isStandalone && isCoarsePointer);
  }

  function updateFullscreenButton() {
    if (!el.btnFullscreen) return;
    if (!isFullscreenSupported() || isStandaloneMobile()) {
      el.btnFullscreen.classList.add("hidden");
      return;
    }
    el.btnFullscreen.classList.remove("hidden");
    if (isFullscreenActive()) {
      el.btnFullscreen.textContent = "✕ خروج تمام‌نما";
      el.btnFullscreen.title = "خروج از حالت تمام‌نما (Esc)";
    } else {
      el.btnFullscreen.textContent = "⛶ تمام‌نما";
      el.btnFullscreen.title = "نمایش تمام‌نما";
    }
  }

  function toggleFullscreen() {
    if (!isFullscreenSupported()) return;
    if (isFullscreenActive()) {
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFn) Promise.resolve(exitFn.call(document)).catch(() => {});
    } else {
      const root = document.documentElement;
      const reqFn = root.requestFullscreen || root.webkitRequestFullscreen;
      if (reqFn) {
        Promise.resolve(reqFn.call(root)).catch(() => {
          showToast("امکان فعال‌سازی تمام‌نما در این مرورگر وجود ندارد.");
        });
      }
    }
  }

  // --- مدیریت نصب آفلاین (PWA) و بررسی نسخه جدید ---
  function isAppInstalledStandalone() {
    return Boolean(
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function showInstallActionStatus(type, message) {
    if (!el.installActionStatus) return;
    el.installActionStatus.className = `update-status-box ${type}`;
    el.installActionStatus.textContent = message;
  }

  function clearInstallHighlights() {
    [el.installBoxAndroid, el.installBoxIos, el.installBoxWindows].forEach((box) => {
      if (box) box.classList.remove("install-box-highlight");
    });
  }

  function highlightInstallBox(box) {
    clearInstallHighlights();
    if (box) {
      box.classList.add("install-box-highlight");
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function refreshInstallCardUI() {
    if (!el.btnPwaInstall) return;
    if (isAppInstalledStandalone()) {
      el.btnPwaInstall.textContent = "✅ برنامه نصب شده است";
      el.btnPwaInstall.disabled = true;
      showInstallActionStatus("ok", "✅ نرم‌افزار «سالار» همین حالا به صورت آفلاین روی دستگاه شما نصب است و بدون اینترنت کار می‌کند.");
    } else {
      el.btnPwaInstall.textContent = "📲 این برنامه را برایم آفلاین نصب کن";
      el.btnPwaInstall.disabled = false;
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    refreshInstallCardUI();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    refreshInstallCardUI();
    showInstallActionStatus("ok", "✅ نرم‌افزار سالار با موفقیت روی دستگاه شما نصب شد و از این پس کاملاً آفلاین کار می‌کند!");
    showToast("نرم‌افزار سالار با موفقیت نصب شد!");
  });

  async function triggerPwaInstall() {
    if (window.location.protocol === "file:") {
      showInstallActionStatus("warn", "⚠️ برای نصب آفلاین باید نرم‌افزار را از طریق آدرس اینترنتی سایت باز کنید (نه فایل مستقیم).");
      return;
    }

    if (isAppInstalledStandalone()) {
      refreshInstallCardUI();
      return;
    }

    // ۱. اگر مرورگر اجازه‌ی نصب خودکار یک‌کلیکی را داده باشد (کروم و اج اندروید و ویندوز)
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          showInstallActionStatus("ok", "✅ درخواست نصب تأیید شد! تا چند لحظه‌ی دیگر آیکون «سالار» به دستگاه شما اضافه می‌شود.");
        } else {
          showInstallActionStatus("info", "نصب لغو شد. هر زمان خواستید می‌توانید دوباره روی همین دکمه بزنید.");
        }
        deferredInstallPrompt = null;
      } catch {
        showInstallActionStatus("info", "از راهنمای پایین صفحه برای تکمیل نصب از منوی مرورگر استفاده کنید.");
      }
      return;
    }

    // ۲. تشخیص دقیق دستگاه و مرورگر و راهنمایی فوری
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isInAppBrowser = /Telegram|Instagram|FBAN|FBAV|WhatsApp|Eitaa|Shad|Rubika|Bale|;\s*wv/i.test(ua);

    if (isInAppBrowser) {
      showInstallActionStatus(
        "warn",
        "⚠️ شما سایت را داخل مرورگر داخلی پیام‌رسان باز کرده‌اید که اجازه‌ی نصب آفلاین نمی‌دهد. لطفاً از منوی بالا گزینه‌ی «باز کردن در مرورگر / Open in Chrome» را بزنید و سپس روی همین دکمه کلیک کنید."
      );
      return;
    }

    if (isIOS) {
      showInstallActionStatus(
        "info",
        "🍎 در آیفون و آیپد، سیستم‌عامل اپل اجازه‌ی نصب خودکار بدون دکمه‌ی اشتراک‌گذاری را به سایت‌ها نمی‌دهد. کافی است پایین مرورگر سافاری روی دکمه‌ی اشتراک‌گذاری (مربع با فلش بالا) بزنید و «Add to Home Screen» و سپس «Add» را انتخاب کنید."
      );
      highlightInstallBox(el.installBoxIos);
      return;
    }

    if (isAndroid) {
      showInstallActionStatus(
        "info",
        "🤖 اگر برنامه هنوز روی گوشی شما نصب نشده، در مرورگر گوگل کروم روی سه‌نقطه‌ی بالا (⋮) بزنید و گزینه‌ی «نصب برنامه / Install app» را انتخاب کنید. (اگر قبلاً نصب کرده‌اید، آیکون سالار در صفحه‌ی برنامه‌های گوشی شما آماده است.)"
      );
      highlightInstallBox(el.installBoxAndroid);
      return;
    }

    showInstallActionStatus(
      "info",
      "💻 در مرورگر Chrome یا Edge ویندوز، روی آیکون نصب (مانیتور با فلش پایین) در سمت راست نوار آدرس بالا کلیک کنید و «Install» را بزنید. (اگر آن آیکون دیده نمی‌شود، احتمالاً برنامه قبلاً روی ویندوز نصب شده است.)"
    );
    highlightInstallBox(el.installBoxWindows);
  }

  function showUpdateStatus(type, message) {
    if (!el.updateStatusBox) return;
    el.updateStatusBox.className = `update-status-box ${type}`;
    el.updateStatusBox.textContent = message;
  }

  function showImportStatus(type, message) {
    if (!el.importStatusBox) return;
    el.importStatusBox.className = `update-status-box ${type}`;
    el.importStatusBox.textContent = message;
  }

  function showBackupStatus(type, message) {
    if (!el.backupStatusBox) return;
    el.backupStatusBox.className = `update-status-box ${type}`;
    el.backupStatusBox.textContent = message;
  }

  function compareVersions(v1, v2) {
    const a = String(v1 || "0").split(".").map((n) => parseInt(n, 10) || 0);
    const b = String(v2 || "0").split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  async function checkAppUpdate() {
    if (window.location.protocol === "file:") {
      showUpdateStatus("warn", "⚠️ بررسی نسخه جدید فقط هنگام اجرا از طریق اینترنت (سایت یا نسخه نصب‌شده PWA) فعال است.");
      return;
    }

    if (!navigator.onLine) {
      showUpdateStatus("warn", "⚠️ دستگاه شما به اینترنت متصل نیست. برای بررسی نسخه جدید ابتدا اینترنت را روشن کنید.");
      showToast("اتصال اینترنت برقرار نیست.");
      return;
    }

    if (el.btnCheckUpdate) {
      el.btnCheckUpdate.disabled = true;
      el.btnCheckUpdate.textContent = "در حال بررسی...";
    }
    showUpdateStatus("info", "🔎 در حال بررسی وجود نسخه جدید روی سرور...");

    try {
      let remoteVersion = null;
      let remoteNotes = "";

      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          remoteVersion = String(data.version).trim();
          remoteNotes = data.notes ? String(data.notes).trim() : "";
        }
      }

      let swHasUpdate = false;
      let swReg = null;
      if ("serviceWorker" in navigator) {
        swReg = await navigator.serviceWorker.getRegistration();
        if (swReg) {
          await swReg.update().catch(() => {});
          if (swReg.waiting || swReg.installing) swHasUpdate = true;
        }
      }

      const hasNewerVersion = remoteVersion && compareVersions(remoteVersion, APP_VERSION) > 0;

      if (!hasNewerVersion && !swHasUpdate) {
        const verFa = toPersianDigits(APP_VERSION);
        showUpdateStatus("ok", `✅ نرم‌افزار شما به‌روز است (نسخه ${verFa} — آخرین نسخه).`);
        showToast("نرم‌افزار شما به‌روز است.");
        if (el.btnCheckUpdate) {
          el.btnCheckUpdate.disabled = false;
          el.btnCheckUpdate.textContent = "بررسی و دریافت نسخه جدید";
        }
        return;
      }

      const targetVer = remoteVersion || APP_VERSION;
      showUpdateStatus("info", `⬇️ نسخه جدید (${toPersianDigits(targetVer)}) یافت شد! در حال دریافت و به‌روزرسانی...`);

      if (swReg && swReg.waiting) {
        swReg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      try {
        sessionStorage.setItem(POST_UPDATE_KEY, JSON.stringify({
          from: APP_VERSION,
          to: targetVer,
          notes: remoteNotes
        }));
      } catch {}

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch {
      showUpdateStatus("warn", "⚠️ خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.");
      showToast("خطا در بررسی نسخه جدید.");
      if (el.btnCheckUpdate) {
        el.btnCheckUpdate.disabled = false;
        el.btnCheckUpdate.textContent = "بررسی و دریافت نسخه جدید";
      }
    }
  }

  // --- مدیریت تم ---
  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function applyTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    el.btnThemeToggle.textContent = currentTheme === "dark" ? "☀️ روشن" : "🌙 تیره";
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", currentTheme === "dark" ? "#0f172a" : "#f8fafc");
    }
    try {
      localStorage.setItem(THEME_KEY, currentTheme);
    } catch {}
  }

  // --- مدیریت حافظه پیشرفت (Stats) و فهرست آزمون‌های نیمه‌کاره ---
  function makeSessionId(gradeId, lessonScope, mode, reviewOnly) {
    return `${gradeId || "grade6"}::${lessonScope || "all"}::${mode || "spelling"}::${reviewOnly ? "review" : "normal"}`;
  }

  function normalizeSessionObj(s) {
    if (!s || !Array.isArray(s.queue) || s.queue.length === 0) return null;
    const gradeId = s.gradeId || "grade6";
    const lessonScope = s.lessonScope || "all";
    const mode = s.mode || "spelling";
    const reviewOnly = Boolean(s.reviewOnly);
    const currentIndex = Number.isInteger(s.currentIndex) && s.currentIndex >= 0 ? s.currentIndex : 0;
    if (currentIndex >= s.queue.length) return null;
    return {
      id: s.id || makeSessionId(gradeId, lessonScope, mode, reviewOnly),
      gradeId,
      lessonScope,
      lessonLabel: s.lessonLabel || "",
      mode,
      reviewOnly,
      queue: s.queue.slice(),
      currentIndex,
      correctInSession: Number(s.correctInSession) || 0,
      wrongInSession: Number(s.wrongInSession) || 0,
      wrongIdsInSession: Array.isArray(s.wrongIdsInSession) ? s.wrongIdsInSession.slice() : [],
      updatedAt: Number(s.updatedAt) || Date.now()
    };
  }

  function defaultState() {
    return { version: 3, stats: {}, activeSessions: [] };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const sessions = [];
      const seenIds = new Set();

      const addUnique = (rawSess) => {
        const clean = normalizeSessionObj(rawSess);
        if (clean && !seenIds.has(clean.id)) {
          seenIds.add(clean.id);
          sessions.push(clean);
        }
      };

      if (Array.isArray(parsed.activeSessions)) {
        parsed.activeSessions.forEach(addUnique);
      }
      // مهاجرت خودکار از نسخه‌های قبلی که فقط یک activeSession ذخیره می‌کردند
      if (parsed.activeSession) {
        addUnique(parsed.activeSession);
      }

      return {
        version: 3,
        stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {},
        activeSessions: sessions
      };
    } catch {
      return defaultState();
    }
  }

  function getValidActiveSessions() {
    if (!Array.isArray(state.activeSessions)) state.activeSessions = [];
    return state.activeSessions
      .filter((s) => s && Array.isArray(s.queue) && s.currentIndex < s.queue.length)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function getCurrentSession() {
    if (!currentSessionId || !Array.isArray(state.activeSessions)) return null;
    return state.activeSessions.find((s) => s.id === currentSessionId) || null;
  }

  function upsertActiveSession(sessionObj) {
    if (!Array.isArray(state.activeSessions)) state.activeSessions = [];
    const idx = state.activeSessions.findIndex((s) => s.id === sessionObj.id);
    if (idx >= 0) {
      state.activeSessions[idx] = sessionObj;
    } else {
      state.activeSessions.push(sessionObj);
    }
  }

  function removeActiveSession(sessionId) {
    if (!Array.isArray(state.activeSessions)) return;
    state.activeSessions = state.activeSessions.filter((s) => s.id !== sessionId);
    if (currentSessionId === sessionId) {
      currentSessionId = null;
    }
  }

  function isQuotaOrPrivacyError(err) {
    return Boolean(
      err && (
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.name === "SecurityError"
      )
    );
  }

  function loadBackupMeta() {
    try {
      const raw = localStorage.getItem(BACKUP_META_KEY);
      if (!raw) return { lastBackupAt: 0, lastCustomEditAt: 0 };
      const parsed = JSON.parse(raw);
      return {
        lastBackupAt: Number(parsed.lastBackupAt) || 0,
        lastCustomEditAt: Number(parsed.lastCustomEditAt) || 0
      };
    } catch {
      return { lastBackupAt: 0, lastCustomEditAt: 0 };
    }
  }

  function saveBackupMeta() {
    try {
      localStorage.setItem(BACKUP_META_KEY, JSON.stringify(backupMeta));
    } catch {}
  }

  function markBackupTaken() {
    backupMeta.lastBackupAt = Date.now();
    saveBackupMeta();
    updateBackupReminderBanner();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      if (isQuotaOrPrivacyError(err)) {
        showToast("ذخیره‌سازی ممکن نیست (حافظه مرورگر پر است یا در حالت ناشناس هستید).");
      } else {
        showToast("خطا در ذخیره‌سازی خودکار مرورگر.");
      }
    }
  }

  // --- مدیریت لایه‌ی شخصی (Custom Lessons / Sections / Questions) ---
  function defaultCustomData() {
    return { version: 1, grades: {} };
  }

  function loadCustomData() {
    try {
      const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (!raw) return defaultCustomData();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || typeof parsed.grades !== "object") {
        return defaultCustomData();
      }
      return { version: 1, grades: parsed.grades };
    } catch {
      return defaultCustomData();
    }
  }

  function saveCustomData(markEdited) {
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customData));
      if (markEdited !== false) {
        backupMeta.lastCustomEditAt = Date.now();
        saveBackupMeta();
      }
    } catch (err) {
      if (isQuotaOrPrivacyError(err)) {
        showToast("⚠️ فضای ذخیره‌سازی مرورگر پر است یا حالت ناشناس فعال است؛ لطفاً از سؤالات خود پشتیبان بگیرید.");
      } else {
        showToast("خطا در ذخیره سؤال‌های شخصی در مرورگر.");
      }
    }
  }

  function ensureGradeBucket(gradeId) {
    if (!customData.grades[gradeId]) {
      customData.grades[gradeId] = {
        customLessons: [],
        customSections: [],
        lessonSections: {},
        questions: []
      };
    }
    const b = customData.grades[gradeId];
    if (!Array.isArray(b.customLessons)) b.customLessons = [];
    if (!Array.isArray(b.customSections)) b.customSections = [];
    if (!b.lessonSections || typeof b.lessonSections !== "object") b.lessonSections = {};
    if (!Array.isArray(b.questions)) b.questions = [];
    return b;
  }

  function linkSectionToLesson(gradeId, lessonId, sectionId) {
    if (sectionId === "spelling" || sectionId === "meaning") return;
    const bucket = ensureGradeBucket(gradeId);
    if (!Array.isArray(bucket.lessonSections[lessonId])) {
      bucket.lessonSections[lessonId] = [];
    }
    if (!bucket.lessonSections[lessonId].includes(sectionId)) {
      bucket.lessonSections[lessonId].push(sectionId);
    }
  }

  function getCustomTotals() {
    let questions = 0;
    let lessons = 0;
    let sections = 0;
    GRADES.forEach((g) => {
      const b = customData.grades[g.id];
      if (!b) return;
      if (Array.isArray(b.questions)) questions += b.questions.length;
      if (Array.isArray(b.customLessons)) lessons += b.customLessons.length;
      if (Array.isArray(b.customSections)) sections += b.customSections.length;
    });
    return { questions, lessons, sections };
  }

  function countCustomQuestionsForGrade(gradeId) {
    const b = customData.grades[gradeId];
    return b && Array.isArray(b.questions) ? b.questions.length : 0;
  }

  function countCustomQuestionsForLesson(gradeId, lessonId) {
    const b = customData.grades[gradeId];
    if (!b || !Array.isArray(b.questions)) return 0;
    return b.questions.filter((q) => q.lessonId === lessonId).length;
  }

  function countCustomQuestionsForSection(gradeId, lessonId, sectionId) {
    const b = customData.grades[gradeId];
    if (!b || !Array.isArray(b.questions)) return 0;
    return b.questions.filter((q) => q.lessonId === lessonId && q.sectionId === sectionId).length;
  }

  // پاکسازی ایمن همه‌ی آزمون‌های نیمه‌کاره پس از حذف یا جایگزینی سؤالات شخصی
  function sanitizeActiveSessionAfterCustomChange() {
    if (!Array.isArray(state.activeSessions) || !state.activeSessions.length) return;

    state.activeSessions = state.activeSessions.filter((s) => {
      if (!s || !Array.isArray(s.queue)) return false;

      const gId = s.gradeId || "grade6";
      const bucket = ensureGradeBucket(gId);
      const validCustomIds = new Set(bucket.questions.map((q) => q.id));

      const cleanedQueue = s.queue.filter((id) => {
        if (String(id).startsWith("c_q_")) {
          return validCustomIds.has(id);
        }
        return true;
      });

      const isMissingCustomLesson =
        String(s.lessonScope || "").startsWith("c_les_") &&
        !bucket.customLessons.some((cl) => cl.id === s.lessonScope);

      const isMissingCustomSection =
        String(s.mode || "").startsWith("c_sec_") &&
        !bucket.customSections.some((cs) => cs.id === s.mode);

      if (isMissingCustomLesson || isMissingCustomSection || cleanedQueue.length === 0) {
        if (currentSessionId === s.id) currentSessionId = null;
        return false;
      }

      s.queue = cleanedQueue;
      if (s.currentIndex >= s.queue.length) {
        if (currentSessionId === s.id) currentSessionId = null;
        return false;
      }
      return true;
    });
  }

  // اطلاعات نمایشی هر بخش (رسمی، پیشنهادی یا دلخواه)
  function getSectionMeta(gradeId, sectionId) {
    if (sectionId === "spelling") {
      return {
        id: "spelling",
        title: "بخش املا",
        shortTitle: "املا",
        icon: "📝",
        badge: "تشخیص نوشتار درست",
        badgeClass: "badge-blue",
        isBuiltin: true
      };
    }
    if (sectionId === "meaning") {
      const isG1 = gradeId === "grade1";
      return {
        id: "meaning",
        title: isG1 ? "بخش صداشناسی و معنا" : "بخش معنی لغات",
        shortTitle: isG1 ? "صداشناسی و معنا" : "معنی لغات",
        icon: isG1 ? "🔊" : "💬",
        badge: isG1 ? "تشخیص صداها و درک ساده" : "یادگیری معنای واژه‌ها",
        badgeClass: "badge-teal",
        isBuiltin: true
      };
    }
    const preset = PRESET_SECTIONS.find((s) => s.id === sectionId);
    if (preset) {
      return {
        id: preset.id,
        title: `بخش ${preset.title}`,
        shortTitle: preset.title,
        icon: preset.icon,
        badge: "زیربخش شخصی",
        badgeClass: "badge-custom",
        isBuiltin: false,
        isPreset: true
      };
    }
    const bucket = customData.grades[gradeId];
    const customSec = bucket && Array.isArray(bucket.customSections)
      ? bucket.customSections.find((s) => s.id === sectionId)
      : null;
    if (customSec) {
      return {
        id: customSec.id,
        title: customSec.title.startsWith("بخش ") ? customSec.title : `بخش ${customSec.title}`,
        shortTitle: customSec.title,
        icon: "⭐",
        badge: "زیربخش دلخواه",
        badgeClass: "badge-custom",
        isBuiltin: false,
        isCustom: true
      };
    }
    return {
      id: sectionId,
      title: "بخش شخصی",
      shortTitle: "شخصی",
      icon: "⭐",
      badge: "زیربخش شخصی",
      badgeClass: "badge-custom",
      isBuiltin: false
    };
  }

  // ترکیب زنده لایه رسمی (فقط‌خواندنی) + لایه شخصی کاربر
  function buildMergedLessons(gradeId, officialLessons) {
    const bucket = ensureGradeBucket(gradeId);
    const mergedMap = new Map();
    const orderedIds = [];

    (officialLessons || []).forEach((lesson) => {
      const sections = {
        spelling: (lesson.spelling || []).map((q) => ({ ...q, isCustom: false })),
        meaning: (lesson.meaning || []).map((q) => ({ ...q, isCustom: false }))
      };
      mergedMap.set(lesson.id, {
        id: lesson.id,
        title: lesson.title,
        isCustom: false,
        sections
      });
      orderedIds.push(lesson.id);
    });

    bucket.customLessons.forEach((cl) => {
      if (!mergedMap.has(cl.id)) {
        mergedMap.set(cl.id, {
          id: cl.id,
          title: cl.title,
          isCustom: true,
          sections: {}
        });
        orderedIds.push(cl.id);
      }
    });

    bucket.questions.forEach((q) => {
      const targetLesson = mergedMap.get(q.lessonId);
      if (!targetLesson) return;
      if (!targetLesson.sections[q.sectionId]) {
        targetLesson.sections[q.sectionId] = [];
      }
      targetLesson.sections[q.sectionId].push({ ...q, isCustom: true });
    });

    return orderedIds.map((id) => mergedMap.get(id));
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2700);
  }

  function hidePraiseOverlay() {
    if (el.quizPraiseOverlay) {
      el.quizPraiseOverlay.classList.add("hidden");
    }
  }

  function showPraiseOverlay() {
    if (el.quizPraiseOverlay) {
      el.quizPraiseOverlay.classList.remove("hidden");
    }
  }

  function clearAutoNext() {
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
    }
    hidePraiseOverlay();
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // --- بارگذاری پویای فایل داده‌ی هر پایه ---
  function loadGradeData(grade) {
    return new Promise((resolve, reject) => {
      if (Array.isArray(window.SALAR_DATA[grade.id])) {
        resolve(window.SALAR_DATA[grade.id]);
        return;
      }
      if (loadedScripts.has(grade.file)) {
        resolve(window.SALAR_DATA[grade.id] || []);
        return;
      }
      const script = document.createElement("script");
      script.src = `${grade.file}?v=${APP_VERSION}`;
      script.onload = () => {
        loadedScripts.add(grade.file);
        if (Array.isArray(window.SALAR_DATA[grade.id])) {
          resolve(window.SALAR_DATA[grade.id]);
        } else {
          reject(new Error("داده‌ای در فایل پایه یافت نشد."));
        }
      };
      script.onerror = () => reject(new Error("فایل این پایه هنوز بارگذاری نشده است."));
      document.body.appendChild(script);
    });
  }

  function refreshActiveGradeMergedData() {
    if (!activeGrade) return;
    const official = window.SALAR_DATA[activeGrade.id] || [];
    currentLessons = buildMergedLessons(activeGrade.id, official);
    buildQuestionMap(currentLessons);
  }

  function buildQuestionMap(lessonsList) {
    questionMap = new Map();
    lessonsList.forEach((lesson) => {
      Object.keys(lesson.sections).forEach((secId) => {
        (lesson.sections[secId] || []).forEach((q) => {
          questionMap.set(q.id, {
            ...q,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            mode: secId
          });
        });
      });
    });
  }

  function getOrderedSectionIdsForScope(scope) {
    const found = new Set();
    const isAll = scope === "all";
    const targetLessons = isAll
      ? currentLessons
      : currentLessons.filter((l) => l.id === scope);

    targetLessons.forEach((lesson) => {
      Object.keys(lesson.sections).forEach((secId) => {
        const list = lesson.sections[secId] || [];
        if (list.length > 0) {
          found.add(secId);
        } else if (!lesson.isCustom && (secId === "spelling" || secId === "meaning")) {
          found.add(secId);
        }
      });
    });

    const ordered = [];
    if (found.has("spelling")) ordered.push("spelling");
    if (found.has("meaning")) ordered.push("meaning");
    PRESET_SECTIONS.forEach((p) => {
      if (found.has(p.id)) ordered.push(p.id);
    });
    if (activeGrade) {
      const bucket = ensureGradeBucket(activeGrade.id);
      bucket.customSections.forEach((cs) => {
        if (found.has(cs.id)) ordered.push(cs.id);
      });
    }
    found.forEach((id) => {
      if (!ordered.includes(id)) ordered.push(id);
    });
    return ordered;
  }

  function getQuestionsForScope(scope, sectionId) {
    const list = [];
    currentLessons.forEach((l) => {
      if (scope === "all" || l.id === scope) {
        (l.sections[sectionId] || []).forEach((q) => list.push(q.id));
      }
    });
    return list;
  }

  function getCustomQuestionCountForScope(scope, sectionId) {
    let cnt = 0;
    currentLessons.forEach((l) => {
      if (scope === "all" || l.id === scope) {
        (l.sections[sectionId] || []).forEach((q) => {
          if (q.isCustom) cnt++;
        });
      }
    });
    return cnt;
  }

  function getScopeLabel(scope) {
    if (scope === "all") return "همه درس‌ها";
    const found = currentLessons.find((l) => l.id === scope);
    return found ? found.title : "درس";
  }

  function getCombinedCounts(scope) {
    const allIds = [];
    currentLessons.forEach((l) => {
      if (scope === "all" || l.id === scope) {
        Object.keys(l.sections).forEach((secId) => {
          (l.sections[secId] || []).forEach((q) => allIds.push(q.id));
        });
      }
    });
    let ok = 0;
    let wrong = 0;
    allIds.forEach((id) => {
      const st = state.stats[id];
      if (st && st.status === "correct") ok++;
      if (st && st.status === "wrong") wrong++;
    });
    return { total: allIds.length, ok, wrong };
  }

  // --- کنترل نمایش صفحه‌ها و منوی بالا ---
  function setActiveNav(navName) {
    el.navBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === navName);
    });
  }

  function buildNavSnapshot(viewName) {
    return {
      salarNav: true,
      view: viewName,
      gradeId: activeGrade ? activeGrade.id : null,
      lessonScope: selectedLesson || null,
      builderTab: builderTab,
      builderStep: builderStep,
      builderGradeId: builderGradeId,
      builderLessonId: builderLessonId,
      builderSectionId: builderSectionId
    };
  }

  function snapshotKey(snap) {
    if (!snap || !snap.salarNav) return "";
    return [
      snap.view,
      snap.gradeId || "",
      snap.lessonScope || "",
      snap.view === "builder" ? snap.builderTab : "",
      snap.view === "builder" ? snap.builderStep : "",
      snap.view === "builder" ? (snap.builderGradeId || "") : "",
      snap.view === "builder" ? (snap.builderLessonId || "") : "",
      snap.view === "builder" ? (snap.builderSectionId || "") : ""
    ].join("|");
  }

  function syncHistoryState(viewName, forceReplace) {
    if (isHandlingPopState || !window.history || !window.history.pushState) return;
    const snap = buildNavSnapshot(viewName);
    const prev = window.history.state;
    try {
      if (forceReplace || !prev || !prev.salarNav) {
        window.history.replaceState(snap, "");
      } else if (snapshotKey(prev) !== snapshotKey(snap)) {
        window.history.pushState(snap, "");
      }
    } catch {}
  }

  function restoreFromHistorySnapshot(snap) {
    if (!snap || !snap.salarNav || !snap.view || snap.view === "grades") {
      renderGrades();
      return;
    }

    if (snap.view === "install") {
      renderInstall(false);
      return;
    }
    if (snap.view === "about") {
      renderAbout();
      return;
    }
    if (snap.view === "naming") {
      renderNaming();
      return;
    }

    if (snap.view === "builder") {
      setActiveNav("builder");
      builderTab = snap.builderTab === "backup" ? "backup" : "manage";
      builderStep = snap.builderStep || "grades";
      builderGradeId = snap.builderGradeId || null;
      builderLessonId = snap.builderLessonId || null;
      builderSectionId = snap.builderSectionId || null;
      hideInlineLessonBox();
      hideInlineSectionBox();
      cancelEditQuestion(true);
      showView("builder");
      if (builderTab === "backup") {
        renderBackupPanel();
        renderBuilder();
        return;
      }
      if (builderGradeId) {
        const gObj = GRADES.find((g) => g.id === builderGradeId);
        if (gObj) {
          loadGradeData(gObj)
            .then(() => {
              renderBuilder();
            })
            .catch(() => {
              builderStep = "grades";
              renderBuilder();
            })
            .finally(() => {
              isHandlingPopState = false;
            });
          return true;
        }
      }
      renderBuilder();
      return false;
    }

    if (snap.view === "gradeHome" || snap.view === "lesson" || snap.view === "quiz" || snap.view === "result") {
      const gObj = GRADES.find((g) => g.id === snap.gradeId);
      if (!gObj) {
        renderGrades();
        return false;
      }
      loadGradeData(gObj)
        .then((officialLessons) => {
          activeGrade = gObj;
          currentLessons = buildMergedLessons(gObj.id, officialLessons);
          buildQuestionMap(currentLessons);
          if (snap.view === "gradeHome") {
            renderGradeHome();
          } else {
            // هنگام برگشت از آزمون یا نتیجه، مستقیم و تمیز به صفحه درس برمی‌گردیم
            openLesson(snap.lessonScope || "all");
          }
        })
        .catch(() => {
          renderGrades();
        })
        .finally(() => {
          isHandlingPopState = false;
        });
      return true;
    }

    renderGrades();
    return false;
  }

  function showView(viewName) {
    currentViewName = viewName;

    // هنگام ورود دانش‌آموز به مقطع/درس/آزمون، بنر پنهان می‌شود تا تمرکز حفظ شود؛ در بازگشت به مقاطع دوباره نمایش می‌یابد
    const hideBanner =
      viewName === "gradeHome" ||
      viewName === "lesson" ||
      viewName === "quiz" ||
      viewName === "result";
    if (el.siteBannerWrap) {
      el.siteBannerWrap.classList.toggle("hidden", hideBanner);
    }

    el.gradesView.classList.toggle("hidden", viewName !== "grades");
    el.gradeHomeView.classList.toggle("hidden", viewName !== "gradeHome");
    el.lessonView.classList.toggle("hidden", viewName !== "lesson");
    el.quizView.classList.toggle("hidden", viewName !== "quiz");
    el.resultView.classList.toggle("hidden", viewName !== "result");
    el.builderView.classList.toggle("hidden", viewName !== "builder");
    el.installView.classList.toggle("hidden", viewName !== "install");
    el.aboutView.classList.toggle("hidden", viewName !== "about");
    el.namingView.classList.toggle("hidden", viewName !== "naming");
    syncHistoryState(viewName, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function configureHeader(title, tabTitle, backLabel, backHandler) {
    el.pageTitle.textContent = title;
    document.title = tabTitle;
    if (backLabel && backHandler) {
      el.btnTopBack.textContent = backLabel;
      el.btnTopBack.onclick = backHandler;
      el.btnTopBack.classList.remove("hidden");
    } else {
      el.btnTopBack.classList.add("hidden");
      el.btnTopBack.onclick = null;
    }
  }

  // --- ۱. صفحه انتخاب مقطع ---
  function renderGrades() {
    clearAutoNext();
    setActiveNav("grades");
    configureHeader(
      "انتخاب مقطع تحصیلی",
      "سالار — نرم‌افزار تعاملی املا و لغت فارسی دبستان",
      null,
      null
    );



    el.gradesGrid.innerHTML = "";
    GRADES.forEach((grade) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grade-card-btn";
      btn.disabled = !grade.ready;

      const customCount = countCustomQuestionsForGrade(grade.id);
      const statusBadge = grade.ready
        ? `<span class="badge badge-blue">آماده تمرین</span>`
        : `<span class="badge badge-muted">به‌زودی</span>`;
      const metaText = customCount > 0
        ? `${grade.shortTitle} • ${toPersianDigits(customCount)} سؤال شخصی`
        : grade.shortTitle;

      btn.innerHTML = `
        ${statusBadge}
        <span class="grade-title">${grade.title}</span>
        <span class="grade-meta">${metaText}</span>
      `;
      if (grade.ready) {
        btn.addEventListener("click", () => openGrade(grade.id));
      }
      el.gradesGrid.appendChild(btn);
    });

    showView("grades");
  }

  // --- ۲. صفحه درس‌های یک مقطع ---
  function openGrade(gradeId) {
    clearAutoNext();
    const grade = GRADES.find((g) => g.id === gradeId);
    if (!grade || !grade.ready) {
      showToast("محتوای این پایه به‌زودی اضافه می‌شود.");
      return;
    }

    loadGradeData(grade)
      .then((officialLessons) => {
        activeGrade = grade;
        selectedLesson = null;
        currentLessons = buildMergedLessons(grade.id, officialLessons);
        buildQuestionMap(currentLessons);
        renderGradeHome();
      })
      .catch((err) => {
        showToast(err.message || "خطا در بارگذاری داده‌های پایه.");
      });
  }

  function renderGradeResumeCard() {
    if (!el.resumeCard || !el.resumeList || !activeGrade) return;
    const sessions = getValidActiveSessions().filter(
      (s) => (s.gradeId || "grade6") === activeGrade.id
    );

    if (sessions.length > 0) {
      if (el.resumeBadge) {
        el.resumeBadge.textContent = sessions.length > 1
          ? `آزمون‌های نیمه‌کاره (${toPersianDigits(sessions.length)})`
          : "آزمون نیمه‌کاره";
      }
      if (el.resumeSubtitle) {
        el.resumeSubtitle.textContent = sessions.length > 1
          ? `تمرین‌های ناتمام ${activeGrade.shortTitle} را می‌توانی از همان‌جا ادامه دهی:`
          : `یک تمرین ناتمام در ${activeGrade.shortTitle} داری؛ می‌توانی از همان‌جا ادامه دهی:`;
      }

      el.resumeList.innerHTML = "";
      sessions.forEach((s) => {
        const secMeta = getSectionMeta(activeGrade.id, s.mode || "spelling");
        const reviewTag = s.reviewOnly ? " (مرور اشتباهات)" : "";
        const lessonTitle = s.lessonLabel || getScopeLabel(s.lessonScope);

        const row = document.createElement("div");
        row.className = "resume-row";

        const info = document.createElement("div");
        info.className = "resume-row-info";
        info.innerHTML = `
          <span class="resume-row-title">${escapeHtml(lessonTitle)}</span>
          <span class="resume-row-meta">${escapeHtml(secMeta.title)}${reviewTag} • سؤال ${toPersianDigits(s.currentIndex + 1)} از ${toPersianDigits(s.queue.length)}</span>
        `;

        const actions = document.createElement("div");
        actions.className = "resume-actions";

        const btnContinue = document.createElement("button");
        btnContinue.type = "button";
        btnContinue.className = "btn btn-primary btn-sm";
        btnContinue.textContent = "ادامه از همین‌جا";
        btnContinue.addEventListener("click", () => resumeSession(s.id));

        const btnDiscard = document.createElement("button");
        btnDiscard.type = "button";
        btnDiscard.className = "btn btn-ghost btn-sm";
        btnDiscard.textContent = "بستن";
        btnDiscard.addEventListener("click", () => {
          removeActiveSession(s.id);
          saveState();
          renderGradeHome();
        });

        actions.appendChild(btnContinue);
        actions.appendChild(btnDiscard);
        row.appendChild(info);
        row.appendChild(actions);
        el.resumeList.appendChild(row);
      });

      el.resumeCard.classList.remove("hidden");
    } else {
      el.resumeList.innerHTML = "";
      el.resumeCard.classList.add("hidden");
    }
  }

  function renderGradeHome() {
    clearAutoNext();
    refreshActiveGradeMergedData();
    setActiveNav("grades");
    configureHeader(
      `تمرین املا و لغت ${activeGrade.shortTitle}`,
      `${activeGrade.shortTitle} — سالار`,
      null,
      null
    );

    renderGradeResumeCard();

    el.lessonsGrid.innerHTML = "";

    const allCounts = getCombinedCounts("all");
    const allItem = document.createElement("div");
    allItem.className = "lesson-item lesson-item-all";

    let allPillClass = "lesson-pill";
    let allPillText = `${allCounts.ok} از ${allCounts.total}`;
    if (allCounts.wrong > 0) {
      allPillClass += " has-wrong";
      allPillText = `${allCounts.wrong} غلط از ${allCounts.total}`;
    } else if (allCounts.total > 0 && allCounts.ok === allCounts.total) {
      allPillClass += " all-ok";
      allPillText = "کامل";
    }

    const btnAllMain = document.createElement("button");
    btnAllMain.type = "button";
    btnAllMain.className = "lesson-main-btn";
    btnAllMain.innerHTML = `
      <span>همه درس‌ها</span>
      <span class="${allPillClass}">${allPillText}</span>
    `;
    btnAllMain.addEventListener("click", () => openLesson("all"));

    const btnAllReset = document.createElement("button");
    btnAllReset.type = "button";
    btnAllReset.className = "lesson-reset-btn";
    btnAllReset.title = `بازنشانی همه درس‌های ${activeGrade.title}`;
    btnAllReset.textContent = "بازنشانی";
    btnAllReset.addEventListener("click", (e) => {
      e.stopPropagation();
      resetCurrentGrade(true);
    });

    allItem.appendChild(btnAllMain);
    allItem.appendChild(btnAllReset);
    el.lessonsGrid.appendChild(allItem);

    currentLessons.forEach((lesson) => {
      const counts = getCombinedCounts(lesson.id);
      const item = document.createElement("div");
      item.className = "lesson-item";

      let pillClass = "lesson-pill";
      let pillText = counts.total > 0 ? `${counts.ok}/${counts.total}` : "بدون سؤال";
      if (counts.wrong > 0) {
        pillClass += " has-wrong";
        pillText = `${counts.wrong} غلط`;
      } else if (counts.total > 0 && counts.ok === counts.total) {
        pillClass += " all-ok";
        pillText = "کامل";
      }

      const customTag = lesson.isCustom ? `<span class="lesson-custom-tag">درس من</span>` : "";

      const mainBtn = document.createElement("button");
      mainBtn.type = "button";
      mainBtn.className = "lesson-main-btn";
      mainBtn.innerHTML = `
        <span>${escapeHtml(lesson.title)}${customTag}</span>
        <span class="${pillClass}">${pillText}</span>
      `;
      mainBtn.addEventListener("click", () => openLesson(lesson.id));

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "lesson-reset-btn";
      resetBtn.title = `بازنشانی ${lesson.title}`;
      resetBtn.textContent = "بازنشانی";
      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetLessonById(lesson.id, true);
      });

      item.appendChild(mainBtn);
      item.appendChild(resetBtn);
      el.lessonsGrid.appendChild(item);
    });

    showView("gradeHome");
  }

  // --- ۳. صفحه داخلی درس (ساخت پویا کارت‌های بخش‌ها) ---
  function openLesson(scope) {
    clearAutoNext();
    refreshActiveGradeMergedData();
    selectedLesson = scope;

    if (scope !== "all" && !currentLessons.some((l) => l.id === scope)) {
      renderGradeHome();
      return;
    }

    const label = getScopeLabel(scope);
    configureHeader(
      `${activeGrade.shortTitle} — ${label}`,
      `${label} — سالار`,
      "بازگشت به فهرست درس‌ها",
      renderGradeHome
    );

    const sectionIds = getOrderedSectionIdsForScope(scope);
    el.modesGrid.innerHTML = "";

    if (!sectionIds.length) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "empty-state-box";
      emptyBox.innerHTML = `
        <p>هنوز سؤالی برای این درس ثبت نشده است. از بخش «طراحی سؤال» می‌توانید برای این درس سؤال اضافه کنید.</p>
      `;
      const goBuilderBtn = document.createElement("button");
      goBuilderBtn.type = "button";
      goBuilderBtn.className = "btn btn-primary btn-sm";
      goBuilderBtn.textContent = "➕ رفتن به طراحی سؤال";
      goBuilderBtn.addEventListener("click", () => {
        openBuilder(activeGrade.id, scope !== "all" ? scope : null, null);
      });
      emptyBox.appendChild(goBuilderBtn);
      el.modesGrid.appendChild(emptyBox);
    } else {
      sectionIds.forEach((secId) => {
        const meta = getSectionMeta(activeGrade.id, secId);
        const ids = getQuestionsForScope(scope, secId);
        const customCnt = getCustomQuestionCountForScope(scope, secId);

        let ok = 0;
        let wrong = 0;
        ids.forEach((id) => {
          const st = state.stats[id];
          if (st && st.status === "correct") ok++;
          if (st && st.status === "wrong") wrong++;
        });

        const card = document.createElement("div");
        card.className = "card mode-card";

        const customNoteHtml = (meta.isBuiltin && customCnt > 0)
          ? `<div class="mode-custom-note">شامل ${toPersianDigits(customCnt)} سؤال شخصی</div>`
          : "";

        card.innerHTML = `
          <div>
            <div class="mode-header">
              <h2>${escapeHtml(meta.title)}</h2>
              <span class="badge ${meta.badgeClass}">${escapeHtml(meta.badge)}</span>
            </div>
            ${customNoteHtml}
            <div class="stats-row">
              <div>کل سؤالات: <strong>${ids.length}</strong></div>
              <div>بلد بوده: <strong class="text-green">${ok}</strong></div>
              <div>نیاز به مرور: <strong class="text-red">${wrong}</strong></div>
            </div>
          </div>
          <div class="mode-actions"></div>
        `;

        const actionsWrap = card.querySelector(".mode-actions");

        const btnStart = document.createElement("button");
        btnStart.type = "button";
        btnStart.className = "btn btn-primary btn-block";
        btnStart.textContent = `شروع تمرین ${meta.shortTitle}`;
        btnStart.disabled = ids.length === 0;
        btnStart.addEventListener("click", () => startQuiz(secId, false));
        actionsWrap.appendChild(btnStart);

        if (wrong > 0) {
          const btnReview = document.createElement("button");
          btnReview.type = "button";
          btnReview.className = "btn btn-danger-outline btn-block";
          btnReview.textContent = `مرور اشتباهات ${meta.shortTitle} (${wrong})`;
          btnReview.addEventListener("click", () => startQuiz(secId, true));
          actionsWrap.appendChild(btnReview);
        }

        el.modesGrid.appendChild(card);
      });
    }

    const isAll = selectedLesson === "all";
    el.btnResetLesson.classList.toggle("hidden", isAll);
    el.btnResetAll.classList.toggle("hidden", !isAll);

    showView("lesson");
  }

  // --- ۴. آزمون ---
  function startQuiz(sectionId, reviewOnly) {
    clearAutoNext();
    if (!activeGrade || !selectedLesson) return;

    let ids = getQuestionsForScope(selectedLesson, sectionId);
    if (reviewOnly) {
      ids = ids.filter((id) => state.stats[id] && state.stats[id].status === "wrong");
    }

    if (!ids.length) {
      showToast("سؤالی برای نمایش وجود ندارد.");
      return;
    }

    const sessionId = makeSessionId(activeGrade.id, selectedLesson, sectionId, reviewOnly);
    const sessionObj = {
      id: sessionId,
      gradeId: activeGrade.id,
      lessonScope: selectedLesson,
      lessonLabel: getScopeLabel(selectedLesson),
      mode: sectionId,
      reviewOnly: reviewOnly,
      queue: shuffle(ids),
      currentIndex: 0,
      correctInSession: 0,
      wrongInSession: 0,
      wrongIdsInSession: [],
      updatedAt: Date.now()
    };

    upsertActiveSession(sessionObj);
    currentSessionId = sessionId;
    currentQuestionIndex = 0;
    saveState();
    renderQuestion();
    showView("quiz");
  }

  function resumeSession(sessionId) {
    clearAutoNext();
    const s = state.activeSessions.find((item) => item.id === sessionId);
    if (!s || !Array.isArray(s.queue)) {
      renderGrades();
      return;
    }

    const gradeId = s.gradeId || "grade6";
    const grade = GRADES.find((g) => g.id === gradeId);
    if (!grade || !grade.ready) {
      removeActiveSession(s.id);
      saveState();
      renderGrades();
      return;
    }

    loadGradeData(grade)
      .then((officialLessons) => {
        activeGrade = grade;
        currentLessons = buildMergedLessons(grade.id, officialLessons);
        buildQuestionMap(currentLessons);

        s.queue = s.queue.filter((id) => questionMap.has(id));
        if (s.currentIndex >= s.queue.length) {
          removeActiveSession(s.id);
          saveState();
          renderGradeHome();
          return;
        }

        s.lessonLabel = getScopeLabel(s.lessonScope);
        s.updatedAt = Date.now();
        currentSessionId = s.id;
        selectedLesson = s.lessonScope;
        currentQuestionIndex = s.currentIndex;
        saveState();
        renderQuestion();
        showView("quiz");
      })
      .catch(() => {
        showToast("خطا در بازیابی آزمون نیمه‌کاره.");
      });
  }

  function renderQuestion() {
    clearAutoNext();
    const s = getCurrentSession();
    if (!s) {
      renderGrades();
      return;
    }
    const qId = s.queue[currentQuestionIndex];
    const q = questionMap.get(qId);
    if (!q) {
      finishSession();
      return;
    }

    isAnswered = false;
    const scopeLabel = getScopeLabel(s.lessonScope);
    configureHeader(
      `${activeGrade.shortTitle} — ${scopeLabel}`,
      `${scopeLabel} — سالار`,
      "بازگشت به فهرست درس‌ها",
      renderGradeHome
    );

    const secMeta = getSectionMeta(activeGrade.id, s.mode || "spelling");
    el.quizTitle.textContent = s.reviewOnly
      ? `مرور اشتباهات ${secMeta.shortTitle}`
      : `تمرین ${secMeta.shortTitle}`;
    el.quizProgressText.textContent = `سؤال ${currentQuestionIndex + 1} از ${s.queue.length}`;
    el.progressBar.style.width = `${(currentQuestionIndex / s.queue.length) * 100}%`;

    el.btnBackLesson.textContent = s.lessonScope === "all" ? "برگشت به همه درس‌ها" : "برگشت به درس";
    el.questionLessonTag.textContent = q.isCustom
      ? `${q.lessonTitle} • سؤال شخصی`
      : q.lessonTitle;
    el.questionPrompt.textContent = q.prompt;

    el.feedbackBox.classList.add("hidden");
    el.feedbackBox.className = "feedback-box hidden";
    el.btnNext.classList.add("hidden");

    const optionItems = q.options.map((text, idx) => ({
      text: text,
      isCorrect: idx === q.answer
    }));
    const shuffledOptions = shuffle(optionItems);

    el.optionsContainer.innerHTML = "";
    el.optionsContainer.className = "options-grid";

    const maxOptLen = shuffledOptions.reduce((mx, o) => Math.max(mx, o.text.length), 0);
    const isLongList = (s.mode === "meaning" && maxOptLen > 18) || maxOptLen > 24;

    if (isLongList) {
      el.optionsContainer.classList.add("meaning-mode", "cols-1");
    } else {
      const count = shuffledOptions.length;
      if (count === 2 || count === 4) {
        el.optionsContainer.classList.add("cols-2");
      } else if (count >= 3) {
        el.optionsContainer.classList.add("cols-3");
      } else {
        el.optionsContainer.classList.add("cols-1");
      }
    }

    shuffledOptions.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.textContent = opt.text;
      btn.dataset.correct = opt.isCorrect ? "1" : "0";
      btn.addEventListener("click", () => handleAnswer(btn, opt.isCorrect, q));
      el.optionsContainer.appendChild(btn);
    });
  }

  function handleAnswer(clickedBtn, isCorrect, q) {
    if (isAnswered) return;
    isAnswered = true;

    const s = getCurrentSession();
    if (!s) return;
    const allBtns = el.optionsContainer.querySelectorAll(".option-btn");
    allBtns.forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === "1") {
        b.classList.add("correct");
      }
    });

    s.currentIndex = currentQuestionIndex + 1;
    s.updatedAt = Date.now();

    if (isCorrect) {
      s.correctInSession++;
      state.stats[q.id] = { status: "correct" };
      saveState();

      if (s.currentIndex >= s.queue.length) {
        el.progressBar.style.width = "100%";
      }

      showPraiseOverlay();
      autoNextTimer = setTimeout(() => {
        hidePraiseOverlay();
        nextQuestion();
      }, AUTO_NEXT_DELAY_MS);
    } else {
      clickedBtn.classList.add("wrong");
      s.wrongInSession++;
      if (!s.wrongIdsInSession.includes(q.id)) {
        s.wrongIdsInSession.push(q.id);
      }
      state.stats[q.id] = { status: "wrong" };
      saveState();

      el.feedbackBox.classList.add("err");
      el.feedbackStatus.textContent = "پاسخ درست نبود؛ دقت کن!";
      el.feedbackHint.textContent = q.hint || "";
      el.feedbackBox.classList.remove("hidden");

      if (s.currentIndex >= s.queue.length) {
        el.progressBar.style.width = "100%";
        el.btnNext.textContent = "مشاهده نتیجه";
      } else {
        el.btnNext.textContent = "سؤال بعدی";
      }
      el.btnNext.classList.remove("hidden");
    }
  }

  function nextQuestion() {
    clearAutoNext();
    const s = getCurrentSession();
    if (!s) return;
    currentQuestionIndex++;
    if (currentQuestionIndex >= s.queue.length) {
      finishSession();
    } else {
      renderQuestion();
    }
  }

  function finishSession() {
    clearAutoNext();
    const s = getCurrentSession();
    lastFinishedSession = s ? { ...s } : null;
    if (s) {
      removeActiveSession(s.id);
    }
    saveState();

    const total = s ? s.queue.length : 0;
    const ok = s ? s.correctInSession : 0;
    const wrong = s ? s.wrongInSession : 0;
    const ratio = total > 0 ? ok / total : 0;

    el.resCorrect.textContent = toPersianDigits(ok);
    el.resWrong.textContent = toPersianDigits(wrong);

    if (wrong === 0 && total > 0) {
      if (el.resultSticker) {
        el.resultSticker.src = "images/salar_congratulations.png";
        el.resultSticker.alt = "تبریک! موفق شدی!";
      }
      el.resultSummary.textContent = `عالی بود! به همه ${toPersianDigits(total)} سؤال درست پاسخ دادی.`;
    } else if (ratio >= 0.8) {
      if (el.resultSticker) {
        el.resultSticker.src = "images/salar_praise.png";
        el.resultSticker.alt = "آفرین! عالی نوشتی!";
      }
      el.resultSummary.textContent =
        `خیلی خوب بود! از ${toPersianDigits(total)} سؤال به ${toPersianDigits(ok)} سؤال درست پاسخ دادی. می‌توانی همین الان اشتباهاتت را دوباره تمرین کنی.`;
    } else {
      if (el.resultSticker) {
        el.resultSticker.src = "images/salar_encouragement.png";
        el.resultSticker.alt = "اشکالی ندارد، دوباره تلاش کن.";
      }
      el.resultSummary.textContent =
        `از ${toPersianDigits(total)} سؤال به ${toPersianDigits(ok)} سؤال درست پاسخ دادی. می‌توانی همین الان اشتباهاتت را دوباره تمرین کنی.`;
    }

    el.btnResultLesson.textContent =
      (s && s.lessonScope === "all") ? "برگشت به همه درس‌ها" : "برگشت به درس";
    el.btnRetryMistakes.classList.toggle("hidden", wrong === 0);
    showView("result");
  }

  function backToCurrentLesson() {
    clearAutoNext();
    const s = getCurrentSession();
    const targetScope = s ? s.lessonScope : (selectedLesson || "all");
    if (s && s.currentIndex >= s.queue.length) {
      removeActiveSession(s.id);
    }
    currentSessionId = null;
    saveState();
    openLesson(targetScope);
  }

  // ===========================================================================
  // ۶. بخش «طراحی سؤال» کارتی و مرحله‌به‌مرحله + تب «بارگیری و پشتیبان‌گیری»
  // ===========================================================================
  function updateBuilderTotalBadge() {
    const totals = getCustomTotals();
    el.builderTotalBadge.textContent = `${toPersianDigits(totals.questions)} سؤال شخصی`;
  }

  function getBuilderGradeObj() {
    return GRADES.find((g) => g.id === builderGradeId) || null;
  }

  function getBuilderLessonObj() {
    if (!builderGradeId || !builderLessonId) return null;
    const official = (window.SALAR_DATA[builderGradeId] || []).find((l) => l.id === builderLessonId);
    if (official) return { id: official.id, title: official.title, isCustom: false, raw: official };
    const bucket = ensureGradeBucket(builderGradeId);
    const custom = bucket.customLessons.find((cl) => cl.id === builderLessonId);
    if (custom) return { id: custom.id, title: custom.title, isCustom: true, raw: null };
    return null;
  }

  function openBuilder(preselectGradeId, preselectLessonId, preselectSectionId) {
    clearAutoNext();
    setActiveNav("builder");
    builderTab = "manage";
    hideInlineLessonBox();
    hideInlineSectionBox();
    cancelEditQuestion(true);
    clearPendingRestore();

    if (preselectGradeId && VALID_GRADE_IDS.has(preselectGradeId)) {
      builderGradeId = preselectGradeId;
      const grade = getBuilderGradeObj();
      showView("builder");
      loadGradeData(grade)
        .then(() => {
          if (preselectLessonId) {
            builderLessonId = preselectLessonId;
            if (preselectSectionId) {
              builderSectionId = preselectSectionId;
              builderStep = "questions";
            } else {
              builderSectionId = null;
              builderStep = "sections";
            }
          } else {
            builderLessonId = null;
            builderSectionId = null;
            builderStep = "lessons";
          }
          renderBuilder();
        })
        .catch(() => {
          builderGradeId = null;
          builderLessonId = null;
          builderSectionId = null;
          builderStep = "grades";
          renderBuilder();
        });
      return;
    }

    builderGradeId = null;
    builderLessonId = null;
    builderSectionId = null;
    builderStep = "grades";
    showView("builder");
    renderBuilder();
  }

  function switchBuilderTab(tabName) {
    builderTab = tabName === "backup" ? "backup" : "manage";
    hideInlineLessonBox();
    hideInlineSectionBox();
    if (builderTab === "backup") {
      renderBackupPanel();
    }
    renderBuilder();
  }

  function renderBuilder() {
    updateBuilderTotalBadge();

    const isManage = builderTab === "manage";
    el.tabBuilderManage.classList.toggle("active", isManage);
    el.tabBuilderManage.setAttribute("aria-selected", isManage ? "true" : "false");
    el.tabBuilderBackup.classList.toggle("active", !isManage);
    el.tabBuilderBackup.setAttribute("aria-selected", !isManage ? "true" : "false");

    el.builderManagePanel.classList.toggle("hidden", !isManage);
    el.builderBackupPanel.classList.toggle("hidden", isManage);

    if (!isManage) {
      configureHeader(
        "بارگیری و پشتیبان‌گیری سؤال‌های شخصی",
        "بارگیری و پشتیبان‌گیری — سالار",
        null,
        null
      );
      syncHistoryState("builder", false);
      return;
    }

    // تنظیم عنوان صفحه و دکمه بازگشت بالا بر اساس مرحله فعلی
    const gradeObj = getBuilderGradeObj();
    const lessonObj = getBuilderLessonObj();

    if (builderStep === "grades" || !gradeObj) {
      builderStep = "grades";
      configureHeader("طراحی سؤال — انتخاب پایه", "طراحی سؤال — سالار", null, null);
    } else if (builderStep === "lessons" || !lessonObj) {
      builderStep = "lessons";
      configureHeader(
        `طراحی سؤال — ${gradeObj.shortTitle}`,
        `طراحی سؤال ${gradeObj.shortTitle}`,
        "بازگشت به مقاطع",
        () => {
          builderStep = "grades";
          builderGradeId = null;
          builderLessonId = null;
          builderSectionId = null;
          hideInlineLessonBox();
          renderBuilder();
        }
      );
    } else if (builderStep === "sections" || !builderSectionId) {
      builderStep = "sections";
      configureHeader(
        `زیربخش‌های ${lessonObj.title}`,
        `زیربخش‌ها — ${lessonObj.title}`,
        "بازگشت به درس‌ها",
        () => {
          builderStep = "lessons";
          builderLessonId = null;
          builderSectionId = null;
          hideInlineSectionBox();
          renderBuilder();
        }
      );
    } else {
      const secMeta = getSectionMeta(builderGradeId, builderSectionId);
      configureHeader(
        `${secMeta.title} — ${lessonObj.title}`,
        `${secMeta.title} — طراحی سؤال`,
        "بازگشت به زیربخش‌ها",
        () => {
          builderStep = "sections";
          builderSectionId = null;
          cancelEditQuestion(true);
          renderBuilder();
        }
      );
    }

    renderBuilderBreadcrumb();

    el.builderStepGrades.classList.toggle("hidden", builderStep !== "grades");
    el.builderStepLessons.classList.toggle("hidden", builderStep !== "lessons");
    el.builderStepSections.classList.toggle("hidden", builderStep !== "sections");
    el.builderStepQuestions.classList.toggle("hidden", builderStep !== "questions");

    if (builderStep === "grades") renderBuilderGradesStep();
    else if (builderStep === "lessons") renderBuilderLessonsStep();
    else if (builderStep === "sections") renderBuilderSectionsStep();
    else if (builderStep === "questions") renderBuilderQuestionsStep();

    syncHistoryState("builder", false);
  }

  function renderBuilderBreadcrumb() {
    el.builderBreadcrumb.innerHTML = "";
    const gradeObj = getBuilderGradeObj();
    const lessonObj = getBuilderLessonObj();
    const secMeta = builderSectionId && builderGradeId
      ? getSectionMeta(builderGradeId, builderSectionId)
      : null;

    const crumbs = [
      {
        label: "مقاطع",
        active: builderStep === "grades",
        onClick: () => {
          builderStep = "grades";
          builderGradeId = null;
          builderLessonId = null;
          builderSectionId = null;
          hideInlineLessonBox();
          hideInlineSectionBox();
          cancelEditQuestion(true);
          renderBuilder();
        }
      }
    ];

    if (gradeObj && builderStep !== "grades") {
      crumbs.push({
        label: gradeObj.shortTitle,
        active: builderStep === "lessons",
        onClick: () => {
          builderStep = "lessons";
          builderLessonId = null;
          builderSectionId = null;
          hideInlineSectionBox();
          cancelEditQuestion(true);
          renderBuilder();
        }
      });
    }

    if (lessonObj && (builderStep === "sections" || builderStep === "questions")) {
      crumbs.push({
        label: lessonObj.title,
        active: builderStep === "sections",
        onClick: () => {
          builderStep = "sections";
          builderSectionId = null;
          cancelEditQuestion(true);
          renderBuilder();
        }
      });
    }

    if (secMeta && builderStep === "questions") {
      crumbs.push({
        label: secMeta.shortTitle,
        active: true,
        onClick: null
      });
    }

    crumbs.forEach((c, idx) => {
      if (idx > 0) {
        const sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "←";
        el.builderBreadcrumb.appendChild(sep);
      }
      if (c.active || !c.onClick) {
        const span = document.createElement("span");
        span.className = "crumb-current";
        span.textContent = c.label;
        el.builderBreadcrumb.appendChild(span);
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crumb-btn";
        btn.textContent = c.label;
        btn.addEventListener("click", c.onClick);
        el.builderBreadcrumb.appendChild(btn);
      }
    });
  }

  // --- مرحله ۱ طراحی سؤال: کارت‌های ۶ پایه ---
  function renderBuilderGradesStep() {
    el.builderGradesGrid.innerHTML = "";
    GRADES.forEach((grade) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grade-card-btn";

      const bucket = ensureGradeBucket(grade.id);
      const qCnt = bucket.questions.length;
      const lCnt = bucket.customLessons.length;

      const badgeHtml = qCnt > 0
        ? `<span class="badge badge-teal">${toPersianDigits(qCnt)} سؤال شخصی</span>`
        : `<span class="badge badge-muted">بدون سؤال شخصی</span>`;

      const subParts = [grade.shortTitle];
      if (lCnt > 0) subParts.push(`${toPersianDigits(lCnt)} درس شخصی`);

      btn.innerHTML = `
        ${badgeHtml}
        <span class="grade-title">${grade.title}</span>
        <span class="grade-meta">${subParts.join(" • ")}</span>
      `;
      btn.addEventListener("click", () => {
        builderGradeId = grade.id;
        builderLessonId = null;
        builderSectionId = null;
        loadGradeData(grade)
          .then(() => {
            builderStep = "lessons";
            renderBuilder();
          })
          .catch(() => {
            builderStep = "lessons";
            renderBuilder();
          });
      });
      el.builderGradesGrid.appendChild(btn);
    });
  }

  // --- مرحله ۲ طراحی سؤال: کارت‌های درس‌ها (+ کارت اول: افزودن درس جدید) ---
  function renderBuilderLessonsStep() {
    el.builderLessonsGrid.innerHTML = "";
    const officialLessons = window.SALAR_DATA[builderGradeId] || [];
    const bucket = ensureGradeBucket(builderGradeId);

    // اولین کارت: افزودن درس جدید
    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.className = "builder-card builder-card-add";
    addCard.innerHTML = `
      <span class="builder-card-add-icon">＋</span>
      <span class="builder-card-add-label">افزودن درس جدید</span>
    `;
    addCard.addEventListener("click", () => showInlineLessonBox("create", null));
    el.builderLessonsGrid.appendChild(addCard);

    // کارت‌های درس‌های رسمی + درس‌های شخصی
    const allLessons = [
      ...officialLessons.map((l) => ({ id: l.id, title: l.title, isCustom: false })),
      ...bucket.customLessons.map((cl) => ({ id: cl.id, title: cl.title, isCustom: true }))
    ];

    allLessons.forEach((lesson) => {
      const card = document.createElement("div");
      card.className = `builder-card${lesson.isCustom ? " builder-card-custom" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const customCnt = countCustomQuestionsForLesson(builderGradeId, lesson.id);
      const countBadge = customCnt > 0
        ? `<span class="badge badge-teal">${toPersianDigits(customCnt)} سؤال شخصی</span>`
        : `<span class="badge badge-muted">۰ سؤال شخصی</span>`;
      const originBadge = lesson.isCustom
        ? `<span class="badge badge-custom">شخصی</span>`
        : `<span class="badge badge-blue">رسمی</span>`;

      card.innerHTML = `
        <div class="builder-card-top">
          <span class="builder-card-icon">${lesson.isCustom ? "⭐" : "📖"}</span>
          <div class="builder-card-actions"></div>
        </div>
        <div class="builder-card-name">${escapeHtml(lesson.title)}</div>
        <div class="builder-card-footer">
          ${originBadge}
          ${countBadge}
        </div>
      `;

      if (lesson.isCustom) {
        const actionsEl = card.querySelector(".builder-card-actions");
        const btnRename = document.createElement("button");
        btnRename.type = "button";
        btnRename.className = "icon-action-btn";
        btnRename.title = "تغییر نام درس";
        btnRename.textContent = "✏️";
        btnRename.addEventListener("click", (e) => {
          e.stopPropagation();
          showInlineLessonBox("rename", lesson.id);
        });

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "icon-action-btn danger";
        btnDel.title = "حذف درس شخصی";
        btnDel.textContent = "🗑️";
        btnDel.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteCustomLessonById(lesson.id);
        });

        actionsEl.appendChild(btnRename);
        actionsEl.appendChild(btnDel);
      }

      const openThisLesson = () => {
        builderLessonId = lesson.id;
        builderSectionId = null;
        builderStep = "sections";
        hideInlineLessonBox();
        renderBuilder();
      };

      card.addEventListener("click", openThisLesson);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openThisLesson();
        }
      });

      el.builderLessonsGrid.appendChild(card);
    });
  }

  function showInlineLessonBox(mode, targetLessonId) {
    lessonFormMode = mode;
    renamingLessonId = targetLessonId;
    el.inlineLessonBox.classList.remove("hidden");

    if (mode === "rename") {
      const bucket = ensureGradeBucket(builderGradeId);
      const found = bucket.customLessons.find((cl) => cl.id === targetLessonId);
      el.inlineLessonHeading.textContent = "✏️ تغییر نام درس شخصی";
      el.inputLessonTitle.value = found ? found.title : "";
      el.btnSaveLesson.textContent = "ذخیره نام جدید";
    } else {
      el.inlineLessonHeading.textContent = "➕ افزودن درس جدید";
      el.inputLessonTitle.value = "";
      el.btnSaveLesson.textContent = "ساخت درس";
    }
    el.inputLessonTitle.focus();
  }

  function hideInlineLessonBox() {
    lessonFormMode = null;
    renamingLessonId = null;
    el.inlineLessonBox.classList.add("hidden");
    el.inputLessonTitle.value = "";
  }

  function saveInlineLesson() {
    const title = normalizeText(el.inputLessonTitle.value);
    if (!title) {
      showToast("لطفاً نام درس را وارد کنید.");
      el.inputLessonTitle.focus();
      return;
    }

    const bucket = ensureGradeBucket(builderGradeId);

    if (lessonFormMode === "rename" && renamingLessonId) {
      const target = bucket.customLessons.find((cl) => cl.id === renamingLessonId);
      if (target) {
        target.title = title;
        saveCustomData();
        hideInlineLessonBox();
        renderBuilder();
        showToast("نام درس تغییر یافت.");
      }
      return;
    }

    const dup = bucket.customLessons.find((cl) => normalizeText(cl.title) === title);
    if (dup) {
      hideInlineLessonBox();
      builderLessonId = dup.id;
      builderStep = "sections";
      renderBuilder();
      showToast("درسی با این نام از قبل وجود داشت و باز شد.");
      return;
    }

    const newLesson = { id: genId("c_les"), title };
    bucket.customLessons.push(newLesson);
    saveCustomData();
    hideInlineLessonBox();
    builderLessonId = newLesson.id;
    builderStep = "sections";
    renderBuilder();
    showToast(`درس «${title}» ساخته شد.`);
  }

  function deleteCustomLessonById(lessonId) {
    const bucket = ensureGradeBucket(builderGradeId);
    const target = bucket.customLessons.find((cl) => cl.id === lessonId);
    if (!target) return;

    const qCount = bucket.questions.filter((q) => q.lessonId === lessonId).length;
    const msg = qCount > 0
      ? `آیا از حذف درس «${target.title}» و ${toPersianDigits(qCount)} سؤال داخل آن مطمئن هستید؟`
      : `آیا از حذف درس «${target.title}» مطمئن هستید؟`;
    if (!confirm(msg)) return;

    bucket.questions.forEach((q) => {
      if (q.lessonId === lessonId) delete state.stats[q.id];
    });
    bucket.questions = bucket.questions.filter((q) => q.lessonId !== lessonId);
    bucket.customLessons = bucket.customLessons.filter((cl) => cl.id !== lessonId);
    if (bucket.lessonSections && bucket.lessonSections[lessonId]) {
      delete bucket.lessonSections[lessonId];
    }

    sanitizeActiveSessionAfterCustomChange();
    saveState();
    saveCustomData(mode !== "replace");
    if (mode === "replace") {
      backupMeta.lastBackupAt = Date.now();
      saveBackupMeta();
    }
    hideInlineLessonBox();
    renderBuilder();
    showToast(`درس «${target.title}» حذف شد.`);
  }

  // --- مرحله ۳ طراحی سؤال: کارت‌های زیربخش‌ها (+ کارت اول: افزودن زیربخش جدید) ---
  function getVisibleSectionsForBuilderLesson(gradeId, lessonId) {
    const bucket = ensureGradeBucket(gradeId);
    const set = new Set(["spelling", "meaning"]);

    const linked = bucket.lessonSections[lessonId];
    if (Array.isArray(linked)) {
      linked.forEach((sid) => {
        if (PRESET_SECTION_IDS.has(sid) || bucket.customSections.some((cs) => cs.id === sid)) {
          set.add(sid);
        }
      });
    }

    bucket.questions.forEach((q) => {
      if (q.lessonId === lessonId) set.add(q.sectionId);
    });

    const ordered = ["spelling", "meaning"];
    PRESET_SECTIONS.forEach((p) => {
      if (set.has(p.id)) ordered.push(p.id);
    });
    bucket.customSections.forEach((cs) => {
      if (set.has(cs.id)) ordered.push(cs.id);
    });
    set.forEach((sid) => {
      if (!ordered.includes(sid)) ordered.push(sid);
    });
    return ordered;
  }

  function renderBuilderSectionsStep() {
    el.builderSectionsGrid.innerHTML = "";
    const lessonObj = getBuilderLessonObj();
    if (!lessonObj) return;

    // اولین کارت: افزودن زیربخش جدید
    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.className = "builder-card builder-card-add";
    addCard.innerHTML = `
      <span class="builder-card-add-icon">＋</span>
      <span class="builder-card-add-label">افزودن زیربخش جدید</span>
    `;
    addCard.addEventListener("click", () => showInlineSectionBox("create", null));
    el.builderSectionsGrid.appendChild(addCard);

    const sectionIds = getVisibleSectionsForBuilderLesson(builderGradeId, builderLessonId);

    sectionIds.forEach((secId) => {
      const meta = getSectionMeta(builderGradeId, secId);
      const customCnt = countCustomQuestionsForSection(builderGradeId, builderLessonId, secId);
      const officialCnt = (!lessonObj.isCustom && lessonObj.raw && Array.isArray(lessonObj.raw[secId]))
        ? lessonObj.raw[secId].length
        : 0;

      const card = document.createElement("div");
      card.className = `builder-card${!meta.isBuiltin ? " builder-card-custom" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      const originBadge = meta.isBuiltin
        ? `<span class="badge ${meta.badgeClass}">رسمی</span>`
        : `<span class="badge badge-custom">شخصی</span>`;

      let countText = `${toPersianDigits(customCnt)} سؤال شخصی`;
      if (officialCnt > 0 && customCnt === 0) {
        countText = `${toPersianDigits(officialCnt)} رسمی`;
      } else if (officialCnt > 0 && customCnt > 0) {
        countText = `${toPersianDigits(officialCnt)} رسمی + ${toPersianDigits(customCnt)} شخصی`;
      }

      const countBadge = customCnt > 0
        ? `<span class="badge badge-teal">${countText}</span>`
        : `<span class="badge badge-muted">${countText}</span>`;

      card.innerHTML = `
        <div class="builder-card-top">
          <span class="builder-card-icon">${meta.icon}</span>
          <div class="builder-card-actions"></div>
        </div>
        <div class="builder-card-name">${escapeHtml(meta.title)}</div>
        <div class="builder-card-footer">
          ${originBadge}
          ${countBadge}
        </div>
      `;

      if (!meta.isBuiltin) {
        const actionsEl = card.querySelector(".builder-card-actions");
        if (meta.isCustom) {
          const btnRename = document.createElement("button");
          btnRename.type = "button";
          btnRename.className = "icon-action-btn";
          btnRename.title = "تغییر نام زیربخش";
          btnRename.textContent = "✏️";
          btnRename.addEventListener("click", (e) => {
            e.stopPropagation();
            showInlineSectionBox("rename", secId);
          });
          actionsEl.appendChild(btnRename);
        }

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "icon-action-btn danger";
        btnDel.title = "حذف زیربخش از این درس";
        btnDel.textContent = "🗑️";
        btnDel.addEventListener("click", (e) => {
          e.stopPropagation();
          removeSectionFromLesson(secId);
        });
        actionsEl.appendChild(btnDel);
      }

      const openThisSection = () => {
        builderSectionId = secId;
        builderStep = "questions";
        hideInlineSectionBox();
        cancelEditQuestion(true);
        renderBuilder();
      };

      card.addEventListener("click", openThisSection);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openThisSection();
        }
      });

      el.builderSectionsGrid.appendChild(card);
    });
  }

  function showInlineSectionBox(mode, targetSectionId) {
    sectionFormMode = mode;
    renamingSectionId = targetSectionId;
    el.inlineSectionBox.classList.remove("hidden");

    if (mode === "rename" && targetSectionId) {
      const bucket = ensureGradeBucket(builderGradeId);
      const found = bucket.customSections.find((cs) => cs.id === targetSectionId);
      el.inlineSectionHeading.textContent = "✏️ تغییر نام زیربخش دلخواه";
      el.presetSectionsWrap.classList.add("hidden");
      el.inlineSectionDivider.classList.add("hidden");
      el.inputSectionTitle.value = found ? found.title : "";
      el.btnSaveSection.textContent = "ذخیره نام جدید";
      el.inputSectionTitle.focus();
      return;
    }

    el.inlineSectionHeading.textContent = "➕ افزودن زیربخش جدید";
    el.presetSectionsWrap.classList.remove("hidden");
    el.inlineSectionDivider.classList.remove("hidden");
    el.inputSectionTitle.value = "";
    el.btnSaveSection.textContent = "افزودن زیربخش";

    // ساخت چیپ‌های پیشنهادی با یک کلیک
    const visibleSet = new Set(getVisibleSectionsForBuilderLesson(builderGradeId, builderLessonId));
    el.presetSectionsChips.innerHTML = "";

    PRESET_SECTIONS.forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const already = visibleSet.has(p.id);
      chip.className = `preset-chip-btn${already ? " added" : ""}`;
      chip.textContent = already ? `✓ ${p.icon} ${p.title}` : `+ ${p.icon} ${p.title}`;
      chip.addEventListener("click", () => {
        linkSectionToLesson(builderGradeId, builderLessonId, p.id);
        saveCustomData();
        hideInlineSectionBox();
        builderSectionId = p.id;
        builderStep = "questions";
        cancelEditQuestion(true);
        renderBuilder();
        if (!already) showToast(`زیربخش «${p.title}» اضافه شد.`);
      });
      el.presetSectionsChips.appendChild(chip);
    });

    // نمایش زیربخش‌های دلخواه قبلی همین پایه که در این درس اضافه نشده‌اند
    const bucket = ensureGradeBucket(builderGradeId);
    bucket.customSections.forEach((cs) => {
      if (visibleSet.has(cs.id)) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "preset-chip-btn";
      chip.textContent = `+ ⭐ ${cs.title}`;
      chip.addEventListener("click", () => {
        linkSectionToLesson(builderGradeId, builderLessonId, cs.id);
        saveCustomData();
        hideInlineSectionBox();
        builderSectionId = cs.id;
        builderStep = "questions";
        cancelEditQuestion(true);
        renderBuilder();
        showToast(`زیربخش «${cs.title}» به این درس اضافه شد.`);
      });
      el.presetSectionsChips.appendChild(chip);
    });
  }

  function hideInlineSectionBox() {
    sectionFormMode = null;
    renamingSectionId = null;
    el.inlineSectionBox.classList.add("hidden");
    el.inputSectionTitle.value = "";
  }

  function saveInlineSection() {
    const rawTitle = normalizeText(el.inputSectionTitle.value).replace(/^بخش\s+/, "");
    if (!rawTitle) {
      showToast("لطفاً نام زیربخش را وارد کنید.");
      el.inputSectionTitle.focus();
      return;
    }

    const bucket = ensureGradeBucket(builderGradeId);

    if (sectionFormMode === "rename" && renamingSectionId) {
      const target = bucket.customSections.find((cs) => cs.id === renamingSectionId);
      if (target) {
        target.title = rawTitle;
        saveCustomData();
        hideInlineSectionBox();
        renderBuilder();
        showToast("نام زیربخش تغییر یافت.");
      }
      return;
    }

    if (rawTitle === "املا") {
      hideInlineSectionBox();
      builderSectionId = "spelling";
      builderStep = "questions";
      renderBuilder();
      return;
    }
    if (rawTitle === "معنی لغات" || rawTitle === "معنی" || rawTitle === "صداشناسی و معنا") {
      hideInlineSectionBox();
      builderSectionId = "meaning";
      builderStep = "questions";
      renderBuilder();
      return;
    }

    const presetMatch = PRESET_SECTIONS.find((p) => normalizeText(p.title) === rawTitle);
    if (presetMatch) {
      linkSectionToLesson(builderGradeId, builderLessonId, presetMatch.id);
      saveCustomData();
      hideInlineSectionBox();
      builderSectionId = presetMatch.id;
      builderStep = "questions";
      renderBuilder();
      showToast(`زیربخش «${presetMatch.title}» اضافه شد.`);
      return;
    }

    let targetSec = bucket.customSections.find((cs) => normalizeText(cs.title) === rawTitle);
    if (!targetSec) {
      targetSec = { id: genId("c_sec"), title: rawTitle };
      bucket.customSections.push(targetSec);
    }

    linkSectionToLesson(builderGradeId, builderLessonId, targetSec.id);
    saveCustomData();
    hideInlineSectionBox();
    builderSectionId = targetSec.id;
    builderStep = "questions";
    cancelEditQuestion(true);
    renderBuilder();
    showToast(`زیربخش «${targetSec.title}» ساخته شد.`);
  }

  function removeSectionFromLesson(secId) {
    const meta = getSectionMeta(builderGradeId, secId);
    const bucket = ensureGradeBucket(builderGradeId);
    const qCnt = countCustomQuestionsForSection(builderGradeId, builderLessonId, secId);

    const msg = qCnt > 0
      ? `آیا از حذف «${meta.title}» و ${toPersianDigits(qCnt)} سؤال آن در این درس مطمئن هستید؟`
      : `آیا «${meta.title}» از این درس حذف شود؟`;
    if (!confirm(msg)) return;

    bucket.questions.forEach((q) => {
      if (q.lessonId === builderLessonId && q.sectionId === secId) {
        delete state.stats[q.id];
      }
    });
    bucket.questions = bucket.questions.filter(
      (q) => !(q.lessonId === builderLessonId && q.sectionId === secId)
    );

    if (Array.isArray(bucket.lessonSections[builderLessonId])) {
      bucket.lessonSections[builderLessonId] =
        bucket.lessonSections[builderLessonId].filter((id) => id !== secId);
    }

    // اگر زیربخش دلخواه در هیچ درس دیگری استفاده نشده، تعریفش را هم پاک کن
    if (meta.isCustom) {
      const usedElsewhere =
        bucket.questions.some((q) => q.sectionId === secId) ||
        Object.values(bucket.lessonSections).some((arr) => Array.isArray(arr) && arr.includes(secId));
      if (!usedElsewhere) {
        bucket.customSections = bucket.customSections.filter((cs) => cs.id !== secId);
      }
    }

    sanitizeActiveSessionAfterCustomChange();
    saveState();
    saveCustomData();
    renderBuilder();
    showToast(`«${meta.title}» از این درس حذف شد.`);
  }

  // --- مرحله ۴ طراحی سؤال: مشاهده، افزودن، ویرایش و حذف سؤال‌های زیربخش ---
  function renderBuilderQuestionsStep() {
    const lessonObj = getBuilderLessonObj();
    if (!lessonObj || !builderSectionId) return;

    const bucket = ensureGradeBucket(builderGradeId);
    const secMeta = getSectionMeta(builderGradeId, builderSectionId);
    const officialCnt = (!lessonObj.isCustom && lessonObj.raw && Array.isArray(lessonObj.raw[builderSectionId]))
      ? lessonObj.raw[builderSectionId].length
      : 0;

    const matchingQuestions = bucket.questions.filter(
      (q) => q.lessonId === builderLessonId && q.sectionId === builderSectionId
    );

    el.builderQHeading.textContent = `${secMeta.icon} ${secMeta.title}`;

    const summaryParts = [];
    if (officialCnt > 0) summaryParts.push(`${toPersianDigits(officialCnt)} سؤال رسمی کتاب`);
    summaryParts.push(`${toPersianDigits(matchingQuestions.length)} سؤال شخصی شما`);
    el.builderContextSummary.textContent = summaryParts.join(" + ");

    el.btnBuilderTryQuiz.disabled = (officialCnt + matchingQuestions.length) === 0;
    el.builderListTitle.textContent = `سؤال‌های شخصی در «${secMeta.title}»`;
    el.builderListCount.textContent = `${toPersianDigits(matchingQuestions.length)} سؤال`;

    // اگر این زیربخش هنوز هیچ سؤال شخصی ندارد، فرم افزودن را خودکار باز نشان بده
    if (matchingQuestions.length === 0 && !editingQuestionId) {
      el.builderFormCard.classList.remove("hidden");
      el.btnToggleQForm.textContent = "بستن فرم سؤال";
    } else if (!editingQuestionId) {
      const formOpen = !el.builderFormCard.classList.contains("hidden");
      el.btnToggleQForm.textContent = formOpen ? "بستن فرم سؤال" : "➕ افزودن سؤال جدید";
    }

    el.builderQuestionsList.innerHTML = "";
    if (!matchingQuestions.length) {
      const empty = document.createElement("p");
      empty.className = "text-muted";
      empty.textContent = "هنوز سؤال شخصی در این زیربخش ثبت نکرده‌اید. از فرم بالا اولین سؤال را اضافه کنید.";
      el.builderQuestionsList.appendChild(empty);
      return;
    }

    matchingQuestions.forEach((q, idx) => {
      const item = document.createElement("div");
      item.className = "custom-q-item";

      const optsHtml = q.options.map((opt, oIdx) => {
        const isOk = oIdx === (q.answer || 0);
        return `<span class="opt-pill${isOk ? " opt-ok" : ""}">${isOk ? "✓ " : ""}${escapeHtml(opt)}</span>`;
      }).join("");

      const hintHtml = q.hint
        ? `<div class="custom-q-hint">💡 نکته: ${escapeHtml(q.hint)}</div>`
        : "";

      item.innerHTML = `
        <div class="custom-q-top">
          <div class="custom-q-prompt">${toPersianDigits(idx + 1)}. ${escapeHtml(q.prompt)}</div>
          <div class="custom-q-actions">
            <button class="mini-btn js-dup-q" type="button" title="ساخت سؤال جدید از روی همین الگو">📋 کپی</button>
            <button class="mini-btn js-edit-q" type="button">✏️ ویرایش</button>
            <button class="mini-btn mini-btn-danger js-del-q" type="button">🗑️ حذف</button>
          </div>
        </div>
        <div class="custom-q-opts">${optsHtml}</div>
        ${hintHtml}
      `;

      item.querySelector(".js-dup-q").addEventListener("click", () => startDuplicateQuestion(q));
      item.querySelector(".js-edit-q").addEventListener("click", () => startEditQuestion(q));
      item.querySelector(".js-del-q").addEventListener("click", () => deleteCustomQuestion(q.id));
      el.builderQuestionsList.appendChild(item);
    });
  }

  function toggleQuestionForm() {
    if (editingQuestionId) {
      cancelEditQuestion(true);
      return;
    }
    const isHidden = el.builderFormCard.classList.toggle("hidden");
    el.btnToggleQForm.textContent = isHidden ? "➕ افزودن سؤال جدید" : "بستن فرم سؤال";
    if (!isHidden) {
      el.builderFormTitle.textContent = "افزودن سؤال جدید";
      el.btnSubmitQuestion.textContent = "ذخیره سؤال";
      el.qPrompt.focus();
    }
  }

  function clearQuestionFormInputs() {
    el.qPrompt.value = "";
    el.qCorrect.value = "";
    el.qWrong1.value = "";
    el.qWrong2.value = "";
    el.qWrong3.value = "";
    el.qHint.value = "";
  }

  function cancelEditQuestion(hideForm) {
    editingQuestionId = null;
    el.builderFormTitle.textContent = "افزودن سؤال جدید";
    el.btnSubmitQuestion.textContent = "ذخیره سؤال";
    clearQuestionFormInputs();
    if (hideForm) {
      el.builderFormCard.classList.add("hidden");
      el.btnToggleQForm.textContent = "➕ افزودن سؤال جدید";
    }
  }

  function startEditQuestion(q) {
    editingQuestionId = q.id;
    el.builderFormCard.classList.remove("hidden");
    el.builderFormTitle.textContent = "✏️ ویرایش سؤال";
    el.btnSubmitQuestion.textContent = "ذخیره تغییرات";
    el.btnToggleQForm.textContent = "بستن فرم ویرایش";

    el.qPrompt.value = q.prompt || "";
    const correctText = q.options[q.answer] || q.options[0] || "";
    const wrongs = q.options.filter((_, idx) => idx !== (q.answer || 0));
    el.qCorrect.value = correctText;
    el.qWrong1.value = wrongs[0] || "";
    el.qWrong2.value = wrongs[1] || "";
    el.qWrong3.value = wrongs[2] || "";
    el.qHint.value = q.hint || "";

    el.builderFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
    el.qPrompt.focus();
  }

  function startDuplicateQuestion(q) {
    editingQuestionId = null;
    el.builderFormCard.classList.remove("hidden");
    el.builderFormTitle.textContent = "📋 افزودن سؤال جدید (از روی کپی)";
    el.btnSubmitQuestion.textContent = "ذخیره سؤال جدید";
    el.btnToggleQForm.textContent = "بستن فرم سؤال";

    el.qPrompt.value = q.prompt || "";
    const correctText = q.options[q.answer] || q.options[0] || "";
    const wrongs = q.options.filter((_, idx) => idx !== (q.answer || 0));
    el.qCorrect.value = correctText;
    el.qWrong1.value = wrongs[0] || "";
    el.qWrong2.value = wrongs[1] || "";
    el.qWrong3.value = wrongs[2] || "";
    el.qHint.value = q.hint || "";

    el.builderFormCard.scrollIntoView({ behavior: "smooth", block: "start" });
    el.qPrompt.focus();
    showToast("متن سؤال کپی شد؛ پس از ویرایش روی «ذخیره سؤال جدید» بزنید.");
  }

  function handleQuestionFormSubmit(e) {
    e.preventDefault();
    if (!builderGradeId || !builderLessonId || !builderSectionId) return;

    const prompt = normalizeText(el.qPrompt.value);
    const correct = normalizeText(el.qCorrect.value);
    const wrong1 = normalizeText(el.qWrong1.value);
    const wrong2 = normalizeText(el.qWrong2.value);
    const wrong3 = normalizeText(el.qWrong3.value);
    const hint = normalizeText(el.qHint.value);

    if (!prompt) {
      showToast("لطفاً صورت سؤال را بنویسید.");
      el.qPrompt.focus();
      return;
    }
    if (!correct) {
      showToast("لطفاً پاسخ درست را وارد کنید.");
      el.qCorrect.focus();
      return;
    }
    if (!wrong1) {
      showToast("حداقل یک گزینه نادرست وارد کنید.");
      el.qWrong1.focus();
      return;
    }

    const options = [correct, wrong1];
    if (wrong2) options.push(wrong2);
    if (wrong3) options.push(wrong3);

    const uniqueCheck = new Set(options.map((o) => normalizeText(o)));
    if (uniqueCheck.size !== options.length) {
      showToast("گزینه‌ها نباید تکراری باشند؛ لطفاً گزینه‌های متفاوت بنویسید.");
      return;
    }

    const bucket = ensureGradeBucket(builderGradeId);
    linkSectionToLesson(builderGradeId, builderLessonId, builderSectionId);

    if (editingQuestionId) {
      const target = bucket.questions.find((q) => q.id === editingQuestionId);
      if (target) {
        target.prompt = prompt;
        target.options = options;
        target.answer = 0;
        target.hint = hint;
        saveCustomData();
        cancelEditQuestion(true);
        updateBuilderTotalBadge();
        renderBuilderQuestionsStep();
        showToast("✅ تغییرات سؤال ذخیره شد.");
        return;
      }
    }

    const newQ = {
      id: genId("c_q"),
      lessonId: builderLessonId,
      sectionId: builderSectionId,
      prompt,
      options,
      answer: 0,
      hint,
      createdAt: Date.now()
    };

    bucket.questions.push(newQ);
    saveCustomData();
    clearQuestionFormInputs();
    updateBuilderTotalBadge();
    renderBuilderQuestionsStep();
    el.qPrompt.focus();
    showToast("✅ سؤال جدید ذخیره شد.");
  }

  function deleteCustomQuestion(questionId) {
    if (!confirm("آیا از حذف این سؤال مطمئن هستید؟")) return;
    const bucket = ensureGradeBucket(builderGradeId);
    bucket.questions = bucket.questions.filter((q) => q.id !== questionId);
    delete state.stats[questionId];
    sanitizeActiveSessionAfterCustomChange();

    if (editingQuestionId === questionId) {
      cancelEditQuestion(true);
    }
    saveState();
    saveCustomData();
    updateBuilderTotalBadge();
    renderBuilderQuestionsStep();
    showToast("سؤال حذف شد.");
  }

  function tryBuilderCurrentQuiz() {
    const grade = getBuilderGradeObj();
    if (!grade || !builderLessonId || !builderSectionId) return;
    loadGradeData(grade).then((officialLessons) => {
      activeGrade = grade;
      currentLessons = buildMergedLessons(grade.id, officialLessons);
      buildQuestionMap(currentLessons);
      selectedLesson = builderLessonId;
      startQuiz(builderSectionId, false);
    });
  }

  // ===========================================================================
  // تب ۲: بارگیری و پشتیبان‌گیری (Backup & Restore با Merge و Replace امن)
  // ===========================================================================
  function canWebShareFiles() {
    try {
      if (!navigator.share || !navigator.canShare || typeof File === "undefined") return false;
      const testFile = new File(["{}"], "salar-test.json", { type: "application/json" });
      return Boolean(navigator.canShare({ files: [testFile] }));
    } catch {
      return false;
    }
  }

  function isIOSStandalone() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = Boolean(
      window.navigator.standalone ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    );
    return isIOS && isStandalone;
  }

  function updateBackupReminderBanner() {
    if (!el.backupReminderBox) return;
    const totals = getCustomTotals();
    const needsBackup =
      totals.questions > 0 &&
      (!backupMeta.lastBackupAt || backupMeta.lastCustomEditAt > backupMeta.lastBackupAt);

    if (needsBackup) {
      el.backupReminderBox.className = "update-status-box warn";
      el.backupReminderBox.textContent =
        "💡 یادآوری: پس از آخرین تغییرات هنوز فایل پشتیبان نگرفته‌اید. برای اطمینان (به‌ویژه در گوشی‌های آیفون و اندروید) یک فایل پشتیبان ذخیره کنید.";
    } else {
      el.backupReminderBox.className = "update-status-box warn hidden";
      el.backupReminderBox.textContent = "";
    }
  }

  function getSelectedBackupScope() {
    const checked = document.querySelector('input[name="backup-scope"]:checked');
    return checked && checked.value === "lesson" ? "lesson" : "all";
  }

  function updateBackupScopeUI() {
    const scope = getSelectedBackupScope();
    const isLesson = scope === "lesson";
    const iosStandalone = isIOSStandalone();
    const hasShare = canWebShareFiles();

    if (el.lblBackupScopeAll) {
      el.lblBackupScopeAll.classList.toggle("selected", !isLesson);
    }
    if (el.lblBackupScopeLesson) {
      el.lblBackupScopeLesson.classList.toggle("selected", isLesson);
    }
    if (el.backupLessonPicker) {
      el.backupLessonPicker.classList.toggle("hidden", !isLesson);
    }

    // تنظیم هوشمند دکمه‌ها بر اساس سیستم‌عامل و محدوده انتخاب‌شده
    if (el.btnExportDownload) {
      // در حالت نصب‌شده‌ی iOS (Standalone) دانلود مستقیم پایدار نیست، بنابراین مخفی می‌شود
      el.btnExportDownload.classList.toggle("hidden", iosStandalone);
      el.btnExportDownload.textContent = isLesson ? "⬇️ دانلود فایل این درس" : "⬇️ دانلود فایل پشتیبان";
    }

    if (el.btnExportShare) {
      el.btnExportShare.classList.toggle("hidden", !hasShare);
      if (iosStandalone && hasShare) {
        el.btnExportShare.className = "btn btn-primary";
        el.btnExportShare.textContent = isLesson
          ? "📤 ذخیره در فایل‌ها / اشتراک‌گذاری این درس"
          : "📤 ذخیره در فایل‌ها / اشتراک‌گذاری";
      } else {
        el.btnExportShare.className = "btn btn-outline";
        el.btnExportShare.textContent = isLesson ? "📤 اشتراک‌گذاری فایل این درس" : "📤 اشتراک‌گذاری فایل";
      }
    }

    if (el.btnExportCopy) {
      const promoteCopy = iosStandalone && !hasShare;
      el.btnExportCopy.className = promoteCopy ? "btn btn-primary" : "btn btn-outline";
      el.btnExportCopy.textContent = isLesson ? "📋 کپی متن این درس" : "📋 کپی متن پشتیبان";
    }
  }

  function renderBackupPanel() {
    const totals = getCustomTotals();
    if (el.statBackupQuestions) el.statBackupQuestions.textContent = toPersianDigits(totals.questions);
    if (el.statBackupLessons) el.statBackupLessons.textContent = toPersianDigits(totals.lessons);
    if (el.statBackupSections) el.statBackupSections.textContent = toPersianDigits(totals.sections);

    updateBackupReminderBanner();
    updateBackupScopeUI();

    // پر کردن فهرست انتخاب پایه برای حالت «فقط یک درس خاص»
    const prevGrade = el.backupGradeSelect.value || builderGradeId || "grade1";
    el.backupGradeSelect.innerHTML = "";
    GRADES.forEach((g) => {
      const cnt = countCustomQuestionsForGrade(g.id);
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = cnt > 0
        ? `${g.shortTitle} (${toPersianDigits(cnt)} سؤال شخصی)`
        : g.shortTitle;
      el.backupGradeSelect.appendChild(opt);
    });
    el.backupGradeSelect.value = VALID_GRADE_IDS.has(prevGrade) ? prevGrade : "grade1";
    populateBackupLessonsSelect();
  }

  function populateBackupLessonsSelect() {
    const gId = el.backupGradeSelect.value || "grade1";
    const grade = GRADES.find((g) => g.id === gId) || GRADES[0];
    loadGradeData(grade)
      .then((officialLessons) => {
        const bucket = ensureGradeBucket(gId);
        const prevLesson = el.backupLessonSelect.value || builderLessonId || "";
        el.backupLessonSelect.innerHTML = "";
        const all = [
          ...(officialLessons || []).map((l) => ({ id: l.id, title: l.title, isCustom: false })),
          ...bucket.customLessons.map((cl) => ({ id: cl.id, title: `★ ${cl.title}`, isCustom: true }))
        ];
        all.forEach((l) => {
          const cnt = countCustomQuestionsForLesson(gId, l.id);
          const opt = document.createElement("option");
          opt.value = l.id;
          opt.textContent = cnt > 0
            ? `${l.title} (${toPersianDigits(cnt)} سؤال شخصی)`
            : l.title;
          el.backupLessonSelect.appendChild(opt);
        });
        if (all.some((l) => l.id === prevLesson)) {
          el.backupLessonSelect.value = prevLesson;
        }
      })
      .catch(() => {
        el.backupLessonSelect.innerHTML = "";
      });
  }

  function buildSafeAsciiFilename(prefix) {
    const cleanPrefix = String(prefix || "salar-backup").replace(/[^a-zA-Z0-9_-]/g, "-");
    const dateTag = new Date().toISOString().slice(0, 10);
    return `${cleanPrefix}-${dateTag}.json`;
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  async function downloadOrShareJsonFile(payload, filename, shareTitle, preferShare) {
    const jsonText = JSON.stringify(payload, null, 2);

    const shouldTryShare = canWebShareFiles() && (preferShare || isIOSStandalone());
    if (shouldTryShare) {
      try {
        const file = new File([jsonText], filename, { type: "application/json" });
        await navigator.share({
          files: [file],
          title: shareTitle || "پشتیبان سؤال‌های سالار",
          text: "فایل سؤال‌های نرم‌افزار آموزشی سالار"
        });
        return "shared";
      } catch (err) {
        if (err && err.name === "AbortError") {
          return "cancelled";
        }
      }
    }

    if (isIOSStandalone()) {
      const copied = await copyTextToClipboard(jsonText);
      if (copied) return "copied";
    }

    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "downloaded";
  }

  function buildAllBackupPayload() {
    return {
      app: "salar",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: "all",
      grades: customData.grades
    };
  }

  function buildLessonBackupPayload(gradeId, lessonId) {
    const bucket = ensureGradeBucket(gradeId);
    const lessonQuestions = bucket.questions.filter((q) => q.lessonId === lessonId);
    const lessonObj = bucket.customLessons.find((cl) => cl.id === lessonId);
    if (!lessonQuestions.length && !lessonObj) return null;

    const usedSecIds = new Set(lessonQuestions.map((q) => q.sectionId));
    const usedCustomSections = bucket.customSections.filter((cs) => usedSecIds.has(cs.id));
    const lessonSecLinks = {};
    if (Array.isArray(bucket.lessonSections[lessonId]) && bucket.lessonSections[lessonId].length) {
      lessonSecLinks[lessonId] = bucket.lessonSections[lessonId].slice();
    }

    return {
      questionCount: lessonQuestions.length,
      payload: {
        app: "salar",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        scope: "lesson",
        grades: {
          [gradeId]: {
            customLessons: lessonObj ? [lessonObj] : [],
            customSections: usedCustomSections,
            lessonSections: lessonSecLinks,
            questions: lessonQuestions
          }
        }
      }
    };
  }

  async function executeBackupAction(action, forceScope, customGradeId, customLessonId) {
    const scope = forceScope || getSelectedBackupScope();
    let payload = null;
    let filename = "";
    let shareTitle = "";
    let labelDesc = "";
    let qCount = 0;

    if (scope === "lesson") {
      const gId = customGradeId || (el.backupGradeSelect ? el.backupGradeSelect.value : "");
      const lId = customLessonId || (el.backupLessonSelect ? el.backupLessonSelect.value : "");
      if (!gId || !lId) {
        showToast("ابتدا پایه و درس مورد نظر را انتخاب کنید.");
        return false;
      }
      const built = buildLessonBackupPayload(gId, lId);
      if (!built) {
        showToast("در این درس هنوز هیچ سؤال شخصی ثبت نشده است.");
        if (builderTab === "backup") {
          showBackupStatus("warn", "⚠️ در درس انتخاب‌شده هنوز هیچ سؤال شخصی برای خروجی گرفتن وجود ندارد.");
        }
        return false;
      }
      payload = built.payload;
      qCount = built.questionCount;
      filename = buildSafeAsciiFilename(`salar-${gId}`);
      shareTitle = "فایل سؤال‌های درس سالار";
      labelDesc = `این درس (${toPersianDigits(qCount)} سؤال)`;
    } else {
      const totals = getCustomTotals();
      if (totals.questions === 0 && totals.lessons === 0 && totals.sections === 0) {
        showToast("هنوز سؤال یا درس شخصی برای پشتیبان‌گیری ثبت نشده است.");
        if (builderTab === "backup") {
          showBackupStatus("warn", "⚠️ هنوز هیچ سؤال یا درس شخصی برای پشتیبان‌گیری ثبت نشده است.");
        }
        return false;
      }
      payload = buildAllBackupPayload();
      qCount = totals.questions;
      filename = buildSafeAsciiFilename("salar-backup-all");
      shareTitle = "پشتیبان کامل سؤال‌های سالار";
      labelDesc = `پشتیبان کامل (${toPersianDigits(qCount)} سؤال شخصی)`;
    }

    if (action === "copy") {
      const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
      if (!ok) {
        if (builderTab === "backup") {
          showBackupStatus("warn", "⚠️ مرورگر اجازه کپی خودکار نداد؛ لطفاً از دکمه‌ی دانلود یا اشتراک‌گذاری استفاده کنید.");
        }
        showToast("امکان کپی خودکار وجود نداشت.");
        return false;
      }
      if (scope === "all") markBackupTaken();
      const copyMsg = `✅ متن ${labelDesc} کپی شد. می‌توانید آن را در یادداشت، شاد، ایتا، بله یا تلگرام ارسال کرده و از بخش «بازیابی از متن کپی‌شده» برگردانید.`;
      if (builderTab === "backup") showBackupStatus("ok", copyMsg);
      showToast(`متن ${labelDesc} کپی شد.`);
      return true;
    }

    const preferShare = action === "share";
    const method = await downloadOrShareJsonFile(payload, filename, shareTitle, preferShare);
    if (method === "cancelled") return false;
    if (scope === "all") markBackupTaken();

    if (method === "shared") {
      const msg = `✅ فایل ${labelDesc} آماده اشتراک‌گذاری و ذخیره شد.`;
      if (builderTab === "backup") showBackupStatus("ok", msg);
      showToast("اشتراک‌گذاری انجام شد.");
    } else if (method === "copied") {
      const msg = `✅ متن ${labelDesc} در حافظه کپی شد؛ می‌توانید آن را در یادداشت یا پیام‌رسان ذخیره کنید.`;
      if (builderTab === "backup") showBackupStatus("ok", msg);
      showToast("متن پشتیبان کپی شد.");
    } else {
      const msg = `✅ فایل ${labelDesc} با نام «${filename}» در پوشه‌ی Downloads دستگاه شما ذخیره شد.`;
      if (builderTab === "backup") showBackupStatus("ok", msg);
      showToast(`فایل در پوشه‌ی Downloads ذخیره شد.`);
    }
    return true;
  }

  function clearPendingRestore() {
    pendingRestore = null;
    if (el.restorePreviewBox) el.restorePreviewBox.classList.add("hidden");
    if (el.replaceDangerBox) el.replaceDangerBox.classList.add("hidden");
    const mergeRadio = document.querySelector('input[name="restore-mode"][value="merge"]');
    if (mergeRadio) mergeRadio.checked = true;
    updateRestoreModeUI();
  }

  function getSelectedRestoreMode() {
    const checked = document.querySelector('input[name="restore-mode"]:checked');
    return checked && checked.value === "replace" ? "replace" : "merge";
  }

  function updateRestoreModeUI() {
    const mode = getSelectedRestoreMode();
    const isReplace = mode === "replace";

    if (el.lblModeMerge) {
      el.lblModeMerge.classList.toggle("selected", !isReplace);
    }
    if (el.lblModeReplace) {
      el.lblModeReplace.classList.toggle("selected", false);
      el.lblModeReplace.classList.toggle("selected-danger", isReplace);
    }

    if (el.replaceDangerBox) {
      el.replaceDangerBox.classList.toggle("hidden", !isReplace);
      if (isReplace) {
        const totals = getCustomTotals();
        if (totals.questions > 0 || totals.lessons > 0) {
          el.replaceDangerText.textContent =
            `⚠️ هشدار: با جایگزینی کامل، تمام ${toPersianDigits(totals.questions)} سؤال شخصی و ${toPersianDigits(totals.lessons)} درس شخصی فعلی شما در همه‌ی پایه‌ها حذف و با این فایل جایگزین می‌شوند.`;
          el.btnBackupBeforeReplace.classList.remove("hidden");
        } else {
          el.replaceDangerText.textContent =
            "⚠️ حالت جایگزینی کامل انتخاب شده است؛ محتوای این فایل به عنوان کل سؤال‌های شخصی شما ثبت خواهد شد.";
          el.btnBackupBeforeReplace.classList.add("hidden");
        }
      }
    }

    if (el.btnConfirmRestore) {
      if (isReplace) {
        el.btnConfirmRestore.className = "btn btn-danger-outline";
        el.btnConfirmRestore.textContent = "⚠️ تأیید و جایگزینی کامل";
      } else {
        el.btnConfirmRestore.className = "btn btn-primary";
        el.btnConfirmRestore.textContent = "✅ اجرای ادغام هوشمند";
      }
    }
  }

  function inspectBackupPayload(parsed) {
    if (!parsed || parsed.app !== "salar" || !parsed.grades || typeof parsed.grades !== "object") {
      return null;
    }
    let validQuestions = 0;
    let customLessons = 0;
    let customSections = 0;
    const gradeTitles = [];

    Object.keys(parsed.grades).forEach((gId) => {
      if (!VALID_GRADE_IDS.has(gId)) return;
      const incoming = parsed.grades[gId];
      if (!incoming || typeof incoming !== "object") return;

      let gHasContent = false;
      if (Array.isArray(incoming.customLessons)) {
        const cnt = incoming.customLessons.filter((cl) => cl && cl.id && normalizeText(cl.title)).length;
        customLessons += cnt;
        if (cnt > 0) gHasContent = true;
      }
      if (Array.isArray(incoming.customSections)) {
        const cnt = incoming.customSections.filter((cs) => cs && cs.id && normalizeText(cs.title)).length;
        customSections += cnt;
        if (cnt > 0) gHasContent = true;
      }
      if (Array.isArray(incoming.questions)) {
        const cnt = incoming.questions.filter(
          (q) => q && normalizeText(q.prompt) && Array.isArray(q.options) && q.options.length >= 2 && q.lessonId
        ).length;
        validQuestions += cnt;
        if (cnt > 0) gHasContent = true;
      }
      if (gHasContent) {
        const gObj = GRADES.find((g) => g.id === gId);
        if (gObj) gradeTitles.push(gObj.shortTitle);
      }
    });

    return { validQuestions, customLessons, customSections, gradeTitles };
  }

  function parseAndPreviewBackupText(rawText, sourceLabel) {
    try {
      const cleaned = String(rawText || "").replace(/^\uFEFF/, "").trim();
      const parsed = JSON.parse(cleaned);
      const summary = inspectBackupPayload(parsed);
      if (!summary) {
        clearPendingRestore();
        showImportStatus("warn", "⚠️ محتوای انتخاب‌شده مربوط به نرم‌افزار سالار نیست یا ساختار معتبری ندارد. هیچ تغییری اعمال نشد.");
        return false;
      }
      if (summary.validQuestions === 0 && summary.customLessons === 0 && summary.customSections === 0) {
        clearPendingRestore();
        showImportStatus("warn", "⚠️ در این پشتیبان هیچ سؤال یا درس شخصی معتبری یافت نشد.");
        return false;
      }

      pendingRestore = { filename: sourceLabel, parsed, summary };
      el.importStatusBox.className = "update-status-box hidden";
      el.restoreFileName.textContent = sourceLabel;

      const currentTotals = getCustomTotals();
      const gradesStr = summary.gradeTitles.length ? summary.gradeTitles.join("، ") : "—";
      el.restoreFileSummary.textContent =
        `محتوای پشتیبان: ${toPersianDigits(summary.validQuestions)} سؤال، ${toPersianDigits(summary.customLessons)} درس شخصی و ${toPersianDigits(summary.customSections)} زیربخش دلخواه (پایه‌ها: ${gradesStr}) | وضعیت فعلی دستگاه شما: ${toPersianDigits(currentTotals.questions)} سؤال شخصی.`;

      const mergeRadio = document.querySelector('input[name="restore-mode"][value="merge"]');
      if (mergeRadio) mergeRadio.checked = true;
      updateRestoreModeUI();
      el.restorePreviewBox.classList.remove("hidden");
      if (el.pasteRestoreBox) el.pasteRestoreBox.classList.add("hidden");
      el.restorePreviewBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return true;
    } catch {
      clearPendingRestore();
      showImportStatus("warn", "⚠️ فایل یا متن انتخاب‌شده خراب است یا فرمت JSON معتبر ندارد. هیچ تغییری اعمال نشد.");
      return false;
    }
  }

  function handleImportFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      parseAndPreviewBackupText(reader.result, file.name);
    };
    reader.onerror = () => {
      clearPendingRestore();
      showImportStatus("warn", "⚠️ خطا در خواندن فایل از حافظه‌ی دستگاه.");
    };
    reader.readAsText(file, "utf-8");
  }

  function handlePasteRestoreParse() {
    const raw = el.inputPasteJson ? el.inputPasteJson.value : "";
    if (!normalizeText(raw)) {
      showToast("ابتدا متن پشتیبان را داخل کادر جای‌گذاری کنید.");
      return;
    }
    if (parseAndPreviewBackupText(raw, "متن کپی‌شده")) {
      el.inputPasteJson.value = "";
    }
  }

  function executePendingRestore() {
    if (!pendingRestore || !pendingRestore.parsed) return;
    const mode = getSelectedRestoreMode();
    const parsed = pendingRestore.parsed;

    if (mode === "replace") {
      const curTotals = getCustomTotals();
      if (curTotals.questions > 0 || curTotals.lessons > 0) {
        const ok = confirm(
          `تأیید نهایی: آیا مطمئن هستید که تمام ${toPersianDigits(curTotals.questions)} سؤال شخصی فعلی پاک شده و فایل پشتیبان جایگزین شود؟`
        );
        if (!ok) return;
      }

      // پاک کردن آمار سؤالات شخصی قبلی
      Object.keys(state.stats).forEach((qId) => {
        if (String(qId).startsWith("c_q_")) delete state.stats[qId];
      });
      customData = defaultCustomData();
    }

    let addedLessons = 0;
    let addedSections = 0;
    let addedQuestions = 0;
    let updatedQuestions = 0;
    let skippedDuplicates = 0;

    Object.keys(parsed.grades).forEach((gId) => {
      if (!VALID_GRADE_IDS.has(gId)) return;
      const incoming = parsed.grades[gId];
      if (!incoming || typeof incoming !== "object") return;

      const bucket = ensureGradeBucket(gId);
      const lessonIdRemap = {};
      const sectionIdRemap = {};

      // ۱. درس‌های شخصی
      if (Array.isArray(incoming.customLessons)) {
        incoming.customLessons.forEach((cl) => {
          if (!cl || !cl.id || !normalizeText(cl.title)) return;
          const title = normalizeText(cl.title);
          const existing = bucket.customLessons.find(
            (x) => x.id === cl.id || normalizeText(x.title) === title
          );
          if (existing) {
            lessonIdRemap[cl.id] = existing.id;
          } else {
            bucket.customLessons.push({ id: String(cl.id), title });
            lessonIdRemap[cl.id] = String(cl.id);
            addedLessons++;
          }
        });
      }

      // ۲. زیربخش‌های دلخواه
      if (Array.isArray(incoming.customSections)) {
        incoming.customSections.forEach((cs) => {
          if (!cs || !cs.id || !normalizeText(cs.title)) return;
          const title = normalizeText(cs.title);
          const presetMatch = PRESET_SECTIONS.find((p) => normalizeText(p.title) === title);
          if (presetMatch) {
            sectionIdRemap[cs.id] = presetMatch.id;
            return;
          }
          const existing = bucket.customSections.find(
            (x) => x.id === cs.id || normalizeText(x.title) === title
          );
          if (existing) {
            sectionIdRemap[cs.id] = existing.id;
          } else {
            bucket.customSections.push({ id: String(cs.id), title });
            sectionIdRemap[cs.id] = String(cs.id);
            addedSections++;
          }
        });
      }

      // ۳. پیوندهای زیربخش به درس‌ها
      if (incoming.lessonSections && typeof incoming.lessonSections === "object") {
        Object.keys(incoming.lessonSections).forEach((rawLesId) => {
          const mappedLes = lessonIdRemap[rawLesId] || rawLesId;
          const arr = incoming.lessonSections[rawLesId];
          if (!Array.isArray(arr)) return;
          arr.forEach((rawSecId) => {
            const mappedSec = sectionIdRemap[rawSecId] || rawSecId;
            if (PRESET_SECTION_IDS.has(mappedSec) || bucket.customSections.some((cs) => cs.id === mappedSec)) {
              linkSectionToLesson(gId, mappedLes, mappedSec);
            }
          });
        });
      }

      // ۴. سؤال‌ها
      if (Array.isArray(incoming.questions)) {
        incoming.questions.forEach((q) => {
          if (!q || !normalizeText(q.prompt) || !Array.isArray(q.options) || q.options.length < 2) return;
          const cleanOpts = q.options.map((o) => normalizeText(o)).filter(Boolean);
          if (cleanOpts.length < 2) return;

          let ansIdx = Number.isInteger(q.answer) && q.answer >= 0 && q.answer < cleanOpts.length ? q.answer : 0;
          if (ansIdx !== 0) {
            const correctVal = cleanOpts[ansIdx];
            cleanOpts.splice(ansIdx, 1);
            cleanOpts.unshift(correctVal);
            ansIdx = 0;
          }

          const mappedLessonId = lessonIdRemap[q.lessonId] || String(q.lessonId || "");
          let mappedSectionId = sectionIdRemap[q.sectionId] || String(q.sectionId || "spelling");
          if (!mappedLessonId) return;

          const validSec =
            mappedSectionId === "spelling" ||
            mappedSectionId === "meaning" ||
            PRESET_SECTION_IDS.has(mappedSectionId) ||
            bucket.customSections.some((cs) => cs.id === mappedSectionId);
          if (!validSec) mappedSectionId = "spelling";

          linkSectionToLesson(gId, mappedLessonId, mappedSectionId);

          const prompt = normalizeText(q.prompt);
          const hint = normalizeText(q.hint || "");
          const qId = q.id ? String(q.id) : genId("c_q");

          const byId = bucket.questions.find((x) => x.id === qId);
          if (byId) {
            byId.lessonId = mappedLessonId;
            byId.sectionId = mappedSectionId;
            byId.prompt = prompt;
            byId.options = cleanOpts;
            byId.answer = 0;
            byId.hint = hint;
            updatedQuestions++;
            return;
          }

          const byContent = bucket.questions.find(
            (x) =>
              x.lessonId === mappedLessonId &&
              x.sectionId === mappedSectionId &&
              normalizeText(x.prompt) === prompt &&
              normalizeText(x.options[0]) === cleanOpts[0]
          );
          if (byContent) {
            skippedDuplicates++;
            return;
          }

          bucket.questions.push({
            id: qId,
            lessonId: mappedLessonId,
            sectionId: mappedSectionId,
            prompt,
            options: cleanOpts,
            answer: 0,
            hint,
            createdAt: q.createdAt || Date.now()
          });
          addedQuestions++;
        });
      }
    });

    sanitizeActiveSessionAfterCustomChange();
    saveState();
    saveCustomData();
    clearPendingRestore();
    updateBuilderTotalBadge();
    renderBackupPanel();

    const parts = [];
    if (addedQuestions > 0) parts.push(`${toPersianDigits(addedQuestions)} سؤال`);
    if (updatedQuestions > 0) parts.push(`${toPersianDigits(updatedQuestions)} سؤال به‌روزرسانی‌شده`);
    if (addedLessons > 0) parts.push(`${toPersianDigits(addedLessons)} درس شخصی`);
    if (addedSections > 0) parts.push(`${toPersianDigits(addedSections)} زیربخش دلخواه`);
    if (skippedDuplicates > 0) parts.push(`${toPersianDigits(skippedDuplicates)} تکراری نادیده گرفته شد`);

    const prefix = mode === "replace"
      ? "✅ جایگزینی کامل با موفقیت انجام شد"
      : "✅ ادغام هوشمند با موفقیت انجام شد";

    const msg = parts.length
      ? `${prefix}: ${parts.join(" • ")}.`
      : "ℹ️ همه‌ی موارد این فایل از قبل در دستگاه شما وجود داشتند.";
    showImportStatus("ok", msg);
    showToast(mode === "replace" ? "جایگزینی کامل انجام شد." : "ادغام فایل پشتیبان انجام شد.");
  }

  // --- صفحات نصب آفلاین، درباره و نام‌گذاری ---
  function renderInstall(keepStatus) {
    clearAutoNext();
    setActiveNav("install");
    if (el.appVersionLabel) {
      el.appVersionLabel.textContent = toPersianDigits(APP_VERSION);
    }
    clearInstallHighlights();
    if (el.installActionStatus && !isAppInstalledStandalone()) {
      el.installActionStatus.className = "update-status-box hidden";
      el.installActionStatus.textContent = "";
    }
    refreshInstallCardUI();
    if (!keepStatus && el.updateStatusBox) {
      el.updateStatusBox.className = "update-status-box hidden";
      el.updateStatusBox.textContent = "";
    }
    configureHeader(
      "نحوه نصب آفلاین و به‌روزرسانی",
      "نصب آفلاین نرم‌افزار سالار",
      null,
      null
    );
    showView("install");
  }

  function renderAbout() {
    clearAutoNext();
    setActiveNav("about");
    configureHeader("درباره نرم‌افزار سالار", "درباره سالار", null, null);
    showView("about");
  }

  function renderNaming() {
    clearAutoNext();
    setActiveNav("naming");
    configureHeader("نام‌گذاری نرم‌افزار سالار", "نام‌گذاری سالار", null, null);
    showView("naming");
  }

  // --- بازنشانی آمار پیشرفت (بدون حذف سؤال‌های شخصی) ---
  function resetLessonById(lessonId, stayOnGradeHome) {
    if (!lessonId || lessonId === "all") return;
    const title = getScopeLabel(lessonId);
    if (!confirm(`آیا مطمئن هستید امتیازها و پیشرفت «${title}» به حالت اولیه برگردد؟ (سؤال‌های شخصی حذف نمی‌شوند)`)) return;

    const lesson = currentLessons.find((l) => l.id === lessonId);
    if (lesson) {
      Object.keys(lesson.sections).forEach((secId) => {
        (lesson.sections[secId] || []).forEach((q) => delete state.stats[q.id]);
      });
    }
    if (Array.isArray(state.activeSessions) && activeGrade) {
      state.activeSessions = state.activeSessions.filter(
        (s) => !(s.gradeId === activeGrade.id && s.lessonScope === lessonId)
      );
    }
    saveState();

    if (stayOnGradeHome) renderGradeHome();
    else openLesson(lessonId);
    showToast(`اطلاعات ${title} بازنشانی شد.`);
  }

  function resetCurrentGrade(stayOnGradeHome) {
    if (!activeGrade) return;
    if (!confirm(`هشدار: همه‌ی درس‌های «${activeGrade.title}» (${activeGrade.shortTitle}) بازنشانی می‌شوند و تمام اطلاعات پیشرفت و امتیازهای این پایه حذف خواهند شد. (سؤال‌های شخصی حذف نمی‌شوند)\n\nآیا از بازنشانی مطمئن هستید؟`)) return;

    currentLessons.forEach((lesson) => {
      Object.keys(lesson.sections).forEach((secId) => {
        (lesson.sections[secId] || []).forEach((q) => delete state.stats[q.id]);
      });
    });
    if (Array.isArray(state.activeSessions)) {
      state.activeSessions = state.activeSessions.filter(
        (s) => (s.gradeId || "grade6") !== activeGrade.id
      );
    }
    saveState();

    if (stayOnGradeHome) renderGradeHome();
    else openLesson("all");
    showToast(`اطلاعات ${activeGrade.shortTitle} بازنشانی شد.`);
  }

  // --- رویدادها ---
  el.navBrand.addEventListener("click", renderGrades);

  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "grades") renderGrades();
      else if (target === "builder") openBuilder();
      else if (target === "install") renderInstall();
      else if (target === "about") renderAbout();
      else if (target === "naming") renderNaming();
    });
  });

  if (el.btnZoomIn) el.btnZoomIn.addEventListener("click", () => applyFontScale(currentFontScale + FONT_SCALE_STEP, true, true));
  if (el.btnZoomOut) el.btnZoomOut.addEventListener("click", () => applyFontScale(currentFontScale - FONT_SCALE_STEP, true, true));
  if (el.btnZoomReset) el.btnZoomReset.addEventListener("click", () => applyFontScale(getDefaultFontScale(), true, true));

  if (el.btnFullscreen) {
    el.btnFullscreen.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  }

  if (el.btnPwaInstall) el.btnPwaInstall.addEventListener("click", triggerPwaInstall);
  if (el.btnCheckUpdate) el.btnCheckUpdate.addEventListener("click", checkAppUpdate);

  el.btnThemeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });

  el.goGradesBtns.forEach((b) => b.addEventListener("click", renderGrades));
  el.goGradeHomeBtns.forEach((b) => b.addEventListener("click", () => {
    if (activeGrade) renderGradeHome();
    else renderGrades();
  }));

  el.btnBackLesson.addEventListener("click", backToCurrentLesson);
  el.btnResultLesson.addEventListener("click", backToCurrentLesson);



  el.btnNext.addEventListener("click", nextQuestion);

  el.btnRetryMistakes.addEventListener("click", () => {
    if (!lastFinishedSession) return;
    selectedLesson = lastFinishedSession.lessonScope;
    startQuiz(lastFinishedSession.mode, true);
  });

  el.btnResetLesson.addEventListener("click", () => resetLessonById(selectedLesson, false));
  el.btnResetAll.addEventListener("click", () => resetCurrentGrade(false));

  // رویدادهای طراحی سؤال (نسخه کارتی ۲.۳)
  el.tabBuilderManage.addEventListener("click", () => switchBuilderTab("manage"));
  el.tabBuilderBackup.addEventListener("click", () => switchBuilderTab("backup"));

  el.btnSaveLesson.addEventListener("click", saveInlineLesson);
  el.btnCancelLesson.addEventListener("click", hideInlineLessonBox);
  el.inputLessonTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveInlineLesson();
    }
  });

  el.btnSaveSection.addEventListener("click", saveInlineSection);
  el.btnCancelSection.addEventListener("click", hideInlineSectionBox);
  el.inputSectionTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveInlineSection();
    }
  });

  el.btnToggleQForm.addEventListener("click", toggleQuestionForm);
  el.btnBuilderTryQuiz.addEventListener("click", tryBuilderCurrentQuiz);
  el.btnQuickExportLesson.addEventListener("click", () => {
    const useShare = (isIOSStandalone() || Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches)) && canWebShareFiles();
    executeBackupAction(useShare ? "share" : "download", "lesson", builderGradeId, builderLessonId);
  });
  el.btnCancelEdit.addEventListener("click", () => cancelEditQuestion(true));
  el.questionForm.addEventListener("submit", handleQuestionFormSubmit);

  // رویدادهای بارگیری و پشتیبان‌گیری (طرح یکپارچه)
  document.querySelectorAll('input[name="backup-scope"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateBackupScopeUI();
      if (el.backupStatusBox) {
        el.backupStatusBox.className = "update-status-box hidden";
        el.backupStatusBox.textContent = "";
      }
    });
  });

  if (el.btnExportDownload) {
    el.btnExportDownload.addEventListener("click", () => executeBackupAction("download"));
  }
  if (el.btnExportShare) {
    el.btnExportShare.addEventListener("click", () => executeBackupAction("share"));
  }
  if (el.btnExportCopy) {
    el.btnExportCopy.addEventListener("click", () => executeBackupAction("copy"));
  }
  el.backupGradeSelect.addEventListener("change", populateBackupLessonsSelect);

  el.btnImportTrigger.addEventListener("click", () => el.inputImportFile.click());
  el.inputImportFile.addEventListener("change", handleImportFileSelected);

  if (el.btnTogglePasteRestore) {
    el.btnTogglePasteRestore.addEventListener("click", () => {
      const hidden = el.pasteRestoreBox.classList.toggle("hidden");
      if (!hidden && el.inputPasteJson) el.inputPasteJson.focus();
    });
  }
  if (el.btnParsePastedJson) {
    el.btnParsePastedJson.addEventListener("click", handlePasteRestoreParse);
  }
  if (el.btnCancelPasteRestore) {
    el.btnCancelPasteRestore.addEventListener("click", () => {
      el.pasteRestoreBox.classList.add("hidden");
      if (el.inputPasteJson) el.inputPasteJson.value = "";
    });
  }

  document.querySelectorAll('input[name="restore-mode"]').forEach((radio) => {
    radio.addEventListener("change", updateRestoreModeUI);
  });

  el.btnBackupBeforeReplace.addEventListener("click", () => executeBackupAction(isIOSStandalone() && canWebShareFiles() ? "share" : "download", "all"));

  // پشتیبانی از دکمه فیزیکی Back اندروید و ژست بازگشت iOS
  window.addEventListener("popstate", (e) => {
    isHandlingPopState = true;
    let isAsync = false;
    try {
      isAsync = Boolean(restoreFromHistorySnapshot(e.state));
    } finally {
      if (!isAsync) {
        isHandlingPopState = false;
      }
    }
  });
  el.btnConfirmRestore.addEventListener("click", executePendingRestore);
  el.btnCancelRestore.addEventListener("click", clearPendingRestore);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.quizView.classList.contains("hidden") && isAnswered && !el.btnNext.classList.contains("hidden")) {
      nextQuestion();
    }
  });

  // شروع برنامه
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  applyTheme(currentTheme);
  applyFontScale(currentFontScale, false, false);
  updateFullscreenButton();

  let postUpdateData = null;
  try {
    const rawUpdate = sessionStorage.getItem(POST_UPDATE_KEY);
    if (rawUpdate) {
      postUpdateData = JSON.parse(rawUpdate);
      sessionStorage.removeItem(POST_UPDATE_KEY);
    }
  } catch {}

  if (postUpdateData) {
    renderInstall(true);
    const verFa = toPersianDigits(APP_VERSION);
    const notesPart = postUpdateData.notes ? ` — ${postUpdateData.notes}` : "";
    showUpdateStatus("ok", `🎉 نرم‌افزار با موفقیت به نسخه ${verFa} به‌روزرسانی شد!${notesPart}`);
    showToast(`به‌روزرسانی به نسخه ${verFa} انجام شد.`);
  } else {
    renderGrades();
  }
})();
