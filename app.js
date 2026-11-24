(function () {
  "use strict";

  // کلید ذخیره‌سازی سازگار با نسخه‌های قبلی تا پیشرفت‌های ذخیره‌شده حفظ شود
  const APP_VERSION = "2.1";
  const POST_UPDATE_KEY = "salar_post_update_v1";
  const STORAGE_KEY = "farsi6_emla_app_v1";
  const THEME_KEY = "salar_theme_v1";
  const FONT_SCALE_KEY = "salar_font_scale_v1";
  const AUTO_NEXT_DELAY_MS = 500;

  const MIN_FONT_SCALE = 0.8;
  const MAX_FONT_SCALE = 1.5;
  const FONT_SCALE_STEP = 0.1;

  // فهرست ۶ مقطع ابتدایی — هر ۶ پایه فعال و آماده تمرین
  const GRADES = [
    { id: "grade1", title: "پایه اول ابتدایی", shortTitle: "فارسی اول", file: "data/grade1.js", ready: true },
    { id: "grade2", title: "پایه دوم ابتدایی", shortTitle: "فارسی دوم", file: "data/grade2.js", ready: true },
    { id: "grade3", title: "پایه سوم ابتدایی", shortTitle: "فارسی سوم", file: "data/grade3.js", ready: true },
    { id: "grade4", title: "پایه چهارم ابتدایی", shortTitle: "فارسی چهارم", file: "data/grade4.js", ready: true },
    { id: "grade5", title: "پایه پنجم ابتدایی", shortTitle: "فارسی پنجم", file: "data/grade5.js", ready: true },
    { id: "grade6", title: "پایه ششم ابتدایی", shortTitle: "فارسی ششم", file: "data/grade6.js", ready: true }
  ];

  window.SALAR_DATA = window.SALAR_DATA || {};
  const loadedScripts = new Set();

  let state = loadState();
  let currentTheme = loadTheme();
  let currentFontScale = loadFontScale();
  let deferredInstallPrompt = null;

  let activeGrade = null;   // شیء پایه انتخاب‌شده
  let selectedLesson = null; // id درس یا "all"
  let currentLessons = [];
  let questionMap = new Map();
  let currentQuestionIndex = 0;
  let isAnswered = false;
  let lastFinishedSession = null;
  let toastTimer = null;
  let autoNextTimer = null;

  const el = {
    navBrand: document.getElementById("nav-brand"),
    navLinks: document.getElementById("nav-links"),
    navBtns: document.querySelectorAll(".nav-btn"),
    btnMobileMenu: document.getElementById("btn-mobile-menu"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),
    btnFullscreen: document.getElementById("btn-fullscreen"),
    btnZoomIn: document.getElementById("btn-zoom-in"),
    btnZoomOut: document.getElementById("btn-zoom-out"),
    btnZoomReset: document.getElementById("btn-zoom-reset"),

    pageTitle: document.getElementById("page-title"),
    btnTopBack: document.getElementById("btn-top-back"),

    gradesView: document.getElementById("grades-view"),
    gradeHomeView: document.getElementById("grade-home-view"),
    lessonView: document.getElementById("lesson-view"),
    quizView: document.getElementById("quiz-view"),
    resultView: document.getElementById("result-view"),
    installView: document.getElementById("install-view"),
    aboutView: document.getElementById("about-view"),
    namingView: document.getElementById("naming-view"),

    directInstallCard: document.getElementById("direct-install-card"),
    btnPwaInstall: document.getElementById("btn-pwa-install"),
    btnCheckUpdate: document.getElementById("btn-check-update"),
    appVersionLabel: document.getElementById("app-version-label"),
    updateStatusBox: document.getElementById("update-status-box"),

    resumeCard: document.getElementById("resume-card"),
    resumeText: document.getElementById("resume-text"),
    btnResume: document.getElementById("btn-resume"),
    btnDiscardSession: document.getElementById("btn-discard-session"),

    gradesGrid: document.getElementById("grades-grid"),
    lessonsGrid: document.getElementById("lessons-grid"),
    btnGradeResetAll: document.getElementById("btn-grade-reset-all"),

    spellingModeTitle: document.getElementById("spelling-mode-title"),
    meaningModeTitle: document.getElementById("meaning-mode-title"),
    meaningModeBadge: document.getElementById("meaning-mode-badge"),

    statSpTotal: document.getElementById("stat-sp-total"),
    statSpOk: document.getElementById("stat-sp-ok"),
    statSpWrong: document.getElementById("stat-sp-wrong"),
    cntSpWrong: document.getElementById("cnt-sp-wrong"),
    btnStartSpelling: document.getElementById("btn-start-spelling"),
    btnReviewSpelling: document.getElementById("btn-review-spelling"),

    statMnTotal: document.getElementById("stat-mn-total"),
    statMnOk: document.getElementById("stat-mn-ok"),
    statMnWrong: document.getElementById("stat-mn-wrong"),
    cntMnWrong: document.getElementById("cnt-mn-wrong"),
    btnStartMeaning: document.getElementById("btn-start-meaning"),
    btnReviewMeaning: document.getElementById("btn-review-meaning"),

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

    resultSummary: document.getElementById("result-summary"),
    resCorrect: document.getElementById("res-correct"),
    resWrong: document.getElementById("res-wrong"),
    btnRetryMistakes: document.getElementById("btn-retry-mistakes"),
    btnResultLesson: document.getElementById("btn-result-lesson"),

    goGradesBtns: document.querySelectorAll(".js-go-grades"),
    goGradeHomeBtns: document.querySelectorAll(".js-go-grade-home"),
    toast: document.getElementById("toast")
  };

  function toPersianDigits(num) {
    return String(num).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  }

  // --- مدیریت منوی موبایل ---
  function closeMobileMenu() {
    if (!el.navLinks || !el.btnMobileMenu) return;
    el.navLinks.classList.remove("mobile-open");
    el.btnMobileMenu.setAttribute("aria-expanded", "false");
    el.btnMobileMenu.textContent = "☰ منو";
  }

  function toggleMobileMenu() {
    if (!el.navLinks || !el.btnMobileMenu) return;
    const isOpen = el.navLinks.classList.toggle("mobile-open");
    el.btnMobileMenu.setAttribute("aria-expanded", isOpen ? "true" : "false");
    el.btnMobileMenu.textContent = isOpen ? "✕ بستن" : "☰ منو";
  }

  // --- مدیریت زوم (بزرگ‌نمایی و کوچک‌نمایی متن‌ها در ویندوز، اندروید و iOS) ---
  function loadFontScale() {
    try {
      const saved = parseFloat(localStorage.getItem(FONT_SCALE_KEY));
      if (!Number.isNaN(saved) && saved >= MIN_FONT_SCALE && saved <= MAX_FONT_SCALE) {
        return Math.round(saved * 10) / 10;
      }
    } catch {}
    return 1;
  }

  function applyFontScale(scale, announce) {
    const clamped = Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, Math.round(scale * 10) / 10));
    currentFontScale = clamped;
    document.documentElement.style.setProperty("--font-scale", String(clamped));
    if (el.btnZoomReset) {
      el.btnZoomReset.textContent = `${toPersianDigits(Math.round(clamped * 100))}٪`;
    }
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(clamped));
    } catch {}
    if (announce) {
      showToast(`اندازه متن: ${toPersianDigits(Math.round(clamped * 100))} درصد`);
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
    // در iOS (عدم پشتیبانی API) و در حالت PWA نصب‌شده روی گوشی موبایل دکمه تمام‌نما مخفی می‌شود
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
      if (exitFn) {
        Promise.resolve(exitFn.call(document)).catch(() => {});
      }
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
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (el.directInstallCard) {
      el.directInstallCard.classList.remove("hidden");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (el.directInstallCard) {
      el.directInstallCard.classList.add("hidden");
    }
    showToast("نرم‌افزار سالار با موفقیت نصب شد!");
  });

  function triggerPwaInstall() {
    if (!deferredInstallPrompt) {
      showToast("از راهنمای زیر برای نصب از منوی مرورگر استفاده کنید.");
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
      if (el.directInstallCard) {
        el.directInstallCard.classList.add("hidden");
      }
    }).catch(() => {});
  }

  function showUpdateStatus(type, message) {
    if (!el.updateStatusBox) return;
    el.updateStatusBox.className = `update-status-box ${type}`;
    el.updateStatusBox.textContent = message;
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
          if (swReg.waiting || swReg.installing) {
            swHasUpdate = true;
          }
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
      metaTheme.setAttribute("content", currentTheme === "dark" ? "#0f172a" : "#ffffff");
    }
    try {
      localStorage.setItem(THEME_KEY, currentTheme);
    } catch {}
  }

  // --- مدیریت حافظه ---
  function defaultState() {
    return { version: 2, stats: {}, activeSession: null };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        version: 2,
        stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {},
        activeSession: parsed.activeSession || null
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast("خطا در ذخیره‌سازی خودکار مرورگر.");
    }
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2600);
  }

  function clearAutoNext() {
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
    }
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
      script.src = grade.file;
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

  function buildQuestionMap(lessonsList) {
    questionMap = new Map();
    lessonsList.forEach((lesson) => {
      lesson.spelling.forEach((q) =>
        questionMap.set(q.id, { ...q, lessonId: lesson.id, lessonTitle: lesson.title, mode: "spelling" })
      );
      lesson.meaning.forEach((q) =>
        questionMap.set(q.id, { ...q, lessonId: lesson.id, lessonTitle: lesson.title, mode: "meaning" })
      );
    });
  }

  function getQuestionsForScope(scope, mode) {
    const list = [];
    currentLessons.forEach((l) => {
      if (scope === "all" || l.id === scope) {
        l[mode].forEach((q) => list.push(q.id));
      }
    });
    return list;
  }

  function getScopeLabel(scope) {
    if (scope === "all") return "همه درس‌ها";
    const found = currentLessons.find((l) => l.id === scope);
    return found ? found.title : "درس";
  }

  function getCombinedCounts(scope) {
    const allIds = [
      ...getQuestionsForScope(scope, "spelling"),
      ...getQuestionsForScope(scope, "meaning")
    ];
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

  function showView(viewName) {
    closeMobileMenu();
    el.gradesView.classList.toggle("hidden", viewName !== "grades");
    el.gradeHomeView.classList.toggle("hidden", viewName !== "gradeHome");
    el.lessonView.classList.toggle("hidden", viewName !== "lesson");
    el.quizView.classList.toggle("hidden", viewName !== "quiz");
    el.resultView.classList.toggle("hidden", viewName !== "result");
    el.installView.classList.toggle("hidden", viewName !== "install");
    el.aboutView.classList.toggle("hidden", viewName !== "about");
    el.namingView.classList.toggle("hidden", viewName !== "naming");
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

    const s = state.activeSession;
    if (s && Array.isArray(s.queue) && s.currentIndex < s.queue.length) {
      const gradeObj = GRADES.find((g) => g.id === (s.gradeId || "grade6"));
      const gradeName = gradeObj ? gradeObj.shortTitle : "فارسی ششم";
      const isG1 = (s.gradeId || "grade6") === "grade1";
      const modeName = s.mode === "spelling"
        ? "بخش املا"
        : (isG1 ? "بخش صداشناسی و معنا" : "بخش معنی لغات");
      const reviewTag = s.reviewOnly ? " (مرور اشتباهات)" : "";
      el.resumeText.textContent =
        `${gradeName} • ${modeName}${reviewTag} • سؤال ${s.currentIndex + 1} از ${s.queue.length}`;
      el.resumeCard.classList.remove("hidden");
    } else {
      el.resumeCard.classList.add("hidden");
    }

    el.gradesGrid.innerHTML = "";
    GRADES.forEach((grade) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grade-card-btn";
      btn.disabled = !grade.ready;

      const statusBadge = grade.ready
        ? `<span class="badge badge-blue">آماده تمرین</span>`
        : `<span class="badge badge-muted">به‌زودی</span>`;

      btn.innerHTML = `
        ${statusBadge}
        <span class="grade-title">${grade.title}</span>
        <span class="grade-meta">${grade.shortTitle}</span>
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
      .then((lessonsList) => {
        activeGrade = grade;
        selectedLesson = null;
        currentLessons = lessonsList;
        buildQuestionMap(currentLessons);
        renderGradeHome();
      })
      .catch((err) => {
        showToast(err.message || "خطا در بارگذاری داده‌های پایه.");
      });
  }

  function renderGradeHome() {
    clearAutoNext();
    setActiveNav("grades");
    configureHeader(
      `تمرین املا و لغت ${activeGrade.shortTitle}`,
      `${activeGrade.shortTitle} — سالار`,
      "تغییر مقطع",
      renderGrades
    );

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
    allItem.appendChild(btnAllMain);
    el.lessonsGrid.appendChild(allItem);

    currentLessons.forEach((lesson) => {
      const counts = getCombinedCounts(lesson.id);
      const item = document.createElement("div");
      item.className = "lesson-item";

      let pillClass = "lesson-pill";
      let pillText = `${counts.ok}/${counts.total}`;
      if (counts.wrong > 0) {
        pillClass += " has-wrong";
        pillText = `${counts.wrong} غلط`;
      } else if (counts.total > 0 && counts.ok === counts.total) {
        pillClass += " all-ok";
        pillText = "کامل";
      }

      const mainBtn = document.createElement("button");
      mainBtn.type = "button";
      mainBtn.className = "lesson-main-btn";
      mainBtn.innerHTML = `
        <span>${lesson.title}</span>
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

  // --- ۳. صفحه داخلی درس ---
  function openLesson(scope) {
    clearAutoNext();
    selectedLesson = scope;
    const label = getScopeLabel(scope);
    configureHeader(
      `${activeGrade.shortTitle} — ${label}`,
      `${label} — سالار`,
      "بازگشت به فهرست درس‌ها",
      renderGradeHome
    );

    const isGrade1 = activeGrade && activeGrade.id === "grade1";
    if (el.meaningModeTitle && el.meaningModeBadge) {
      if (isGrade1) {
        el.meaningModeTitle.textContent = "بخش صداشناسی و معنا";
        el.meaningModeBadge.textContent = "تشخیص صداها و درک ساده";
        el.btnStartMeaning.textContent = "شروع تمرین صداشناسی و معنا";
      } else {
        el.meaningModeTitle.textContent = "بخش معنی لغات";
        el.meaningModeBadge.textContent = "یادگیری معنای واژه‌ها";
        el.btnStartMeaning.textContent = "شروع تمرین معنی";
      }
    }

    updateModeStats("spelling", el.statSpTotal, el.statSpOk, el.statSpWrong, el.cntSpWrong, el.btnReviewSpelling);
    updateModeStats("meaning", el.statMnTotal, el.statMnOk, el.statMnWrong, el.cntMnWrong, el.btnReviewMeaning);

    const isAll = selectedLesson === "all";
    el.btnResetLesson.classList.toggle("hidden", isAll);
    el.btnResetAll.classList.toggle("hidden", !isAll);

    showView("lesson");
  }

  function updateModeStats(mode, totalEl, okEl, wrongEl, cntEl, reviewBtn) {
    const ids = getQuestionsForScope(selectedLesson, mode);
    let ok = 0;
    let wrong = 0;
    ids.forEach((id) => {
      const st = state.stats[id];
      if (st && st.status === "correct") ok++;
      if (st && st.status === "wrong") wrong++;
    });

    totalEl.textContent = ids.length;
    okEl.textContent = ok;
    wrongEl.textContent = wrong;
    cntEl.textContent = wrong;
    reviewBtn.classList.toggle("hidden", wrong === 0);
  }

  // --- ۴. آزمون ---
  function startQuiz(mode, reviewOnly) {
    clearAutoNext();
    if (!activeGrade || !selectedLesson) return;

    let ids = getQuestionsForScope(selectedLesson, mode);
    if (reviewOnly) {
      ids = ids.filter((id) => state.stats[id] && state.stats[id].status === "wrong");
    }

    if (!ids.length) {
      showToast("سؤالی برای نمایش وجود ندارد.");
      return;
    }

    state.activeSession = {
      gradeId: activeGrade.id,
      lessonScope: selectedLesson,
      mode: mode,
      reviewOnly: reviewOnly,
      queue: shuffle(ids),
      currentIndex: 0,
      correctInSession: 0,
      wrongInSession: 0,
      wrongIdsInSession: []
    };

    currentQuestionIndex = 0;
    saveState();
    renderQuestion();
    showView("quiz");
  }

  function resumeSession() {
    clearAutoNext();
    const s = state.activeSession;
    if (!s || !Array.isArray(s.queue)) return;

    const gradeId = s.gradeId || "grade6";
    const grade = GRADES.find((g) => g.id === gradeId);
    if (!grade || !grade.ready) {
      state.activeSession = null;
      saveState();
      renderGrades();
      return;
    }

    loadGradeData(grade)
      .then((lessonsList) => {
        activeGrade = grade;
        currentLessons = lessonsList;
        buildQuestionMap(currentLessons);

        s.queue = s.queue.filter((id) => questionMap.has(id));
        if (s.currentIndex >= s.queue.length) {
          state.activeSession = null;
          saveState();
          renderGradeHome();
          return;
        }

        selectedLesson = s.lessonScope;
        currentQuestionIndex = s.currentIndex;
        renderQuestion();
        showView("quiz");
      })
      .catch(() => {
        showToast("خطا در بازیابی آزمون نیمه‌کاره.");
      });
  }

  function renderQuestion() {
    clearAutoNext();
    const s = state.activeSession;
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

    const isGrade1 = activeGrade && activeGrade.id === "grade1";
    const modeLabel = s.mode === "spelling"
      ? "املا"
      : (isGrade1 ? "صداشناسی و معنا" : "معنی لغات");
    el.quizTitle.textContent = s.reviewOnly ? `مرور اشتباهات ${modeLabel}` : `تمرین ${modeLabel}`;
    el.quizProgressText.textContent = `سؤال ${currentQuestionIndex + 1} از ${s.queue.length}`;
    el.progressBar.style.width = `${(currentQuestionIndex / s.queue.length) * 100}%`;

    el.btnBackLesson.textContent = s.lessonScope === "all" ? "برگشت به همه درس‌ها" : "برگشت به درس";
    el.questionLessonTag.textContent = q.lessonTitle;
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

    if (s.mode === "meaning") {
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

    const s = state.activeSession;
    const allBtns = el.optionsContainer.querySelectorAll(".option-btn");
    allBtns.forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === "1") {
        b.classList.add("correct");
      }
    });

    s.currentIndex = currentQuestionIndex + 1;

    if (isCorrect) {
      s.correctInSession++;
      state.stats[q.id] = { status: "correct" };
      saveState();

      if (s.currentIndex >= s.queue.length) {
        el.progressBar.style.width = "100%";
      }

      autoNextTimer = setTimeout(() => {
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
    const s = state.activeSession;
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
    const s = state.activeSession;
    lastFinishedSession = s ? { ...s } : null;
    state.activeSession = null;
    saveState();

    const total = s ? s.queue.length : 0;
    const ok = s ? s.correctInSession : 0;
    const wrong = s ? s.wrongInSession : 0;

    el.resCorrect.textContent = ok;
    el.resWrong.textContent = wrong;

    if (wrong === 0) {
      el.resultSummary.textContent = `عالی بود! به همه ${total} سؤال درست پاسخ دادی.`;
    } else {
      el.resultSummary.textContent =
        `از ${total} سؤال به ${ok} سؤال درست پاسخ دادی. می‌توانی همین الان اشتباهاتت را دوباره تمرین کنی.`;
    }

    el.btnResultLesson.textContent =
      (s && s.lessonScope === "all") ? "برگشت به همه درس‌ها" : "برگشت به درس";
    el.btnRetryMistakes.classList.toggle("hidden", wrong === 0);
    showView("result");
  }

  function backToCurrentLesson() {
    clearAutoNext();
    const s = state.activeSession;
    const targetScope = s ? s.lessonScope : (selectedLesson || "all");
    if (s && s.currentIndex >= s.queue.length) {
      state.activeSession = null;
    }
    saveState();
    openLesson(targetScope);
  }

  // --- صفحات نصب آفلاین، درباره و نام‌گذاری ---
  function renderInstall(keepStatus) {
    clearAutoNext();
    setActiveNav("install");
    if (el.appVersionLabel) {
      el.appVersionLabel.textContent = toPersianDigits(APP_VERSION);
    }
    if (!keepStatus && el.updateStatusBox) {
      el.updateStatusBox.className = "update-status-box hidden";
      el.updateStatusBox.textContent = "";
    }
    configureHeader(
      "نحوه نصب آفلاین و به‌روزرسانی",
      "نصب آفلاین نرم‌افزار سالار",
      "مقاطع تحصیلی",
      renderGrades
    );
    showView("install");
  }

  function renderAbout() {
    clearAutoNext();
    setActiveNav("about");
    configureHeader("درباره نرم‌افزار سالار", "درباره سالار", "مقاطع تحصیلی", renderGrades);
    showView("about");
  }

  function renderNaming() {
    clearAutoNext();
    setActiveNav("naming");
    configureHeader("نام‌گذاری نرم‌افزار سالار", "نام‌گذاری سالار", "مقاطع تحصیلی", renderGrades);
    showView("naming");
  }

  // --- ریست ---
  function resetLessonById(lessonId, stayOnGradeHome) {
    if (!lessonId || lessonId === "all") return;
    const title = getScopeLabel(lessonId);
    if (!confirm(`آیا مطمئن هستید اطلاعات «${title}» به حالت اولیه برگردد؟`)) return;

    const lesson = currentLessons.find((l) => l.id === lessonId);
    if (lesson) {
      lesson.spelling.forEach((q) => delete state.stats[q.id]);
      lesson.meaning.forEach((q) => delete state.stats[q.id]);
    }
    if (state.activeSession && state.activeSession.lessonScope === lessonId) {
      state.activeSession = null;
    }
    saveState();

    if (stayOnGradeHome) {
      renderGradeHome();
    } else {
      openLesson(lessonId);
    }
    showToast(`اطلاعات ${title} بازنشانی شد.`);
  }

  function resetCurrentGrade(stayOnGradeHome) {
    if (!activeGrade) return;
    if (!confirm(`آیا مطمئن هستید پیشرفت همه درس‌های «${activeGrade.shortTitle}» پاک شود؟`)) return;

    currentLessons.forEach((lesson) => {
      lesson.spelling.forEach((q) => delete state.stats[q.id]);
      lesson.meaning.forEach((q) => delete state.stats[q.id]);
    });
    if (state.activeSession && (state.activeSession.gradeId || "grade6") === activeGrade.id) {
      state.activeSession = null;
    }
    saveState();

    if (stayOnGradeHome) {
      renderGradeHome();
    } else {
      openLesson("all");
    }
    showToast(`اطلاعات ${activeGrade.shortTitle} بازنشانی شد.`);
  }

  // --- رویدادها ---
  el.navBrand.addEventListener("click", renderGrades);
  if (el.btnMobileMenu) {
    el.btnMobileMenu.addEventListener("click", toggleMobileMenu);
  }

  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "grades") renderGrades();
      else if (target === "install") renderInstall();
      else if (target === "about") renderAbout();
      else if (target === "naming") renderNaming();
    });
  });

  if (el.btnZoomIn) {
    el.btnZoomIn.addEventListener("click", () => applyFontScale(currentFontScale + FONT_SCALE_STEP, true));
  }
  if (el.btnZoomOut) {
    el.btnZoomOut.addEventListener("click", () => applyFontScale(currentFontScale - FONT_SCALE_STEP, true));
  }
  if (el.btnZoomReset) {
    el.btnZoomReset.addEventListener("click", () => applyFontScale(1, true));
  }

  if (el.btnFullscreen) {
    el.btnFullscreen.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  }

  if (el.btnPwaInstall) {
    el.btnPwaInstall.addEventListener("click", triggerPwaInstall);
  }
  if (el.btnCheckUpdate) {
    el.btnCheckUpdate.addEventListener("click", checkAppUpdate);
  }

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

  el.btnStartSpelling.addEventListener("click", () => startQuiz("spelling", false));
  el.btnReviewSpelling.addEventListener("click", () => startQuiz("spelling", true));
  el.btnStartMeaning.addEventListener("click", () => startQuiz("meaning", false));
  el.btnReviewMeaning.addEventListener("click", () => startQuiz("meaning", true));

  el.btnResume.addEventListener("click", resumeSession);
  el.btnDiscardSession.addEventListener("click", () => {
    state.activeSession = null;
    saveState();
    renderGrades();
  });

  el.btnNext.addEventListener("click", nextQuestion);

  el.btnRetryMistakes.addEventListener("click", () => {
    if (!lastFinishedSession) return;
    selectedLesson = lastFinishedSession.lessonScope;
    startQuiz(lastFinishedSession.mode, true);
  });

  el.btnGradeResetAll.addEventListener("click", () => resetCurrentGrade(true));
  el.btnResetLesson.addEventListener("click", () => resetLessonById(selectedLesson, false));
  el.btnResetAll.addEventListener("click", () => resetCurrentGrade(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.quizView.classList.contains("hidden") && isAnswered && !el.btnNext.classList.contains("hidden")) {
      nextQuestion();
    }
  });

  applyTheme(currentTheme);
  applyFontScale(currentFontScale, false);
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
