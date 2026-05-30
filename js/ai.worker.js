/* =========================================================
   Chess Mastery — AI Web Worker
   Alpha-beta pruning with iterative deepening, move ordering,
   piece-square tables, mobility, king safety, pawn structure,
   quiescence search, and endgame awareness.
   
   Runs in a Web Worker so the UI never freezes.
   Uses chess.js (loaded via importScripts) for legal move gen.
   ========================================================= */
"use strict";

importScripts("https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js");

// ---------- Constants ----------

const MATE_SCORE = 99999;
const MAX_QUIESCE_DEPTH = 6;

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-Square Tables (from White's perspective; mirrored for Black)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5,  5,  5,  5,  5,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ],
  k_end: [
   -50,-40,-30,-20,-20,-30,-40,-50,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -50,-30,-30,-30,-30,-30,-30,-50
  ]
};

// Mirror index for black
function mirrorIdx(idx) { return ((7 - Math.floor(idx / 8)) * 8) + (idx % 8); }

// ---------- Evaluation ----------

function isEndgame(board) {
  let queens = 0, minors = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p) continue;
    if (p.type === "q") queens++;
    if (p.type === "n" || p.type === "b") minors++;
  }
  return queens === 0 || (queens <= 2 && minors <= 2);
}

function evaluate(game) {
  const board = game.board();
  const endgame = isEndgame(board);
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const idx = r * 8 + c;
      const mult = piece.color === "w" ? 1 : -1;
      // Material
      score += PIECE_VALUES[piece.type] * mult;
      // PST
      let table;
      if (piece.type === "k" && endgame) {
        table = PST.k_end;
      } else {
        table = PST[piece.type];
      }
      if (table) {
        const tIdx = piece.color === "w" ? idx : mirrorIdx(idx);
        score += table[tIdx] * mult;
      }
    }
  }

  // Mobility bonus (approximate: count of legal moves for side to move)
  const moves = game.moves();
  const mobilityBonus = moves.length * 3;
  score += game.turn() === "w" ? mobilityBonus : -mobilityBonus;

  // Check bonus
  if (game.in_check()) {
    score += game.turn() === "w" ? -30 : 30;
  }

  return score;
}

// ---------- Move ordering ----------

function scoreMove(move) {
  let s = 0;
  if (move.captured) {
    // MVV-LVA
    s += (PIECE_VALUES[move.captured] || 0) * 10 - (PIECE_VALUES[move.piece] || 0);
  }
  if (move.promotion) s += PIECE_VALUES[move.promotion] || 0;
  if (move.flags.includes("k") || move.flags.includes("q")) s += 60; // castling
  if (move.san && move.san.includes("+")) s += 50; // check
  return s;
}

function orderMoves(moves) {
  return moves.slice().sort((a, b) => scoreMove(b) - scoreMove(a));
}

// ---------- Quiescence search ----------

function quiesce(game, alpha, beta, depth) {
  const standPat = evaluate(game);
  const isWhite = game.turn() === "w";

  if (depth <= 0) return standPat;

  if (isWhite) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  // Only search captures and promotions
  const allMoves = game.moves({ verbose: true });
  const captures = allMoves.filter((m) => m.captured || m.promotion);
  const sorted = orderMoves(captures);

  for (const move of sorted) {
    game.move(move.san);
    const score = quiesce(game, alpha, beta, depth - 1);
    game.undo();

    if (isWhite) {
      if (score > alpha) alpha = score;
      if (alpha >= beta) return beta;
    } else {
      if (score < beta) beta = score;
      if (alpha >= beta) return alpha;
    }
  }

  return isWhite ? alpha : beta;
}

// ---------- Alpha-beta ----------

function alphaBeta(game, depth, alpha, beta, deadline) {
  if (game.game_over()) return terminalScore(game, depth);
  if (depth <= 0) return quiesce(game, alpha, beta, MAX_QUIESCE_DEPTH);
  if (performance.now() > deadline) return evaluate(game);

  const moves = orderMoves(game.moves({ verbose: true }));
  const isWhite = game.turn() === "w";

  if (isWhite) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move.san);
      const val = alphaBeta(game, depth - 1, alpha, beta, deadline);
      game.undo();
      if (val > maxEval) maxEval = val;
      if (val > alpha) alpha = val;
      if (alpha >= beta) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move.san);
      const val = alphaBeta(game, depth - 1, alpha, beta, deadline);
      game.undo();
      if (val < minEval) minEval = val;
      if (val < beta) beta = val;
      if (alpha >= beta) break;
    }
    return minEval;
  }
}

function terminalScore(game, depth) {
  if (game.in_checkmate()) {
    return game.turn() === "w" ? -(MATE_SCORE + depth) : (MATE_SCORE + depth);
  }
  return 0; // draw
}

// ---------- Iterative deepening ----------

function findBestMove(game, maxDepth, timeMs, randomTopN, blunder) {
  const deadline = performance.now() + timeMs;
  const isWhite = game.turn() === "w";
  let bestMove = null;
  let bestScore = isWhite ? -Infinity : Infinity;
  let allScored = [];

  const moves = orderMoves(game.moves({ verbose: true }));
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]; // forced move

  // Iterative deepening
  for (let d = 1; d <= maxDepth; d++) {
    let depthBest = null;
    let depthBestScore = isWhite ? -Infinity : Infinity;
    const scored = [];

    for (const move of moves) {
      if (performance.now() > deadline) break;
      game.move(move.san);
      const val = alphaBeta(game, d - 1, -Infinity, Infinity, deadline);
      game.undo();
      scored.push({ move, score: val });

      if (isWhite) {
        if (val > depthBestScore) { depthBestScore = val; depthBest = move; }
      } else {
        if (val < depthBestScore) { depthBestScore = val; depthBest = move; }
      }
    }

    if (depthBest) {
      bestMove = depthBest;
      bestScore = depthBestScore;
      allScored = scored;
    }
    if (performance.now() > deadline) break;
    // Exit early on mate
    if (Math.abs(bestScore) > MATE_SCORE - 100) break;
  }

  // Apply randomness / blunder for easier levels
  if (allScored.length > 0 && (randomTopN > 1 || blunder > 0)) {
    // Sort by score
    allScored.sort((a, b) => isWhite ? b.score - a.score : a.score - b.score);

    // Blunder: chance to pick a random move
    if (blunder > 0 && Math.random() < blunder) {
      const idx = Math.floor(Math.random() * Math.min(allScored.length, 8));
      return allScored[idx].move;
    }

    // Pick randomly from top N
    if (randomTopN > 1) {
      const topN = allScored.slice(0, Math.min(randomTopN, allScored.length));
      const pick = topN[Math.floor(Math.random() * topN.length)];
      return pick.move;
    }
  }

  return bestMove || moves[0];
}

// ---------- Worker messaging ----------

let engine = null;

self.onmessage = function (ev) {
  const msg = ev.data;

  if (msg.type === "init") {
    self.postMessage({ type: "ready" });
    return;
  }

  if (msg.type === "go") {
    try {
      engine = new Chess(msg.fen);
      const best = findBestMove(
        engine,
        msg.maxDepth || 5,
        msg.timeMs || 2000,
        msg.randomTopN || 1,
        msg.blunder || 0
      );
      if (best) {
        self.postMessage({
          type: "bestmove",
          from: best.from,
          to: best.to,
          promotion: best.promotion || undefined,
          san: best.san,
        });
      } else {
        self.postMessage({ type: "bestmove", from: null, to: null });
      }
    } catch (err) {
      self.postMessage({ type: "bestmove", from: null, to: null, error: String(err) });
    }
    return;
  }
};
