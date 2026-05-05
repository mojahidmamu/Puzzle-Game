import { useState, useEffect } from "react";
import confetti from "canvas-confetti";

function App() {
  const [size, setSize] = useState(3);
  const [board, setBoard] = useState([]);
  const [emptyPos, setEmptyPos] = useState({ row: 0, col: 0 });
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [dark, setDark] = useState(true);
  const [history, setHistory] = useState([]);

  // 🎵 SOUND
  const playSound = (type) => {
    const audio = new Audio(
      type === "win"
        ? "https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3"
        : "https://assets.mixkit.co/sfx/preview/mixkit-game-click-1114.mp3"
    );
    audio.play();
  };

  // ⏱️ TIMER FORMAT
  const formatTime = (t) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 🔀 SHUFFLE
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  // 🧱 GENERATE BOARD
  const generate = () => {
    let arr = Array.from({ length: size * size - 1 }, (_, i) => i + 1);
    arr.push(0);
    shuffle(arr);

    const b = [];
    for (let i = 0; i < size; i++) {
      b.push(arr.slice(i * size, i * size + size));
    }

    const idx = arr.indexOf(0);
    setEmptyPos({ row: Math.floor(idx / size), col: idx % size });
    setBoard(b);
    setMoves(0);
    setTime(0);
    setIsWon(false);
    setHistory([]);
  };

  // 🏆 WIN CHECK
  const checkWin = (b) => {
    let k = 1;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === size - 1 && j === size - 1) return b[i][j] === 0;
        if (b[i][j] !== k++) return false;
      }
    }
    return true;
  };

  // 🎮 MOVE
  const move = (r, c) => {
    const { row: er, col: ec } = emptyPos;
    if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return;

    setHistory((h) => [...h, board]);

    const b = board.map((row) => [...row]);
    b[er][ec] = b[r][c];
    b[r][c] = 0;

    setBoard(b);
    setEmptyPos({ row: r, col: c });
    setMoves((m) => m + 1);
    playSound("move");

    if (checkWin(b)) {
      setIsWon(true);
      playSound("win");
      confetti();
    }
  };

  // 🔁 UNDO
  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setBoard(last);
    setHistory((h) => h.slice(0, -1));
    setMoves((m) => m - 1);
  };

  // ⏱️ TIMER
  useEffect(() => {
    let t;
    if (!isWon) t = setInterval(() => setTime((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isWon]);

  useEffect(() => generate(), [size]);

  // 🧠 SMART HINT (better)
  const hint = () => {
    let bestMove = null;
    let bestScore = Infinity;

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    dirs.forEach(([dr, dc]) => {
      const r = emptyPos.row + dr;
      const c = emptyPos.col + dc;
      if (r >= 0 && c >= 0 && r < size && c < size) {
        const temp = board.map((row) => [...row]);
        temp[emptyPos.row][emptyPos.col] = temp[r][c];
        temp[r][c] = 0;

        let score = temp.flat().reduce((acc, val, i) => {
          return val === i + 1 ? acc : acc + 1;
        }, 0);

        if (score < bestScore) {
          bestScore = score;
          bestMove = [r, c];
        }
      }
    });

    if (bestMove) move(bestMove[0], bestMove[1]);
  };

  // 📊 PROGRESS
  const getProgress = () => {
    let correct = 0;
    let k = 1;

    board.forEach((row) =>
      row.forEach((val) => {
        if (val === k++) correct++;
      })
    );

    return Math.floor((correct / (size * size)) * 100);
  };

  return (
    <div
      className={`min-h-screen transition-all duration-500 ${
        dark
          ? "bg-gradient-to-br from-black via-gray-900 to-purple-900 text-white"
          : "bg-gray-100 text-black"
      }`}
    >
      {/* HEADER */}
      <div className="flex justify-between p-4">
        <h1 className="text-2xl font-bold">🧩 Puzzle Pro</h1>

        <div className="flex gap-2">
          <button onClick={() => setDark(!dark)} className="btn">
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="flex justify-center gap-4">
        <div className="badge">Moves: {moves}</div>
        <div className="badge">Time: {formatTime(time)}</div>
      </div>

      {/* PROGRESS */}
      <div className="w-64 mx-auto mt-4 bg-gray-300 h-3 rounded-full">
        <div
          className="bg-green-500 h-3 rounded-full transition-all"
          style={{ width: `${getProgress()}%` }}
        ></div>
      </div>

      {/* BOARD */}
      <div className="flex justify-center mt-6">
        <div
          className="grid gap-2 p-3 bg-white/10 rounded-xl"
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(60px, 80px))`,
          }}
        >
          {board.flat().map((num, i) => {
            const r = Math.floor(i / size);
            const c = i % size;

            return (
              <div
                key={i}
                onClick={() => move(r, c)}
                className={`aspect-square flex items-center justify-center font-bold rounded-lg
                transition-all duration-300 active:scale-90
                ${
                  num === 0
                    ? "bg-transparent"
                    : "bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg"
                }`}
              >
                {num !== 0 && num}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex justify-center gap-3 mt-6 flex-wrap">
        {[3, 4, 5].map((n) => (
          <button key={n} onClick={() => setSize(n)} className="btn">
            {n}x{n}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-4 flex-wrap">
        <button onClick={generate} className="btn btn-success">
          Shuffle
        </button>
        <button onClick={hint} className="btn btn-warning">
          Hint
        </button>
        <button onClick={undo} className="btn btn-info">
          Undo
        </button>
      </div>

      {/* WIN MODAL */}
      {isWon && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white text-black p-6 rounded-xl text-center">
            <h2 className="text-2xl font-bold">🎉 You Win!</h2>
            <p>Moves: {moves}</p>
            <p>Time: {formatTime(time)}</p>

            <button
              onClick={generate}
              className="btn mt-3 bg-blue-500 text-white"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;