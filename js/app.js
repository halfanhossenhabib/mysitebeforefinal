/* =========================================================
   Chess Mastery — main app
   - UI: render board, drag/touch + click moves, animations
   - Modes: human-vs-AI, human-vs-human, AI-vs-AI demo
   - Clocks, promotion modal, sounds, themes
   - Web Worker AI (alpha-beta + iterative deepening)
   - Save / resume (localStorage), PGN export, FEN copy/load
   - Keyboard navigation + ARIA live updates
   ========================================================= */
(function () {
  "use strict";

  // ---------- Config ----------

  /** Unicode chess pieces */
  const PIECE_GLYPH = {
    w: { p: "\u2659", n: "\u2658", b: "\u2657", r: "\u2656", q: "\u2655", k: "\u2654" },
    b: { p: "\u265F", n: "\u265E", b: "\u265D", r: "\u265C", q: "\u265B", k: "\u265A" },
  };
  const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  /** Time presets: ms per side, ms increment */
  const TIME_PRESETS = {
    "untimed": null,
    "1+0":   { base: 60 * 1000, inc: 0 },
    "3+2":   { base: 3 * 60 * 1000, inc: 2 * 1000 },
    "5+0":   { base: 5 * 60 * 1000, inc: 0 },
    "10+0":  { base: 10 * 60 * 1000, inc: 0 },
  };

  /** AI level → worker config (time budget ms + skill) */
  const LEVEL_CONFIG = {
    1: { name: "Beginner", maxDepth: 2, timeMs: 150,  blunder: 0.50, randomTopN: 6 },
    2: { name: "Easy",     maxDepth: 3, timeMs: 350,  blunder: 0.20, randomTopN: 3 },
    3: { name: "Medium",   maxDepth: 4, timeMs: 800,  blunder: 0.05, randomTopN: 2 },
    4: { name: "Hard",     maxDepth: 5, timeMs: 1500, blunder: 0.0,  randomTopN: 1 },
    5: { name: "Master",   maxDepth: 6, timeMs: 2500, blunder: 0.0,  randomTopN: 1 },
  };

  const SAVE_KEY = "chess-mastery:save:v1";
  const SETTINGS_KEY = "chess-mastery:settings:v1";

  // ---------- State ----------
  const S = {
    game: null,                 // chess.js instance
    flipped: false,             // board orientation (true = black at bottom)
    selected: null,             // selected square id e.g. 'e2'
    legalFromSelected: [],      // verbose moves array from chess.js
    lastMove: null,             // {from, to}
    aiThinking: false,
    pendingPromotion: null,     // {from, to, color}
    keyboardCursor: null,       // square id under keyboard focus
    history: [],                // san history (for redraw)
    undone: [],                 // (kept simple — we use chess.undo so this is just SAN cache)
    clocks: { w: 0, b: 0, lastTickAt: 0, running: false, preset: "untimed" },
    clockTimerId: null,
    aiVsAiTimerId: null,
    settings: loadSettings(),
    worker: null,
    workerReady: false,
    pendingAi: null,            // resolver awaiting bestmove
    boardRectCache: null,
    soundCtx: null,
    aiReqId: 0,                 // monotonic, lets us discard stale AI replies
  };

  // ---------- Element cache ----------
  const $ = (id) => document.getElementById(id);
  const E = {};

  function cacheElements() {
    [
      "board","statusText","turnDot","thinkingDots",
      "clockBlack","clockWhite","clockBlackTime","clockWhiteTime",
      "capturedTop","capturedTopPieces","capturedTopScore",
      "capturedBottom","capturedBottomPieces","capturedBottomScore",
      "newGameBtn","undoBtn","flipBtn","resignBtn","settingsBtn","soundToggle",
      "moveList","moveListEmpty","tabMovesBtn","tabToolsBtn","tab-moves","tab-tools",
      "fenView","pgnView","copyFenBtn","loadFenBtn","copyPgnBtn","downloadPgnBtn",
      "saveBtn","loadSaveBtn","clearSaveBtn","saveHint",
      "settingsDialog","settingsCloseBtn","settingsApplyNew",
      "resultDialog","resultIcon","resultTitle","resultReason",
      "resultRematchBtn","resultReviewBtn","resultCloseBtn",
      "fenDialog","fenInput","fenError","fenLoadConfirmBtn","fenDialogCloseBtn",
      "promoPopover","promoCancel",
      "coordFilesTop","coordFilesBottom","coordRanksLeft","coordRanksRight",
      "toast",
    ].forEach((id) => { E[id] = $(id); });
    E.tabMoves = $("tab-moves");
    E.tabTools = $("tab-tools");
    E.settingsShowHints = $("settingsShowHints");
    E.settingsShowCoords = $("settingsShowCoords");
    E.settingsAutoFlip = $("settingsAutoFlip");
    E.settingsSound = $("settingsSound");
  }

  // ---------- Settings ----------

  function defaultSettings() {
    return {
      mode: "hva",
      playerColor: "w",
      level: 3,
      time: "untimed",
      theme: "midnight",
      pieceStyle: "classic",
      showHints: true,
      showCoords: true,
      autoFlip: false,
      sound: false,
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      return Object.assign(defaultSettings(), JSON.parse(raw));
    } catch (_) {
      return defaultSettings();
    }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings)); } catch (_) {}
  }

  function applySettingsToDocument() {
    document.body.dataset.theme = S.settings.theme;
    document.body.dataset.pieceStyle = S.settings.pieceStyle;
    document.body.dataset.coords = S.settings.showCoords ? "on" : "off";
    E.soundToggle.setAttribute("aria-pressed", String(!!S.settings.sound));
  }

  function syncSettingsDialogInputs() {
    document.querySelectorAll('input[name="mode"]').forEach((i) => i.checked = i.value === S.settings.mode);
    document.querySelectorAll('input[name="playerColor"]').forEach((i) => i.checked = i.value === S.settings.playerColor);
    document.querySelectorAll('input[name="level"]').forEach((i) => i.checked = String(i.value) === String(S.settings.level));
    document.querySelectorAll('input[name="time"]').forEach((i) => i.checked = i.value === S.settings.time);
    document.querySelectorAll('input[name="theme"]').forEach((i) => i.checked = i.value === S.settings.theme);
    document.querySelectorAll('input[name="pieceStyle"]').forEach((i) => i.checked = i.value === S.settings.pieceStyle);
    E.settingsShowHints.checked  = S.settings.showHints;
    E.settingsShowCoords.checked = S.settings.showCoords;
    E.settingsAutoFlip.checked   = S.settings.autoFlip;
    E.settingsSound.checked      = !!S.settings.sound;
  }

  function readSettingsFromDialog() {
    const get = (name) => document.querySelector(`input[name="${name}"]:checked`);
    S.settings.mode        = get("mode")?.value || "hva";
    S.settings.playerColor = get("playerColor")?.value || "w";
    S.settings.level       = Number(get("level")?.value || 3);
    S.settings.time        = get("time")?.value || "untimed";
    S.settings.theme       = get("theme")?.value || "midnight";
    S.settings.pieceStyle  = get("pieceStyle")?.value || "classic";
    S.settings.showHints   = !!E.settingsShowHints.checked;
    S.settings.showCoords  = !!E.settingsShowCoords.checked;
    S.settings.autoFlip    = !!E.settingsAutoFlip.checked;
    S.settings.sound       = !!E.settingsSound.checked;
    saveSettings();
    applySettingsToDocument();
  }

  // ---------- Helpers ----------

  function squareId(file, rank) { return "abcdefgh"[file] + (rank + 1); }
  function isLight(file, rank) { return ((file + rank) % 2) === 1; } // a1 (0,0) is dark
  function pieceColorOf(square) { const p = S.game.get(square); return p ? p.color : null; }
  function isHumanTurn() {
    if (S.aiThinking) return false;
    if (S.settings.mode === "hvh") return true;
    if (S.settings.mode === "ava") return false;
    // hva
    return S.game.turn() === resolvedPlayerColor();
  }
  function resolvedPlayerColor() {
    let c = S.settings.playerColor;
    if (c === "r") c = S.settings._resolvedRandom || (Math.random() < 0.5 ? "w" : "b");
    return c;
  }

  function showToast(text, ms = 2200) {
    E.toast.textContent = text;
    E.toast.hidden = false;
    requestAnimationFrame(() => E.toast.classList.add("is-on"));
    clearTimeout(E.toast._timer);
    E.toast._timer = setTimeout(() => {
      E.toast.classList.remove("is-on");
      setTimeout(() => { E.toast.hidden = true; }, 300);
    }, ms);
  }

  // ---------- Board rendering ----------

  function buildBoard() {
    E.board.innerHTML = "";
    const order = orderedSquares(); // 64 squares in display order (top-left first)
    for (const sq of order) {
      const file = "abcdefgh".indexOf(sq[0]);
      const rank = Number(sq[1]) - 1;
      const div = document.createElement("div");
      div.className = "square" + (isLight(file, rank) ? "" : " is-dark");
      div.setAttribute("role", "gridcell");
      div.dataset.id = sq;
      div.setAttribute("aria-label", squareAriaLabel(sq));
      div.tabIndex = -1;
      E.board.appendChild(div);
    }
    renderCoordinates();
    renderPieces();
    bindBoardInputs();
  }

  function orderedSquares() {
    const ranks = S.flipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
    const files = S.flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    const out = [];
    for (const r of ranks) for (const f of files) out.push(squareId(f, r));
    return out;
  }

  function renderCoordinates() {
    if (!S.settings.showCoords) return;
    const filesOrder = S.flipped ? "hgfedcba" : "abcdefgh";
    const ranksOrder = S.flipped ? "12345678" : "87654321";
    E.coordFilesTop.innerHTML = "";
    E.coordFilesBottom.innerHTML = "";
    E.coordRanksLeft.innerHTML = "";
    E.coordRanksRight.innerHTML = "";
    for (const f of filesOrder) {
      const a = document.createElement("span"); a.textContent = f;
      const b = a.cloneNode(true);
      E.coordFilesTop.appendChild(a);
      E.coordFilesBottom.appendChild(b);
    }
    for (const r of ranksOrder) {
      const a = document.createElement("span"); a.textContent = r;
      const b = a.cloneNode(true);
      E.coordRanksLeft.appendChild(a);
      E.coordRanksRight.appendChild(b);
    }
  }

  function renderPieces() {
    E.board.querySelectorAll(".piece").forEach((p) => p.remove());
    const board = S.game.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (!piece) continue;
        // chess.js board: row 0 = rank 8 (top), col 0 = file a
        const sq = "abcdefgh"[f] + (8 - r);
        const cell = E.board.querySelector(`.square[data-id="${sq}"]`);
        if (!cell) continue;
        cell.appendChild(makePieceSvg(piece.color, piece.type));
      }
    }
  }

  function makePieceSvg(color, type) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "piece");
    svg.setAttribute("viewBox", "0 0 45 45");
    svg.setAttribute("aria-hidden", "true");
    svg.dataset.color = color;
    svg.dataset.type = type;
    const use = document.createElementNS(ns, "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#pc-" + type);
    use.setAttribute("href", "#pc-" + type);
    svg.appendChild(use);
    return svg;
  }

  function squareAriaLabel(sq) {
    const piece = S.game?.get(sq);
    if (!piece) return `Empty square ${sq}`;
    const colorWord = piece.color === "w" ? "White" : "Black";
    const typeWord  = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[piece.type];
    return `${colorWord} ${typeWord} on ${sq}`;
  }

  // ---------- Highlights & hints ----------

  function clearHints() {
    E.board.querySelectorAll(".square").forEach((sq) => {
      sq.classList.remove("is-selected","is-hint","is-cap","is-check","is-last");
    });
  }

  function applyHighlights() {
    E.board.querySelectorAll(".square").forEach((sq) => {
      sq.classList.remove("is-selected","is-hint","is-cap","is-check","is-last");
    });
    if (S.lastMove) {
      const a = E.board.querySelector(`.square[data-id="${S.lastMove.from}"]`);
      const b = E.board.querySelector(`.square[data-id="${S.lastMove.to}"]`);
      a?.classList.add("is-last");
      b?.classList.add("is-last");
    }
    if (S.game.in_check()) {
      const turn = S.game.turn();
      const board = S.game.board();
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          const sq = "abcdefgh"[f] + (8 - r);
          E.board.querySelector(`.square[data-id="${sq}"]`)?.classList.add("is-check");
        }
      }
    }
    if (S.selected && S.settings.showHints) {
      E.board.querySelector(`.square[data-id="${S.selected}"]`)?.classList.add("is-selected");
      for (const m of S.legalFromSelected) {
        const sq = E.board.querySelector(`.square[data-id="${m.to}"]`);
        sq?.classList.add("is-hint");
        if (m.captured || m.flags.includes("e")) sq?.classList.add("is-cap");
      }
    }
    if (S.keyboardCursor) {
      E.board.querySelector(`.square[data-id="${S.keyboardCursor}"]`)?.classList.add("is-kbfocus");
    }
  }

  // ---------- Input: click + drag ----------

  function bindBoardInputs() {
    E.board.addEventListener("pointerdown", onPointerDown, { passive: false });
    E.board.addEventListener("click", onBoardClick);
    E.board.addEventListener("keydown", onBoardKeydown);
    E.board.addEventListener("focus", () => {
      if (!S.keyboardCursor) S.keyboardCursor = "e4";
      applyHighlights();
    });
  }

  let drag = null; // { piece, fromSquare, ghost, startX, startY, moved }

  function onPointerDown(ev) {
    if (!isHumanTurn()) return;
    if (S.pendingPromotion) return;
    const sqEl = ev.target.closest(".square");
    if (!sqEl) return;
    const sq = sqEl.dataset.id;
    const piece = S.game.get(sq);

    // Only start drag if piece belongs to side to move
    if (!piece || piece.color !== S.game.turn()) {
      // also handle "second click" on hint square via click handler below
      return;
    }
    if (S.settings.mode === "hva" && piece.color !== resolvedPlayerColor()) return;

    ev.preventDefault();
    selectSquare(sq);
    const pieceEl = sqEl.querySelector(".piece");
    if (!pieceEl) return;

    const rect = pieceEl.getBoundingClientRect();
    const ghost = pieceEl.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.fontSize = getComputedStyle(pieceEl).fontSize;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "1000";
    ghost.classList.add("is-dragging");
    document.body.appendChild(ghost);
    pieceEl.style.opacity = "0.25";

    drag = {
      piece: pieceEl,
      ghost,
      fromSquare: sq,
      startX: ev.clientX,
      startY: ev.clientY,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
      moved: false,
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp, { once: true });
    document.addEventListener("pointercancel", onPointerUp, { once: true });
  }

  function onPointerMove(ev) {
    if (!drag) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
    drag.ghost.style.left = (ev.clientX - drag.offsetX) + "px";
    drag.ghost.style.top  = (ev.clientY - drag.offsetY) + "px";

    // Highlight target
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const sqEl = target?.closest?.(".square");
    E.board.querySelectorAll(".square.is-kbfocus").forEach((el) => el.classList.remove("is-kbfocus"));
    if (sqEl) sqEl.classList.add("is-kbfocus");
  }

  function onPointerUp(ev) {
    document.removeEventListener("pointermove", onPointerMove);
    if (!drag) return;
    const ghost = drag.ghost;
    const fromSq = drag.fromSquare;
    const wasMoved = drag.moved;
    drag.piece.style.opacity = "";
    ghost.remove();
    drag = null;

    if (!wasMoved) {
      // Treat as click-select (already selected). Click handler will manage.
      return;
    }
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const targetSq = target?.closest?.(".square");
    E.board.querySelectorAll(".square.is-kbfocus").forEach((el) => el.classList.remove("is-kbfocus"));
    if (!targetSq) {
      clearSelection();
      return;
    }
    const toSq = targetSq.dataset.id;
    if (toSq === fromSq) {
      // dropped back; keep selection
      applyHighlights();
      return;
    }
    attemptUserMove(fromSq, toSq);
  }

  function onBoardClick(ev) {
    if (!isHumanTurn() || S.pendingPromotion) return;
    const sqEl = ev.target.closest(".square");
    if (!sqEl) return;
    const sq = sqEl.dataset.id;
    if (S.selected) {
      // Try to move, otherwise reselect
      if (sq === S.selected) { clearSelection(); return; }
      const ownPieceClicked = (() => {
        const p = S.game.get(sq); return p && p.color === S.game.turn();
      })();
      // If clicked own-color piece (different from current selection), switch selection
      if (ownPieceClicked) {
        // Prefer move if legal, else switch
        const isLegal = S.legalFromSelected.some((m) => m.to === sq);
        if (!isLegal) { selectSquare(sq); return; }
      }
      attemptUserMove(S.selected, sq);
    } else {
      const p = S.game.get(sq);
      if (p && p.color === S.game.turn()) {
        if (S.settings.mode === "hva" && p.color !== resolvedPlayerColor()) return;
        selectSquare(sq);
      }
    }
  }

  function selectSquare(sq) {
    S.selected = sq;
    S.legalFromSelected = S.game.moves({ square: sq, verbose: true });
    applyHighlights();
  }
  function clearSelection() {
    S.selected = null;
    S.legalFromSelected = [];
    applyHighlights();
  }

  // ---------- Move execution ----------

  function attemptUserMove(from, to) {
    const moves = S.game.moves({ square: from, verbose: true });
    const candidate = moves.find((m) => m.to === to);
    if (!candidate) {
      // Not legal; if user clicked an own piece, switch selection
      const p = S.game.get(to);
      if (p && p.color === S.game.turn()) selectSquare(to);
      else clearSelection();
      return;
    }
    if (candidate.flags.includes("p")) {
      openPromotionPopover(from, to, candidate.color, (piece) => {
        if (!piece) { clearSelection(); return; }
        executeMove({ from, to, promotion: piece });
      });
      return;
    }
    executeMove({ from, to });
  }

  function executeMove(spec) {
    const before = S.game.fen();
    const move = S.game.move(spec);
    if (!move) { clearSelection(); return false; }
    S.lastMove = { from: move.from, to: move.to };
    clearSelection();
    afterMoveCommitted(move, before);
    return true;
  }

  function afterMoveCommitted(move, beforeFen) {
    // Animate (FLIP-style) if previous render had pieces
    animateMove(move);
    renderPieces();
    applyHighlights();
    onMoveSideEffects(move, beforeFen);
    refreshUiAfterMove();
    persistAutosave();

    if (S.game.game_over()) {
      stopClocks();
      onGameOver();
      return;
    }
    // Trigger next player
    scheduleNextTurn();
  }

  function refreshUiAfterMove() {
    updateStatus();
    updateMoveList();
    updateCaptured();
    updateTools();
    updateUndoButton();
    updateClocksDisplay();
  }

  function animateMove(move) {
    // Re-render then apply a transient transform on destination piece for smoothness
    const dur = matchesReducedMotion() ? 0 : 220;
    if (!dur) return;
    const cell = E.board.querySelector(`.square[data-id="${move.to}"]`);
    if (!cell) return;
    // Build the new position then animate
    requestAnimationFrame(() => {
      const piece = cell.querySelector(".piece");
      if (!piece) return;
      const fromCell = E.board.querySelector(`.square[data-id="${move.from}"]`);
      if (!fromCell) return;
      const r1 = fromCell.getBoundingClientRect();
      const r2 = cell.getBoundingClientRect();
      const dx = r1.left - r2.left;
      const dy = r1.top  - r2.top;
      piece.style.transform = `translate(${dx}px, ${dy}px)`;
      piece.classList.add("is-moving");
      requestAnimationFrame(() => {
        piece.style.transform = "";
        setTimeout(() => piece.classList.remove("is-moving"), dur);
      });
    });
  }

  function matchesReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onMoveSideEffects(move) {
    // Sound
    if (move.flags.includes("c") || move.captured) playSound("capture");
    else if (move.flags.includes("k") || move.flags.includes("q")) playSound("castle");
    else if (move.promotion) playSound("promote");
    else playSound("move");
    if (S.game.in_check()) playSound("check");

    // Auto-flip for HvH
    if (S.settings.mode === "hvh" && S.settings.autoFlip) {
      S.flipped = (S.game.turn() === "b");
      buildBoard();
      applyHighlights();
    }
    // Clocks: switch active side, add increment to mover
    if (TIME_PRESETS[S.clocks.preset]) {
      const inc = TIME_PRESETS[S.clocks.preset].inc;
      const mover = move.color;
      S.clocks[mover] += inc;
      // Active side is the new turn
      startClocks();
    }
  }

  function scheduleNextTurn() {
    const turn = S.game.turn();
    const isAi =
      (S.settings.mode === "hva" && turn !== resolvedPlayerColor()) ||
      (S.settings.mode === "ava");

    if (isAi) requestAiMove();
  }

  // ---------- Promotion popover ----------

  function openPromotionPopover(from, to, color, callback) {
    S.pendingPromotion = { from, to, color };
    const cell = E.board.querySelector(`.square[data-id="${to}"]`);
    if (!cell) { callback(null); return; }

    // Set color on popover (CSS picks up data-color to color the SVG pieces)
    E.promoPopover.dataset.color = color;

    const buttons = E.promoPopover.querySelectorAll("button.promo-piece");
    buttons.forEach((btn) => {
      btn.onclick = () => closePromotion(btn.dataset.piece);
    });
    E.promoCancel.onclick = () => closePromotion(null);

    // Position popover near destination
    E.promoPopover.hidden = false;
    requestAnimationFrame(() => positionPromoPopover(cell));
    buttons[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePromotion(null);
      }
    };
    document.addEventListener("keydown", onKey, { once: false });

    function closePromotion(piece) {
      document.removeEventListener("keydown", onKey);
      E.promoPopover.hidden = true;
      const cb = callback;
      S.pendingPromotion = null;
      cb(piece);
    }
  }

  function positionPromoPopover(destCell) {
    const wrap = destCell.closest(".board-wrap");
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const cellRect = destCell.getBoundingClientRect();
    const popRect = E.promoPopover.getBoundingClientRect();
    let left = (cellRect.left - wrapRect.left) + cellRect.width / 2 - popRect.width / 2;
    let top  = (cellRect.bottom - wrapRect.top) + 6;
    if (top + popRect.height > wrapRect.height) {
      top = (cellRect.top - wrapRect.top) - popRect.height - 6;
    }
    left = Math.max(4, Math.min(wrapRect.width - popRect.width - 4, left));
    E.promoPopover.style.left = left + "px";
    E.promoPopover.style.top = top + "px";
  }

  // ---------- Status / move list / captures / tools ----------

  function updateStatus() {
    let text;
    const turn = S.game.turn();
    if (S.game.in_checkmate()) {
      text = `Checkmate — ${turn === "w" ? "Black" : "White"} wins`;
    } else if (S.game.in_stalemate()) {
      text = "Stalemate — draw";
    } else if (S.game.in_threefold_repetition()) {
      text = "Threefold repetition — draw";
    } else if (S.game.insufficient_material()) {
      text = "Insufficient material — draw";
    } else if (S.game.in_draw()) {
      text = "Draw";
    } else {
      const sideName = (turn === "w") ? "White" : "Black";
      const who = whoToMoveName(turn);
      text = `${sideName} to move — ${who}`;
      if (S.game.in_check()) text += " (check)";
    }
    E.statusText.textContent = text;
    E.turnDot.classList.toggle("is-black", turn === "b");
    E.thinkingDots.hidden = !S.aiThinking;
  }

  function whoToMoveName(turn) {
    if (S.settings.mode === "hvh") return "Human";
    if (S.settings.mode === "ava") return `AI (${LEVEL_CONFIG[S.settings.level].name})`;
    // hva
    return (turn === resolvedPlayerColor()) ? "You" : `AI (${LEVEL_CONFIG[S.settings.level].name})`;
  }

  function updateMoveList() {
    const history = S.game.history({ verbose: true });
    E.moveList.innerHTML = "";
    if (history.length === 0) {
      E.moveListEmpty.hidden = false;
      return;
    }
    E.moveListEmpty.hidden = true;
    let li = null;
    history.forEach((m, i) => {
      const moveNum = Math.floor(i / 2) + 1;
      if (i % 2 === 0) {
        li = document.createElement("li");
        const num = document.createElement("span");
        num.className = "ply-num";
        num.textContent = moveNum + ".";
        const p = document.createElement("span");
        p.className = "ply";
        p.textContent = m.san;
        const p2 = document.createElement("span");
        p2.className = "ply ply-empty";
        p2.style.visibility = "hidden";
        p2.textContent = "—";
        li.appendChild(num);
        li.appendChild(p);
        li.appendChild(p2);
        E.moveList.appendChild(li);
      } else {
        const p2 = li.lastElementChild;
        p2.textContent = m.san;
        p2.classList.remove("ply-empty");
        p2.style.visibility = "";
      }
    });
    // Highlight last
    const plies = E.moveList.querySelectorAll(".ply:not(.ply-empty)");
    plies.forEach((el) => el.classList.remove("is-current"));
    if (plies.length) {
      const last = plies[plies.length - 1];
      last.classList.add("is-current");
      last.scrollIntoView({ block: "nearest" });
    }
  }

  function updateCaptured() {
    // Captured pieces (by white, by black) + material score
    const captured = { w: [], b: [] };
    S.game.history({ verbose: true }).forEach((m) => {
      if (m.captured) captured[m.color].push(m.captured); // captor's color → list of captured types
    });
    const valSum = (arr) => arr.reduce((s, t) => s + (PIECE_VALUE[t] || 0), 0);
    const whiteScore = valSum(captured.w); // captured by white
    const blackScore = valSum(captured.b); // captured by black
    const diff = whiteScore - blackScore;

    // Render: top is opponent (white perspective: top = black side)
    // We choose: top captured row = pieces captured BY the opponent of bottom side
    // For simplicity, top row = captured by black (i.e. white pieces taken),
    //                bottom row = captured by white (i.e. black pieces taken).
    setCapturedRow(E.capturedTopPieces,    captured.b, "w");
    setCapturedRow(E.capturedBottomPieces, captured.w, "b");
    E.capturedTopScore.textContent    = diff < 0 ? `+${-diff}` : "";
    E.capturedBottomScore.textContent = diff > 0 ? `+${diff}` : "";
  }

  function setCapturedRow(host, types, color) {
    host.innerHTML = "";
    if (!types.length) {
      host.parentElement.classList.add("is-empty");
      return;
    }
    host.parentElement.classList.remove("is-empty");
    // Sort by value desc for visual clarity
    const order = ["q","r","b","n","p"];
    types.slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b)).forEach((t) => {
      const s = document.createElement("span");
      s.textContent = PIECE_GLYPH[color][t];
      host.appendChild(s);
    });
  }

  function updateUndoButton() {
    const canUndo =
      !S.aiThinking &&
      !S.pendingPromotion &&
      S.game.history().length > 0 &&
      (S.settings.mode !== "ava");
    E.undoBtn.disabled = !canUndo;
  }

  function updateTools() {
    E.fenView.value = S.game.fen();
    E.pgnView.value = S.game.pgn();
  }

  // ---------- Clocks ----------

  function setClockPreset(preset) {
    S.clocks.preset = preset;
    if (TIME_PRESETS[preset]) {
      const t = TIME_PRESETS[preset].base;
      S.clocks.w = t;
      S.clocks.b = t;
    } else {
      S.clocks.w = 0;
      S.clocks.b = 0;
    }
    stopClocks();
    updateClocksDisplay();
  }

  function startClocks() {
    if (!TIME_PRESETS[S.clocks.preset]) return;
    if (S.game.game_over()) return;
    S.clocks.lastTickAt = performance.now();
    if (!S.clockTimerId) {
      S.clockTimerId = setInterval(tickClocks, 200);
    }
    S.clocks.running = true;
    updateClocksDisplay();
  }

  function stopClocks() {
    if (S.clockTimerId) { clearInterval(S.clockTimerId); S.clockTimerId = null; }
    S.clocks.running = false;
    updateClocksDisplay();
  }

  function tickClocks() {
    if (!TIME_PRESETS[S.clocks.preset]) return;
    if (S.pendingPromotion) return;
    const now = performance.now();
    const delta = now - S.clocks.lastTickAt;
    S.clocks.lastTickAt = now;
    const turn = S.game.turn();
    S.clocks[turn] = Math.max(0, S.clocks[turn] - delta);
    if (S.clocks[turn] <= 0) {
      stopClocks();
      onTimeOut(turn);
      return;
    }
    updateClocksDisplay();
  }

  function updateClocksDisplay() {
    const useTime = !!TIME_PRESETS[S.clocks.preset];
    if (!useTime) {
      E.clockWhiteTime.textContent = "—";
      E.clockBlackTime.textContent = "—";
      E.clockWhite.dataset.active = "false";
      E.clockBlack.dataset.active = "false";
      E.clockWhite.classList.remove("is-low");
      E.clockBlack.classList.remove("is-low");
      return;
    }
    E.clockWhiteTime.textContent = formatClock(S.clocks.w);
    E.clockBlackTime.textContent = formatClock(S.clocks.b);
    const turn = S.game.turn();
    const running = S.clocks.running && !S.game.game_over();
    E.clockWhite.dataset.active = String(running && turn === "w");
    E.clockBlack.dataset.active = String(running && turn === "b");
    E.clockWhite.classList.toggle("is-low", S.clocks.w < 15000);
    E.clockBlack.classList.toggle("is-low", S.clocks.b < 15000);
  }

  function formatClock(ms) {
    if (ms < 0) ms = 0;
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m >= 1) return `${m}:${String(s).padStart(2,"0")}`;
    return `0:${String(s).padStart(2,"0")}.${Math.floor((ms % 1000)/100)}`;
  }

  function onTimeOut(turn) {
    showResult({
      icon: "\u23F0",
      title: "Time out",
      reason: turn === "w" ? "White ran out of time. Black wins." : "Black ran out of time. White wins.",
    });
    playSound("end");
  }

  // ---------- AI worker ----------
  //
  // The AI runs in a Web Worker for non-blocking thinking. To avoid any
  // file-path / CORS / file:// issues we build the worker from an inline
  // Blob URL. If Worker is unavailable for any reason we fall back to a
  // shallow synchronous AI so the game is still playable.

  /** Inline AI source (runs inside the Worker). Kept self-contained. */
  const WORKER_SOURCE = `
    "use strict";
    importScripts("https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js");

    const MATE = 99999;
    const QDEPTH = 4;
    const VAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };
    const PST = {
      p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
      n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
      b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,5,5,5,5,5,5,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
      r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
      q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
      k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
      ke:[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50]
    };
    const mirror = (i) => ((7 - (i>>3)) << 3) + (i & 7);

    function evaluate(g) {
      const b = g.board();
      let queens = 0, minors = 0, score = 0;
      for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
        const p = b[r][c]; if (!p) continue;
        if (p.type === "q") queens++;
        else if (p.type === "n" || p.type === "b") minors++;
      }
      const eg = queens === 0 || (queens <= 2 && minors <= 2);
      for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
        const p = b[r][c]; if (!p) continue;
        const idx = r*8 + c;
        const sign = p.color === "w" ? 1 : -1;
        score += VAL[p.type] * sign;
        const t = p.type === "k" && eg ? PST.ke : PST[p.type];
        if (t) score += t[p.color === "w" ? idx : mirror(idx)] * sign;
      }
      const mob = g.moves().length * 2;
      score += g.turn() === "w" ? mob : -mob;
      if (g.in_check()) score += g.turn() === "w" ? -25 : 25;
      return score;
    }

    function order(moves) {
      return moves.slice().sort((a,b) => mvscore(b) - mvscore(a));
    }
    function mvscore(m) {
      let s = 0;
      if (m.captured) s += (VAL[m.captured]||0) * 10 - (VAL[m.piece]||0) + 100000;
      if (m.promotion) s += (VAL[m.promotion]||0) + 80000;
      if (m.flags.includes("k") || m.flags.includes("q")) s += 50;
      return s;
    }

    function quiesce(g, alpha, beta, d) {
      const stand = evaluate(g);
      const w = g.turn() === "w";
      if (d <= 0) return stand;
      if (w) { if (stand >= beta) return beta; if (stand > alpha) alpha = stand; }
      else   { if (stand <= alpha) return alpha; if (stand < beta) beta = stand; }
      const caps = g.moves({verbose:true}).filter(m => m.captured || m.promotion);
      const sorted = order(caps);
      for (const m of sorted) {
        g.move(m.san);
        const v = quiesce(g, alpha, beta, d - 1);
        g.undo();
        if (w) { if (v > alpha) alpha = v; if (alpha >= beta) return beta; }
        else   { if (v < beta) beta = v;  if (alpha >= beta) return alpha; }
      }
      return w ? alpha : beta;
    }

    function ab(g, depth, alpha, beta, deadline) {
      if (g.in_checkmate()) return g.turn() === "w" ? -(MATE + depth) : (MATE + depth);
      if (g.in_draw() || g.in_stalemate() || g.insufficient_material() || g.in_threefold_repetition()) return 0;
      if (depth <= 0) return quiesce(g, alpha, beta, QDEPTH);
      if (performance.now() > deadline) return evaluate(g);
      const moves = order(g.moves({verbose:true}));
      const w = g.turn() === "w";
      if (w) {
        let best = -Infinity;
        for (const m of moves) {
          g.move(m.san);
          const v = ab(g, depth - 1, alpha, beta, deadline);
          g.undo();
          if (v > best) best = v;
          if (v > alpha) alpha = v;
          if (alpha >= beta) break;
        }
        return best;
      } else {
        let best = Infinity;
        for (const m of moves) {
          g.move(m.san);
          const v = ab(g, depth - 1, alpha, beta, deadline);
          g.undo();
          if (v < best) best = v;
          if (v < beta) beta = v;
          if (alpha >= beta) break;
        }
        return best;
      }
    }

    function findBest(g, maxDepth, timeMs, randomTopN, blunder) {
      const deadline = performance.now() + timeMs;
      const moves = order(g.moves({verbose:true}));
      if (moves.length === 0) return null;
      if (moves.length === 1) return moves[0];
      const w = g.turn() === "w";
      let best = moves[0], bestScore = w ? -Infinity : Infinity;
      let scored = [];
      for (let d = 1; d <= maxDepth; d++) {
        const arr = [];
        let dBest = null, dScore = w ? -Infinity : Infinity;
        for (const m of moves) {
          if (performance.now() > deadline) break;
          g.move(m.san);
          const v = ab(g, d - 1, -Infinity, Infinity, deadline);
          g.undo();
          arr.push({m, v});
          if (w ? (v > dScore) : (v < dScore)) { dScore = v; dBest = m; }
        }
        if (dBest) { best = dBest; bestScore = dScore; scored = arr; }
        if (performance.now() > deadline) break;
        if (Math.abs(bestScore) > MATE - 100) break;
      }
      // Difficulty modulation: random top-N or chance to blunder
      if (scored.length && (randomTopN > 1 || blunder > 0)) {
        scored.sort((a,b) => w ? b.v - a.v : a.v - b.v);
        if (blunder > 0 && Math.random() < blunder) {
          const pool = scored.slice(0, Math.min(scored.length, 8));
          return pool[Math.floor(Math.random() * pool.length)].m;
        }
        if (randomTopN > 1) {
          const pool = scored.slice(0, Math.min(scored.length, randomTopN));
          return pool[Math.floor(Math.random() * pool.length)].m;
        }
      }
      return best;
    }

    self.onmessage = function (ev) {
      const m = ev.data;
      if (m.type === "init") { self.postMessage({type:"ready"}); return; }
      if (m.type === "go") {
        try {
          const g = new Chess(m.fen);
          const best = findBest(g, m.maxDepth || 4, m.timeMs || 1000, m.randomTopN || 1, m.blunder || 0);
          if (best) self.postMessage({ type:"bestmove", from:best.from, to:best.to, promotion:best.promotion || undefined });
          else self.postMessage({ type:"bestmove", from:null, to:null });
        } catch (err) {
          self.postMessage({ type:"bestmove", from:null, to:null, error:String(err && err.message || err) });
        }
      }
    };
  `;

  function ensureWorker() {
    if (S.worker || S.workerFailed) return S.worker;
    try {
      const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      S.worker = new Worker(url);
      S.worker.onmessage = onWorkerMessage;
      S.worker.onerror = (err) => {
        console.error("[ChessMastery] AI worker error:", err.message || err);
        S.workerFailed = true;
        try { S.worker.terminate(); } catch (_) {}
        S.worker = null;
        // If a request is in flight, resolve it so requestAiMove can fall back.
        if (S.pendingAi) {
          const r = S.pendingAi; S.pendingAi = null;
          r({ from: null, to: null, error: "worker-error" });
        }
      };
      S.worker.postMessage({ type: "init" });
    } catch (e) {
      console.error("[ChessMastery] Worker creation failed:", e);
      S.workerFailed = true;
      S.worker = null;
    }
    return S.worker;
  }

  function onWorkerMessage(ev) {
    const msg = ev.data;
    if (msg.type === "ready") { S.workerReady = true; return; }
    if (msg.type === "bestmove") {
      const r = S.pendingAi; S.pendingAi = null;
      r?.(msg);
    }
  }

  /**
   * Synchronous shallow AI — only used when the Web Worker is unavailable.
   * Fixed-depth alpha-beta on top of chess.js. Runs on the main thread,
   * so we keep depth small to avoid noticeable jank.
   */
  function fallbackBestMove() {
    const game = S.game;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    const score = (g) => {
      let s = 0;
      const b = g.board();
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = b[r][c]; if (!p) continue;
        s += (VAL[p.type] || 0) * (p.color === "w" ? 1 : -1);
      }
      return s;
    };
    const cfg = LEVEL_CONFIG[S.settings.level] || LEVEL_CONFIG[3];
    const depth = Math.min(2, cfg.maxDepth);
    const isWhite = game.turn() === "w";

    const search = (g, d, alpha, beta) => {
      if (d <= 0 || g.game_over()) return score(g);
      const w = g.turn() === "w";
      const list = g.moves({ verbose: true });
      if (w) {
        let best = -Infinity;
        for (const m of list) {
          g.move(m.san);
          const v = search(g, d - 1, alpha, beta);
          g.undo();
          if (v > best) best = v;
          if (v > alpha) alpha = v;
          if (alpha >= beta) break;
        }
        return best;
      }
      let best = Infinity;
      for (const m of list) {
        g.move(m.san);
        const v = search(g, d - 1, alpha, beta);
        g.undo();
        if (v < best) best = v;
        if (v < beta) beta = v;
        if (alpha >= beta) break;
      }
      return best;
    };

    let bestMove = moves[0];
    let bestScore = isWhite ? -Infinity : Infinity;
    const sorted = moves.slice().sort((a, b) => {
      const av = (a.captured ? VAL[a.captured] * 10 : 0) + (a.promotion ? VAL[a.promotion] : 0);
      const bv = (b.captured ? VAL[b.captured] * 10 : 0) + (b.promotion ? VAL[b.promotion] : 0);
      return bv - av;
    });
    for (const m of sorted) {
      game.move(m.san);
      const v = search(game, depth - 1, -Infinity, Infinity);
      game.undo();
      if (isWhite ? v > bestScore : v < bestScore) { bestScore = v; bestMove = m; }
    }
    // For lower levels, occasionally pick a different reasonable move.
    if (cfg.randomTopN > 1 && Math.random() < 0.5) {
      const pool = sorted.slice(0, Math.min(sorted.length, cfg.randomTopN));
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return bestMove;
  }

  function requestAiMove() {
    if (S.aiThinking) return;
    if (S.game.game_over()) return;

    const cfg = LEVEL_CONFIG[S.settings.level] || LEVEL_CONFIG[3];
    const useTime = !!TIME_PRESETS[S.clocks.preset];
    const remaining = useTime ? S.clocks[S.game.turn()] : Number.POSITIVE_INFINITY;
    const budget = Math.max(80, Math.min(cfg.timeMs, useTime ? Math.floor(remaining / 25) : cfg.timeMs));

    S.aiThinking = true;
    E.thinkingDots.hidden = false;
    updateStatus();
    const t0 = performance.now();
    const reqId = ++S.aiReqId;

    const w = ensureWorker();

    if (!w) {
      // No Worker available — use the synchronous fallback after a short
      // yield so the UI gets a chance to repaint the "thinking" indicator.
      setTimeout(() => {
        if (reqId !== S.aiReqId) return;        // stale (newGame, undo, etc.)
        const m = fallbackBestMove();
        if (!m) { playAiMove({ from: null, to: null }); return; }
        playAiMove({ from: m.from, to: m.to, promotion: m.promotion });
      }, 30);
      return;
    }

    // Worker path: race the worker against a hard timeout. If the worker
    // doesn't reply within budget + 4s we fall back to a quick move so the
    // game can never hang.
    const aiPromise = new Promise((resolve) => { S.pendingAi = resolve; });
    const hardTimeout = budget + 4000;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), hardTimeout)
    );

    try {
      w.postMessage({
        type: "go",
        fen: S.game.fen(),
        level: S.settings.level,
        maxDepth: cfg.maxDepth,
        timeMs: budget,
        randomTopN: cfg.randomTopN,
        blunder: cfg.blunder,
      });
    } catch (e) {
      console.error("[ChessMastery] postMessage failed:", e);
      S.workerFailed = true;
      S.pendingAi = null;
      setTimeout(() => {
        const m = fallbackBestMove();
        if (m) playAiMove({ from: m.from, to: m.to, promotion: m.promotion });
        else playAiMove({ from: null, to: null });
      }, 30);
      return;
    }

    Promise.race([aiPromise, timeoutPromise]).then((msg) => {
      // If user started a new game / undid / loaded FEN, drop the result.
      if (reqId !== S.aiReqId) return;
      // If timeout won the race, clean up the resolver and use a quick fallback.
      if (msg && msg.__timeout) {
        console.warn("[ChessMastery] AI worker timed out, using fallback move");
        S.pendingAi = null;
        const m = fallbackBestMove();
        msg = m ? { from: m.from, to: m.to, promotion: m.promotion } : { from: null, to: null };
      }
      // If the worker reported an error, also fall back.
      if (msg && (msg.error || (!msg.from && !msg.__timeout))) {
        if (msg.error) console.warn("[ChessMastery] Worker returned error:", msg.error);
        const m = fallbackBestMove();
        if (m) msg = { from: m.from, to: m.to, promotion: m.promotion };
      }
      // Pad to a minimum think time so it doesn't snap instantly on easy levels.
      const elapsed = performance.now() - t0;
      const minThink = (S.settings.level <= 2) ? 320 : 160;
      const wait = Math.max(0, minThink - elapsed);
      setTimeout(() => {
        if (reqId !== S.aiReqId) return;
        playAiMove(msg);
      }, wait);
    });
  }

  function playAiMove(msg) {
    S.aiThinking = false;
    E.thinkingDots.hidden = true;
    if (S.game.game_over()) { updateStatus(); return; }
    if (!msg || !msg.from || !msg.to) {
      // No move (game over, or worker failure). Try to detect game-over.
      updateStatus();
      if (S.game.game_over()) onGameOver();
      return;
    }
    executeMove({ from: msg.from, to: msg.to, promotion: msg.promotion });
  }

  // ---------- Game lifecycle ----------

  function newGame(opts = {}) {
    stopClocks();
    if (S.aiVsAiTimerId) { clearTimeout(S.aiVsAiTimerId); S.aiVsAiTimerId = null; }
    S.aiThinking = false;
    S.aiReqId++;                   // invalidate any in-flight AI request
    S.pendingAi = null;
    E.thinkingDots.hidden = true;
    S.pendingPromotion = null;
    S.lastMove = null;
    S.selected = null;
    S.legalFromSelected = [];
    S.game = new window.Chess();

    // Resolve random color
    if (S.settings.playerColor === "r") {
      S.settings._resolvedRandom = (Math.random() < 0.5 ? "w" : "b");
    }
    // Initial board orientation based on player color
    if (S.settings.mode === "hva") {
      S.flipped = (resolvedPlayerColor() === "b");
    } else if (S.settings.mode === "hvh") {
      S.flipped = false;
    }

    setClockPreset(S.settings.time);
    buildBoard();
    applyHighlights();
    refreshUiAfterMove();
    updateStatus();
    if (TIME_PRESETS[S.clocks.preset]) startClocks();

    // First move: maybe AI
    scheduleNextTurn();
    persistAutosave();
    if (!opts.silent) showToast("New game started");
  }

  function onGameOver() {
    let title = "Game over", reason = "", icon = "\u265A";
    const turn = S.game.turn();
    if (S.game.in_checkmate()) {
      title = (turn === "w") ? "Black wins" : "White wins";
      reason = "Checkmate.";
      icon = "\u265A";
    } else if (S.game.in_stalemate()) {
      title = "Draw"; reason = "Stalemate."; icon = "\u00BD";
    } else if (S.game.in_threefold_repetition()) {
      title = "Draw"; reason = "Threefold repetition."; icon = "\u00BD";
    } else if (S.game.insufficient_material()) {
      title = "Draw"; reason = "Insufficient material."; icon = "\u00BD";
    } else if (S.game.in_draw()) {
      title = "Draw"; reason = "50-move rule or draw."; icon = "\u00BD";
    }
    playSound("end");
    showResult({ title, reason, icon });
  }

  function showResult({ title, reason }) {
    E.resultTitle.textContent = title;
    E.resultReason.textContent = reason;
    if (typeof E.resultDialog.showModal === "function") E.resultDialog.showModal();
    else E.resultDialog.setAttribute("open", "");
  }

  function closeResult() {
    if (typeof E.resultDialog.close === "function") E.resultDialog.close();
    else E.resultDialog.removeAttribute("open");
  }

  function undoMove() {
    if (S.aiThinking || S.pendingPromotion) return;
    S.aiReqId++;                   // invalidate any pending AI reply
    S.pendingAi = null;
    if (S.settings.mode === "hva") {
      // Undo the player's last move plus the AI response (if any) so it's the player's turn again.
      const undoTwo = (S.game.history().length >= 1 && S.game.turn() === resolvedPlayerColor());
      const turnBefore = S.game.turn();
      S.game.undo();
      if (undoTwo) S.game.undo();
      // ^ we may over-undo by one; ensure we don't undo into AI's move only
      // Recompute: ensure final turn is player's color
      while (S.game.history().length > 0 && S.game.turn() !== resolvedPlayerColor()) {
        S.game.undo();
      }
    } else {
      S.game.undo();
    }
    const hist = S.game.history({ verbose: true });
    S.lastMove = hist.length ? { from: hist[hist.length-1].from, to: hist[hist.length-1].to } : null;
    S.selected = null;
    S.legalFromSelected = [];
    buildBoard();
    applyHighlights();
    refreshUiAfterMove();
    persistAutosave();
  }

  function flipBoard() {
    S.flipped = !S.flipped;
    buildBoard();
    applyHighlights();
  }

  function resignGame() {
    if (S.game.game_over()) return;
    const loser = S.settings.mode === "hva" ? resolvedPlayerColor() : S.game.turn();
    showResult({
      icon: "\uD83C\uDFC1",
      title: (loser === "w") ? "Black wins" : "White wins",
      reason: "Resignation.",
    });
    stopClocks();
    playSound("end");
  }

  // ---------- Save / resume ----------

  function persistAutosave() {
    try {
      const payload = {
        pgn: S.game.pgn(),
        flipped: S.flipped,
        settings: S.settings,
        clocks: { ...S.clocks, lastTickAt: 0 },
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function tryAutoresume() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.pgn) return false;
      Object.assign(S.settings, data.settings || {});
      saveSettings();
      applySettingsToDocument();
      syncSettingsDialogInputs();
      const game = new window.Chess();
      const ok = data.pgn ? game.load_pgn(data.pgn) : true;
      if (!ok) return false;
      S.game = game;
      S.flipped = !!data.flipped;
      S.clocks = Object.assign({ w:0, b:0, preset: S.settings.time }, data.clocks || {});
      buildBoard();
      const hist = S.game.history({ verbose: true });
      S.lastMove = hist.length ? { from: hist[hist.length-1].from, to: hist[hist.length-1].to } : null;
      applyHighlights();
      refreshUiAfterMove();
      updateStatus();
      if (TIME_PRESETS[S.clocks.preset] && !S.game.game_over()) startClocks();
      // If it's AI's move on resume, ask the worker
      scheduleNextTurn();
      return true;
    } catch (e) {
      console.warn("Resume failed", e);
      return false;
    }
  }

  // ---------- PGN / FEN tools ----------

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch (_) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); showToast(`${label} copied`); }
      catch { showToast(`Copy failed`); }
      ta.remove();
    }
  }

  function downloadPgn() {
    const pgn = S.game.pgn({ max_width: 80 });
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess-mastery-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.pgn`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("PGN downloaded");
  }

  function openFenDialog() {
    E.fenInput.value = S.game.fen();
    E.fenError.hidden = true;
    if (typeof E.fenDialog.showModal === "function") E.fenDialog.showModal();
    else E.fenDialog.setAttribute("open", "");
    setTimeout(() => E.fenInput.focus(), 50);
  }

  function applyFenFromDialog() {
    const candidate = E.fenInput.value.trim();
    const probe = new window.Chess();
    if (!probe.load(candidate)) {
      E.fenError.hidden = false;
      E.fenError.textContent = "Invalid FEN string. Please double-check.";
      E.fenError.classList.add("is-error");
      return;
    }
    S.game = probe;
    S.lastMove = null;
    S.selected = null;
    S.legalFromSelected = [];
    buildBoard();
    applyHighlights();
    refreshUiAfterMove();
    updateStatus();
    persistAutosave();
    if (typeof E.fenDialog.close === "function") E.fenDialog.close();
    showToast("Position loaded");
    scheduleNextTurn();
  }

  // ---------- Sounds ----------

  function ensureAudio() {
    if (S.soundCtx) return S.soundCtx;
    try { S.soundCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) { S.soundCtx = null; }
    return S.soundCtx;
  }

  function playSound(kind) {
    if (!S.settings.sound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume?.();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    let dur = 0.08, freq = 440, type = "sine", vol = 0.05;
    switch (kind) {
      case "move":    freq = 380; type = "triangle"; dur = 0.06; vol = 0.04; break;
      case "capture": freq = 220; type = "sawtooth"; dur = 0.10; vol = 0.06; break;
      case "check":   freq = 660; type = "square";   dur = 0.20; vol = 0.05; break;
      case "castle":  freq = 540; type = "triangle"; dur = 0.10; vol = 0.05; break;
      case "promote": freq = 880; type = "sine";     dur = 0.18; vol = 0.05; break;
      case "end":     freq = 320; type = "sine";     dur = 0.5;  vol = 0.06; break;
      default: break;
    }
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  // ---------- Keyboard navigation ----------

  function onBoardKeydown(ev) {
    if (S.pendingPromotion) return;
    const cur = S.keyboardCursor || "e4";
    const f = "abcdefgh".indexOf(cur[0]);
    const r = Number(cur[1]) - 1;
    let nf = f, nr = r;
    switch (ev.key) {
      case "ArrowLeft":  nf = Math.max(0, f - 1); break;
      case "ArrowRight": nf = Math.min(7, f + 1); break;
      case "ArrowDown":  nr = Math.max(0, r - 1); break;
      case "ArrowUp":    nr = Math.min(7, r + 1); break;
      case "Enter":
      case " ":
        ev.preventDefault();
        if (!isHumanTurn()) return;
        if (S.selected) {
          attemptUserMove(S.selected, cur);
        } else {
          const p = S.game.get(cur);
          if (p && p.color === S.game.turn()) selectSquare(cur);
        }
        return;
      case "Escape":
        clearSelection();
        return;
      default: return;
    }
    ev.preventDefault();
    S.keyboardCursor = squareId(nf, nr);
    applyHighlights();
    const cell = E.board.querySelector(`.square[data-id="${S.keyboardCursor}"]`);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // ---------- Settings dialog ----------

  function openSettings() {
    syncSettingsDialogInputs();
    if (typeof E.settingsDialog.showModal === "function") E.settingsDialog.showModal();
    else E.settingsDialog.setAttribute("open", "");
  }
  function closeSettings(applyAndNew) {
    readSettingsFromDialog();
    if (typeof E.settingsDialog.close === "function") E.settingsDialog.close();
    else E.settingsDialog.removeAttribute("open");
    if (applyAndNew) newGame();
    else {
      // Apply non-disruptive changes
      buildBoard();
      applyHighlights();
      refreshUiAfterMove();
      updateStatus();
    }
  }

  // ---------- Bind UI events ----------

  function bindUi() {
    E.newGameBtn.addEventListener("click", () => newGame());
    E.undoBtn.addEventListener("click", undoMove);
    E.flipBtn.addEventListener("click", flipBoard);
    E.resignBtn.addEventListener("click", resignGame);
    E.settingsBtn.addEventListener("click", openSettings);
    E.settingsCloseBtn.addEventListener("click", () => closeSettings(false));
    E.settingsApplyNew.addEventListener("click", () => closeSettings(true));
    E.settingsDialog.addEventListener("close", () => closeSettings(false));
    E.settingsDialog.addEventListener("submit", (e) => { e.preventDefault?.(); closeSettings(false); });

    // Tabs
    E.tabMovesBtn.addEventListener("click", () => switchTab("moves"));
    E.tabToolsBtn.addEventListener("click", () => switchTab("tools"));

    // Tools
    E.copyFenBtn.addEventListener("click", () => copyToClipboard(S.game.fen(), "FEN"));
    E.copyPgnBtn.addEventListener("click", () => copyToClipboard(S.game.pgn(), "PGN"));
    E.downloadPgnBtn.addEventListener("click", downloadPgn);
    E.loadFenBtn.addEventListener("click", openFenDialog);
    E.fenLoadConfirmBtn.addEventListener("click", applyFenFromDialog);
    E.fenDialogCloseBtn.addEventListener("click", () => {
      if (typeof E.fenDialog.close === "function") E.fenDialog.close();
    });
    E.saveBtn.addEventListener("click", () => { persistAutosave(); showToast("Game saved"); });
    E.loadSaveBtn.addEventListener("click", () => {
      if (tryAutoresume()) showToast("Game resumed");
      else showToast("No saved game found");
    });
    E.clearSaveBtn.addEventListener("click", () => {
      try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
      showToast("Saved game cleared");
    });

    // Result dialog
    E.resultRematchBtn.addEventListener("click", () => { closeResult(); newGame(); });
    E.resultReviewBtn.addEventListener("click", () => { closeResult(); showToast("Use the Tools panel to review"); });
    E.resultCloseBtn.addEventListener("click", closeResult);

    // Sound toggle
    E.soundToggle.addEventListener("click", () => {
      S.settings.sound = !S.settings.sound;
      saveSettings();
      applySettingsToDocument();
      if (S.settings.sound) { ensureAudio(); playSound("move"); }
      showToast(`Sound ${S.settings.sound ? "on" : "off"}`);
    });

    // Resize → rebuild coordinates positioning of promo popover (just rebuild on orientation change)
    window.addEventListener("resize", () => {
      if (!E.promoPopover.hidden) {
        const cell = E.board.querySelector(`.square[data-id="${S.pendingPromotion?.to}"]`);
        if (cell) positionPromoPopover(cell);
      }
    });

    // Click on dialog backdrop to close (settings, fen)
    [E.settingsDialog, E.fenDialog].forEach((dlg) => {
      dlg?.addEventListener("click", (ev) => {
        const card = dlg.querySelector(".dialog-form");
        if (card && !card.contains(ev.target)) {
          if (typeof dlg.close === "function") dlg.close();
        }
      });
    });
  }

  function switchTab(name) {
    const isMoves = name === "moves";
    E.tabMovesBtn.classList.toggle("is-active", isMoves);
    E.tabToolsBtn.classList.toggle("is-active", !isMoves);
    E.tabMovesBtn.setAttribute("aria-selected", String(isMoves));
    E.tabToolsBtn.setAttribute("aria-selected", String(!isMoves));
    $("tab-moves").hidden = !isMoves;
    $("tab-tools").hidden = isMoves;
    $("tab-moves").classList.toggle("is-active", isMoves);
    $("tab-tools").classList.toggle("is-active", !isMoves);
  }

  // ---------- Init ----------

  function init() {
    if (typeof window.Chess !== "function") {
      console.error("chess.js not loaded");
      document.body.innerHTML = '<p style="padding:2rem;color:#fff;text-align:center">Failed to load chess engine. Please refresh.</p>';
      return;
    }
    cacheElements();
    applySettingsToDocument();
    syncSettingsDialogInputs();
    bindUi();
    ensureWorker();

    if (!tryAutoresume()) {
      newGame({ silent: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
