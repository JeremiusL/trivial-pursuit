import { useState } from 'react';

export default function Home({ onCreateGame, onJoinByCode }) {
  const [username, setUsername] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');

  const handleCreate = () => {
    if (username.trim()) onCreateGame(username.trim());
  };

  const handleJoin = () => {
    if (username.trim() && lobbyCode.trim()) {
      onJoinByCode(username.trim(), lobbyCode.trim().toUpperCase());
    }
  };

  return (
    <div className="home-page">
      <h1 className="game-title">Trivial Pursuit</h1>
      <p className="game-subtitle">Online Edition</p>
      <div className="home-form">
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          maxLength={20}
          className="input-field"
        />
        <button
          onClick={handleCreate}
          disabled={!username.trim()}
          className="btn btn-primary"
        >
          Create 2-Player Game
        </button>

        <div className="join-divider">or</div>

        <input
          type="text"
          placeholder="Enter lobby code"
          value={lobbyCode}
          onChange={e => setLobbyCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={6}
          className="input-field"
        />
        <button
          onClick={handleJoin}
          disabled={!username.trim() || !lobbyCode.trim()}
          className="btn btn-secondary"
        >
          Join Game
        </button>
      </div>
    </div>
  );
}
