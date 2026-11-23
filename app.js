(function () {
  "use strict";

  // کلید ذخیره‌سازی سازگار با نسخه قبلی فارسی ششم تا پیشرفت‌های قبلی حفظ شود
  const STORAGE_KEY = "farsi6_emla_app_v1";
  const THEME_KEY = "salar_theme_v1";
  const AUTO_NEXT_DELAY_MS = 500;

  // فهرست ۶ مقطع ابتدایی — هر زمان فایل data/gradeX.js را آماده کردید، ready را به true تغییر دهید
  const GRADES = [
    { id: "grade1", title: "پایه اول ابتدایی", shortTitle: "فارسی اول", file: "data/grade1.js", ready: false },
    { id: "grade2", title: "پایه دوم ابتدایی", shortTitle: "فارسی دوم", file: "data/grade2.js", ready: false },
    { id: "grade3", title: "پایه سوم ابتدایی", shortTitle: "فارسی سوم", file: "data/grade3.js", ready: false },
    { id: "grade4", title: "پایه چهارم ابتدایی", shortTitle: "فارسی چهارم", file: "data/grade4.js", ready: false },
	{ id: "grade5", title: "پایه پنجم ابتدایی", shortTitle: "فارسی پنجم", file: "data/grade5.js", ready: true },
    { id: "grade6", title: "پایه ششم ابتدایی", shortTitle: "فارسی ششم", file: "data/grade6.js", ready: true }
  ];

  window.SALAR_DATA = window.SALAR_DATA || {};
  const loadedScripts = new Set();

  let state = loadState();
  let currentTheme = loadTheme();
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
    navBtns: document.querySelectorAll(".nav-btn"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),

    pageTitle: document.getElementById("page-title"),
    btnTopBack: document.getElementById("btn-top-back"),

    gradesView: document.getElementById("grades-view"),
    gradeHomeView: document.getElementById("grade-home-view"),
    lessonView: document.getElementById("lesson-view"),
    quizView: document.getElementById("quiz-view"),
    resultView: document.getElementById("result-view"),
    aboutView: document.getElementById("about-view"),
    namingView: document.getElementById("naming-view"),

    resumeCard: document.getElementById("resume-card"),
    resumeText: document.getElementById("resume-text"),
    btnResume: document.getElementById("btn-resume"),
    btnDiscardSession: document.getElementById("btn-discard-session"),

    gradesGrid: document.getElementById("grades-grid"),
    lessonsGrid: document.getElementById("lessons-grid"),
    btnGradeResetAll: document.getElementById("btn-grade-reset-all"),

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
    el.btnThemeToggle.textContent = currentTheme === "dark" ? "☀️ تم روشن" : "🌙 تم تیره";
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
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2500);
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

  // --- بارگذاری پویای فایل داده‌ی هر پایه (سازگار با آنلاین و اجرای آفلاین روی هارد) ---
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
      script.onerror = () => reject(new Error("فایل این پایه هنوز اضافه نشده است."));
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
    el.gradesView.classList.toggle("hidden", viewName !== "grades");
    el.gradeHomeView.classList.toggle("hidden", viewName !== "gradeHome");
    el.lessonView.classList.toggle("hidden", viewName !== "lesson");
    el.quizView.classList.toggle("hidden", viewName !== "quiz");
    el.resultView.classList.toggle("hidden", viewName !== "result");
    el.aboutView.classList.toggle("hidden", viewName !== "about");
    el.namingView.classList.toggle("hidden", viewName !== "naming");
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
    configureHeader("انتخاب مقطع تحصیلی", "سالار — مقاطع تحصیلی", null, null);

    const s = state.activeSession;
    if (s && Array.isArray(s.queue) && s.currentIndex < s.queue.length) {
      const gradeObj = GRADES.find((g) => g.id === (s.gradeId || "grade6"));
      const gradeName = gradeObj ? gradeObj.shortTitle : "فارسی ششم";
      const modeName = s.mode === "spelling" ? "بخش املا" : "بخش معنی لغات";
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
      `تمرین املا و معنی ${activeGrade.shortTitle}`,
      activeGrade.shortTitle,
      "تغییر مقطع",
      renderGrades
    );

    el.lessonsGrid.innerHTML = "";

    // دکمه «همه درس‌ها» با عرض دو برابر و استایل یکدست
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

    // دکمه‌های تک‌تک درس‌ها همراه با دکمه ریست کوچک
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
      resetBtn.title = `ریست ${lesson.title}`;
      resetBtn.textContent = "ریست";
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
      label,
      "بازگشت به فهرست درس‌ها",
      renderGradeHome
    );

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
      scopeLabel,
      "بازگشت به فهرست درس‌ها",
      renderGradeHome
    );

    const modeLabel = s.mode === "spelling" ? "املا" : "معنی لغات";
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

  // --- صفحات درباره و نام‌گذاری ---
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
    showToast(`اطلاعات ${title} ریست شد.`);
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
    showToast(`اطلاعات ${activeGrade.shortTitle} ریست شد.`);
  }

  // --- رویدادها ---
  el.navBrand.addEventListener("click", renderGrades);
  el.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "grades") renderGrades();
      else if (target === "about") renderAbout();
      else if (target === "naming") renderNaming();
    });
  });

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
  renderGrades();
})();
