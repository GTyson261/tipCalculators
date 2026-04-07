import React, { useEffect, useMemo, useState } from "react";

const CELL_SIZE = 24;
const HIGH_SCORE_KEY = "pacmanHighScore";

const BASE_MAZE = [
  "###############",
  "#.............#",
  "#.###.###.###.#",
  "#o#.......#..o#",
  "#.###.#.#.###.#",
  "#.....#.#.....#",
  "###.#.###.#.###",
  "#...#..P..#...#",
  "###.#.###.#.###",
  "#.....#.#.....#",
  "#.###.#.#.###.#",
  "#o..#.....#..o#",
  "#.###.###.###.#",
  "#....GGGG....##",
  "###############",
];

const FRUIT_SPAWNS = [
  { x: 7, y: 7 },
  { x: 6, y: 5 },
  { x: 8, y: 9 },
];

function findChar(char) {
  for (let y = 0; y < BASE_MAZE.length; y++) {
    for (let x = 0; x < BASE_MAZE[y].length; x++) {
      if (BASE_MAZE[y][x] === char) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

function findAllChars(char) {
  const result = [];
  for (let y = 0; y < BASE_MAZE.length; y++) {
    for (let x = 0; x < BASE_MAZE[y].length; x++) {
      if (BASE_MAZE[y][x] === char) result.push({ x, y });
    }
  }
  return result;
}

function buildPellets() {
  return BASE_MAZE.map((row) =>
    row.split("").map((cell) => {
      if (cell === "." || cell === "o") return cell;
      return "";
    })
  );
}

function isWall(x, y) {
  return BASE_MAZE[y]?.[x] === "#";
}

function nextPos(pos, dir) {
  if (dir === "UP") return { x: pos.x, y: pos.y - 1 };
  if (dir === "DOWN") return { x: pos.x, y: pos.y + 1 };
  if (dir === "LEFT") return { x: pos.x - 1, y: pos.y };
  return { x: pos.x + 1, y: pos.y };
}

function getPacmanRotation(dir) {
  if (dir === "UP") return "270deg";
  if (dir === "DOWN") return "90deg";
  if (dir === "LEFT") return "180deg";
  return "0deg";
}

function getNeighbors(pos) {
  const dirs = ["UP", "DOWN", "LEFT", "RIGHT"];
  return dirs
    .map((dir) => ({ dir, pos: nextPos(pos, dir) }))
    .filter(({ pos }) => !isWall(pos.x, pos.y));
}

function bfsNextDirection(start, target) {
  const queue = [{ pos: start, firstDir: null }];
  const visited = new Set([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.pos.x === target.x && current.pos.y === target.y) {
      return current.firstDir || "LEFT";
    }

    for (const neighbor of getNeighbors(current.pos)) {
      const key = `${neighbor.pos.x},${neighbor.pos.y}`;
      if (visited.has(key)) continue;

      visited.add(key);
      queue.push({
        pos: neighbor.pos,
        firstDir: current.firstDir || neighbor.dir,
      });
    }
  }

  return "LEFT";
}

function pickRunAwayTarget(player) {
  const corners = [
    { x: 1, y: 1 },
    { x: 13, y: 1 },
    { x: 1, y: 13 },
    { x: 13, y: 13 },
  ];

  let best = corners[0];
  let bestDist = -1;

  for (const corner of corners) {
    const dist = Math.abs(corner.x - player.x) + Math.abs(corner.y - player.y);
    if (dist > bestDist) {
      bestDist = dist;
      best = corner;
    }
  }

  return best;
}

function PacmanGame({ onScoreChange, onGameOver }) {
  const startPlayer = useMemo(() => findChar("P"), []);
  const ghostHouse = useMemo(() => findAllChars("G"), []);

  const [player, setPlayer] = useState(startPlayer);
  const [direction, setDirection] = useState("RIGHT");
  const [pendingDirection, setPendingDirection] = useState("RIGHT");
  const [pellets, setPellets] = useState(buildPellets());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(
    Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0
  );
  const [lives, setLives] = useState(3);
  const [powered, setPowered] = useState(false);
  const [powerTimer, setPowerTimer] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [mouthOpen, setMouthOpen] = useState(true);
  const [fruit, setFruit] = useState(null);

  const [ghosts, setGhosts] = useState(
    ghostHouse.map((g, index) => ({
      id: index,
      x: g.x,
      y: g.y,
      color: ["#ff4d6d", "#60a5fa", "#f97316", "#ec4899"][index % 4],
      eyesOnly: false,
      respawnTimer: 0,
    }))
  );

  const speed = Math.max(180 - (level - 1) * 10, 85);

  useEffect(() => {
    onScoreChange?.(score);
  }, [score, onScoreChange]);

  useEffect(() => {
    if (gameOver) {
      onGameOver?.(score);
    }
  }, [gameOver, score, onGameOver]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    }
  }, [score, highScore]);

  useEffect(() => {
    function handleKeyDown(e) {
      const key = e.key.toLowerCase();

      if (key === "w") {
        setPendingDirection("UP");
        setStarted(true);
      } else if (key === "s") {
        setPendingDirection("DOWN");
        setStarted(true);
      } else if (key === "a") {
        setPendingDirection("LEFT");
        setStarted(true);
      } else if (key === "d") {
        setPendingDirection("RIGHT");
        setStarted(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      setMouthOpen((prev) => !prev);

      setPlayer((prevPlayer) => {
        let newDir = direction;

        const tryPending = nextPos(prevPlayer, pendingDirection);
        if (!isWall(tryPending.x, tryPending.y)) {
          newDir = pendingDirection;
          setDirection(pendingDirection);
        }

        const candidate = nextPos(prevPlayer, newDir);
        const nextPlayer = isWall(candidate.x, candidate.y) ? prevPlayer : candidate;

        setPellets((prevPellets) => {
          const updated = prevPellets.map((row) => [...row]);
          const cell = updated[nextPlayer.y][nextPlayer.x];

          if (cell === ".") {
            updated[nextPlayer.y][nextPlayer.x] = "";
            setScore((s) => s + 10);
          } else if (cell === "o") {
            updated[nextPlayer.y][nextPlayer.x] = "";
            setScore((s) => s + 50);
            setPowered(true);
            setPowerTimer(50);
          }

          const remaining = updated.flat().filter((c) => c === "." || c === "o").length;
          if (remaining > 0 && remaining % 25 === 0 && !fruit) {
            const spawn = FRUIT_SPAWNS[(level + remaining) % FRUIT_SPAWNS.length];
            setFruit({
              x: spawn.x,
              y: spawn.y,
              value: 100 + level * 25,
            });
          }

          if (remaining === 0) {
            nextLevel();
            return buildPellets();
          }

          return updated;
        });

        setFruit((prevFruit) => {
          if (prevFruit && prevFruit.x === nextPlayer.x && prevFruit.y === nextPlayer.y) {
            setScore((s) => s + prevFruit.value);
            return null;
          }
          return prevFruit;
        });

        return nextPlayer;
      });

      setGhosts((prevGhosts) =>
        prevGhosts.map((ghost, index) => {
          if (ghost.respawnTimer > 0) {
            const nextTimer = ghost.respawnTimer - 1;
            if (nextTimer <= 0) {
              return {
                ...ghost,
                x: ghostHouse[index].x,
                y: ghostHouse[index].y,
                eyesOnly: false,
                respawnTimer: 0,
              };
            }
            return { ...ghost, respawnTimer: nextTimer };
          }

          let target;
          if (ghost.eyesOnly) {
            target = ghostHouse[index];
          } else if (powered) {
            target = pickRunAwayTarget(player);
          } else {
            target = player;
          }

          const dir = bfsNextDirection({ x: ghost.x, y: ghost.y }, target);
          const moved = nextPos({ x: ghost.x, y: ghost.y }, dir);

          if (isWall(moved.x, moved.y)) return ghost;

          return {
            ...ghost,
            x: moved.x,
            y: moved.y,
          };
        })
      );

      setPowerTimer((prev) => {
        if (prev <= 1) {
          setPowered(false);
          return 0;
        }
        return prev - 1;
      });

      setFruit((prevFruit) => {
        if (!prevFruit) return prevFruit;
        return {
          ...prevFruit,
          ttl: (prevFruit.ttl || 60) - 1,
        }.ttl <= 0
          ? null
          : {
              ...prevFruit,
              ttl: (prevFruit.ttl || 60) - 1,
            };
      });
    }, speed);

    return () => clearInterval(interval);
  }, [started, gameOver, direction, pendingDirection, powered, player, level, fruit, speed]);

  useEffect(() => {
    if (gameOver) return;

    ghosts.forEach((ghost) => {
      if (ghost.respawnTimer > 0) return;

      const collided = player.x === ghost.x && player.y === ghost.y;
      if (!collided) return;

      if (powered && !ghost.eyesOnly) {
        setScore((s) => s + 200);
        setGhosts((prev) =>
          prev.map((g) =>
            g.id === ghost.id
              ? {
                  ...g,
                  eyesOnly: true,
                  respawnTimer: 18,
                }
              : g
          )
        );
      } else if (!powered && !ghost.eyesOnly) {
        setLives((prevLives) => {
          const nextLives = prevLives - 1;
          if (nextLives <= 0) {
            setGameOver(true);
            return 0;
          }

          resetPositions();
          return nextLives;
        });
      }
    });
  }, [player, ghosts, powered, gameOver]);

  function resetPositions() {
    setPlayer(startPlayer);
    setDirection("RIGHT");
    setPendingDirection("RIGHT");
    setGhosts(
      ghostHouse.map((g, index) => ({
        id: index,
        x: g.x,
        y: g.y,
        color: ["#ff4d6d", "#60a5fa", "#f97316", "#ec4899"][index % 4],
        eyesOnly: false,
        respawnTimer: 0,
      }))
    );
  }

  function nextLevel() {
    setLevel((prev) => prev + 1);
    setStarted(false);
    setPowered(false);
    setPowerTimer(0);
    setFruit(null);
    resetPositions();
  }

  function restartGame() {
    setPellets(buildPellets());
    setScore(0);
    setLives(3);
    setPowered(false);
    setPowerTimer(0);
    setGameOver(false);
    setStarted(false);
    setLevel(1);
    setMouthOpen(true);
    setFruit(null);
    resetPositions();
  }

  function getPacmanStyle() {
    return {
      ...styles.pacman,
      clipPath: mouthOpen
        ? "polygon(100% 50%, 42% 12%, 0% 0%, 0% 100%, 42% 88%)"
        : "circle(50% at 50% 50%)",
      transform: `rotate(${getPacmanRotation(direction)})`,
    };
  }

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Pac-Man Deluxe 🟡</h2>

      <div style={styles.hud}>
        <span>Score: {score}</span>
        <span>High: {highScore}</span>
        <span>Lives: {lives}</span>
        <span>Level: {level}</span>
        <span>{powered ? `Power ${powerTimer}` : "Normal Mode"}</span>
      </div>

      {!started && !gameOver && (
        <p style={styles.text}>Press W A S D to start level {level}</p>
      )}

      {gameOver && <p style={styles.gameOver}>Game Over</p>}

      <div
        style={{
          ...styles.board,
          gridTemplateColumns: `repeat(${BASE_MAZE[0].length}, ${CELL_SIZE}px)`,
        }}
      >
        {BASE_MAZE.map((row, y) =>
          row.split("").map((cell, x) => {
            const isPlayer = player.x === x && player.y === y;
            const pellet = pellets[y][x];
            const ghost = ghosts.find(
              (g) => g.x === x && g.y === y && g.respawnTimer <= 0
            );
            const isFruit = fruit && fruit.x === x && fruit.y === y;

            return (
              <div
                key={`${x}-${y}`}
                style={{
                  ...styles.cell,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  background:
                    cell === "#"
                      ? "linear-gradient(135deg, #1826a3, #0f172a)"
                      : "rgba(0,0,0,0.82)",
                }}
              >
                {pellet === "." && <div style={styles.dot} />}
                {pellet === "o" && <div style={styles.powerDot} />}
                {isFruit && <div style={styles.fruit} />}

                {ghost && (
                  <div
                    style={{
                      ...styles.ghost,
                      background: ghost.eyesOnly
                        ? "#ffffff"
                        : powered
                        ? "#60a5fa"
                        : ghost.color,
                    }}
                  >
                    <div style={styles.ghostEyes}>
                      <span style={styles.eye} />
                      <span style={styles.eye} />
                    </div>
                  </div>
                )}

                {isPlayer && <div style={getPacmanStyle()} />}
              </div>
            );
          })
        )}
      </div>

      <button onClick={restartGame} style={styles.button}>
        Restart
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    textAlign: "center",
    marginTop: "30px",
    color: "white",
  },
  title: {
    fontSize: "32px",
    marginBottom: "10px",
    textShadow: "0 0 16px rgba(255,255,0,0.5)",
  },
  hud: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "12px",
    fontSize: "15px",
  },
  text: {
    margin: "8px 0",
    fontSize: "15px",
  },
  gameOver: {
    color: "#ff5d73",
    fontSize: "20px",
    fontWeight: "bold",
  },
  board: {
    display: "grid",
    justifyContent: "center",
    margin: "20px auto",
    border: "2px solid rgba(255,255,255,0.18)",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 0 24px rgba(255,255,0,0.12)",
    width: "fit-content",
  },
  cell: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.03)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#fff3a3",
    boxShadow: "0 0 10px rgba(255,255,180,0.7)",
  },
  powerDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#fff176",
    boxShadow: "0 0 14px rgba(255,255,120,0.95)",
  },
  fruit: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "radial-gradient(circle, #ff4d6d, #f97316)",
    boxShadow: "0 0 14px rgba(255,77,109,0.8)",
  },
  pacman: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#ffd600",
    position: "absolute",
    boxShadow: "0 0 14px rgba(255,214,0,0.65)",
    transition: "transform 0.08s linear",
  },
  ghost: {
    width: 18,
    height: 18,
    borderRadius: "9px 9px 4px 4px",
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 14px rgba(255,255,255,0.18)",
  },
  ghostEyes: {
    display: "flex",
    gap: 3,
    marginTop: -2,
  },
  eye: {
    width: 4,
    height: 6,
    borderRadius: "50%",
    background: "black",
  },
  button: {
    padding: "10px 18px",
    fontSize: "16px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #facc15, #f97316)",
    color: "black",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default PacmanGame;