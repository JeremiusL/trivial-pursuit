import { CATEGORY_IDS, getCategoryColor } from '../boardConfig';

function PieToken({ cx, cy, r, categories, strokeColor }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#eee" stroke={strokeColor} strokeWidth={2} />
      {CATEGORY_IDS.map((cat, i) => {
        if (!categories[cat]) return null;
        const startAngle = (i * 60 - 90) * Math.PI / 180;
        const endAngle = ((i + 1) * 60 - 90) * Math.PI / 180;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        return (
          <path
            key={cat}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
            fill={getCategoryColor(cat)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={strokeColor} strokeWidth={2} />
    </g>
  );
}

export default function Board({ positions, players, validMoves, onSquareClick, CX, CY, OUTER_RADIUS, CENTER_RADIUS, SQUARE_SIZE }) {
  const SQ = SQUARE_SIZE;
  const HALF = SQ / 2;
  const armAngles = [0, 60, 120, 180, 240, 300];

  return (
    <svg viewBox="0 0 900 900" className="game-board">
      {/* Outer ring track */}
      <circle cx={CX} cy={CY} r={OUTER_RADIUS} fill="none" stroke="#e0e0e0" strokeWidth={SQ + 6} />

      {/* Arm tracks */}
      {armAngles.map((angle, i) => {
        const hqPos = positions[19 + i * 4];
        return (
          <line
            key={`arm-track-${i}`}
            x1={CX} y1={CY} x2={hqPos.x} y2={hqPos.y}
            stroke="#e0e0e0" strokeWidth={SQ + 6} strokeLinecap="round"
          />
        );
      })}

      {/* Squares */}
      {positions.map(pos => {
        if (pos.type === 'center') return null;

        const isValid = validMoves.includes(pos.id);
        const rotation = pos.angle || 0;

        return (
          <g
            key={pos.id}
            onClick={isValid ? () => onSquareClick(pos.id) : undefined}
            style={{ cursor: isValid ? 'pointer' : 'default' }}
          >
            <g transform={`rotate(${rotation}, ${pos.x}, ${pos.y})`}>
              <rect
                x={pos.x - HALF} y={pos.y - HALF}
                width={SQ} height={SQ}
                fill={isValid ? '#d0e8ff' : 'white'}
                stroke={isValid ? '#4a90d9' : '#333'}
                strokeWidth={isValid ? 2.5 : 1.5}
                rx={3}
              />
            </g>
            {pos.type === 'roll_again' ? (
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={8} fontWeight="bold" fill="#333"
              >
                ROLL AGAIN
              </text>
            ) : (
              <circle cx={pos.x} cy={pos.y} r={7} fill={getCategoryColor(pos.category)} />
            )}
          </g>
        );
      })}

      {/* Center hub - 6 colored pie segments */}
      {CATEGORY_IDS.map((cat, i) => {
        const r = CENTER_RADIUS;
        const startAngle = (i * 60 - 90) * Math.PI / 180;
        const endAngle = ((i + 1) * 60 - 90) * Math.PI / 180;
        const x1 = CX + r * Math.cos(startAngle);
        const y1 = CY + r * Math.sin(startAngle);
        const x2 = CX + r * Math.cos(endAngle);
        const y2 = CY + r * Math.sin(endAngle);
        const isValid = validMoves.includes(0);
        return (
          <path
            key={`hub-${i}`}
            d={`M ${CX} ${CY} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
            fill={getCategoryColor(cat)}
            stroke="white" strokeWidth={2}
            onClick={isValid ? () => onSquareClick(0) : undefined}
            style={{ cursor: isValid ? 'pointer' : 'default', opacity: isValid ? 1 : 0.85 }}
          />
        );
      })}
      {validMoves.includes(0) && (
        <circle cx={CX} cy={CY} r={CENTER_RADIUS + 3} fill="none" stroke="#4a90d9" strokeWidth={3} />
      )}

      {/* Player tokens */}
      {players.map((player, idx) => {
        const pos = positions.find(p => p.id === player.position);
        if (!pos) return null;

        let tx = pos.x;
        let ty = pos.y;
        const sameSquare = players.filter(p => p.position === player.position);

        if (pos.type === 'center') {
          tx = CX + (idx === 0 ? -30 : 30);
          ty = CY + CENTER_RADIUS + 20;
        } else if (sameSquare.length > 1) {
          const myIdx = sameSquare.indexOf(player);
          tx += (myIdx === 0 ? -12 : 12);
          ty += (myIdx === 0 ? -12 : 12);
        }

        const tokenR = 15;
        const color = idx === 0 ? '#e74c3c' : '#3498db';

        return (
          <g key={`token-${idx}`}>
            <PieToken cx={tx} cy={ty} r={tokenR} categories={player.categories} strokeColor={color} />
            <text
              x={tx} y={ty + tokenR + 12}
              textAnchor="middle" fontSize={10} fill={color} fontWeight="bold"
            >
              {player.username}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
