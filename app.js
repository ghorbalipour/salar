(function () {
  "use strict";

  const STORAGE_KEY = "farsi6_emla_app_v1";
  const THEME_KEY = "farsi6_emla_theme_v1";
  const AUTO_NEXT_DELAY_MS = 500;
  const lessons = window.LESSONS_DATA || [];

  // نگاشت سریع همه سؤالات با شناسه
  const questionMap = new Map();
  lessons.forEach((lesson) => {
    lesson.spelling.forEach((q) =>
      questionMap.set(q.id, { ...q, lessonId: lesson.id, lessonTitle: lesson.title, mode: "spelling" })
    );
    lesson.meaning.forEach((q) =>
      questionMap.set(q.id, { ...q, lessonId: lesson.id, lessonTitle: lesson.title, mode: "meaning" })
    );
  });

  // وضعیت ذخیره شده کاربر
  let state = loadState();
  let currentTheme = loadTheme();
  let selectedLesson = null; // null یعنی در صفحه اصلی هستیم
  let currentQuestionIndex = 0;
  let isAnswered = false;
  let toastTimer = null;
  let autoNextTimer = null;

  // عناصر صفحه
  const el = {
    mainTitle: document.getElementById("main-title"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),
    btnGlobalHome: document.getElementById("btn-global-home"),
    bottomHomeBtns: document.querySelectorAll(".js-go-home"),

    homeView: document.getElementById("home-view"),
    lessonView: document.getElementById("lesson-view"),
    quizView: document.getElementById("quiz-view"),
    resultView: document.getElementById("result-view"),

    resumeCard: document.getElementById("resume-card"),
    resumeText: document.getElementById("resume-text"),
    btnResume: document.getElementById("btn-resume"),
    btnDiscardSession: document.getElementById("btn-discard-session"),

    lessonsGrid: document.getElementById("lessons-grid"),
    btnHomeResetAll: document.getElementById("btn-home-reset-all"),

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

    toast: document.getElementById("toast")
  };

  // --- مدیریت تم (تیره پیش‌فرض / روشن انتخابی) ---
  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === "light" ? "light" : "dark";
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
    } catch {
      // نادیده گرفتن خطای ذخیره تم
    }
  }

  // --- مدیریت حافظه خودکار ---
  function defaultState() {
    return { version: 1, stats: {}, activeSession: null };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        version: 1,
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
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2400);
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

  function getQuestionsForScope(scope, mode) {
    const list = [];
    lessons.forEach((l) => {
      if (scope === "all" || l.id === scope) {
        l[mode].forEach((q) => list.push(q.id));
      }
    });
    return list;
  }

  function getScopeLabel(scope) {
    if (scope === "all") return "همه درس‌ها";
    const found = lessons.find((l) => l.id === scope);
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

  function updateHeader(scope) {
    if (!scope) {
      el.mainTitle.textContent = "تمرین املا و معنی فارسی ششم";
      document.title = "فارسی ششم";
      el.btnGlobalHome.classList.add("hidden");
    } else {
      const label = getScopeLabel(scope);
      el.mainTitle.textContent = `تمرین املا و معنی فارسی ششم — ${label}`;
      document.title = label;
      el.btnGlobalHome.classList.remove("hidden");
    }
  }

  // --- نمایش صفحه‌ها ---
  function showView(name) {
    el.homeView.classList.toggle("hidden", name !== "home");
    el.lessonView.classList.toggle("hidden", name !== "lesson");
    el.quizView.classList.toggle("hidden", name !== "quiz");
    el.resultView.classList.toggle("hidden", name !== "result");
  }

  // --- صفحه اصلی: دکمه «همه درس‌ها» با استایل یکدست + دکمه‌های ۱۷ درس همراه با دکمه ریست کوچک ---
  function renderHome() {
    clearAutoNext();
    selectedLesson = null;
    updateHeader(null);

    const s = state.activeSession;
    if (s && Array.isArray(s.queue) && s.currentIndex < s.queue.length) {
      const modeName = s.mode === "spelling" ? "بخش املا" : "بخش معنی لغات";
      const reviewTag = s.reviewOnly ? " (مرور اشتباهات)" : "";
      el.resumeText.textContent =
        `${getScopeLabel(s.lessonScope)} • ${modeName}${reviewTag} • سؤال ${s.currentIndex + 1} از ${s.queue.length}`;
      el.resumeCard.classList.remove("hidden");
    } else {
      el.resumeCard.classList.add("hidden");
    }

    el.lessonsGrid.innerHTML = "";

    // ۱. دکمه «همه درس‌ها» با عرض دو برابر در بالای بقیه دکمه‌ها و استایل یکدست
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

    // ۲. دکمه ۱۷ درس به همراه دکمه ریست کوچک کنار عنوان هر درس
    lessons.forEach((lesson) => {
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

    showView("home");
  }

  // --- صفحه داخلی درس ---
  function openLesson(scope) {
    clearAutoNext();
    selectedLesson = scope;
    updateHeader(selectedLesson);

    updateModeStats("spelling", el.statSpTotal, el.statSpOk, el.statSpWrong, el.cntSpWrong, el.btnReviewSpelling);
    updateModeStats("meaning", el.statMnTotal, el.statMnOk, el.statMnWrong, el.cntMnWrong, el.btnReviewMeaning);

    const isAllLessons = selectedLesson === "all";
    el.btnResetLesson.classList.toggle("hidden", isAllLessons);
    el.btnResetAll.classList.toggle("hidden", !isAllLessons);

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

  // --- شروع و ادامه آزمون ---
  function startQuiz(mode, reviewOnly) {
    clearAutoNext();
    if (!selectedLesson) return;

    let ids = getQuestionsForScope(selectedLesson, mode);
    if (reviewOnly) {
      ids = ids.filter((id) => state.stats[id] && state.stats[id].status === "wrong");
    }

    if (!ids.length) {
      showToast("سؤالی برای نمایش وجود ندارد.");
      return;
    }

    state.activeSession = {
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
    updateHeader(selectedLesson);
    saveState();
    renderQuestion();
    showView("quiz");
  }

  function resumeSession() {
    clearAutoNext();
    const s = state.activeSession;
    if (!s || !Array.isArray(s.queue)) return;

    s.queue = s.queue.filter((id) => questionMap.has(id));
    if (s.currentIndex >= s.queue.length) {
      state.activeSession = null;
      saveState();
      renderHome();
      return;
    }

    selectedLesson = s.lessonScope;
    updateHeader(selectedLesson);
    currentQuestionIndex = s.currentIndex;
    renderQuestion();
    showView("quiz");
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

  let lastFinishedSession = null;

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

  function goHome() {
    clearAutoNext();
    const s = state.activeSession;
    if (s && s.currentIndex >= s.queue.length) {
      state.activeSession = null;
    }
    saveState();
    renderHome();
  }

  // --- ریست ---
  function resetLessonById(lessonId, stayOnHome) {
    if (!lessonId || lessonId === "all") return;
    const title = getScopeLabel(lessonId);
    if (!confirm(`آیا مطمئن هستید اطلاعات «${title}» به حالت اولیه برگردد؟`)) return;

    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      lesson.spelling.forEach((q) => delete state.stats[q.id]);
      lesson.meaning.forEach((q) => delete state.stats[q.id]);
    }
    if (state.activeSession && state.activeSession.lessonScope === lessonId) {
      state.activeSession = null;
    }
    saveState();

    if (stayOnHome) {
      renderHome();
    } else {
      openLesson(lessonId);
    }
    showToast(`اطلاعات ${title} ریست شد.`);
  }

  function resetAllLessons(stayOnHome) {
    if (!confirm("آیا مطمئن هستید پیشرفت همه درس‌ها پاک شود و به حالت اولیه برگردد؟")) return;
    state = defaultState();
    saveState();
    if (stayOnHome) {
      renderHome();
    } else {
      openLesson("all");
    }
    showToast("اطلاعات همه درس‌ها ریست شد.");
  }

  // --- رویدادها ---
  el.btnThemeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });

  el.btnGlobalHome.addEventListener("click", goHome);
  el.bottomHomeBtns.forEach((btn) => btn.addEventListener("click", goHome));

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
    renderHome();
  });

  el.btnNext.addEventListener("click", nextQuestion);

  el.btnRetryMistakes.addEventListener("click", () => {
    if (!lastFinishedSession) return;
    selectedLesson = lastFinishedSession.lessonScope;
    startQuiz(lastFinishedSession.mode, true);
  });

  el.btnHomeResetAll.addEventListener("click", () => resetAllLessons(true));
  el.btnResetLesson.addEventListener("click", () => resetLessonById(selectedLesson, false));
  el.btnResetAll.addEventListener("click", () => resetAllLessons(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !el.quizView.classList.contains("hidden") && isAnswered && !el.btnNext.classList.contains("hidden")) {
      nextQuestion();
    }
  });

  // اعمال تم پیش‌فرض (تیره) و شروع برنامه
  applyTheme(currentTheme);
  renderHome();
})();