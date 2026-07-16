const STORAGE_KEY = "reading-gate-v1";

const defaultState = {
  books: [
    {
      id: "book-sample",
      title: "静かな森の読書術",
      author: "妖怪INFJ",
      coverImage: "",
      totalPages: 300,
      currentPage: 156,
      status: "reading",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  sessions: [
    {
      id: "session-sample",
      bookId: "book-sample",
      date: new Date().toISOString(),
      minutes: 190,
      startPage: 120,
      endPage: 156,
      pages: 36,
      createdAt: new Date().toISOString(),
    },
  ],
  memos: [
    {
      id: "memo-sample",
      bookId: "book-sample",
      date: new Date().toISOString(),
      page: 145,
      text: "少しだけでも開くと、続きは自然に読める。",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  settings: {
    gateApps: ["X", "Instagram", "YouTube"],
    readingMinutes: 15,
    shortReadingMinutes: 3,
    snsMinutes: 5,
  },
};

let state = loadState();
let activeScreen = "home";
let selectedMemoBookId = state.books[0]?.id || "";
let activeRange = 7;
let pendingMood = null;
let editingBookId = "";
let editingSessionId = "";
let timer = {
  mode: "reading",
  totalSeconds: state.settings.readingMinutes * 60,
  remainingSeconds: state.settings.readingMinutes * 60,
  running: false,
  interval: null,
  startedAt: null,
};
let snsTimer = {
  remainingSeconds: state.settings.snsMinutes * 60,
  interval: null,
};
let exportObjectUrl = "";
let audioContext = null;

const elements = {
  screenTitle: document.getElementById("screen-title"),
  yokai: document.getElementById("yokai"),
  yokaiFace: document.getElementById("yokai-face"),
  yokaiHands: document.getElementById("yokai-hands"),
  yokaiMessage: document.getElementById("yokai-message"),
  homeMetrics: document.getElementById("home-metrics"),
  bookForm: document.getElementById("book-form"),
  coverInput: document.getElementById("cover-input"),
  titleInput: document.getElementById("title-input"),
  authorInput: document.getElementById("author-input"),
  totalInput: document.getElementById("total-input"),
  currentInput: document.getElementById("current-input"),
  bookSubmit: document.getElementById("book-submit"),
  bookCancel: document.getElementById("book-cancel"),
  bookList: document.getElementById("book-list"),
  sessionEditForm: document.getElementById("session-edit-form"),
  sessionMinutesInput: document.getElementById("session-minutes-input"),
  sessionPagesInput: document.getElementById("session-pages-input"),
  sessionCancel: document.getElementById("session-cancel"),
  timerLabel: document.getElementById("timer-label"),
  timerTime: document.getElementById("timer-time"),
  timerBook: document.getElementById("timer-book"),
  timerStart: document.getElementById("timer-start"),
  timerFinish: document.getElementById("timer-finish"),
  sessionForm: document.getElementById("session-form"),
  startPageInput: document.getElementById("start-page-input"),
  endPageInput: document.getElementById("end-page-input"),
  memoInput: document.getElementById("memo-input"),
  memoBookTabs: document.getElementById("memo-book-tabs"),
  memoList: document.getElementById("memo-list"),
  minutesChart: document.getElementById("minutes-chart"),
  pagesChart: document.getElementById("pages-chart"),
  settingsForm: document.getElementById("settings-form"),
  readingMinutes: document.getElementById("reading-minutes"),
  shortMinutes: document.getElementById("short-minutes"),
  snsMinutes: document.getElementById("sns-minutes"),
  exportBackup: document.getElementById("export-backup"),
  importBackup: document.getElementById("import-backup"),
  importBackupFile: document.getElementById("import-backup-file"),
  exportNotion: document.getElementById("export-notion"),
  exportEvernote: document.getElementById("export-evernote"),
  exportStatus: document.getElementById("export-status"),
  gateDialog: document.getElementById("gate-dialog"),
  snsDialog: document.getElementById("sns-dialog"),
  snsTime: document.getElementById("sns-time"),
  snsMessage: document.getElementById("sns-message"),
  snsActions: document.getElementById("sns-actions"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return structuredClone(defaultState);
    return {
      books: saved.books || [],
      sessions: saved.sessions || [],
      memos: saved.memos || [],
      settings: { ...defaultState.settings, ...(saved.settings || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(value) {
  return {
    books: Array.isArray(value?.books) ? value.books : [],
    sessions: Array.isArray(value?.sessions) ? value.sessions : [],
    memos: Array.isArray(value?.memos) ? value.memos : [],
    settings: { ...defaultState.settings, ...(value?.settings || {}) },
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function dateKey(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(dateValue) {
  const date = new Date(dateValue);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function fileDate(dateValue = new Date()) {
  return dateKey(dateValue);
}

function totals() {
  const minutes = state.sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  const pages = state.sessions.reduce((sum, session) => sum + Number(session.pages || 0), 0);
  const finished = state.books.filter((book) => book.status === "finished").length;
  return { minutes, pages, finished, memos: state.memos.length };
}

function setYokai(mood) {
  const moods = {
    normal: "静かに、そばにいる。",
    reading: "いいね。少しだけ、ページを開こう。",
    gate: "……読む？",
    done: "積み上がった。えらい。",
  };
  const imageSrc = mood === "reading" ? elements.yokai.dataset.readingSrc : elements.yokai.dataset.mainSrc;
  if (imageSrc && elements.yokai.getAttribute("src") !== imageSrc) {
    elements.yokai.setAttribute("src", imageSrc);
  }
  elements.yokai.alt = mood === "reading" ? "本を読んでいる妖怪INFJ" : "森にいる妖怪INFJ";
  elements.yokaiMessage.textContent = moods[mood] || moods.normal;
  elements.yokai.classList.remove("mood-normal", "mood-reading", "mood-gate", "mood-done");
  elements.yokai.classList.add(`mood-${mood}`);
  elements.yokai.classList.toggle("pulling", mood === "gate");
}

function navigate(screen) {
  activeScreen = screen;
  document.querySelectorAll(".screen").forEach((node) => {
    node.classList.toggle("active", node.id === `${screen}-screen`);
  });
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === screen);
  });
  const screenNode = document.getElementById(`${screen}-screen`);
  if (elements.screenTitle) {
    elements.screenTitle.textContent = screenNode?.dataset.title || "読書ゲート";
  }
  setYokai(pendingMood || (screen === "timer" ? "reading" : "normal"));
  pendingMood = null;
  render();
}

function render() {
  renderHome();
  renderBooks();
  renderTimerBooks();
  renderMemos();
  renderGraphs();
  renderSettings();
}

function renderHome() {
  const summary = totals();
  const metrics = [
    ["読書時間", formatMinutes(summary.minutes)],
    ["読んだページ", `${summary.pages.toLocaleString()}ページ`],
    ["読了した本", `${summary.finished}冊`],
    ["読書メモ", `${summary.memos}個`],
  ];
  elements.homeMetrics.replaceChildren(
    ...metrics.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "metric-card";
      card.innerHTML = `<span class="metric-label">${label}</span><strong>${value}</strong>`;
      return card;
    }),
  );
}

function renderBooks() {
  renderBookFormMode();
  if (!state.books.length) {
    elements.bookList.innerHTML = `<div class="empty">最初の本を登録しよう。</div>`;
    return;
  }

  elements.bookList.replaceChildren(
    ...state.books.map((book) => {
      const bookSessions = state.sessions.filter((session) => session.bookId === book.id);
      const minutes = bookSessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
      const memoCount = state.memos.filter((memo) => memo.bookId === book.id).length;
      const percent = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100) || 0);
      const sessionRows = bookSessions
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(
          (session) => `
            <div class="session-row">
              <span>${shortDate(session.date)} ・ ${formatMinutes(Number(session.minutes || 0))} ・ ${Number(session.pages || 0)}ページ</span>
              <div class="mini-actions">
                <button type="button" data-edit-session="${session.id}">編集</button>
                <button type="button" data-delete-session="${session.id}">削除</button>
              </div>
            </div>
          `,
        )
        .join("");
      const card = document.createElement("article");
      card.className = "book-card";
      card.innerHTML = `
        <div class="cover">${book.coverImage ? `<img alt="" src="${book.coverImage}">` : "本"}</div>
        <div>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="book-meta">${escapeHtml(book.author || "著者未設定")} ・ ${book.status === "finished" ? "読了済み" : "読書中"}</p>
          <div class="progress" aria-label="${percent}%"><span style="width:${percent}%"></span></div>
          <p class="book-meta">${book.currentPage} / ${book.totalPages}ページ ・ ${percent}%</p>
          <div class="book-stats">
            <span>読書時間: ${formatMinutes(minutes)}</span>
            <span>メモ: ${memoCount}個</span>
          </div>
          <div class="card-actions">
            <button type="button" data-edit-book="${book.id}">本を編集</button>
            <button type="button" data-delete-book="${book.id}">本を削除</button>
          </div>
          <div class="session-list">
            <h4>読書記録</h4>
            ${sessionRows || `<p class="book-meta">まだ記録がありません。</p>`}
          </div>
        </div>
      `;
      return card;
    }),
  );
  elements.bookList.querySelectorAll("[data-edit-book]").forEach((button) => {
    button.addEventListener("click", () => startBookEdit(button.dataset.editBook));
  });
  elements.bookList.querySelectorAll("[data-delete-book]").forEach((button) => {
    button.addEventListener("click", () => deleteBook(button.dataset.deleteBook));
  });
  elements.bookList.querySelectorAll("[data-edit-session]").forEach((button) => {
    button.addEventListener("click", () => startSessionEdit(button.dataset.editSession));
  });
  elements.bookList.querySelectorAll("[data-delete-session]").forEach((button) => {
    button.addEventListener("click", () => deleteSession(button.dataset.deleteSession));
  });
}

function renderBookFormMode() {
  if (!elements.bookSubmit || !elements.bookCancel) return;
  elements.bookSubmit.textContent = editingBookId ? "本を保存" : "本を登録";
  elements.bookCancel.classList.toggle("hidden", !editingBookId);
}

function resetBookForm() {
  editingBookId = "";
  elements.bookForm.reset();
  elements.totalInput.value = 300;
  elements.currentInput.value = 0;
  renderBookFormMode();
}

function startBookEdit(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  editingBookId = book.id;
  elements.coverInput.value = book.coverImage || "";
  elements.titleInput.value = book.title || "";
  elements.authorInput.value = book.author || "";
  elements.totalInput.value = book.totalPages || 1;
  elements.currentInput.value = book.currentPage || 0;
  renderBookFormMode();
  elements.bookForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteBook(bookId) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book) return;
  if (!window.confirm(`「${book.title || "未設定の本"}」を削除しますか？\nこの本の読書記録とメモも削除されます。`)) return;
  state.books = state.books.filter((item) => item.id !== bookId);
  state.sessions = state.sessions.filter((session) => session.bookId !== bookId);
  state.memos = state.memos.filter((memo) => memo.bookId !== bookId);
  if (editingBookId === bookId) resetBookForm();
  if (selectedMemoBookId === bookId) selectedMemoBookId = state.books[0]?.id || "";
  if (elements.timerBook.value === bookId) resetTimerLength();
  saveState();
  render();
}

function startSessionEdit(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  editingSessionId = session.id;
  elements.sessionMinutesInput.value = Math.max(1, Number(session.minutes || 1));
  elements.sessionPagesInput.value = Math.max(0, Number(session.pages || 0));
  elements.sessionEditForm.classList.remove("hidden");
  elements.sessionEditForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetSessionEdit() {
  editingSessionId = "";
  elements.sessionEditForm.classList.add("hidden");
  elements.sessionEditForm.reset();
}

function saveSessionEdit(event) {
  event.preventDefault();
  const session = state.sessions.find((item) => item.id === editingSessionId);
  if (!session) return;
  const minutes = Math.max(1, Number(elements.sessionMinutesInput.value || 1));
  const pages = Math.max(0, Number(elements.sessionPagesInput.value || 0));
  session.minutes = minutes;
  session.pages = pages;
  session.endPage = Number(session.startPage || 0) + pages;
  session.updatedAt = new Date().toISOString();
  const book = state.books.find((item) => item.id === session.bookId);
  if (book) {
    book.currentPage = Math.min(book.totalPages, Math.max(Number(book.currentPage || 0), Number(session.endPage || 0)));
    book.status = book.currentPage >= book.totalPages ? "finished" : "reading";
    book.updatedAt = session.updatedAt;
  }
  resetSessionEdit();
  saveState();
  render();
}

function deleteSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (!window.confirm("この読書記録を削除しますか？")) return;
  state.sessions = state.sessions.filter((item) => item.id !== sessionId);
  if (editingSessionId === sessionId) resetSessionEdit();
  saveState();
  render();
}

function editMemo(memoId) {
  const memo = state.memos.find((item) => item.id === memoId);
  if (!memo) return;
  const pageValue = window.prompt("ページを編集", memo.page || 0);
  if (pageValue === null) return;
  const textValue = window.prompt("メモを編集", memo.text || "");
  if (textValue === null) return;
  memo.page = Math.max(0, Number(pageValue || 0));
  memo.text = textValue.trim();
  memo.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function deleteMemo(memoId) {
  const memo = state.memos.find((item) => item.id === memoId);
  if (!memo) return;
  if (!window.confirm("このメモを削除しますか？")) return;
  state.memos = state.memos.filter((item) => item.id !== memoId);
  saveState();
  render();
}

function renderTimerBooks() {
  elements.timerBook.replaceChildren(
    ...state.books.map((book) => {
      const option = document.createElement("option");
      option.value = book.id;
      option.textContent = book.title;
      return option;
    }),
  );

  if (!state.books.length) {
    const option = document.createElement("option");
    option.textContent = "本棚で本を登録してください";
    elements.timerBook.append(option);
    elements.timerStart.disabled = true;
    elements.timerFinish.disabled = true;
  } else {
    elements.timerStart.disabled = false;
    elements.timerFinish.disabled = false;
  }
}

function renderMemos() {
  if (!state.books.length) {
    elements.memoBookTabs.innerHTML = "";
    elements.memoList.innerHTML = `<div class="empty">本を登録すると、ここに本ごとのメモが並びます。</div>`;
    return;
  }

  if (!state.books.some((book) => book.id === selectedMemoBookId)) selectedMemoBookId = state.books[0].id;
  elements.memoBookTabs.replaceChildren(
    ...state.books.map((book) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = book.id === selectedMemoBookId ? "active" : "";
      button.textContent = book.title;
      button.addEventListener("click", () => {
        selectedMemoBookId = book.id;
        renderMemos();
      });
      return button;
    }),
  );

  const memos = state.memos
    .filter((memo) => memo.bookId === selectedMemoBookId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!memos.length) {
    elements.memoList.innerHTML = `<div class="empty">この本のメモはまだありません。</div>`;
    return;
  }

  elements.memoList.replaceChildren(
    ...memos.map((memo) => {
      const card = document.createElement("article");
      card.className = "memo-card";
      card.innerHTML = `
        <time>${shortDate(memo.date)} ・ p.${memo.page || 0}</time>
        <p>${escapeHtml(memo.text)}</p>
        <div class="card-actions">
          <button type="button" data-edit-memo="${memo.id}">メモを編集</button>
          <button type="button" data-delete-memo="${memo.id}">メモを削除</button>
        </div>
      `;
      return card;
    }),
  );
  elements.memoList.querySelectorAll("[data-edit-memo]").forEach((button) => {
    button.addEventListener("click", () => editMemo(button.dataset.editMemo));
  });
  elements.memoList.querySelectorAll("[data-delete-memo]").forEach((button) => {
    button.addEventListener("click", () => deleteMemo(button.dataset.deleteMemo));
  });
}

function renderGraphs() {
  renderMinutesChart();
  renderPagesChart();
}

function renderMinutesChart() {
  const days = [];
  const now = new Date();
  for (let i = activeRange - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    days.push({ key: dateKey(date), label: activeRange > 30 ? `${date.getMonth() + 1}月` : `${date.getMonth() + 1}/${date.getDate()}`, value: 0 });
  }

  state.sessions.forEach((session) => {
    const bucket = days.find((day) => day.key === dateKey(session.date));
    if (bucket) bucket.value += Number(session.minutes || 0);
  });

  drawBars(elements.minutesChart, days, "分");
}

function renderPagesChart() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: `${date.getMonth() + 1}月`, value: 0 });
  }

  state.sessions.forEach((session) => {
    const date = new Date(session.date);
    const bucket = months.find((month) => month.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += Number(session.pages || 0);
  });

  drawBars(elements.pagesChart, months, "P");
}

function drawBars(container, items, suffix) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const visibleItems = activeRange === 365 && items.length > 40 ? items.filter((_, index) => index % 14 === 0) : items;
  container.style.setProperty("--bars", visibleItems.length);
  container.replaceChildren(
    ...visibleItems.map((item) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.title = `${item.label}: ${item.value}${suffix}`;
      bar.innerHTML = `
        <div class="bar-fill" style="height:${Math.max(3, (item.value / max) * 150)}px"></div>
        <div class="bar-label">${item.value ? `${item.value}${suffix}` : item.label}</div>
      `;
      return bar;
    }),
  );
}

function renderSettings() {
  elements.readingMinutes.value = state.settings.readingMinutes;
  elements.shortMinutes.value = state.settings.shortReadingMinutes;
  elements.snsMinutes.value = state.settings.snsMinutes;
  elements.settingsForm.querySelectorAll("[name='gateApp']").forEach((input) => {
    input.checked = state.settings.gateApps.includes(input.value);
  });
}

function startReadingTimer(minutes = state.settings.readingMinutes) {
  prepareAudio();
  clearInterval(timer.interval);
  timer = {
    mode: "reading",
    totalSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
    running: false,
    interval: null,
    startedAt: null,
  };
  elements.sessionForm.classList.add("hidden");
  elements.timerLabel.textContent = "読書中";
  elements.timerStart.textContent = "開始";
  updateTimerDisplay();
  navigate("timer");
  setYokai("reading");
}

function toggleTimer() {
  if (!state.books.length) return;
  prepareAudio();
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    elements.timerStart.textContent = "再開";
    return;
  }
  timer.running = true;
  timer.startedAt = timer.startedAt || Date.now();
  elements.timerStart.textContent = "一時停止";
  timer.interval = setInterval(() => {
    timer.remainingSeconds -= 1;
    updateTimerDisplay();
    if (timer.remainingSeconds <= 0) finishTimer(true);
  }, 1000);
}

function finishTimer(playSound = false) {
  clearInterval(timer.interval);
  timer.running = false;
  timer.remainingSeconds = Math.max(0, timer.remainingSeconds);
  elements.timerStart.textContent = "再開";
  elements.sessionForm.classList.remove("hidden");
  if (playSound) playWaterDropAlarm();
  const book = state.books.find((item) => item.id === elements.timerBook.value) || state.books[0];
  if (book) {
    elements.startPageInput.value = book.currentPage;
    elements.endPageInput.value = Math.min(book.totalPages, book.currentPage + 10);
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  elements.timerTime.textContent = formatTimer(timer.remainingSeconds);
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = audioContext || new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playWaterDropAlarm() {
  const context = prepareAudio();
  if (!context) return;
  const now = context.currentTime + 0.03;
  playWaterDrop(now, 0.42);
  playWaterDrop(now + 0.58, 0.32);
}

function playWaterDrop(startTime, volume) {
  const context = audioContext;
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const ripple = context.createDelay(0.16);
  const rippleGain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1120, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(470, startTime + 0.16);
  oscillator.frequency.exponentialRampToValueAtTime(260, startTime + 0.42);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1900, startTime);
  filter.frequency.exponentialRampToValueAtTime(620, startTime + 0.45);
  filter.Q.setValueAtTime(7, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

  ripple.delayTime.setValueAtTime(0.085, startTime);
  rippleGain.gain.setValueAtTime(0.16, startTime);
  rippleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.55);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  gain.connect(ripple);
  ripple.connect(rippleGain);
  rippleGain.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + 0.56);
}

function saveSession(event) {
  event.preventDefault();
  const book = state.books.find((item) => item.id === elements.timerBook.value);
  if (!book) return;
  const startPage = Math.max(0, Number(elements.startPageInput.value || book.currentPage));
  const endPage = Math.max(startPage, Number(elements.endPageInput.value || startPage));
  const pages = Math.max(0, endPage - startPage);
  const minutes = Math.max(1, Math.round((timer.totalSeconds - timer.remainingSeconds) / 60) || Math.round(timer.totalSeconds / 60));
  const now = new Date().toISOString();

  state.sessions.push({
    id: uid("session"),
    bookId: book.id,
    date: now,
    minutes,
    startPage,
    endPage,
    pages,
    createdAt: now,
  });

  book.currentPage = Math.min(book.totalPages, endPage);
  book.status = book.currentPage >= book.totalPages ? "finished" : "reading";
  book.updatedAt = now;

  const text = elements.memoInput.value.trim();
  if (text) {
    state.memos.push({
      id: uid("memo"),
      bookId: book.id,
      date: now,
      page: endPage,
      text,
      createdAt: now,
      updatedAt: now,
    });
  }

  selectedMemoBookId = book.id;
  saveState();
  elements.memoInput.value = "";
  elements.sessionForm.classList.add("hidden");
  pendingMood = "done";
  render();
  navigate("home");
}

function addBook(event) {
  event.preventDefault();
  const totalPages = Math.max(1, Number(elements.totalInput.value || 1));
  const currentPage = Math.min(totalPages, Math.max(0, Number(elements.currentInput.value || 0)));
  const now = new Date().toISOString();
  const existingBook = state.books.find((item) => item.id === editingBookId);
  if (existingBook) {
    existingBook.title = elements.titleInput.value.trim();
    existingBook.author = elements.authorInput.value.trim();
    existingBook.coverImage = elements.coverInput.value.trim();
    existingBook.totalPages = totalPages;
    existingBook.currentPage = currentPage;
    existingBook.status = currentPage >= totalPages ? "finished" : "reading";
    existingBook.updatedAt = now;
    selectedMemoBookId = existingBook.id;
    saveState();
    resetBookForm();
    render();
    return;
  }

  const book = {
    id: uid("book"),
    title: elements.titleInput.value.trim(),
    author: elements.authorInput.value.trim(),
    coverImage: elements.coverInput.value.trim(),
    totalPages,
    currentPage,
    status: currentPage >= totalPages ? "finished" : "reading",
    createdAt: now,
    updatedAt: now,
  };
  state.books.unshift(book);
  selectedMemoBookId = book.id;
  saveState();
  resetBookForm();
  render();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    gateApps: [...elements.settingsForm.querySelectorAll("[name='gateApp']:checked")].map((input) => input.value),
    readingMinutes: Math.max(1, Number(elements.readingMinutes.value || 15)),
    shortReadingMinutes: Math.max(1, Number(elements.shortMinutes.value || 3)),
    snsMinutes: Math.max(1, Number(elements.snsMinutes.value || 5)),
  };
  saveState();
  resetTimerLength();
  setYokai("done");
  render();
}

async function downloadText(filename, content, type, description, extensions) {
  const blob = new Blob([content], { type });
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description,
          accept: { [type.split(";")[0]]: extensions },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 1000);
  return { mode: "download", url, filename };
}

function setExportStatus(message, downloadLink) {
  if (exportObjectUrl && exportObjectUrl !== downloadLink?.url) {
    URL.revokeObjectURL(exportObjectUrl);
    exportObjectUrl = "";
  }
  elements.exportStatus.textContent = message;
  if (!downloadLink) return;
  exportObjectUrl = downloadLink.url;
  elements.exportStatus.append(" ");
  const link = document.createElement("a");
  link.href = downloadLink.url;
  link.download = downloadLink.filename;
  link.textContent = "保存リンクを開く";
  elements.exportStatus.append(link);
}

async function exportBackup() {
  const payload = {
    app: "reading-gate",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  try {
    const result = await downloadText(
      `reading-gate-backup-${fileDate()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
      "JSONバックアップ",
      [".json"],
    );
    setExportStatus(
      result === "saved" ? "バックアップを保存しました。" : "自動で始まらない場合は、",
      result === "saved" ? null : result,
    );
  } catch {
    setExportStatus("バックアップの保存をキャンセルしました。");
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function exportNotionCsv() {
  const header = ["Book", "Author", "Date", "Page", "Memo"];
  const rows = state.memos.map((memo) => {
    const book = state.books.find((item) => item.id === memo.bookId);
    return [
      book?.title || "未設定の本",
      book?.author || "",
      dateKey(memo.date),
      memo.page || "",
      memo.text || "",
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  try {
    const result = await downloadText(
      `reading-gate-notion-memos-${fileDate()}.csv`,
      `\ufeff${csv}`,
      "text/csv;charset=utf-8",
      "Notion用CSV",
      [".csv"],
    );
    setExportStatus(
      result === "saved" ? "Notion用CSVを保存しました。" : "自動で始まらない場合は、",
      result === "saved" ? null : result,
    );
  } catch {
    setExportStatus("Notion用CSVの保存をキャンセルしました。");
  }
}

async function exportEvernoteMarkdown() {
  const lines = ["# 読書ゲート 読書メモ", ""];
  state.books.forEach((book) => {
    const memos = state.memos
      .filter((memo) => memo.bookId === book.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!memos.length) return;
    lines.push(`## ${book.title || "未設定の本"}`, "");
    if (book.author) lines.push(`著者: ${book.author}`, "");
    memos.forEach((memo) => {
      lines.push(`### ${dateKey(memo.date)} / p.${memo.page || "-"}`, "");
      lines.push(memo.text || "", "");
    });
  });
  try {
    const result = await downloadText(
      `reading-gate-evernote-memos-${fileDate()}.md`,
      lines.join("\n"),
      "text/markdown;charset=utf-8",
      "Evernote用Markdown",
      [".md"],
    );
    setExportStatus(
      result === "saved" ? "Evernote用Markdownを保存しました。" : "自動で始まらない場合は、",
      result === "saved" ? null : result,
    );
  } catch {
    setExportStatus("Evernote用Markdownの保存をキャンセルしました。");
  }
}

function openImportBackup() {
  elements.importBackupFile.value = "";
  elements.importBackupFile.click();
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      if (!window.confirm("現在の読書データをバックアップの内容に置き換えます。読み込みますか？")) {
        setExportStatus("バックアップの読み込みをキャンセルしました。");
        return;
      }
      state = normalizeState(parsed.data || parsed);
      selectedMemoBookId = state.books[0]?.id || "";
      saveState();
      resetTimerLength();
      setYokai("done");
      render();
      setExportStatus("バックアップを読み込みました。");
    } catch {
      setExportStatus("バックアップを読み込めませんでした。");
    }
  });
  reader.readAsText(file);
}

function resetTimerLength() {
  if (timer.running) return;
  timer.totalSeconds = state.settings.readingMinutes * 60;
  timer.remainingSeconds = timer.totalSeconds;
  updateTimerDisplay();
}

function openGate() {
  setYokai("gate");
  if (elements.gateDialog.open) return;
  elements.gateDialog.showModal();
}

function handleGateAction(action) {
  elements.gateDialog.close();
  if (action === "read") startReadingTimer(state.settings.readingMinutes);
  if (action === "short") startReadingTimer(state.settings.shortReadingMinutes);
  if (action === "sns") startSnsTimer();
}

function startSnsTimer() {
  clearInterval(snsTimer.interval);
  snsTimer.remainingSeconds = state.settings.snsMinutes * 60;
  elements.snsActions.classList.add("hidden");
  elements.snsMessage.textContent = "終わったら、もう一度だけ聞くね。";
  elements.snsTime.textContent = formatTimer(snsTimer.remainingSeconds);
  elements.snsDialog.showModal();
  snsTimer.interval = setInterval(() => {
    snsTimer.remainingSeconds -= 1;
    elements.snsTime.textContent = formatTimer(snsTimer.remainingSeconds);
    if (snsTimer.remainingSeconds <= 0) {
      clearInterval(snsTimer.interval);
      elements.snsMessage.textContent = "もう少し見る？ それとも読む？";
      elements.snsActions.classList.remove("hidden");
    }
  }, 1000);
}

function handleSnsAction(action) {
  elements.snsDialog.close();
  if (action === "read") startReadingTimer(state.settings.readingMinutes);
  if (action === "extend") startSnsTimer();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.nav));
});

document.querySelectorAll("[data-start-reading]").forEach((button) => {
  button.addEventListener("click", () => startReadingTimer(state.settings.readingMinutes));
});

document.getElementById("open-gate")?.addEventListener("click", openGate);

document.querySelectorAll("[data-gate-action]").forEach((button) => {
  button.addEventListener("click", () => handleGateAction(button.dataset.gateAction));
});

document.querySelectorAll("[data-sns-action]").forEach((button) => {
  button.addEventListener("click", () => handleSnsAction(button.dataset.snsAction));
});

document.querySelectorAll("#range-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    activeRange = Number(button.dataset.range);
    document.querySelectorAll("#range-tabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderGraphs();
  });
});

elements.bookForm.addEventListener("submit", addBook);
elements.bookCancel.addEventListener("click", resetBookForm);
elements.sessionEditForm.addEventListener("submit", saveSessionEdit);
elements.sessionCancel.addEventListener("click", resetSessionEdit);
elements.timerStart.addEventListener("click", toggleTimer);
elements.timerFinish.addEventListener("click", finishTimer);
elements.sessionForm.addEventListener("submit", saveSession);
elements.settingsForm.addEventListener("submit", saveSettings);
elements.exportBackup.addEventListener("click", exportBackup);
elements.importBackup.addEventListener("click", openImportBackup);
elements.importBackupFile.addEventListener("change", importBackup);
elements.exportNotion.addEventListener("click", exportNotionCsv);
elements.exportEvernote.addEventListener("click", exportEvernoteMarkdown);

updateTimerDisplay();
render();
window.setTimeout(openGate, 300);
