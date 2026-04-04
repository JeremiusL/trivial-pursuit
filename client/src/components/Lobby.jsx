import { useState, useEffect } from 'react';
import socket from '../socket';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: '#2ecc71' },
  { id: 'medium', label: 'Medium', color: '#f39c12' },
  { id: 'hard', label: 'Hard', color: '#e74c3c' },
  { id: 'impossible', label: 'Impossible', color: '#8e44ad' },
];

const GAME_MODES = [
  { id: 'rapid', label: 'Rapid', color: '#e74c3c', desc: 'Correct answer = roll again' },
  { id: 'slow', label: 'Slow', color: '#3498db', desc: 'Only roll again if you earn a new wedge' },
];

const WIN_CONDITIONS = [
  { id: 'normal', label: 'Normal', color: '#2ecc71', desc: 'Reach center with all wedges, answer 1 question to win' },
  { id: 'challenge', label: 'Challenge', color: '#e67e22', desc: 'Reach center with all wedges, answer 4/6 category questions to win' },
];

export default function Lobby({ lobbyId, onGameStart }) {
  const [players, setPlayers] = useState([]);
  const [canStart, setCanStart] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [gameMode, setGameMode] = useState('rapid');
  const [winCondition, setWinCondition] = useState('normal');

  const shareLink = `${window.location.origin}?lobby=${lobbyId}`;

  useEffect(() => {
    const handleLobbyUpdate = (data) => {
      setPlayers(data.players);
      setCanStart(data.canStart);
      const me = data.players.find(p => p.id === socket.id);
      setIsHost(me?.isHost === true);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.gameMode) setGameMode(data.gameMode);
      if (data.winCondition) setWinCondition(data.winCondition);
    };

    const handleGameStarted = (data) => {
      onGameStart(data);
    };

    socket.on('lobby-update', handleLobbyUpdate);
    socket.on('game-started', handleGameStarted);

    // Request current lobby state (in case lobby-update was emitted before mount)
    socket.emit('get-lobby-state');

    return () => {
      socket.off('lobby-update', handleLobbyUpdate);
      socket.off('game-started', handleGameStarted);
    };
  }, [onGameStart]);

  const handleStart = () => {
    socket.emit('start-game');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
  };

  const handleDifficulty = (diff) => {
    if (!isHost) return;
    socket.emit('set-difficulty', diff);
  };

  const handleGameMode = (mode) => {
    if (!isHost) return;
    socket.emit('set-game-mode', mode);
  };

  const handleWinCondition = (condition) => {
    if (!isHost) return;
    socket.emit('set-win-condition', condition);
  };

  return (
    <div className="lobby-page">
      <h2>Game Lobby</h2>
      <div className="lobby-code">
        <span className="label">Lobby Code:</span>
        <span className="code">{lobbyId}</span>
      </div>
      <div className="lobby-link">
        <input type="text" value={shareLink} readOnly className="input-field" />
        <button onClick={handleCopy} className="btn btn-secondary">Copy Link</button>
      </div>

      <div className="difficulty-section">
        <h3>Question Difficulty</h3>
        <div className="difficulty-options">
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              onClick={() => handleDifficulty(d.id)}
              className={`difficulty-btn ${difficulty === d.id ? 'active' : ''}`}
              style={{
                borderColor: difficulty === d.id ? d.color : '#444',
                color: difficulty === d.id ? d.color : '#999',
                backgroundColor: difficulty === d.id ? d.color + '22' : 'transparent',
              }}
              disabled={!isHost}
            >
              {d.label}
            </button>
          ))}
        </div>
        {!isHost && <p className="difficulty-note">Only the host can change difficulty</p>}
      </div>

      <div className="difficulty-section">
        <h3>Game Mode</h3>
        <div className="difficulty-options">
          {GAME_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleGameMode(m.id)}
              className={`difficulty-btn ${gameMode === m.id ? 'active' : ''}`}
              style={{
                borderColor: gameMode === m.id ? m.color : '#444',
                color: gameMode === m.id ? m.color : '#999',
                backgroundColor: gameMode === m.id ? m.color + '22' : 'transparent',
              }}
              disabled={!isHost}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="difficulty-note" style={{ color: '#888' }}>
          {GAME_MODES.find(m => m.id === gameMode)?.desc}
        </p>
        {!isHost && <p className="difficulty-note">Only the host can change game mode</p>}
      </div>

      <div className="difficulty-section">
        <h3>Win Condition</h3>
        <div className="difficulty-options">
          {WIN_CONDITIONS.map(w => (
            <button
              key={w.id}
              onClick={() => handleWinCondition(w.id)}
              className={`difficulty-btn ${winCondition === w.id ? 'active' : ''}`}
              style={{
                borderColor: winCondition === w.id ? w.color : '#444',
                color: winCondition === w.id ? w.color : '#999',
                backgroundColor: winCondition === w.id ? w.color + '22' : 'transparent',
              }}
              disabled={!isHost}
            >
              {w.label}
            </button>
          ))}
        </div>
        <p className="difficulty-note" style={{ color: '#888' }}>
          {WIN_CONDITIONS.find(w => w.id === winCondition)?.desc}
        </p>
        {!isHost && <p className="difficulty-note">Only the host can change win condition</p>}
      </div>

      <div className="player-list">
        <h3>Players</h3>
        {players.map((p, i) => (
          <div key={i} className="player-item">
            <span className="player-dot" style={{ background: i === 0 ? '#e74c3c' : '#3498db' }} />
            {p.username} {p.isHost && '(Host)'}
          </div>
        ))}
        {players.length < 2 && (
          <div className="player-item waiting">Waiting for player 2...</div>
        )}
      </div>
      {isHost && (
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="btn btn-primary"
        >
          {canStart ? 'Start Game' : 'Waiting for players...'}
        </button>
      )}
      {!isHost && players.length > 0 && (
        <p className="waiting-text">Waiting for host to start the game...</p>
      )}
    </div>
  );
}
