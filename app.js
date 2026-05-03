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

document.getElementById("btnAddPlayer").addEventListener("click", addPlayer);
document.getElementById("btnStartGame").addEventListener("click", startGame);
document.getElementById("btnRightAnswer").addEventListener("click", correct);
document.getElementById("btnWrongAnswer").addEventListener("click", wrong);
document.getElementById("btnEndQuestion").addEventListener("click", endQuestion);
document.getElementById("btnShowLeaderboard").addEventListener("click", showLeaderboard);
document.getElementById("btnClearState").addEventListener("click", clearState);

loadState();

/* SPIELER */
function addPlayer() {
  const nameInput = document.getElementById("playerName");
  const name = nameInput.value.trim();
  if (!name) return;

  players.push({ name, score: 0 });
  nameInput.value = "";
  renderPlayers();
}

function renderPlayers() {
  document.getElementById("players").innerHTML =
    players.map(p => p.name).join("<br>");
}

/* START */
async function startGame() {
  if(players.length == 0){
    return await alertDialog("Es muss mindestens ein Spieler hinzugefügt werden.");
  }
  const file = document.getElementById("jsonUpload").files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      data = JSON.parse(e.target.result);
      initBoard();
      saveState();
    };
    reader.readAsText(file);
    return;
  } else {
    return await alertDialog("Es muss ein Fragenset ausgewählt werden.");
  }
}

/* BOARD */
function initBoard() {
  document.getElementById("setup").style.display = "none";

  const headline = document.getElementById("headline");
  headline.innerText = data.title;

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
        }

        btn.onclick = () => openQuestion(q, btn, key);
      }

      board.appendChild(btn);
    });
  }
}

/* FRAGE */
function openQuestion(q, btn, key) {
  if (btn.classList.contains("used")) return;

  currentQuestion = { q, btn, key };
  btn.classList.add("used");

  document.getElementById("btnEndQuestion").style.display = "none";
  document.getElementById("modal").style.display = "flex";
  questionPlayer = currentPlayer;
  isTimerRunning = true;
  document.getElementById("questionPlayer").innerText = "Frage für: " + players[questionPlayer].name;
  document.getElementById("questionText").innerText = "Frage: " + q.question;

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
  } else {
    await alertDialog(players[questionPlayer].name + "darf die Frage beantworten!");
    startTimer();
  }
}

function showAnswer(){
  isTimerRunning = false;
  document.getElementById("answer").style.display = "block";
  document.getElementById("btnEndQuestion").style.display = "inline-block";
  document.getElementById("btnRightAnswer").style.display = "none";
  document.getElementById("btnWrongAnswer").style.display = "none";

  usedQuestions[currentQuestion.key] = true;
  nextPlayer();
  saveState();
}

function nextPlayer() {
  currentPlayer = (currentPlayer + 1) % players.length;
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

  timerInterval = setInterval(() => {
    if(isTimerRunning){
      timeLeft--;
    }
    document.getElementById("timer").innerText = "Zeit: " + timeLeft;

    if (timeLeft <= 0) {
      alertDialog("Die Zeit ist abgelaufen, der nächste Spieler ist dran!");
      wrong();
      clearInterval(timerInterval);
    }
  }, 1000);
}

/* LEADERBOARD */
function showLeaderboard() {
  const lb = document.getElementById("leaderboard");
  lb.style.display = "block";

  players.sort((a,b) => b.score - a.score);

  lb.innerHTML =
    "<h2>🏆 Leaderboard</h2>" +
    players.map(p => `${p.name}: ${p.score}`).join("<br>") +
    "<br>Restliche Punkte: " + leftPoints +
    "<br><button id='btnCloseLeaderboard'>Schließen</button>";

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
    answerTime
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

  initBoard();
}

async function clearState() {
  if(await confirmDialog("Wollen Sie wirklich das Spiel komplett zurücksetzen?")) {
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
