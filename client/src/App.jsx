import { useState, useEffect } from 'react';
import socket from './socket';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './App.css';

export default function App() {
  const [page, setPage] = useState('home');
  const [lobbyId, setLobbyId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [joinMode, setJoinMode] = useState(false);
  const [joinUsername, setJoinUsername] = useState('');
  const [error, setError] = useState('');

  // Check URL for lobby invite
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lobbyFromUrl = params.get('lobby');
    if (lobbyFromUrl) {
      setLobbyId(lobbyFromUrl);
      setJoinMode(true);
    }
  }, []);

  const handleCreateGame = (username) => {
    socket.emit('create-lobby', username, (response) => {
      if (response.error) {
        setError(response.error);
        return;
      }
      setLobbyId(response.lobbyId);
      setPlayerId(response.playerId);
      setPage('lobby');
    });
  };

  const handleJoinGame = () => {
    if (!joinUsername.trim()) return;
    socket.emit('join-lobby', lobbyId, joinUsername.trim(), (response) => {
      if (response.error) {
        setError(response.error);
        return;
      }
      setPlayerId(response.playerId);
      setJoinMode(false);
      setPage('lobby');
      window.history.replaceState({}, '', '/');
    });
  };

  const handleJoinByCode = (username, code) => {
    socket.emit('join-lobby', code, username, (response) => {
      if (response.error) {
        setError(response.error);
        return;
      }
      setLobbyId(response.lobbyId);
      setPlayerId(response.playerId);
      setError('');
      setPage('lobby');
    });
  };

  const handleGameStart = (state) => {
    setGameState(state);
    setPage('game');
  };

  if (joinMode) {
    return (
      <div className="app">
        <div className="join-page">
          <h1 className="game-title">Trivial Pursuit</h1>
          <h2>Join Game</h2>
          <p>Lobby: <strong>{lobbyId}</strong></p>
          {error && <p className="error-text">{error}</p>}
          <input
            type="text"
            placeholder="Enter your username"
            value={joinUsername}
            onChange={e => setJoinUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinGame()}
            maxLength={20}
            className="input-field"
          />
          <button
            onClick={handleJoinGame}
            disabled={!joinUsername.trim()}
            className="btn btn-primary"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {error && <p className="error-text">{error}</p>}
      {page === 'home' && <Home onCreateGame={handleCreateGame} onJoinByCode={handleJoinByCode} />}
      {page === 'lobby' && (
        <Lobby lobbyId={lobbyId} onGameStart={handleGameStart} />
      )}
      {page === 'game' && gameState && (
        <Game initialState={gameState} playerId={playerId} />
      )}
    </div>
  );
}
