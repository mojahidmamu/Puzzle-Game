import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import Logo from "../src/assets/logo.jpeg";

// Custorm Hook for Sound Effects
const useCustomSound = () => {
  const audioContext = useRef(null);
  
  const initAudio = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext.current;
  };
  
  const playBeep = (frequency, duration = 0.1, type = 'sine', volume = 0.3) => {
    try {
      const ctx = initAudio();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.value = volume;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.log('Audio not supported');
    }
  };
  
  const playMoveSound = () => playBeep(440, 0.08, 'sine', 0.2);
  const playWinSound = () => {
    playBeep(523.25, 0.15, 'sine', 0.3);
    setTimeout(() => playBeep(659.25, 0.15, 'sine', 0.3), 150);
    setTimeout(() => playBeep(783.99, 0.3, 'sine', 0.4), 300);
  };
  const playUndoSound = () => playBeep(349.23, 0.1, 'sine', 0.15);
  const playClickSound = () => playBeep(523.25, 0.05, 'sine', 0.1);
  const playErrorSound = () => playBeep(220, 0.2, 'sawtooth', 0.2);
  
  return { playMoveSound, playWinSound, playUndoSound, playClickSound, playErrorSound };
};

// Leaderboard Hook: Manages scores in localStorage
const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState(() => {
    const saved = localStorage.getItem('puzzleLeaderboard');
    return saved ? JSON.parse(saved) : [];
  });

  const addScore = (name, moves, time, difficulty, date) => {
    const newEntry = { name, moves, time, difficulty, date, id: Date.now() };
    const updated = [...leaderboard, newEntry]
      .sort((a, b) => a.moves - b.moves)
      .slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem('puzzleLeaderboard', JSON.stringify(updated));
  };

  const clearLeaderboard = () => {
    setLeaderboard([]);
    localStorage.removeItem('puzzleLeaderboard');
  };

  return { leaderboard, addScore, clearLeaderboard };
};

const App = () => {
  // Game State
  const [tiles, setTiles] = useState([]);
  const [size, setSize] = useState(3);
  const [moves, setMoves] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [history, setHistory] = useState([]);
  const [time, setTime] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animatingTile, setAnimatingTile] = useState(null);
  const [finalTime, setFinalTime] = useState(0);
  
  const { playMoveSound, playWinSound, playUndoSound, playClickSound, playErrorSound } = useCustomSound();
  const { leaderboard, addScore, clearLeaderboard } = useLeaderboard();

  const getDifficultyConfig = () => {
    switch(difficulty) {
      case 'easy':
        return { size: 2, shuffleCount: 80, timeLimit: 180, bgGradient: 'from-green-400 to-green-600', icon: '🟢', color: 'success' };
      case 'medium':
        return { size: 3, shuffleCount: 150, timeLimit: 120, bgGradient: 'from-yellow-400 to-yellow-600', icon: '🟡', color: 'warning' };
      case 'hard':
        return { size: 4, shuffleCount: 250, timeLimit: 90, bgGradient: 'from-red-400 to-red-600', icon: '🔴', color: 'error' };
      default:
        return { size: 3, shuffleCount: 150, timeLimit: 120, bgGradient: 'from-yellow-400 to-yellow-600', icon: '🟡', color: 'warning' };
    }      
  };

  const initPuzzle = useCallback(() => {
    const config = getDifficultyConfig();
    const currentSize = config.size;
    const totalTiles = currentSize * currentSize;
    let numbers = Array.from({ length: totalTiles }, (_, i) => i + 1);
    numbers[totalTiles - 1] = 0;
    
    let shuffled = [...numbers];
    for (let i = 0; i < config.shuffleCount; i++) {
      const emptyIndex = shuffled.indexOf(0);
      const possibleMoves = [];
      const row = Math.floor(emptyIndex / currentSize);
      const col = emptyIndex % currentSize;
      
      if (row > 0) possibleMoves.push(emptyIndex - currentSize);
      if (row < currentSize - 1) possibleMoves.push(emptyIndex + currentSize);
      if (col > 0) possibleMoves.push(emptyIndex - 1);
      if (col < currentSize - 1) possibleMoves.push(emptyIndex + 1);
      
      const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      [shuffled[emptyIndex], shuffled[randomMove]] = [shuffled[randomMove], shuffled[emptyIndex]];
    }
    
    setTiles(shuffled);
    setSize(currentSize);
    setMoves(0);
    setGameComplete(false);
    setShowWinModal(false);
    setTimeUp(false);
    setHistory([]);
    setTime(config.timeLimit);
    setTimerActive(true);
    setProgress(0);
  }, [difficulty]);

  const checkVictory = useCallback((currentTiles) => {
    const totalTiles = size * size;
    for (let i = 0; i < totalTiles - 1; i++) {
      if (currentTiles[i] !== i + 1) return false;
    }
    return currentTiles[totalTiles - 1] === 0;
  }, [size]);

  const updateProgress = useCallback((currentTiles) => {
    let correctCount = 0;
    for (let i = 0; i < currentTiles.length - 1; i++) {
      if (currentTiles[i] === i + 1) correctCount++;
    }
    const totalTiles = currentTiles.length - 1;
    const percentage = (correctCount / totalTiles) * 100;
    setProgress(percentage);
  }, []);

  const isValidMove = (clickedIdx, emptyIdx, gridSize) => {
    const clickedRow = Math.floor(clickedIdx / gridSize);
    const clickedCol = clickedIdx % gridSize;
    const emptyRow = Math.floor(emptyIdx / gridSize);
    const emptyCol = emptyIdx % gridSize;
    return (Math.abs(clickedRow - emptyRow) + Math.abs(clickedCol - emptyCol)) === 1;
  };

  const handleTileClick = (index) => {
    if (gameComplete || timeUp) {
      if (timeUp && soundEnabled) playErrorSound();
      return;
    }
    
    const emptyIndex = tiles.indexOf(0);
    const isValid = isValidMove(index, emptyIndex, size);
    
    if (isValid) {
      setHistory([...history, { tiles: [...tiles], moves }]);
      setAnimatingTile(index);
      setTimeout(() => setAnimatingTile(null), 200);
      if (soundEnabled) playMoveSound();
      
      const newTiles = [...tiles];
      [newTiles[index], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[index]];
      setTiles(newTiles);
      setMoves(moves + 1);
      updateProgress(newTiles);
      
      if (checkVictory(newTiles)) {
        setGameComplete(true);
        setTimerActive(false);
        setFinalTime(time);
        if (soundEnabled) playWinSound();
        setShowNameInput(true);
      }
    } else if (soundEnabled) {
      playErrorSound();
    }
  };

  const saveScore = () => {
    if (playerName.trim()) {
      addScore(playerName.trim(), moves, finalTime, difficulty, new Date().toLocaleDateString());
      setShowNameInput(false);
      setShowWinModal(true);
    }
  };

  const undoLastMove = () => {
    if (history.length === 0 || gameComplete || timeUp) {
      if (soundEnabled) playErrorSound();
      return;
    }
    
    const lastState = history[history.length - 1];
    setTiles(lastState.tiles);
    setMoves(lastState.moves);
    setHistory(history.slice(0, -1));
    updateProgress(lastState.tiles);
    if (soundEnabled) playUndoSound();
  };

  const resetGame = () => {
    initPuzzle();
    if (soundEnabled && !gameComplete) playClickSound();
  };

  const changeDifficulty = (newDifficulty) => {
    setDifficulty(newDifficulty);
    setTimeout(() => initPuzzle(), 100);
    if (soundEnabled) playClickSound();
  };

  useEffect(() => {
    let interval;
    if (timerActive && !gameComplete && time > 0 && !timeUp) {
      interval = setInterval(() => {
        setTime(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerActive(false);
            setTimeUp(true);
            if (soundEnabled) playErrorSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, gameComplete, time, soundEnabled, playErrorSound]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    initPuzzle();
  }, [initPuzzle]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTileSize = () => {
    if (windowSize.width < 640) return size === 2 ? 'w-24 h-24' : size === 3 ? 'w-20 h-20' : 'w-16 h-16';
    if (windowSize.width < 768) return size === 2 ? 'w-28 h-28' : size === 3 ? 'w-24 h-24' : 'w-20 h-20';
    return size === 2 ? 'w-32 h-32' : size === 3 ? 'w-28 h-28' : 'w-24 h-24';
  };

  const getProgressColor = () => {
    if (progress < 30) return 'bg-gradient-to-r from-red-500 to-orange-500';
    if (progress < 70) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-green-500 to-emerald-500';
  };

  const currentConfig = getDifficultyConfig();

  return (
    <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'}`}>
      {gameComplete && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />}
      
      {/* Navbar */}
      <div className={`shadow-lg sticky top-0 z-50 ${darkMode ? 'bg-gray-900/90 backdrop-blur-md border-b border-purple-500/30' : 'bg-white/90 backdrop-blur-md border-b border-purple-200'}`}>
        <div className="   px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: gameComplete ? 360 : 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl"
            >
              🧩
            </motion.div>
            <h1 className={`text-2xl md:text-3xl font-bold underline bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent`}>
              Puzzle Master
            </h1>
          </div>
          
          <div className="flex gap-3">
            <div className={`stat px-4 py-2 rounded-xl ${time <= 30 ? 'bg-red-500/20 border border-red-500' : darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <div className="stat-value text-sm flex items-center gap-2">
                <span className='font-semibold hover:text-white'>Time  {formatTime(time)}</span>
              </div>
            </div>
            
            <button onClick={() => setDarkMode(!darkMode)} className={`btn btn-circle p-2 rounded-lg ${darkMode ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-white'}`}>
              {darkMode ? <span className="text-xl">☀️</span> : <span className="text-xl">🌙</span>}
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={`btn btn-circle p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              {soundEnabled ? <span className="text-xl">🔊</span> : <span className="text-xl">🔇</span>}
            </button>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className={`btn btn-circle p-2 rounded-lg ${darkMode ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <span className="text-xl">🏆</span>
            </button>
            <button onClick={() => setShowMenu(!showMenu)} className="btn btn-circle lg:hidden">
              <span className="text-xl">☰</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar  */}
      <div className="container mx-auto px-4 mt-6">
        <div className="relative">
          <div className="w-full bg-gray-700/30 rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div 
              className={`h-3 rounded-full ${getProgressColor()} shadow-lg`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1 text-sm font-medium">
            <span className={progress >= 25 ? 'text-green-500' : 'text-gray-400'}>🎯 25%</span>
            <span className={progress >= 50 ? 'text-yellow-500' : 'text-gray-400'}>⭐ 50%</span>
            <span className={progress >= 75 ? 'text-orange-500' : 'text-gray-400'}>🔥 75%</span>
            <span className={progress >= 100 ? 'text-purple-500' : 'text-gray-400'}>🏆 100% <br /><span className='font-bold mx-2 mx-auto'>Winner</span></span>
          </div>
        </div>
        <p className="text-xs text-center opacity-70 font-bold text-black-400 hover:text-white">Progress: {Math.round(progress)}% Complete</p>
      </div>

      {/* Main Game Area */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4 space-y-4">
            {/* Stats Card */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className={`card shadow-xl rounded-2xl ${darkMode ? 'bg-gray-900/80 backdrop-blur-sm border border-purple-500/30' : 'bg-white/80 backdrop-blur-sm border border-purple-200'}`}
            >
              <div className="card-body p-2 ">
                <h2 className="card-title font-bold text-2xl mx-4 hover:text-purple-500"><span>📊</span> Game Stats</h2>
                <div className="stats shadow w-full bg-transparent">
                  <div className="stat text-center">
                    <div className="stat-title text-lg hover:text-white">Moves</div>
                    <motion.div 
                      key={moves}
                      initial={{ scale: 1.5 }}
                      animate={{ scale: 1 }}
                      className="stat-value text-4xl text-purple-500"
                    >
                      {moves}
                    </motion.div>
                  </div>
                  <div className="stat text-center">
                    <div className="stat-title text-lg hover:text-white">Time Left</div>
                    <div className={`stat-value text-2xl ${time <= 30 ? 'text-red-500' : 'text-yellow-500'}`}>
                      {formatTime(time)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Difficulty Card */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className={`card shadow-xl rounded-2xl py-2  ${darkMode ? 'bg-gray-900/80 backdrop-blur-sm border border-purple-500/30' : 'bg-white/80 backdrop-blur-sm border border-purple-200'}`}
            >
              <div className="card-body p-2">
                <h2 className="card-title font-bold text-2xl mx-8 mb-2 hover:text-purple-500"><span>🎮</span> Difficulty</h2>
                <div className="grid grid-cols-3 gap-2 ">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => changeDifficulty('easy')}
                    className={`btn btn-lg flex flex-col gap-1  border rounded-lg hover:text-white py-2 ${difficulty === 'easy' ? 'btn-success shadow-lg' : 'btn-ghost'}`}
                  >
                    <span className="text-2xl">🟢</span>
                    <span>Easy</span>
                    <span className="text-xs">2x2 • 3min</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => changeDifficulty('medium')}
                    className={`btn btn-lg flex flex-col gap-1 border rounded-lg hover:text-white py-2 ${difficulty === 'medium' ? 'btn-warning shadow-lg' : 'btn-ghost'}`}
                  >
                    <span className="text-2xl">🟡</span>
                    <span>Medium</span>
                    <span className="text-xs">3x3 • 2min</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => changeDifficulty('hard')}
                    className={`btn btn-lg flex flex-col gap-1 border rounded-lg hover:text-white py-2 ${difficulty === 'hard' ? 'btn-error shadow-lg' : 'btn-ghost'}`}
                  >
                    <span className="text-2xl">🔴</span>
                    <span>Hard</span>
                    <span className="text-xs">4x4 • 1.5min</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Controls Card Desktop */}
            <div className={`card shadow-xl rounded-2xl p-2  ${darkMode ? 'bg-gray-900/80 backdrop-blur-sm border border-purple-500/30' : 'bg-white/80 backdrop-blur-sm border border-purple-200'} hidden lg:block`}>
              <div className="card-body">
                <h2 className="card-title font-bold text-2xl mx-10  hover:text-white"><span>🎛️</span> Controls</h2>
                <div className="space-y-3 mt-4">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={undoLastMove} 
                    className="btn btn-secondary border rounded-lg  w-full gap-2 text-lg hover:text-purple-500 " 
                    disabled={history.length === 0 || gameComplete || timeUp}
                  >
                    <span>↩️</span> Undo Last Move
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetGame} 
                    className="btn btn-primary w-full gap-2 text-lg  border rounded-lg hover:text-purple-500"
                  >
                    <span>🔄</span> New Game
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Puzzle Grid */}
          <div className="lg:w-3/4 flex justify-center">
            <motion.div 
              className={`grid gap-2 p-8 rounded-3xl shadow-2xl ${darkMode ? 'bg-gray-900/60 backdrop-blur-sm' : 'bg-white/60 backdrop-blur-sm'}`}
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {tiles.map((tile, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={animatingTile === idx ? { 
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0],
                    transition: { duration: 0.2 }
                  } : {}}
                  onClick={() => handleTileClick(idx)}
                  className={`${getTileSize()} ${tile === 0 ? `${darkMode ? 'bg-gray-800' : 'bg-gray-200'} opacity-50` : `bg-gradient-to-br ${currentConfig.bgGradient} text-white shadow-xl`} 
                             rounded-2xl flex items-center justify-center text-3xl md:text-4xl font-bold
                             transition-all duration-200 hover:shadow-2xl hover:scale-105 cursor-pointer`}
                >
                  {tile !== 0 && tile}
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden fixed bottom-4 left-0 right-0 px-4 z-40">
          <div className={`card shadow-xl ${darkMode ? 'bg-gray-900/95 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'}`}>
            <div className="card-body p-4 flex-row gap-3 justify-center">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={undoLastMove} 
                className="btn btn-secondary flex-1 gap-2 text-lg" 
                disabled={history.length === 0 || gameComplete || timeUp}
              >
                <span>↩️</span> Undo
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={resetGame} 
                className="btn btn-primary flex-1 gap-2 text-lg"
              >
                <span>🔄</span> New
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Name Input Modal */}
      <AnimatePresence>
        {showNameInput && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="card w-full  max-w-md bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl"
            >
              <div className="card-body p-2 text-center">
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
                    <span className="text-6xl">🏆</span>
                  </div>
                </div>
                <h2 className="card-title text-3xl justify-center text-white mt-4">New Record! 🎉</h2>
                <p className="text-white/90 text-lg">You solved the puzzle in {moves} moves!</p>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="input input-lg w-full mt-4 bg-white/20 text-white placeholder-white/70 border-white/30"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveScore()}
                  autoFocus
                />
                <button onClick={saveScore} className="btn btn-light btn-lg mt-4 bg-white text-purple-600 hover:bg-gray-100">
                  Save to Leaderboard 📝
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Modal */}
      <AnimatePresence>
        {showWinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="card w-full max-w-lg bg-gradient-to-br from-green-600 to-emerald-600 shadow-2xl"
            >
              <div className="card-body text-center text-white">
                <div className="flex justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: 2 }}
                    className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <span className="text-7xl">🏆</span>
                  </motion.div>
                </div>
                <h2 className="card-title text-4xl justify-center mt-4">Victory! 🎉</h2>
                <p className="text-xl">Congratulations! You're a Puzzle Master!</p>
                <div className="stats shadow my-4 bg-white/20 text-white">
                  <div className="stat text-center">
                    <div className="stat-title text-white/80">Moves</div>
                    <div className="stat-value text-3xl">{moves}</div>
                  </div>
                  <div className="stat text-center">
                    <div className="stat-title text-white/80">Time Left</div>
                    <div className="stat-value text-3xl">{formatTime(finalTime)}</div>
                  </div>
                </div>
                <div className="card-actions justify-center gap-3">
                  <button onClick={() => { setShowWinModal(false); resetGame(); }} className="btn btn-light btn-lg bg-white text-green-600 hover:bg-gray-100">
                    Play Again 🎮
                  </button>
                  <button onClick={() => setShowWinModal(false)} className="btn btn-outline btn-lg border-white text-white hover:bg-white/20">
                    Close ✕
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time Up Modal */}
      <AnimatePresence>
        {timeUp && !gameComplete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="card w-full max-w-md bg-gradient-to-br from-red-600 to-orange-600 shadow-2xl"
            >
              <div className="card-body text-center text-white">
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-6xl">⏰</span>
                  </div>
                </div>
                <h2 className="card-title text-3xl justify-center mt-4">Time's Up! ⏰</h2>
                <p className="text-lg">Don't worry, try again and beat the clock!</p>
                <div className="card-actions justify-center mt-4">
                  <button onClick={resetGame} className="btn btn-light btn-lg bg-white text-red-600 hover:bg-gray-100">
                    Try Again 🔄
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="card w-full rounded-3xl max-w-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-body p-4">
                <div className="flex justify-between items-center">
                  <h2 className="card-title text-3xl  mb-3 text-white">
                    <span>🏆</span> Leaderboard
                  </h2>
                  <button onClick={() => setShowLeaderboard(false)} className="btn btn-circle btn-ghost text-white">✕</button>
                </div>
                
                {leaderboard.length === 0 ? (
                  <div className="text-center text-white/80 py-8">
                    <p className="text-xl">No scores yet!</p>
                    <p>Be the first to win and appear here! 🎮</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr className="text-white underline border-white/30">
                          <th className="text-lg">#</th>
                          <th className="text-lg">Player</th>
                          <th className="text-lg">Moves</th>
                          <th className="text-lg">Time</th>
                          <th className="text-lg">Difficulty</th>
                          <th className="text-lg">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, idx) => (
                          <motion.tr 
                            key={entry.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="text-white text-center border-white/20 hover:bg-white/10"
                          >
                            <td className="font-bold text-xl">
                              {idx === 0 && '🥇'}
                              {idx === 1 && '🥈'}
                              {idx === 2 && '🥉'}
                              {idx > 2 && `${idx + 1}`}
                            </td>
                            <td className="font-semibold">{entry.name}</td>
                            <td>{entry.moves}</td>
                            <td>{formatTime(entry.time)}</td>
                            <td>
                              <span className={`badge ${entry.difficulty === 'easy' ? 'badge-success' : entry.difficulty === 'medium' ? 'badge-warning' : 'badge-error'}`}>
                                {entry.difficulty}
                              </span>
                            </td>
                            <td className="text-sm">{entry.date}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {leaderboard.length > 0 && (
                  <div className="card-actions justify-end mt-4 p-2">
                    <button onClick={clearLeaderboard} className="btn btn-error btn-outline rounded-xl p-2 border text-white border-white hover:bg-red-600">
                      Clear Leaderboard 🗑️
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;