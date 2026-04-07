import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WormGame from "./components/WormGame.jsx";
import GalaxyGame from "./components/GalaxyGame.jsx";
import PacmanGame from "./components/PacmanGame.jsx";
import YouTubeQueuePlayer from "./components/YouTubeQueuePlayer.jsx";
import TipCalculator from "./components/TipCalculator.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import heroImg from "./assets/hero.png";
import "./App.css";

const LEADERBOARD_KEY = "arcadeLeaderboards";
const HISTORY_KEY = "arcadeMatchHistory";
const PLAYER_NAME_KEY = "arcadePlayerName";

const DEFAULT_LEADERBOARDS = {
  worm: [],
  galaxy: [],
  pacman: [],
};

function readLeaderboards() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return DEFAULT_LEADERBOARDS;

    const parsed = JSON.parse(raw);
    return {
      worm: Array.isArray(parsed.worm) ? parsed.worm : [],
      galaxy: Array.isArray(parsed.galaxy) ? parsed.galaxy : [],
      pacman: Array.isArray(parsed.pacman) ? parsed.pacman : [],
    };
  } catch {
    return DEFAULT_LEADERBOARDS;
  }
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPlayerName() {
  try {
    const raw = localStorage.getItem(PLAYER_NAME_KEY);
    return raw?.trim() || "Player 1";
  } catch {
    return "Player 1";
  }
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function App() {
  const [gameIndex, setGameIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [liveScores, setLiveScores] = useState({
    worm: 0,
    galaxy: 0,
    pacman: 0,
  });
  const [leaderboards, setLeaderboards] = useState(readLeaderboards);
  const [history, setHistory] = useState(readHistory);
  const [scorePulse, setScorePulse] = useState(false);

  const audioCtxRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  const previousScoresRef = useRef({
    worm: 0,
    galaxy: 0,
    pacman: 0,
  });

  const games = useMemo(
    () => [
      { name: "worm", label: "Worm" },
      { name: "galaxy", label: "Galaxy" },
      { name: "pacman", label: "Pacman" },
    ],
    []
  );

  const currentGame = games[gameIndex];

  useEffect(() => {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboards));
  }, [leaderboards]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(PLAYER_NAME_KEY, playerName.trim() || "Player 1");
  }, [playerName]);

  useEffect(() => {
    const currentScore = liveScores[currentGame.name] || 0;
    const previousScore = previousScoresRef.current[currentGame.name] || 0;

    if (currentScore > previousScore) {
      setScorePulse(true);

      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }

      pulseTimeoutRef.current = setTimeout(() => {
        setScorePulse(false);
      }, 260);
    }

    previousScoresRef.current = liveScores;
  }, [liveScores, currentGame.name]);

  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName;
      const isTypingField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable;

      if (isTypingField || e.repeat) return;

      if (e.key === "1") {
        switchGame(0);
      } else if (e.key === "2") {
        switchGame(1);
      } else if (e.key === "3") {
        switchGame(2);
      } else if (e.key === "ArrowRight") {
        switchGame((gameIndex + 1) % games.length);
      } else if (e.key === "ArrowLeft") {
        switchGame((gameIndex - 1 + games.length) % games.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameIndex, games]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  function getAudioContext() {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    return audioCtxRef.current;
  }

  function playSwitchSound(nextIndex) {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const freqs = [420, 620, 820];
    const base = freqs[nextIndex] || 520;

    [0, 0.06].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(base + i * 120, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  }

  const saveScore = useCallback(
    (gameName, score) => {
      if (!Number.isFinite(score) || score <= 0) return;

      const safeName = playerName.trim() || "Player 1";
      const entry = {
        name: safeName,
        score,
        game: gameName,
        at: Date.now(),
      };

      setLeaderboards((prev) => {
        const nextEntries = [...prev[gameName], entry]
          .sort((a, b) => b.score - a.score || b.at - a.at)
          .slice(0, 5);

        return {
          ...prev,
          [gameName]: nextEntries,
        };
      });

      setHistory((prev) => [entry, ...prev].slice(0, 20));
    },
    [playerName]
  );

  function clearHistory() {
    setHistory([]);
  }

  function clearLeaderboards() {
    setLeaderboards(DEFAULT_LEADERBOARDS);
  }

  function switchGame(nextIndex) {
    if (nextIndex === gameIndex) return;

    playSwitchSound(nextIndex);
    setIsTransitioning(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setGameIndex(nextIndex);
      setTimeout(() => setIsTransitioning(false), 220);
    }, 220);
  }

  const handleWormScoreChange = useCallback((score) => {
    setLiveScores((prev) => ({ ...prev, worm: score }));
  }, []);

  const handleGalaxyScoreChange = useCallback((score) => {
    setLiveScores((prev) => ({ ...prev, galaxy: score }));
  }, []);

  const handlePacmanScoreChange = useCallback((score) => {
    setLiveScores((prev) => ({ ...prev, pacman: score }));
  }, []);

  const handleWormGameOver = useCallback(
    (score) => {
      saveScore("worm", score);
    },
    [saveScore]
  );

  const handleGalaxyGameOver = useCallback(
    (score) => {
      saveScore("galaxy", score);
    },
    [saveScore]
  );

  const handlePacmanGameOver = useCallback(
    (score) => {
      saveScore("pacman", score);
    },
    [saveScore]
  );

  const renderedGame = (() => {
    if (currentGame.name === "worm") {
      return (
        <WormGame
          onScoreChange={handleWormScoreChange}
          onGameOver={handleWormGameOver}
        />
      );
    }

    if (currentGame.name === "galaxy") {
      return (
        <GalaxyGame
          onScoreChange={handleGalaxyScoreChange}
          onGameOver={handleGalaxyGameOver}
        />
      );
    }

    return (
      <PacmanGame
        onScoreChange={handlePacmanScoreChange}
        onGameOver={handlePacmanGameOver}
      />
    );
  })();

  return (
    <div className={`app-shell ${currentGame.name}-theme`}>
      <div className={`screen-transition ${isTransitioning ? "active" : ""}`} />

      <div className="hero-badge-wrap cinematic-hero-wrap">
        <div className={`hero-spotlight ${currentGame.name}-spotlight`} />
        <div className={`hero-ring ${currentGame.name}-ring`} />
        <div className={`hero-ring hero-ring-inner ${currentGame.name}-ring`} />

        <div className={`hero-particles ${currentGame.name}-particles`}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <img
          src={heroImg}
          alt="Arcade hero"
          className={`hero-badge cinematic-hero ${currentGame.name}-hero`}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const rotateY = ((x / rect.width) - 0.5) * 18;
            const rotateX = ((y / rect.height) - 0.5) * -18;

            e.currentTarget.style.transform = `translateY(-10px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "";
          }}
        />
      </div>

      <div className="player-bar">
        <div className="player-card">
          <label className="player-label">
            Player Name
            <input
              className="player-input"
              type="text"
              maxLength="20"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter player name"
            />
          </label>

          <div className="player-active-badge">
            Active: <span>{playerName.trim() || "Player 1"}</span>
          </div>
        </div>
      </div>

      <ErrorBoundary>
        <TipCalculator currentGame={currentGame.name} />
      </ErrorBoundary>

      <div className="arcade-shortcuts">
        <span>Shortcuts:</span>
        <span>1 = Worm</span>
        <span>2 = Galaxy</span>
        <span>3 = Pacman</span>
        <span>← / → = Switch</span>
      </div>

      <div className="arcade-layout">
        <div className={`game-panel animated-panel ${isTransitioning ? "switching" : ""}`}>
          <div className="game-topbar">
            <div className="game-now-playing">
              <strong>{currentGame.label}</strong>
              <span className={`live-score ${scorePulse ? "score-pulse" : ""}`}>
                Live Score: {liveScores[currentGame.name] || 0}
              </span>
            </div>

            <div className="game-switcher">
              {games.map((game, index) => (
                <button
                  key={game.name}
                  className={`game-tab ${index === gameIndex ? "active" : ""}`}
                  onClick={() => switchGame(index)}
                >
                  {index + 1}. {game.label}
                </button>
              ))}
            </div>
          </div>

          <ErrorBoundary>{renderedGame}</ErrorBoundary>

          <button
            className="next-game-btn"
            onClick={() => switchGame((gameIndex + 1) % games.length)}
          >
            Next Game 🎮
          </button>
        </div>

        <div className="side-stack">
          <div className="leaderboard-card">
            <div className="card-topbar">
              <h3>🏆 Leaderboards</h3>
              <button className="mini-action-btn" onClick={clearLeaderboards}>
                Clear
              </button>
            </div>

            {games.map((game) => (
              <div key={game.name} className="leaderboard-group">
                <div className="leaderboard-title">{game.label}</div>

                {leaderboards[game.name].length === 0 ? (
                  <p className="leaderboard-empty">No scores yet</p>
                ) : (
                  <ol className="leaderboard-list">
                    {leaderboards[game.name].map((entry, index) => (
                      <li
                        key={`${game.name}-${index}-${entry.at}`}
                        className="leaderboard-row animated-row"
                      >
                        <span>
                          #{index + 1} — {entry.name} — {entry.score}
                        </span>
                        <small>{formatTime(entry.at)}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>

          <div className="leaderboard-card">
            <div className="card-topbar">
              <h3>🕹 Recent Match History</h3>
              <button className="mini-action-btn" onClick={clearHistory}>
                Clear
              </button>
            </div>

            {history.length === 0 ? (
              <p className="leaderboard-empty">No matches saved yet</p>
            ) : (
              <div className="history-list">
                {history.map((entry, index) => (
                  <div
                    key={`history-${entry.game}-${entry.at}-${index}`}
                    className="history-row animated-row"
                  >
                    <div className="history-main">
                      <strong>{entry.name}</strong>
                      <span>{entry.game}</span>
                    </div>
                    <div className="history-side">
                      <strong>{entry.score}</strong>
                      <small>{formatTime(entry.at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ErrorBoundary>
            <YouTubeQueuePlayer />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;