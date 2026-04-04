import { useState, useEffect } from 'react';
import socket from '../socket';

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: '#2ecc71' },
  { id: 'medium', label: 'Medium', color: '#f39c12' },
  { id: 'hard', label: 'Hard', color: '#e74c3c' },
  { id: 'impossible', label: 'Impossible', color: '#8e44ad' },
];

export default function Lobby({ lobbyId, onGameStart }) {
  const [players, setPlayers] = useState([]);
  const [canStart, setCanStart] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');

  const shareLink = `${window.location.origin}?lobby=${lobbyId}`;

  useEffect(() => {
    const handleLobbyUpdate = (data) => {
      setPlayers(data.players);
      setCanStart(data.canStart);
      const me = data.players.find(p => p.id === socket.id);
      setIsHost(me?.isHost === true);
      if (data.difficulty) setDifficulty(data.difficulty);
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
