const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' },
});

// Load all question decks (keyed by difficulty)
const allQuestions = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf-8')
);

// --- Board data (mirrors client boardConfig.js) ---
const CATEGORY_IDS = ['history', 'geography', 'science', 'sports', 'literature', 'cinema'];

const ARM_CATEGORIES = [
  ['history', 'geography', 'science'],
  ['sports', 'literature', 'cinema'],
  ['cinema', 'history', 'literature'],
  ['geography', 'science', 'sports'],
  ['literature', 'sports', 'history'],
  ['science', 'cinema', 'geography'],
];

// Position -> category mapping
const positionCategories = {};
positionCategories[0] = 'center';
for (let arm = 0; arm < 6; arm++) {
  for (let sq = 0; sq < 3; sq++) {
    positionCategories[1 + arm * 3 + sq] = ARM_CATEGORIES[arm][sq];
  }
}
for (let i = 0; i < 24; i++) {
  const id = 19 + i;
  if (i % 4 === 0) {
    positionCategories[id] = CATEGORY_IDS[i / 4];
  } else if (i % 4 === 2) {
    positionCategories[id] = 'roll_again';
  } else if (i % 4 === 1) {
    positionCategories[id] = CATEGORY_IDS[(Math.floor(i / 4) + 2) % 6];
  } else {
    positionCategories[id] = CATEGORY_IDS[(Math.floor(i / 4) + 3) % 6];
  }
}

// Adjacency list
const adjacency = {};
for (let i = 0; i < 43; i++) adjacency[i] = [];

for (let arm = 0; arm < 6; arm++) {
  const first = 1 + arm * 3;
  adjacency[0].push(first);
  adjacency[first].push(0);
  for (let sq = 0; sq < 2; sq++) {
    const a = 1 + arm * 3 + sq;
    const b = a + 1;
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  const lastArm = 1 + arm * 3 + 2;
  const hq = 19 + arm * 4;
  adjacency[lastArm].push(hq);
  adjacency[hq].push(lastArm);
}
for (let i = 0; i < 24; i++) {
  const a = 19 + i;
  const b = 19 + (i + 1) % 24;
  adjacency[a].push(b);
  adjacency[b].push(a);
}
for (const key in adjacency) {
  adjacency[key] = [...new Set(adjacency[key])];
}

// Find all squares reachable in exactly `steps` moves (no revisiting)
function findValidMoves(startPos, diceValue) {
  if (diceValue === 6) {
    return Array.from({ length: 43 }, (_, i) => i).filter(i => i !== startPos);
  }
  const result = new Set();
  function dfs(pos, remaining, visited) {
    if (remaining === 0) {
      result.add(pos);
      return;
    }
    for (const neighbor of adjacency[pos]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        dfs(neighbor, remaining - 1, visited);
        visited.delete(neighbor);
      }
    }
  }
  dfs(startPos, diceValue, new Set([startPos]));
  return Array.from(result);
}

// --- Lobby management ---
const lobbies = {};

function generateLobbyId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getQuestion(category, difficulty, usedQuestions) {
  const deck = allQuestions[difficulty];
  if (!deck) return null;
  const pool = deck[category];
  if (!pool) return null;
  const key = `${difficulty}_${category}`;
  const used = usedQuestions[key] || [];
  let available = pool.map((q, i) => ({ ...q, index: i })).filter(q => !used.includes(q.index));
  if (available.length === 0) {
    usedQuestions[key] = [];
    available = pool.map((q, i) => ({ ...q, index: i }));
  }
  return available[Math.floor(Math.random() * available.length)];
}

function sanitizedState(lobby) {
  return {
    players: lobby.players.map(p => ({
      id: p.id,
      username: p.username,
      position: p.position,
      categories: { ...p.categories },
      isHost: p.isHost,
    })),
    currentPlayerIndex: lobby.currentPlayerIndex,
    phase: lobby.phase,
    diceValue: lobby.diceValue,
    winner: lobby.winner,
    difficulty: lobby.difficulty,
  };
}

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create-lobby', (username, cb) => {
    const lobbyId = generateLobbyId();
    lobbies[lobbyId] = {
      id: lobbyId,
      players: [
        { id: socket.id, username, position: 0, categories: {}, isHost: true },
      ],
      currentPlayerIndex: 0,
      phase: 'waiting',
      difficulty: 'medium',
      gameMode: 'rapid',
      diceValue: null,
      validMoves: [],
      currentQuestion: null,
      winner: null,
      usedQuestions: {},
      phase2Attempt: false,
    };
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    cb({ lobbyId, playerId: socket.id });
    io.to(lobbyId).emit('lobby-update', {
      players: lobbies[lobbyId].players.map(p => ({
        id: p.id,
        username: p.username,
        isHost: p.isHost,
      })),
      canStart: false,
      difficulty: 'medium',
      gameMode: 'rapid',
    });
  });

  socket.on('join-lobby', (lobbyId, username, cb) => {
    const lobby = lobbies[lobbyId];
    if (!lobby) return cb({ error: 'Lobby not found' });
    if (lobby.players.length >= 2) return cb({ error: 'Lobby is full' });

    lobby.players.push({
      id: socket.id,
      username,
      position: 0,
      categories: {},
      isHost: false,
    });
    socket.join(lobbyId);
    socket.lobbyId = lobbyId;
    cb({ lobbyId, playerId: socket.id });
    io.to(lobbyId).emit('lobby-update', {
      players: lobby.players.map(p => ({ id: p.id, username: p.username, isHost: p.isHost })),
      canStart: lobby.players.length === 2,
      difficulty: lobby.difficulty,
      gameMode: lobby.gameMode,
    });
  });

  socket.on('get-lobby-state', () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;
    socket.emit('lobby-update', {
      players: lobby.players.map(p => ({ id: p.id, username: p.username, isHost: p.isHost })),
      canStart: lobby.players.length === 2,
      difficulty: lobby.difficulty,
      gameMode: lobby.gameMode,
    });
  });

  socket.on('set-game-mode', (mode) => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) return;
    if (!['rapid', 'slow'].includes(mode)) return;

    lobby.gameMode = mode;
    io.to(lobby.id).emit('lobby-update', {
      players: lobby.players.map(p => ({ id: p.id, username: p.username, isHost: p.isHost })),
      canStart: lobby.players.length === 2,
      difficulty: lobby.difficulty,
      gameMode: lobby.gameMode,
    });
  });

  socket.on('set-difficulty', (difficulty) => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) return;
    if (!['easy', 'medium', 'hard', 'impossible'].includes(difficulty)) return;

    lobby.difficulty = difficulty;
    io.to(lobby.id).emit('lobby-update', {
      players: lobby.players.map(p => ({ id: p.id, username: p.username, isHost: p.isHost })),
      canStart: lobby.players.length === 2,
      difficulty: lobby.difficulty,
      gameMode: lobby.gameMode,
    });
  });

  socket.on('start-game', () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;
    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.isHost || lobby.players.length < 2) return;

    lobby.phase = 'rolling';
    lobby.currentPlayerIndex = 0;
    io.to(lobby.id).emit('game-started', sanitizedState(lobby));
  });

  socket.on('roll-dice', () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby || lobby.phase !== 'rolling') return;
    if (lobby.players[lobby.currentPlayerIndex].id !== socket.id) return;

    const diceValue = Math.floor(Math.random() * 6) + 1;
    lobby.diceValue = diceValue;
    lobby.validMoves = findValidMoves(
      lobby.players[lobby.currentPlayerIndex].position,
      diceValue
    );
    lobby.phase = 'moving';

    io.to(lobby.id).emit('dice-rolled', {
      diceValue,
      validMoves: lobby.validMoves,
      ...sanitizedState(lobby),
    });
  });

  socket.on('move-player', (targetPos) => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby || lobby.phase !== 'moving') return;
    const current = lobby.players[lobby.currentPlayerIndex];
    if (current.id !== socket.id) return;
    if (!lobby.validMoves.includes(targetPos)) return;

    current.position = targetPos;
    lobby.validMoves = [];
    lobby.diceValue = null;

    const category = positionCategories[targetPos];

    // Roll-again square
    if (category === 'roll_again') {
      lobby.phase = 'rolling';
      io.to(lobby.id).emit('player-moved', {
        rollAgain: true,
        ...sanitizedState(lobby),
      });
      return;
    }

    // Center square
    if (category === 'center') {
      const hasAll = CATEGORY_IDS.every(c => current.categories[c]);
      if (hasAll) {
        lobby.phase = 'phase2Challenge';
        lobby.phase2Attempt = true;
        io.to(lobby.id).emit('player-moved', {
          phase2: true,
          ...sanitizedState(lobby),
        });
      } else {
        lobby.phase = 'choosingCategory';
        io.to(lobby.id).emit('player-moved', {
          chooseCategory: true,
          ...sanitizedState(lobby),
        });
      }
      return;
    }

    // Regular category square -> send question
    sendQuestion(lobby, category);
  });

  socket.on('choose-category', (category) => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby || !CATEGORY_IDS.includes(category)) return;

    if (lobby.phase === 'choosingCategory') {
      if (lobby.players[lobby.currentPlayerIndex].id !== socket.id) return;
      sendQuestion(lobby, category);
    } else if (lobby.phase === 'phase2Challenge') {
      const opponentIdx = (lobby.currentPlayerIndex + 1) % 2;
      if (lobby.players[opponentIdx].id !== socket.id) return;
      sendQuestion(lobby, category);
    }
  });

  socket.on('answer-question', (answerIndex) => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby || lobby.phase !== 'answering') return;
    const current = lobby.players[lobby.currentPlayerIndex];
    if (current.id !== socket.id) return;
    if (typeof answerIndex !== 'number') return;

    const correct = answerIndex === lobby.currentQuestion.answer;
    const category = lobby.currentQuestion.category;
    const correctAnswer = lobby.currentQuestion.options[lobby.currentQuestion.answer];
    lobby.currentQuestion = null;

    if (correct) {
      if (lobby.phase2Attempt) {
        lobby.winner = current.username;
        lobby.phase = 'gameOver';
        io.to(lobby.id).emit('answer-result', {
          correct: true,
          correctAnswer,
          category,
          gameOver: true,
          ...sanitizedState(lobby),
        });
        return;
      }

      const earnedNew = !current.categories[category];
      if (earnedNew) {
        current.categories[category] = true;
      }
      lobby.phase2Attempt = false;
      // Rapid: always keep turn on correct. Slow: only if earned new wedge.
      const keepTurn = lobby.gameMode === 'rapid' ? true : earnedNew;
      if (!keepTurn) {
        lobby.currentPlayerIndex = (lobby.currentPlayerIndex + 1) % 2;
      }
      lobby.phase = 'rolling';
      io.to(lobby.id).emit('answer-result', {
        correct: true,
        correctAnswer,
        category,
        earnedNew,
        ...sanitizedState(lobby),
      });
    } else {
      lobby.phase2Attempt = false;
      lobby.currentPlayerIndex = (lobby.currentPlayerIndex + 1) % 2;
      lobby.phase = 'rolling';
      io.to(lobby.id).emit('answer-result', {
        correct: false,
        correctAnswer,
        category,
        ...sanitizedState(lobby),
      });
    }
  });

  socket.on('rematch', () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;
    lobby.players.forEach(p => {
      p.position = 0;
      p.categories = {};
    });
    lobby.currentPlayerIndex = 0;
    lobby.phase = 'rolling';
    lobby.diceValue = null;
    lobby.validMoves = [];
    lobby.currentQuestion = null;
    lobby.winner = null;
    lobby.usedQuestions = {};
    lobby.phase2Attempt = false;
    io.to(lobby.id).emit('game-started', sanitizedState(lobby));
  });

  socket.on('disconnect', () => {
    const lobbyId = socket.lobbyId;
    if (lobbyId && lobbies[lobbyId]) {
      io.to(lobbyId).emit('player-disconnected');
      delete lobbies[lobbyId];
    }
  });

  function sendQuestion(lobby, category) {
    const q = getQuestion(category, lobby.difficulty, lobby.usedQuestions);
    const key = `${lobby.difficulty}_${category}`;
    if (!lobby.usedQuestions[key]) lobby.usedQuestions[key] = [];
    lobby.usedQuestions[key].push(q.index);

    lobby.currentQuestion = {
      question: q.question,
      options: q.options,
      answer: q.answer,
      category,
    };
    lobby.phase = 'answering';

    io.to(lobby.id).emit('question', {
      question: q.question,
      options: q.options,
      category,
      ...sanitizedState(lobby),
    });
  }
});

// Serve built client in production
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Trivial Pursuit server running on http://localhost:${PORT}`);
});
