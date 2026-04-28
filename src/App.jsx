import { useState, useEffect, useCallback } from 'react'
import confetti from 'canvas-confetti'
import './index.css'

function App() {
  const [size, setSize] = useState(3)
  const [board, setBoard] = useState([])
  const [emptyPos, setEmptyPos] = useState({ row: 0, col: 0 })
  const [moves, setMoves] = useState(0)
  const [time, setTime] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [level, setLevel] = useState(1)

  const [imageMode, setImageMode] = useState(false)
  const [dailyMode, setDailyMode] = useState(false)

  const [leaderboard, setLeaderboard] = useState(() => {
    return JSON.parse(localStorage.getItem("leaderboard")) || []
  })

  // ---------------- SOUND ----------------
  const playSound = (f) => {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)

    o.frequency.value = f === "win" ? 800 : f === "hint" ? 300 : 500
    g.gain.value = 0.1

    o.start()
    o.stop(ctx.currentTime + 0.1)
  }

  // ---------------- DAILY SEED ----------------
  const seed = () => {
    const d = new Date().toDateString()
    return d.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  const shuffle = (arr) => {
    let s = dailyMode ? seed() : Math.random()
    const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  // ---------------- BOARD ----------------
  const generate = () => {
    let arr = Array.from({ length: size * size - 1 }, (_, i) => i + 1)
    arr.push(0)
    shuffle(arr)

    const b = []
    for (let i = 0; i < size; i++) {
      b.push(arr.slice(i * size, i * size + size))
    }

    const idx = arr.indexOf(0)
    setEmptyPos({ row: Math.floor(idx / size), col: idx % size })
    setBoard(b)

    setMoves(0)
    setTime(0)
    setIsWon(false)
  }

  // ---------------- WIN CHECK ----------------
  const checkWin = (b) => {
    let k = 1
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === size - 1 && j === size - 1) return b[i][j] === 0
        if (b[i][j] !== k++) return false
      }
    }
    return true
  }

  // ---------------- MOVE ----------------
  const move = (r, c) => {
    const { row: er, col: ec } = emptyPos
    if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return

    const b = board.map(r => [...r])
    b[er][ec] = b[r][c]
    b[r][c] = 0

    setBoard(b)
    setEmptyPos({ row: r, col: c })
    setMoves(m => m + 1)

    if (checkWin(b)) {
      setIsWon(true)
      playSound("win")
      confetti()

      const newScore = { moves, time, size }
      const updated = [...leaderboard, newScore]
        .sort((a, b) => a.moves - b.moves)
        .slice(0, 10)

      setLeaderboard(updated)
      localStorage.setItem("leaderboard", JSON.stringify(updated))

      setLevel(l => l + 1)
    }
  }

  // ---------------- TIMER ----------------
  useEffect(() => {
    let t
    if (!isWon) t = setInterval(() => setTime(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [isWon])

  useEffect(() => generate(), [size, dailyMode])

  // ---------------- SWIPE ----------------
  useEffect(() => {
    let sx, sy

    const start = e => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    }

    const end = e => {
      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy
      const { row, col } = emptyPos

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 40) move(row, col - 1)
        else move(row, col + 1)
      } else {
        if (dy > 40) move(row - 1, col)
        else move(row + 1, col)
      }
    }

    window.addEventListener("touchstart", start)
    window.addEventListener("touchend", end)

    return () => {
      window.removeEventListener("touchstart", start)
      window.removeEventListener("touchend", end)
    }
  }, [board, emptyPos])

  // ---------------- AI HINT (simple greedy) ----------------
  const hint = () => {
    playSound("hint")
    const flat = board.flat()
    const wrong = flat.findIndex((v, i) => v !== i + 1 && v !== 0)

    if (wrong !== -1) {
      const r = Math.floor(wrong / size)
      const c = wrong % size
      move(r, c)
    }
  }

  // ---------------- IMAGE MODE ----------------
  const tileStyle = (num) => {
    if (!imageMode) return {}
    return {
      backgroundImage: "url('/puzzle.jpg')",
      backgroundSize: `${size * 100}%`,
      backgroundPosition: `${(num % size) * 100}% ${(Math.floor(num / size)) * 100}%`
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 text-white">

      {/* HEADER */}
      <div className="p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">🧩 Puzzle Pro Max</h1>

        <div className="flex gap-2">
          <button onClick={() => setImageMode(!imageMode)} className="btn btn-sm">
            🧩 Image
          </button>

          <button onClick={() => setDailyMode(!dailyMode)} className="btn btn-sm">
            🎯 Daily
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="flex justify-center gap-3">
        <div className="badge badge-primary">Moves: {moves}</div>
        <div className="badge badge-secondary">Time: {time}</div>
        <div className="badge badge-accent">Level: {level}</div>
      </div>

      {/* BOARD */}
      <div className="flex justify-center mt-6">
        <div
          className="grid gap-2 p-4 bg-white/10 rounded-2xl backdrop-blur-xl"
          style={{ gridTemplateColumns: `repeat(${size}, 70px)` }}
        >
          {board.flat().map((num, i) => {
            const r = Math.floor(i / size)
            const c = i % size
            return (
              <div
                key={i}
                onClick={() => move(r, c)}
                style={tileStyle(num)}
                className={`h-[70px] w-[70px] flex items-center justify-center font-bold rounded-lg
                  ${num === 0 ? "bg-transparent" : "bg-gradient-to-r from-blue-500 to-purple-500"}`}
              >
                {!imageMode && num !== 0 && num}
              </div>
            )
          })}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex justify-center gap-3 mt-6">
        {[3, 4, 5].map(n => (
          <button key={n} onClick={() => setSize(n)} className="btn">
            {n}x{n}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-4">
        <button onClick={generate} className="btn btn-success">Shuffle</button>
        <button onClick={hint} className="btn btn-warning">Hint 🧠</button>
      </div>

      {/* LEADERBOARD */}
      <div className="mt-10 text-center">
        <h2 className="text-xl font-bold">🏅 Leaderboard</h2>
        {leaderboard.map((s, i) => (
          <div key={i} className="text-sm opacity-80">
            #{i + 1} Moves: {s.moves} | Time: {s.time}s
          </div>
        ))}
      </div>

      {/* WIN */}
      {isWon && (
        <div className="text-center mt-6 text-3xl text-green-400 animate-bounce">
          🎉 You Won!
        </div>
      )}
    </div>
  )
}

export default App