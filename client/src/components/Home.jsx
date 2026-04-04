import { useState } from 'react';

export default function Home({ onCreateGame }) {
  const [username, setUsername] = useState('');

  const handleCreate = () => {
    if (username.trim()) onCreateGame(username.trim());
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
      </div>
    </div>
  );
}
