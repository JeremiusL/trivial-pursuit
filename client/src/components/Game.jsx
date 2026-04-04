import { useState, useEffect, useMemo, useCallback } from 'react';
import socket from '../socket';
import { buildBoard, CATEGORIES, CATEGORY_IDS, getCategoryColor, getCategoryName } from '../boardConfig';
import Board from './Board';
import Question from './Question';

function PlayerPanel({ player, index, isCurrentTurn }) {
  const color = index === 0 ? '#e74c3c' : '#3498db';
  const completed = CATEGORY_IDS.filter(c => player.categories[c]).length;

  return (
    <div className={`player-panel ${isCurrentTurn ? 'active-turn' : ''}`} style={{ borderColor: color }}>
      <div className="panel-header" style={{ backgroundColor: color }}>{player.username}</div>
      <div className="panel-body">
        <div className="wedge-list">
          {CATEGORIES.map(cat => (
            <div
              key={cat.id}
              className={`wedge-item ${player.categories[cat.id] ? 'earned' : ''}`}
            >
              <span className="wedge-dot" style={{ backgroundColor: player.categories[cat.id] ? cat.color : '#ddd' }} />
              <span className="wedge-name">{cat.name}</span>
            </div>
          ))}
        </div>
        <div className="wedge-count">{completed}/6 categories</div>
      </div>
    </div>
  );
}

export default function Game({ initialState, playerId }) {
  const { positions, adjacency, CX, CY, OUTER_RADIUS, CENTER_RADIUS, SQUARE_SIZE } = useMemo(() => buildBoard(), []);

  const [players, setPlayers] = useState(initialState.players);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(initialState.currentPlayerIndex);
  const [phase, setPhase] = useState(initialState.phase);
  const [diceValue, setDiceValue] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [winner, setWinner] = useState(null);
  const [notification, setNotification] = useState(`Game started! ${initialState.players[0].username} goes first.`);
  const [showCategoryChooser, setShowCategoryChooser] = useState(false);
  const [phase2Challenge, setPhase2Challenge] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  const isMyTurn = players[currentPlayerIndex]?.id === playerId;
  const myIndex = players.findIndex(p => p.id === playerId);
  const opponentIndex = myIndex === 0 ? 1 : 0;

  const updateFromServer = useCallback((data) => {
    if (data.players) setPlayers(data.players);
    if (data.currentPlayerIndex !== undefined) setCurrentPlayerIndex(data.currentPlayerIndex);
    if (data.phase) setPhase(data.phase);
    if (data.winner !== undefined) setWinner(data.winner);
  }, []);

  useEffect(() => {
    const onDiceRolled = (data) => {
      updateFromServer(data);
      setDiceValue(data.diceValue);
      setValidMoves(data.validMoves || []);
      const roller = data.players[data.currentPlayerIndex].username;
      if (data.diceValue === 6) {
        setNotification(`${roller} rolled a 6! Can move to any square.`);
      } else {
        setNotification(`${roller} rolled a ${data.diceValue}.`);
      }
    };

    const onPlayerMoved = (data) => {
      updateFromServer(data);
      setValidMoves([]);
      setDiceValue(null);
      const mover = data.players[data.currentPlayerIndex].username;
      const iAmCurrent = data.players[data.currentPlayerIndex].id === playerId;

      if (data.rollAgain) {
        setNotification(`${mover} landed on Roll Again!`);
      } else if (data.chooseCategory) {
        if (iAmCurrent) {
          setShowCategoryChooser(true);
          setNotification('You landed on the center! Choose a category.');
        } else {
          setNotification(`${mover} is choosing a category...`);
        }
      } else if (data.phase2) {
        setPhase2Challenge(true);
        if (!iAmCurrent) {
          setNotification(`${mover} is attempting to win! Pick a category for them.`);
        } else {
          setNotification('You reached the center with all wedges! Opponent picks your category...');
        }
      }
    };

    const onQuestion = (data) => {
      updateFromServer(data);
      setShowCategoryChooser(false);
      setPhase2Challenge(false);
      setQuestion({ question: data.question, options: data.options, category: data.category });
      setAnswerResult(null);
      const answerer = data.players[data.currentPlayerIndex].username;
      setNotification(`${answerer} must answer a ${getCategoryName(data.category)} question.`);
    };

    const onAnswerResult = (data) => {
      const correctIdx = data.options
        ? data.options.indexOf(data.correctAnswer)
        : null;
      setAnswerResult({
        correct: data.correct,
        correctAnswer: data.correctAnswer,
        correctIndex: correctIdx,
        selectedIndex: null, // will be set by local handler
      });

      if (data.gameOver) {
        setTimeout(() => {
          updateFromServer(data);
          setQuestion(null);
          setAnswerResult(null);
          setWinner(data.winner);
          setNotification(`${data.winner} wins the game!`);
        }, 2500);
      } else {
        let msg;
        if (!data.correct) {
          msg = `Wrong! The answer was: ${data.correctAnswer}. ${data.players[data.currentPlayerIndex]?.username || 'Next player'}'s turn.`;
        } else if (data.earnedNew) {
          msg = `Correct! New wedge earned! ${data.players[data.currentPlayerIndex]?.username || 'Player'} rolls again.`;
        } else {
          msg = `Correct! But already had that category. ${data.players[data.currentPlayerIndex]?.username || 'Next player'}'s turn.`;
        }
        setTimeout(() => {
          updateFromServer(data);
          setQuestion(null);
          setAnswerResult(null);
          setDiceValue(null);
          setNotification(msg);
        }, 2500);
      }
    };

    const onGameStarted = (data) => {
      updateFromServer(data);
      setDiceValue(null);
      setValidMoves([]);
      setQuestion(null);
      setAnswerResult(null);
      setWinner(null);
      setShowCategoryChooser(false);
      setPhase2Challenge(false);
      setNotification(`Game started! ${data.players[0].username} goes first.`);
    };

    const onDisconnected = () => {
      setDisconnected(true);
      setNotification('Opponent disconnected.');
    };

    socket.on('dice-rolled', onDiceRolled);
    socket.on('player-moved', onPlayerMoved);
    socket.on('question', onQuestion);
    socket.on('answer-result', onAnswerResult);
    socket.on('game-started', onGameStarted);
    socket.on('player-disconnected', onDisconnected);

    return () => {
      socket.off('dice-rolled', onDiceRolled);
      socket.off('player-moved', onPlayerMoved);
      socket.off('question', onQuestion);
      socket.off('answer-result', onAnswerResult);
      socket.off('game-started', onGameStarted);
      socket.off('player-disconnected', onDisconnected);
    };
  }, [playerId, updateFromServer]);

  const handleRollDice = () => {
    socket.emit('roll-dice');
  };

  const handleSquareClick = (posId) => {
    if (phase === 'moving' && isMyTurn && validMoves.includes(posId)) {
      socket.emit('move-player', posId);
    }
  };

  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const handleAnswer = (index) => {
    if (!isMyTurn || answerResult) return;
    setSelectedAnswer(index);
    setAnswerResult(prev => prev ? { ...prev, selectedIndex: index } : null);
    socket.emit('answer-question', index);
  };

  const handleChooseCategory = (cat) => {
    socket.emit('choose-category', cat);
    setShowCategoryChooser(false);
  };

  const handlePhase2Pick = (cat) => {
    socket.emit('choose-category', cat);
    setPhase2Challenge(false);
  };

  const handleRematch = () => {
    socket.emit('rematch');
  };

  const handleHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="game-container">
      {/* Notification bar */}
      <div className="notification-bar">{notification}</div>

      <div className="game-layout">
        {/* Player panels */}
        <PlayerPanel
          player={players[0]}
          index={0}
          isCurrentTurn={currentPlayerIndex === 0}
        />

        {/* Board + controls */}
        <div className="board-area">
          <Board
            positions={positions}
            players={players}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            CX={CX}
            CY={CY}
            OUTER_RADIUS={OUTER_RADIUS}
            CENTER_RADIUS={CENTER_RADIUS}
            SQUARE_SIZE={SQUARE_SIZE}
          />
          <div className="dice-area">
            {diceValue && (
              <div className="dice-result">
                <span className="dice-icon">🎲</span> {diceValue === 6 ? '6 — Move anywhere!' : diceValue}
              </div>
            )}
            {phase === 'rolling' && isMyTurn && !winner && (
              <button onClick={handleRollDice} className="btn btn-dice">Roll Dice</button>
            )}
            {phase === 'rolling' && !isMyTurn && !winner && (
              <div className="waiting-turn">Waiting for {players[currentPlayerIndex]?.username}...</div>
            )}
            {phase === 'moving' && isMyTurn && (
              <div className="instruction">Click a highlighted square to move</div>
            )}
          </div>
        </div>

        <PlayerPanel
          player={players[1]}
          index={1}
          isCurrentTurn={currentPlayerIndex === 1}
        />
      </div>

      {/* Category chooser modal (center square) */}
      {showCategoryChooser && (
        <div className="modal-overlay">
          <div className="category-modal">
            <h3>Choose a Category</h3>
            <div className="category-buttons">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleChooseCategory(cat.id)}
                  className="category-btn"
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 challenge: opponent picks category */}
      {phase2Challenge && !isMyTurn && players[currentPlayerIndex] && (
        <div className="modal-overlay">
          <div className="category-modal">
            <h3>Pick a category for {players[currentPlayerIndex].username}!</h3>
            <p className="modal-subtitle">They must answer correctly to win the game.</p>
            <div className="category-buttons">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handlePhase2Pick(cat.id)}
                  className="category-btn"
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase2Challenge && isMyTurn && (
        <div className="modal-overlay">
          <div className="category-modal">
            <h3>Waiting for opponent to pick your category...</h3>
          </div>
        </div>
      )}

      {/* Question modal */}
      {question && (
        <Question
          question={question.question}
          options={question.options}
          category={question.category}
          onAnswer={handleAnswer}
          canAnswer={isMyTurn}
          answerResult={answerResult}
        />
      )}

      {/* Game over */}
      {winner && (
        <div className="modal-overlay">
          <div className="gameover-modal">
            <h2>{winner} wins!</h2>
            <p>Congratulations!</p>
            <div className="gameover-buttons">
              <button onClick={handleRematch} className="btn btn-primary">Rematch</button>
              <button onClick={handleHome} className="btn btn-secondary">Home</button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect */}
      {disconnected && (
        <div className="modal-overlay">
          <div className="gameover-modal">
            <h2>Opponent Disconnected</h2>
            <button onClick={handleHome} className="btn btn-primary">Back to Home</button>
          </div>
        </div>
      )}
    </div>
  );
}
