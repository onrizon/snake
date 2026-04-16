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
const SPEED = 130;
const TILE_COUNT = 12;

function computeCell() {
  if (typeof window === "undefined") return 28;
  const availW = window.innerWidth - 16;
  const availH = window.innerHeight - 280;
  return Math.max(14, Math.floor(Math.min(availW, availH) / COLS));
}

// Rounded rect helper (with native fallback)
function rr(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
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
    const PAD = Math.max(2, Math.floor(CELL * 0.1));
    const TW = CELL - PAD * 2;
    const R = Math.max(3, Math.floor(TW * 0.25));

    // ── Background gradient ──────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f0520");
    bg.addColorStop(0.5, "#0a1535");
    bg.addColorStop(1, "#180830");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (!st) return;
    const { snake, letters, buffer: buf, floatingLabels } = st;

    // ── Grid ─────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke();
    }

    // ── Letter tiles ─────────────────────────────────────────────────
    const dict = dictRef.current;
    for (const l of letters) {
      const x = l.x * CELL + PAD;
      const y = l.y * CELL + PAD;
      let isP = false, isW = false;
      if (dict && buf) {
        const cand = buf + l.ch;
        if (isPrefix(dict, cand)) {
          isP = true;
          if (isWord(dict, cand) && cand.length >= 2) isW = true;
        }
      }

      ctx.save();

      // Drop shadow / glow
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = isW || isP ? 0 : 2;
      ctx.shadowBlur = isW ? 16 : isP ? 12 : 5;
      ctx.shadowColor = isW
        ? "rgba(74,222,128,0.65)"
        : isP
        ? "rgba(34,211,238,0.55)"
        : "rgba(0,0,0,0.55)";

      // Tile body
      const tg = ctx.createLinearGradient(x, y, x, y + TW);
      if (isW) {
        tg.addColorStop(0, "#0f5a28"); tg.addColorStop(1, "#062714");
      } else if (isP) {
        tg.addColorStop(0, "#0e4a5c"); tg.addColorStop(1, "#062530");
      } else {
        tg.addColorStop(0, "#2e1b6e"); tg.addColorStop(1, "#180d40");
      }
      ctx.fillStyle = tg;
      rr(ctx, x, y, TW, TW, R);
      ctx.fill();

      // Top highlight (plastic sheen)
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const hl = ctx.createLinearGradient(x, y, x, y + TW * 0.55);
      hl.addColorStop(0, isW
        ? "rgba(74,222,128,0.2)"
        : isP
        ? "rgba(34,211,238,0.2)"
        : "rgba(255,255,255,0.15)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hl;
      rr(ctx, x, y, TW, TW, R);
      ctx.fill();

      // Border
      ctx.strokeStyle = isW
        ? "rgba(74,222,128,0.45)"
        : isP
        ? "rgba(34,211,238,0.4)"
        : "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      rr(ctx, x, y, TW, TW, R);
      ctx.stroke();

      ctx.restore();

      // Letter glyph
      ctx.save();
      ctx.font = `800 ${Math.max(11, CELL - 9)}px system-ui,-apple-system,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isW || isP) {
        ctx.shadowColor = isW ? "#4ade80" : "#22d3ee";
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = isW ? "#86efac" : isP ? "#67e8f9" : "#ddd6fe";
      ctx.fillText(l.ch, l.x * CELL + CELL / 2, l.y * CELL + CELL / 2 + 1);
      ctx.restore();
    }

    // ── Snake ────────────────────────────────────────────────────────
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const x = s.x * CELL + PAD;
      const y = s.y * CELL + PAD;
      const isHead = i === 0;

      ctx.save();
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = isHead ? 0 : 1;
      ctx.shadowBlur = isHead ? 18 : 7;
      ctx.shadowColor = isHead ? "rgba(74,222,128,0.8)" : "rgba(34,197,94,0.35)";

      const sg = ctx.createLinearGradient(x, y, x + TW, y + TW);
      if (isHead) {
        sg.addColorStop(0, "#4ade80");
        sg.addColorStop(1, "#15803d");
      } else {
        const fade = Math.max(0.45, 1 - i / (snake.length * 1.5));
        sg.addColorStop(0, `rgba(34,197,94,${fade})`);
        sg.addColorStop(1, `rgba(21,128,61,${fade * 0.8})`);
      }
      ctx.fillStyle = sg;
      rr(ctx, x, y, TW, TW, R);
      ctx.fill();

      // Shine
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      const sh = ctx.createLinearGradient(x, y, x, y + TW * 0.55);
      sh.addColorStop(0, "rgba(255,255,255,0.22)");
      sh.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sh;
      rr(ctx, x, y, TW, TW, R);
      ctx.fill();

      ctx.restore();
    }

    // ── Floating labels ──────────────────────────────────────────────
    const now = Date.now();
    st.floatingLabels = floatingLabels.filter((l) => now - l.born < 900);
    for (const lbl of st.floatingLabels) {
      const age = (now - lbl.born) / 900;
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - age, 1.4);
      ctx.font = `800 ${Math.max(11, CELL - 5)}px system-ui,-apple-system,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.shadowColor = "rgba(253,224,71,0.9)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fde047";
      ctx.fillText(lbl.text, lbl.x, lbl.y - age * 42);
      ctx.restore();
    }
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
      next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS ||
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
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => { draw(); }, [canvasSize]);

  useEffect(() => {
    const keyMap = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
      a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      W: { x: 0, y: -1 }, S: { x: 0, y: 1 },
      A: { x: -1, y: 0 }, D: { x: 1, y: 0 },
    };

    function onKey(e) {
      if (e.key === "Enter") {
        if (gameOver) reset(); else { commitBuffer(); draw(); }
        return;
      }
      if (e.key === " ") { e.preventDefault(); if (!gameOver) setPaused((p) => !p); return; }
      if (keyMap[e.key] && stateRef.current) stateRef.current.nextDirection = keyMap[e.key];
    }

    let touchStart = null;
    function onTouchStart(e) { const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; }
    function onTouchEnd(e) {
      if (!touchStart || !stateRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      stateRef.current.nextDirection = Math.abs(dx) > Math.abs(dy)
        ? { x: dx > 0 ? 1 : -1, y: 0 }
        : { x: 0, y: dy > 0 ? 1 : -1 };
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

  useEffect(() => {
    if (!dictReady || gameOver || paused) return;
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [dictReady, gameOver, paused, speed]);

  const canvasShadow = flash === "good"
    ? "0 0 0 2px #4ade80, 0 0 24px rgba(74,222,128,0.45)"
    : flash === "bad"
    ? "0 0 0 2px #f87171, 0 0 24px rgba(248,113,113,0.45)"
    : "0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.5)";

  const glass = {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.11)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
  };

  return (
    <div style={{ textAlign: "center", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem" }}>

      {/* Title */}
      <h1 style={{
        margin: 0,
        fontSize: "1.6rem",
        fontWeight: 900,
        letterSpacing: "-0.03em",
        background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #f0abfc 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 12px rgba(167,139,250,0.4))",
      }}>Word Snake</h1>

      {/* Score bar */}
      <div style={{
        display: "flex", gap: "1.25rem", alignItems: "center",
        padding: "0.35rem 1.1rem", borderRadius: 999,
        fontVariantNumeric: "tabular-nums", fontSize: "0.82rem", fontWeight: 700,
        color: "#e2e8f0", ...glass,
      }}>
        <span>⭐ {score}</span>
        {highScore > 0 && <span style={{ color: "#fbbf24", textShadow: "0 0 8px rgba(251,191,36,0.5)" }}>🏆 {highScore}</span>}
        <span style={{ color: "#f87171" }}>✗ {mistakes}</span>
        <span style={{ color: "#86efac" }}>W {foundWords.length}</span>
      </div>

      {/* Buffer */}
      <div style={{
        minHeight: "2.4rem", width: "100%", maxWidth: canvasSize.w,
        padding: "0.35rem 0.75rem", borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: "1.4rem", letterSpacing: "0.2em", fontWeight: 800,
        color: buffer ? "#fde047" : "#4c3d7a",
        textShadow: buffer ? "0 0 16px rgba(253,224,71,0.6)" : "none",
        ...glass,
        transition: "color 150ms",
      }}>
        {buffer || "· · ·"}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{
            display: "block",
            borderRadius: 14,
            boxShadow: canvasShadow,
            transition: "box-shadow 150ms",
            touchAction: "none",
          }}
        />

        {/* Loading */}
        {!dictReady && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            background: "rgba(10,5,30,0.8)", backdropFilter: "blur(16px)",
            fontSize: "0.95rem", fontWeight: 600, color: "#a78bfa",
          }}>
            <span style={{ fontSize: "1.6rem" }}>📖</span>
            Loading dictionary…
          </div>
        )}

        {/* Pause / Game Over */}
        {dictReady && (gameOver || paused) && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 14,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.6rem",
            background: "rgba(8,4,24,0.78)", backdropFilter: "blur(18px)",
            padding: "1.5rem",
          }}>
            {gameOver ? (
              <>
                <span style={{ fontSize: "2rem" }}>💀</span>
                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "#f87171", lineHeight: 1.3 }}>Game Over</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>
                  Score <strong style={{ color: "#fde047" }}>{score}</strong> · {foundWords.length} words
                </p>
                <div style={{
                  marginTop: "0.4rem", padding: "0.45rem 1.4rem", borderRadius: 999,
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
                  color: "#fff", fontWeight: 800, fontSize: "0.9rem",
                  cursor: "pointer",
                }}>↵ Play Again</div>
              </>
            ) : (
              <>
                <span style={{ fontSize: "2rem" }}>⏸</span>
                <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "#a78bfa" }}>Paused</p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>Press Space to resume</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Found words */}
      <div style={{ maxWidth: canvasSize.w, width: "100%", minHeight: "2.2rem" }}>
        {foundWords.length === 0 ? (
          <span style={{ fontSize: "0.8rem", color: "#4c3d7a", fontWeight: 600 }}>No words yet</span>
        ) : (
          foundWords.map((w, i) => (
            <span key={i} style={{
              display: "inline-block", margin: "0.15rem 0.2rem",
              padding: "0.2rem 0.55rem", borderRadius: 999,
              background: "linear-gradient(135deg, rgba(21,128,61,0.75), rgba(20,83,45,0.75))",
              backdropFilter: "blur(8px)",
              color: "#dcfce7", fontSize: "0.78rem", fontWeight: 700,
              fontFamily: "ui-monospace, Menlo, monospace",
              border: "1px solid rgba(74,222,128,0.3)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}>
              {w.word} <span style={{ color: "#4ade80" }}>+{w.pts}</span>
            </span>
          ))
        )}
      </div>

      {/* Instructions */}
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b5fa0", fontWeight: 500, maxWidth: canvasSize.w }}>
        Tiles glow <span style={{ color: "#67e8f9", fontWeight: 700 }}>cyan</span> for prefixes ·{" "}
        <span style={{ color: "#4ade80", fontWeight: 700 }}>green</span> for words · dead-end = <span style={{ color: "#f87171", fontWeight: 700 }}>miss</span>
      </p>
      <p style={{ margin: 0, fontSize: "0.72rem", color: "#4c3d7a", fontWeight: 500 }}>
        Arrows / WASD · Enter commit · Space pause · Swipe on mobile
      </p>
    </div>
  );
}
