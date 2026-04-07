import React, { useEffect, useRef, useState } from "react";

const WIDTH = 700;
const HEIGHT = 420;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function GalaxyGame({ onScoreChange, onGameOver }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const keysRef = useRef({});
  const gameRef = useRef(null);

  const [ui, setUi] = useState({
    score: 0,
    highScore: Number(localStorage.getItem("galaxyHighScore")) || 0,
    lives: 3,
    level: 1,
    status: "start",
  });

  useEffect(() => {
    onScoreChange?.(ui.score);

    if (ui.status === "gameover") {
      onGameOver?.(ui.score);
    }
  }, [ui.score, ui.status]);

  useEffect(() => {
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      size: randomBetween(1, 3),
      speed: randomBetween(0.3, 1.5),
    }));

    const player = {
      x: WIDTH / 2 - 18,
      y: HEIGHT - 55,
      w: 36,
      h: 24,
      speed: 5,
      cooldown: 0,
    };

    const state = {
      stars,
      player,
      bullets: [],
      enemyBullets: [],
      enemies: [],
      explosions: [],
      score: 0,
      highScore: Number(localStorage.getItem("galaxyHighScore")) || 0,
      lives: 3,
      level: 1,
      frame: 0,
      paused: false,
      running: false,
      gameOver: false,
      winFlash: 0,
    };

    gameRef.current = state;

    function makeWave(level) {
      const enemies = [];
      const rows = Math.min(2 + level, 5);
      const cols = Math.min(5 + level, 10);
      const startX = 70;
      const startY = 40;
      const gapX = 55;
      const gapY = 42;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          enemies.push({
            x: startX + c * gapX,
            y: startY + r * gapY,
            w: 28,
            h: 20,
            alive: true,
            dir: 1,
            speed: 0.45 + level * 0.08,
            shootChance: 0.001 + level * 0.0005,
          });
        }
      }
      state.enemies = enemies;
    }

    function resetGame() {
      state.player.x = WIDTH / 2 - 18;
      state.player.y = HEIGHT - 55;
      state.player.cooldown = 0;
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.score = 0;
      state.lives = 3;
      state.level = 1;
      state.frame = 0;
      state.paused = false;
      state.running = false;
      state.gameOver = false;
      state.winFlash = 0;
      makeWave(1);
      syncUi();
    }

    function startGame() {
      if (state.gameOver) resetGame();
      state.running = true;
      state.paused = false;
      syncUi("playing");
    }

    function togglePause() {
      if (!state.running || state.gameOver) return;
      state.paused = !state.paused;
      syncUi(state.paused ? "paused" : "playing");
    }

    function syncUi(forcedStatus) {
      const nextHigh = Math.max(state.highScore, state.score);
      state.highScore = nextHigh;
      localStorage.setItem("galaxyHighScore", String(nextHigh));

      setUi({
        score: state.score,
        highScore: nextHigh,
        lives: state.lives,
        level: state.level,
        status:
          forcedStatus ||
          (state.gameOver
            ? "gameover"
            : !state.running
            ? "start"
            : state.paused
            ? "paused"
            : "playing"),
      });
    }

    function createExplosion(x, y, color = "#ffb300", count = 14) {
      for (let i = 0; i < count; i++) {
        state.explosions.push({
          x,
          y,
          dx: randomBetween(-2.5, 2.5),
          dy: randomBetween(-2.5, 2.5),
          life: randomBetween(18, 34),
          size: randomBetween(2, 5),
          color,
        });
      }
    }

    function rectsCollide(a, b) {
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
    }

    function shootPlayerBullet() {
      if (state.player.cooldown > 0) return;
      state.bullets.push({
        x: state.player.x + state.player.w / 2 - 2,
        y: state.player.y - 10,
        w: 4,
        h: 12,
        speed: 8,
      });
      state.player.cooldown = 12;
    }

    function shootEnemyBullet(enemy) {
      state.enemyBullets.push({
        x: enemy.x + enemy.w / 2 - 2,
        y: enemy.y + enemy.h,
        w: 4,
        h: 10,
        speed: 4 + state.level * 0.25,
      });
    }

    function update() {
      state.frame++;

      state.stars.forEach((star) => {
        star.y += star.speed;
        if (star.y > HEIGHT) {
          star.y = -5;
          star.x = Math.random() * WIDTH;
        }
      });

      if (!state.running || state.paused || state.gameOver) return;

      const { player } = state;

      if (keysRef.current.ArrowLeft || keysRef.current.a) {
        player.x -= player.speed;
      }
      if (keysRef.current.ArrowRight || keysRef.current.d) {
        player.x += player.speed;
      }
      if (keysRef.current[" "] || keysRef.current.Space || keysRef.current.Spacebar) {
        shootPlayerBullet();
      }

      if (player.x < 0) player.x = 0;
      if (player.x + player.w > WIDTH) player.x = WIDTH - player.w;

      if (player.cooldown > 0) player.cooldown--;

      state.bullets.forEach((b) => {
        b.y -= b.speed;
      });
      state.bullets = state.bullets.filter((b) => b.y + b.h > 0);

      state.enemyBullets.forEach((b) => {
        b.y += b.speed;
      });
      state.enemyBullets = state.enemyBullets.filter((b) => b.y < HEIGHT + 20);

      let shiftDown = false;

      state.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.x += enemy.dir * enemy.speed;

        if (enemy.x <= 10 || enemy.x + enemy.w >= WIDTH - 10) {
          shiftDown = true;
        }

        if (Math.random() < enemy.shootChance) {
          shootEnemyBullet(enemy);
        }
      });

      if (shiftDown) {
        state.enemies.forEach((enemy) => {
          enemy.dir *= -1;
          enemy.y += 14;
        });
      }

      state.bullets.forEach((bullet) => {
        state.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          if (rectsCollide(bullet, enemy)) {
            enemy.alive = false;
            bullet.y = -100;
            state.score += 10;
            createExplosion(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffcc00", 12);
          }
        });
      });

      state.enemyBullets.forEach((bullet) => {
        if (rectsCollide(bullet, player)) {
          bullet.y = HEIGHT + 100;
          state.lives -= 1;
          createExplosion(player.x + player.w / 2, player.y + player.h / 2, "#00e5ff", 18);
          player.x = WIDTH / 2 - 18;

          if (state.lives <= 0) {
            state.gameOver = true;
            state.running = false;
            syncUi("gameover");
          }
        }
      });

      state.enemies.forEach((enemy) => {
        if (!enemy.alive) return;

        if (enemy.y + enemy.h >= player.y) {
          state.gameOver = true;
          state.running = false;
          createExplosion(player.x + player.w / 2, player.y + player.h / 2, "#ff4d6d", 24);
          syncUi("gameover");
        }
      });

      state.explosions.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        p.life -= 1;
      });
      state.explosions = state.explosions.filter((p) => p.life > 0);

      const aliveEnemies = state.enemies.filter((e) => e.alive);
      if (aliveEnemies.length === 0) {
        state.level += 1;
        state.winFlash = 18;
        createExplosion(WIDTH / 2, HEIGHT / 2, "#8cff66", 40);
        makeWave(state.level);
      }

      if (state.winFlash > 0) {
        state.winFlash -= 1;
      }

      if (state.frame % 10 === 0) {
        syncUi();
      }
    }

    function drawShip(ctx, x, y, w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = "#00e5ff";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h - 4);
      ctx.lineTo(x + w / 2 - 6, y + h + 8);
      ctx.lineTo(x + w / 2 + 6, y + h + 8);
      ctx.closePath();
      ctx.fillStyle = "#ff7b00";
      ctx.fill();
      ctx.restore();
    }

    function drawEnemy(ctx, enemy) {
      ctx.save();
      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(enemy.x + 5, enemy.y + 5, 4, 4);
      ctx.fillRect(enemy.x + enemy.w - 9, enemy.y + 5, 4, 4);

      ctx.fillStyle = "#5dff85";
      ctx.fillRect(enemy.x + 4, enemy.y + enemy.h - 4, enemy.w - 8, 3);
      ctx.restore();
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, "#050816");
      gradient.addColorStop(1, "#12002e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      state.stars.forEach((star) => {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (state.winFlash > 0) {
        ctx.fillStyle = `rgba(140,255,102,${state.winFlash / 30})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      drawShip(ctx, state.player.x, state.player.y, state.player.w, state.player.h);

      ctx.fillStyle = "#ffe600";
      state.bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      ctx.fillStyle = "#ff9f1c";
      state.enemyBullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      state.enemies.forEach((enemy) => {
        if (enemy.alive) drawEnemy(ctx, enemy);
      });

      state.explosions.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.fillText(`Score: ${state.score}`, 16, 24);
      ctx.fillText(`Lives: ${state.lives}`, 16, 46);
      ctx.fillText(`Level: ${state.level}`, 16, 68);
      ctx.fillText(`High: ${state.highScore}`, WIDTH - 110, 24);

      if (!state.running && !state.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GALAXY ATTACK", WIDTH / 2, HEIGHT / 2 - 30);
        ctx.font = "18px Arial";
        ctx.fillText("Press Start or Space", WIDTH / 2, HEIGHT / 2 + 10);
        ctx.fillText("Move: ← → or A D", WIDTH / 2, HEIGHT / 2 + 40);
        ctx.textAlign = "left";
      }

      if (state.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);
        ctx.textAlign = "left";
      }

      if (state.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ff4d6d";
        ctx.font = "bold 40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 10);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px Arial";
        ctx.fillText(`Final Score: ${state.score}`, WIDTH / 2, HEIGHT / 2 + 26);
        ctx.textAlign = "left";
      }
    }

    function loop() {
      update();
      draw();
      animationRef.current = requestAnimationFrame(loop);
    }

    function handleKeyDown(e) {
      const tag = e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      keysRef.current[e.key] = true;

      if (e.key === " " && !state.running && !state.gameOver) {
        startGame();
      }

      if (e.key.toLowerCase() === "p") {
        togglePause();
      }

      if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) {
        e.preventDefault();
      }
    }

    function handleKeyUp(e) {
      keysRef.current[e.key] = false;
    }

    resetGame();
    draw();
    animationRef.current = requestAnimationFrame(loop);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    gameRef.current.startGame = startGame;
    gameRef.current.resetGame = resetGame;
    gameRef.current.togglePause = togglePause;

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function handleStart() {
    if (gameRef.current?.startGame) {
      gameRef.current.startGame();
    }
  }

  function handlePause() {
    if (gameRef.current?.togglePause) {
      gameRef.current.togglePause();
    }
  }

  function handleRestart() {
    if (gameRef.current?.resetGame) {
      gameRef.current.resetGame();
    }
  }

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Galaxy Attack 🚀</h2>

      <div style={styles.hud}>
        <span>Score: {ui.score}</span>
        <span>High: {ui.highScore}</span>
        <span>Lives: {ui.lives}</span>
        <span>Level: {ui.level}</span>
        <span>Status: {ui.status}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={styles.canvas}
      />

      <div style={styles.controls}>
        <button style={styles.button} onClick={handleStart}>
          Start
        </button>
        <button style={styles.button} onClick={handlePause}>
          Pause
        </button>
        <button style={styles.button} onClick={handleRestart}>
          Restart
        </button>
      </div>

      <p style={styles.help}>
        Move with <strong>← →</strong> or <strong>A D</strong> • Shoot with <strong>Space</strong> • Pause with <strong>P</strong>
      </p>
    </div>
  );
}

const styles = {
  wrapper: {
    textAlign: "center",
    color: "white",
    marginTop: "30px",
  },
  title: {
    marginBottom: "10px",
    fontSize: "32px",
    textShadow: "0 0 14px rgba(0,229,255,0.8)",
  },
  hud: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "12px",
    fontSize: "15px",
  },
  canvas: {
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: "16px",
    boxShadow: "0 0 25px rgba(0,229,255,0.25)",
    maxWidth: "100%",
  },
  controls: {
    marginTop: "14px",
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontSize: "15px",
    background: "linear-gradient(135deg, #6a5cff, #00c2ff)",
    color: "white",
  },
  help: {
    marginTop: "12px",
    fontSize: "14px",
    opacity: 0.9,
  },
};

export default GalaxyGame;