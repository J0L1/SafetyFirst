let players = [];
let currentPlayer = 0;
let data = null;
let usedQuestions = {};
let currentQuestion = null;
let timerInterval = null;
let answerTime = 60;
let timeLeft = 0;
let questionPlayer = null;
let leftPoints = 0;
let isTimerRunning = true;
let numberOfAllQuestions = 0;
let numberOfUsedQuestions = 0;
let theme = "";

document.getElementById("btnAddPlayer").addEventListener("click", addPlayer);
document.getElementById("btnStartGame").addEventListener("click", startGame);
document.getElementById("btnRightAnswer").addEventListener("click", correct);
document.getElementById("btnWrongAnswer").addEventListener("click", wrong);
document.getElementById("btnEndQuestion").addEventListener("click", endQuestion);
document.getElementById("btnShowLeaderboard").addEventListener("click", showLeaderboard);
document.getElementById("btnClearState").addEventListener("click", clearState);
document.getElementById("btnDownloadConfig").addEventListener("click", downloadConfig);
document.getElementById("btnDownloadManual").addEventListener("click", downloadManual);
document.getElementById("playerName").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        addPlayer();
    }
});
document.getElementById("theme-select").addEventListener("change", (e) => {
  theme = e.target.value;
  document.documentElement.setAttribute(
    "data-theme",
    e.target.value
  );
});

const jsonInput = document.getElementById("jsonUpload");
const mediaInput = document.getElementById("mediaFileInput");
let db;
const request = indexedDB.open("mediaDB", 1);

const currentPlayerOutput = document.getElementById("currentPlayer");

request.onsuccess = function (e) {
  const db = e.target.result;

  // Prüfen ob Store existiert
  if (!db.objectStoreNames.contains("files")) {
    db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
  }
}

request.onupgradeneeded = function (e) {
  db = e.target.result;
  db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = function (e) {
  db = e.target.result;
  loadFiles();
};

loadState();

/* SPIELER */
function addPlayer() {
  const nameInput = document.getElementById("playerName");
  const name = nameInput.value.trim();
  if (!name) return;

  console.log(players);
  if(players.some(player => player.name === name)){
    return alertDialog("Die Spieler dürfen nicht den gleichen Namen haben.");
  }

  players.push({ name, score: 0 });
  nameInput.value = "";
  renderPlayers();
}

function renderPlayers() {
  document.getElementById("players").innerHTML =
    players.map(p => p.name).join("<br>");
  document.getElementById("players").innerHTML += "<br>";
}

function renderMedia(mediaArray) {
    if(mediaArray.length > 0) {
      document.getElementById("mediaFiles").innerHTML = "Medien:<br>";
    }
    mediaArray.forEach(entry => {
      document.getElementById("mediaFiles").innerHTML +=
        entry.file.name + "<br>";
    });
    if(mediaArray.length > 0) {
      const button = document.createElement("button");
      button.innerText = "Alle Medien löschen";

      button.onclick = () => {
        clearAllMediaFiles();
      };
      document.getElementById("mediaFiles").appendChild(button);
    }
}

/* START */
async function startGame() {
  if(players.length < 2){
    return await alertDialog("Es müssen mindestens zwei Spieler hinzugefügt werden.");
  }
  const file = document.getElementById("jsonUpload").files[0];

  if (file) {
    console.log(file);
    const reader = new FileReader();
    reader.onload = e => {
      data = JSON.parse(e.target.result);
      initBoard();
      saveState();
    };
    reader.readAsText(file);
    return;
  } else {
    return await alertDialog("Es muss ein Fragensatz ausgewählt werden.");
  }
}

jsonInput.addEventListener("change", (e) => {
  document.getElementById("jsonFile").innerHTML = "Fragensatz: " + jsonInput.files[0].name + "<br>";
});

mediaInput.addEventListener("change", () => {
  const files = mediaInput.files;
  
  for (let file of files) {
    saveFile(file);
  }

  loadFiles();
});

/* BOARD */
function initBoard() {
  document.getElementById("setup").style.display = "none";
  document.getElementById("btnShowLeaderboard").style.display = "inline-block";
  document.getElementById("btnClearState").style.display = "inline-block";
  document.getElementById("applicationTitle").style.display = "none";
    document.documentElement.setAttribute("data-theme", theme);
  
  const headline = document.getElementById("headline");
  headline.innerText = data.title;

  currentPlayerOutput.innerText = players[currentPlayer].name + " ist dran!";

  const board = document.getElementById("board");
  board.innerHTML = "";

  const cols = data.categories.length;
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  data.categories.forEach((category, ci) => {
    const div = document.createElement("div");
    div.className = "category";
    div.innerText = category.name;
    board.appendChild(div);
  });

  const maxQ = Math.max(...data.categories.map(c => c.questions.length));

  numberOfAllQuestions = 0;
  numberOfUsedQuestions = 0;

  for (let i = 0; i < maxQ; i++) {
    data.categories.forEach((category, ci) => {
      const q = category.questions[i];
      const btn = document.createElement("button");

      if (q) {
        const key = ci + "_" + i;

        btn.className = "question-btn";
        btn.innerText = q.points;

        if (usedQuestions[key]) {
          btn.classList.add("used");
          numberOfUsedQuestions++;
        }

        btn.onclick = () => openQuestion(q, btn, key);
      }

      board.appendChild(btn);
      numberOfAllQuestions++;
    });
  }

  if(numberOfAllQuestions === numberOfUsedQuestions){
    document.getElementById("leaderboard").classList.add("winner");
  } else {
    document.getElementById("leaderboard").classList.remove("winner");
  }
}

/* FRAGE */
function openQuestion(q, btn, key) {
  if (btn.classList.contains("used")) return;

  currentQuestion = { q, btn, key };
  btn.classList.add("used");
  numberOfUsedQuestions ++;

  document.getElementById("btnEndQuestion").style.display = "none";
  document.getElementById("modal").style.display = "flex";
  questionPlayer = currentPlayer;
  isTimerRunning = true;
  document.getElementById("questionPlayer").innerText = "Frage für: " + players[questionPlayer].name;
  document.getElementById("questionText").innerText = "Frage: " + q.question;

  if(numberOfAllQuestions === numberOfUsedQuestions) {
    document.getElementById("leaderboard").classList.add("winner");
  }

  if(q.media != undefined) {
    const element = getFileElement(q.media, document.getElementById("media"));
  }

  const answerDiv = document.getElementById("answer");
  answerDiv.style.display = "none";
  answerDiv.innerText = "Antwort: " + q.answer;

  startTimer();
}

/* LOGIK */
function correct() {
  players[questionPlayer].score += currentQuestion.q.points;
  showAnswer();
}

async function wrong() {
  clearInterval(timerInterval);
  questionPlayer = (questionPlayer + 1) % players.length;
  document.getElementById("questionPlayer").innerText = "Frage für: " + players[questionPlayer].name;
  if(currentPlayer == questionPlayer) {
    await alertDialog("Kein Spieler konnte die Frage korrekt beantworten!");
    leftPoints += currentQuestion.q.points;
    showAnswer();
    document.getElementById("questionPlayer").innerText = "Punkte für: Restliche Punkte";
  } else {
    await alertDialog(players[questionPlayer].name + " darf die Frage beantworten!");
    startTimer();
  }
}

function showAnswer(){
  isTimerRunning = false;
  document.getElementById("answer").style.display = "block";
  document.getElementById("btnEndQuestion").style.display = "inline-block";
  document.getElementById("btnRightAnswer").style.display = "none";
  document.getElementById("btnWrongAnswer").style.display = "none";
  document.getElementById("media").innerHTML = "";

  document.getElementById("questionPlayer").innerText = "Punkte für: " + players[questionPlayer].name;

  usedQuestions[currentQuestion.key] = true;
  nextPlayer();
  saveState();
}

function nextPlayer() {
  currentPlayer = (currentPlayer + 1) % players.length;
  currentPlayerOutput.innerText = players[currentPlayer].name + " ist dran!";
}

function endQuestion() {
  clearInterval(timerInterval);
  document.getElementById("modal").style.display = "none";
  document.getElementById("btnEndQuestion").style.display = "none";
  document.getElementById("btnRightAnswer").style.display = "inline-block";
  document.getElementById("btnWrongAnswer").style.display = "inline-block";

  showLeaderboard();
}

/* TIMER */
async function startTimer() {
  timeLeft = answerTime;
  document.getElementById("timer").innerText = "Zeit: " + timeLeft;

  timerInterval = setInterval(async () => {
    if(isTimerRunning){
      timeLeft--;
    }
    document.getElementById("timer").innerText = "Zeit: " + timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      await alertDialog("Die Zeit ist abgelaufen, der nächste Spieler ist dran!");
      wrong();
    }
  }, 1000);
}

/* LEADERBOARD */
function showLeaderboard() {
  const lb = document.getElementById("leaderboard");
  lb.style.display = "flex";

  let playersForLeaderboard = [ ...players ];
  playersForLeaderboard.sort((a,b) => b.score - a.score);

  let index = 1;
  document.getElementById("leaderboard-list").innerHTML =
    "<h2>🏆 Leaderboard</h2>" +
    playersForLeaderboard.map(p => `<div id="leaderboard-player-${index++}">${p.name}: ${p.score}</div>`).join("<br>") +
    "<br>Restliche Punkte: " + leftPoints + "<br><br>" +
    "<button id='btnCloseLeaderboard'>Schließen</button>";

  document.getElementById("btnCloseLeaderboard").addEventListener("click", closeLeaderboard);
}

function closeLeaderboard() {
  document.getElementById("leaderboard").style.display = "none";
}

/* SPEICHERN */
function saveState() {
  const state = {
    players,
    currentPlayer,
    data,
    usedQuestions,
    leftPoints,
    answerTime,
    theme
  };
  localStorage.setItem("safety_first_state", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("safety_first_state");
  if (!saved) return;

  const state = JSON.parse(saved);

  players = state.players;
  currentPlayer = state.currentPlayer;
  data = state.data;
  usedQuestions = state.usedQuestions || {};
  leftPoints = state.leftPoints;
  answerTime = state.answerTime;
  theme = state.theme;

  initBoard();
}

async function clearState() {
  if(await confirmDialog("Wollen Sie das Spiel komplett zurücksetzen?")) {
    localStorage.removeItem("safety_first_state");
    window.location.reload();
  }
}

/* DIALOG */
function alertDialog(message) {
  return createDialog(message, [
    { text: "OK", value: true }
  ]);
}

function confirmDialog(message) {
  return createDialog(message, [
    { text: "Abbrechen", value: false },
    { text: "OK", value: true }
  ]);
}

function createDialog(message, buttons) {
  return new Promise((resolve) => {
    const root = document.getElementById("dialog-root");

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";

    const box = document.createElement("div");
    box.className = "dialog-box";

    const msg = document.createElement("div");
    msg.className = "dialog-message";
    msg.innerText = message;

    const actions = document.createElement("div");
    actions.className = "dialog-actions";

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.innerText = btn.text;

      button.onclick = () => {
        document.body.removeChild(overlay);
        resolve(btn.value);
      };

      actions.appendChild(button);
    });

    box.appendChild(msg);
    box.appendChild(actions);
    overlay.appendChild(box);

    document.body.appendChild(overlay);
  });
}

function downloadConfig() {
    const link = document.createElement("a");
    link.href = "questions_leer.json";
    link.download = "questions_leer.json";
    link.click();
}

function downloadManual() {
    const link = document.createElement("a");
    link.href = "benutzerhandbuch.pdf";
    link.download = "benutzerhandbuch.pdf";
    link.click();
}

/* INDEX-DB */
function saveFile(file) {
  const tx = db.transaction("files", "readwrite");
  const store = tx.objectStore("files");

  store.add({ file: file });
}

function loadFiles() {
  const tx = db.transaction("files", "readonly");
  const store = tx.objectStore("files");

  const request = store.getAll();

  request.onsuccess = function () {
    renderMedia(request.result);
  };
}

function clearAllMediaFiles() {
  const tx = db.transaction("files", "readwrite");
  const store = tx.objectStore("files");

  const request = store.clear();
  document.getElementById("mediaFiles").innerHTML = "";
}

function getFileElement(filename, mediaDiv) {
  const tx = db.transaction("files", "readonly");
  const store = tx.objectStore("files");

  const request = store.getAll();

  request.onsuccess = function () {
    request.result.forEach(entry => {
      if(entry.file.name == filename) {
        mediaDiv.appendChild(getRenderedFile(entry.file));
      }
    });
  };
}

function getRenderedFile(file) {
  const url = URL.createObjectURL(file);

  let element;

  if (file.type.startsWith("image")) {
    element = document.createElement("img");
    element.src = url;
    element.style.height = "60vh";
  } else {
    element = document.createElement("video");
    element.src = url;
    element.controls = true;
    element.autoplay = true;
    element.style.height = "60vh";
  }

  return element;
}
