import React, { useEffect, useState } from "react";

const GRID_SIZE = 15;
const CELL_SIZE = 22;
const START_WORM = [
  { x: 7, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 7 },
];

function getRandomFood(worm) {
  let food;
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (worm.some((part) => part.x === food.x && part.y === food.y));
  return food;
}

function WormGame({ onScoreChange, onGameOver }) {
  const [worm, setWorm] = useState(START_WORM);
  const [food, setFood] = useState(getRandomFood(START_WORM));
  const [direction, setDirection] = useState("RIGHT");
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    onScoreChange?.(score);
  }, [score]);

  useEffect(() => {
    if (gameOver) {
      onGameOver?.(score);
    }
  }, [gameOver, score]);

  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "w" && direction !== "DOWN") {
        setDirection("UP");
        setStarted(true);
      } else if (key === "s" && direction !== "UP") {
        setDirection("DOWN");
        setStarted(true);
      } else if (key === "a" && direction !== "RIGHT") {
        setDirection("LEFT");
        setStarted(true);
      } else if (key === "d" && direction !== "LEFT") {
        setDirection("RIGHT");
        setStarted(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [direction]);

  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      setWorm((currentWorm) => {
        const head = { ...currentWorm[0] };

        if (direction === "UP") head.y -= 1;
        if (direction === "DOWN") head.y += 1;
        if (direction === "LEFT") head.x -= 1;
        if (direction === "RIGHT") head.x += 1;

        if (
          head.x < 0 ||
          head.y < 0 ||
          head.x >= GRID_SIZE ||
          head.y >= GRID_SIZE ||
          currentWorm.some((part) => part.x === head.x && part.y === head.y)
        ) {
          setGameOver(true);
          return currentWorm;
        }

        const newWorm = [head, ...currentWorm];

        if (head.x === food.x && head.y === food.y) {
          setFood(getRandomFood(newWorm));
          setScore((prev) => prev + 1);
        } else {
          newWorm.pop();
        }

        return newWorm;
      });
    }, 160);

    return () => clearInterval(interval);
  }, [direction, started, gameOver, food]);

  function restartGame() {
    setWorm(START_WORM);
    setFood(getRandomFood(START_WORM));
    setDirection("RIGHT");
    setGameOver(false);
    setStarted(false);
    setScore(0);
  }

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Neon Worm 🐍</h2>
      <p style={styles.text}>Use W A S D to move</p>
      <p style={styles.text}>Score: {score}</p>

      {!started && !gameOver && (
        <p style={styles.text}>Press W A S D to start</p>
      )}

      {gameOver && <p style={styles.gameOver}>Game Over</p>}

      <div
        style={{
          ...styles.board,
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const x = index % GRID_SIZE;
          const y = Math.floor(index / GRID_SIZE);

          const isWorm = worm.some((part) => part.x === x && part.y === y);
          const isHead = worm[0].x === x && worm[0].y === y;
          const isFood = food.x === x && food.y === y;

          let background = "rgba(255,255,255,0.05)";
          if (isFood) background = "radial-gradient(circle, #ff6b6b, #ff1744)";
          if (isWorm) {
            background = isHead
              ? "radial-gradient(circle, #7df9ff, #00e5ff)"
              : "radial-gradient(circle, #7dffb3, #00c853)";
          }

          return (
            <div
              key={index}
              style={{
                ...styles.cell,
                width: CELL_SIZE,
                height: CELL_SIZE,
                background,
              }}
            />
          );
        })}
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
    marginTop: "40px",
    color: "white",
  },
  title: {
    fontSize: "30px",
    textShadow: "0 0 12px rgba(0,229,255,0.7)",
  },
  text: {
    margin: "6px 0",
    fontSize: "16px",
  },
  gameOver: {
    color: "#ff5d73",
    fontWeight: "bold",
    fontSize: "18px",
  },
  board: {
    margin: "20px auto",
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 0 20px rgba(0,229,255,0.2)",
    background: "rgba(255,255,255,0.03)",
  },
  cell: {
    border: "1px solid rgba(255,255,255,0.03)",
    boxSizing: "border-box",
  },
  button: {
    padding: "10px 18px",
    fontSize: "16px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #6a5cff, #00c2ff)",
    color: "white",
    cursor: "pointer",
  },
};

export default WormGame;