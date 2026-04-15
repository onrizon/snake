"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadDictionary,
  isWord,
  isPrefix,
  wordScore,
  randomLetter,
} from "../lib/dictionary";

const COLS = 18;
const ROWS = 18;
const SPEED = 130; // starting ms/tick
const TILE_COUNT = 12;

function computeCell() {
  if (typeof window === "undefined") return 28;
  const maxW = Math.min(window.innerWidth - 32, window.innerHeight - 260);
  return Math.max(16, Math.min(28, Math.floor(maxW / COLS)));
}

function initialSnake() {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
}

function randomCell(blocked) {
  while (true) {
    const c = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
    if (!blocked.some((b) => b.x === c.x && b.y === c.y)) return c;
  }
}

function spawnTile(snake, letters) {
  const blocked = [...snake, ...letters];
  const cell = randomCell(blocked);
  return { ...cell, ch: randomLetter() };
}

function initialLetters(snake) {
  const letters = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    letters.push(spawnTile(snake, letters));
  }
  return letters;
}

export default function SnakeGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const dictRef = useRef(null);
  const cellRef = useRef(28);
  const speedRef = useRef(SPEED);

  const [dictReady, setDictReady] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [buffer, setBuffer] = useState("");
  const [foundWords, setFoundWords] = useState([]);
  const [flash, setFlash] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(SPEED);
  const [canvasSize, setCanvasSize] = useState({ w: 504, h: 504 });

  function updateSpeed(currentScore) {
    const newSpeed = Math.max(60, SPEED - Math.floor(currentScore / 100) * 3);
    if (newSpeed !== speedRef.current) {
      speedRef.current = newSpeed;
      setSpeed(newSpeed);
    }
  }

  function reset() {
    const snake = initialSnake();
    speedRef.current = SPEED;
    stateRef.current = {
      snake,
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      letters: initialLetters(snake),
      buffer: "",
      foundInRun: new Set(),
      score: 0,
      floatingLabels: [],
    };
    setScore(0);
    setMistakes(0);
    setBuffer("");
    setFoundWords([]);
    setFlash(null);
    setGameOver(false);
    setPaused(false);
    setSpeed(SPEED);
  }

  function triggerFlash(kind) {
    setFlash(kind);
    setTimeout(() => setFlash(null), 250);
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const st = stateRef.current;
    const CELL = cellRef.current;
    const W = CELL * COLS;
    const H = CELL * ROWS;

    if (!st) {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const { snake, letters, buffer: buf, floatingLabels } = st;

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#111a2e";
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    const dict = dictRef.current;
    ctx.font = `bold ${CELL - 8}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const l of letters) {
      let bg = "#1e293b";
      let fg = "#e2e8f0";
      if (dict && buf) {
        const candidate = buf + l.ch;
        if (isPrefix(dict, candidate)) {
          bg = "#164e63";
          fg = "#e0f2fe";
          if (isWord(dict, candidate) && candidate.length >= 2) {
            bg = "#14532d";
            fg = "#dcfce7";
          }
        }
      }
      ctx.fillStyle = bg;
      ctx.fillRect(l.x * CELL + 2, l.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = fg;
      ctx.fillText(l.ch, l.x * CELL + CELL / 2, l.y * CELL + CELL / 2 + 1);
    }

    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      ctx.fillStyle = i === 0 ? "#22c55e" : "#16a34a";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }

    // Floating score labels
    const now = Date.now();
    st.floatingLabels = floatingLabels.filter((l) => now - l.born < 900);
    ctx.font = `bold 13px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const lbl of st.floatingLabels) {
      const age = (now - lbl.born) / 900;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = "#86efac";
      ctx.fillText(lbl.text, lbl.x, lbl.y - age * 35);
    }
    ctx.globalAlpha = 1;
  }

  function commitBuffer() {
    const st = stateRef.current;
    if (!st || !st.buffer) return;
    const dict = dictRef.current;
    if (dict && isWord(dict, st.buffer) && st.buffer.length >= 2 && !st.foundInRun.has(st.buffer)) {
      const pts = wordScore(st.buffer);
      st.foundInRun.add(st.buffer);
      st.score += pts;
      setScore(st.score);
      updateSpeed(st.score);
      setFoundWords((fw) => [{ word: st.buffer, pts }, ...fw].slice(0, 8));
      triggerFlash("good");
    }
    st.buffer = "";
    st.foundInRun = new Set();
    setBuffer("");
  }

  function tick() {
    const st = stateRef.current;
    if (!st) return;

    const nd = st.nextDirection;
    if (nd.x !== -st.direction.x || nd.y !== -st.direction.y) {
      st.direction = nd;
    }

    const head = st.snake[0];
    const next = { x: head.x + st.direction.x, y: head.y + st.direction.y };

    if (
      next.x < 0 ||
      next.y < 0 ||
      next.x >= COLS ||
      next.y >= ROWS ||
      st.snake.some((s) => s.x === next.x && s.y === next.y)
    ) {
      const best = parseInt(localStorage.getItem("snake_best") || "0");
      if (st.score > best) {
        localStorage.setItem("snake_best", st.score);
        setHighScore(st.score);
      }
      setGameOver(true);
      return;
    }

    st.snake.unshift(next);

    const hitIdx = st.letters.findIndex((l) => l.x === next.x && l.y === next.y);
    if (hitIdx >= 0) {
      const eaten = st.letters[hitIdx];
      st.letters.splice(hitIdx, 1);
      st.letters.push(spawnTile(st.snake, st.letters));

      st.buffer = st.buffer + eaten.ch;
      const dict = dictRef.current;
      const CELL = cellRef.current;

      if (dict && isWord(dict, st.buffer) && st.buffer.length >= 2 && !st.foundInRun.has(st.buffer)) {
        const pts = wordScore(st.buffer);
        st.foundInRun.add(st.buffer);
        st.score += pts;
        setScore(st.score);
        updateSpeed(st.score);
        setFoundWords((fw) => [{ word: st.buffer, pts }, ...fw].slice(0, 8));
        triggerFlash("good");
        st.floatingLabels.push({
          text: `+${pts} ${st.buffer}`,
          x: next.x * CELL + CELL / 2,
          y: next.y * CELL,
          born: Date.now(),
        });
      }

      if (dict && !isPrefix(dict, st.buffer)) {
        const penalty = 3 * st.buffer.length;
        st.score = Math.max(0, st.score - penalty);
        setScore(st.score);
        updateSpeed(st.score);
        setMistakes((m) => m + 1);
        triggerFlash("bad");
        st.buffer = "";
        st.foundInRun = new Set();
      }

      setBuffer(st.buffer);
    } else {
      st.snake.pop();
    }

    draw();
  }

  // Load dictionary + restore high score
  useEffect(() => {
    let cancelled = false;
    loadDictionary().then((d) => {
      if (cancelled) return;
      dictRef.current = d;
      setDictReady(true);
      const saved = parseInt(localStorage.getItem("snake_best") || "0");
      setHighScore(saved);
      reset();
      draw();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Responsive canvas: recalculate cell size on mount and resize
  useEffect(() => {
    function updateSize() {
      const cell = computeCell();
      cellRef.current = cell;
      setCanvasSize({ w: cell * COLS, h: cell * ROWS });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Redraw after canvas resizes
  useEffect(() => {
    draw();
  }, [canvasSize]);

  // Keyboard + touch controls
  useEffect(() => {
    const keyMap = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
      W: { x: 0, y: -1 },
      S: { x: 0, y: 1 },
      A: { x: -1, y: 0 },
      D: { x: 1, y: 0 },
    };

    function onKey(e) {
      if (e.key === "Enter") {
        if (gameOver) {
          reset();
        } else {
          commitBuffer();
          draw();
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!gameOver) setPaused((p) => !p);
        return;
      }
      if (keyMap[e.key] && stateRef.current) {
        stateRef.current.nextDirection = keyMap[e.key];
      }
    }

    let touchStart = null;
    function onTouchStart(e) {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }
    function onTouchEnd(e) {
      if (!touchStart || !stateRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap, ignore
      if (Math.abs(dx) > Math.abs(dy)) {
        stateRef.current.nextDirection = { x: dx > 0 ? 1 : -1, y: 0 };
      } else {
        stateRef.current.nextDirection = { x: 0, y: dy > 0 ? 1 : -1 };
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [gameOver]);

  // Game loop — restarts when speed changes
  useEffect(() => {
    if (!dictReady || gameOver || paused) return;
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [dictReady, gameOver, paused, speed]);

  const border =
    flash === "good"
      ? "2px solid #22c55e"
      : flash === "bad"
      ? "2px solid #ef4444"
      : "2px solid #334155";

  return (
    <div style={{ textAlign: "center", width: "100%", maxWidth: 640 }}>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>Word Snake</h1>
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          justifyContent: "center",
          marginBottom: "0.5rem",
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.9rem",
          color: "#cbd5e1",
        }}
      >
        <span>Score: {score}</span>
        {highScore > 0 && <span style={{ color: "#fbbf24" }}>Best: {highScore}</span>}
        <span>Misses: {mistakes}</span>
        <span>Words: {foundWords.length}</span>
      </div>
      <div
        style={{
          minHeight: "2.2rem",
          marginBottom: "0.5rem",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: "1.4rem",
          letterSpacing: "0.2em",
          color: "#fde047",
        }}
      >
        {buffer || <span style={{ color: "#475569" }}>buffer empty</span>}
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{
            display: "block",
            border,
            borderRadius: 6,
            background: "#0b1220",
            transition: "border-color 120ms",
            touchAction: "none",
          }}
        />
        {!dictReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.85)",
              fontSize: "1rem",
            }}
          >
            Loading dictionary…
          </div>
        )}
        {dictReady && (gameOver || paused) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15, 23, 42, 0.8)",
              fontSize: "1.1rem",
              fontWeight: 600,
              textAlign: "center",
              padding: "1rem",
            }}
          >
            {gameOver
              ? `Game Over — score ${score}, ${foundWords.length} words. Press Enter to restart.`
              : "Paused — press Space to resume."}
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "0.85rem",
          color: "#cbd5e1",
          minHeight: "3rem",
        }}
      >
        {foundWords.length === 0 ? (
          <span style={{ color: "#64748b" }}>No words yet</span>
        ) : (
          foundWords.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0.15rem 0.3rem",
                padding: "0.2rem 0.5rem",
                background: "#14532d",
                color: "#dcfce7",
                borderRadius: 4,
                fontFamily: "ui-monospace, Menlo, monospace",
              }}
            >
              {w.word} <span style={{ color: "#86efac" }}>+{w.pts}</span>
            </span>
          ))
        )}
      </div>
      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#94a3b8", maxWidth: 560, marginInline: "auto" }}>
        Eat letters to build words. Tiles glow <span style={{ color: "#67e8f9" }}>cyan</span> if they extend a valid
        prefix and <span style={{ color: "#86efac" }}>green</span> if they complete a word. Dead-end prefix ={" "}
        <span style={{ color: "#fca5a5" }}>miss</span>.
      </p>
      <p style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#64748b" }}>
        Arrows / WASD · Enter commit · Space pause · Swipe on mobile
      </p>
    </div>
  );
}
