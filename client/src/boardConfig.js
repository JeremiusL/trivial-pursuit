export const CATEGORIES = [
  { id: 'history', name: 'History', color: '#FFD700' },
  { id: 'geography', name: 'Geography', color: '#4169E1' },
  { id: 'science', name: 'Science & Nature', color: '#2E8B57' },
  { id: 'sports', name: 'Sports & Leisure', color: '#FF8C00' },
  { id: 'literature', name: 'Literature', color: '#FF69B4' },
  { id: 'cinema', name: 'Cinematography', color: '#9370DB' },
];

export const CATEGORY_IDS = ['history', 'geography', 'science', 'sports', 'literature', 'cinema'];

// Each arm has 3 squares with different categories.
// 6 colors x 3 appearances = 18 arm squares, each color appears exactly 3 times.
export const ARM_CATEGORIES = [
  ['history', 'geography', 'science'],     // arm 0 (0°)
  ['sports', 'literature', 'cinema'],      // arm 1 (60°)
  ['cinema', 'history', 'literature'],     // arm 2 (120°)
  ['geography', 'science', 'sports'],      // arm 3 (180°)
  ['literature', 'sports', 'history'],     // arm 4 (240°)
  ['science', 'cinema', 'geography'],      // arm 5 (300°)
];

const CX = 450;
const CY = 450;
const OUTER_RADIUS = 370;
const CENTER_RADIUS = 80;
const ARM_RADII = [130, 210, 290];
const SQUARE_SIZE = 44;
const ARM_ANGLES = [0, 60, 120, 180, 240, 300];

function polarToXY(angleDeg, radius) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

export function buildBoard() {
  const positions = [];
  const adjacency = {};

  // Position 0: Center
  positions.push({ id: 0, x: CX, y: CY, category: 'center', type: 'center', angle: 0 });
  adjacency[0] = [];

  // Arm positions (1-18): 6 arms x 3 squares each, mixed colors
  for (let arm = 0; arm < 6; arm++) {
    const angle = ARM_ANGLES[arm];

    for (let sq = 0; sq < 3; sq++) {
      const id = 1 + arm * 3 + sq;
      const category = ARM_CATEGORIES[arm][sq];
      const { x, y } = polarToXY(angle, ARM_RADII[sq]);
      positions.push({ id, x, y, category, type: 'arm', angle });
      adjacency[id] = [];
    }

    // Center <-> first arm square
    adjacency[0].push(1 + arm * 3);
    adjacency[1 + arm * 3].push(0);

    // Chain arm squares
    for (let sq = 0; sq < 2; sq++) {
      const a = 1 + arm * 3 + sq;
      const b = a + 1;
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
  }

  // Outer ring positions (19-42): 24 squares, 15 degrees apart
  for (let i = 0; i < 24; i++) {
    const id = 19 + i;
    const angleDeg = i * 15;
    const { x, y } = polarToXY(angleDeg, OUTER_RADIUS);

    let category, type;
    if (i % 4 === 0) {
      category = CATEGORY_IDS[i / 4];
      type = 'headquarters';
    } else if (i % 4 === 2) {
      category = 'roll_again';
      type = 'roll_again';
    } else if (i % 4 === 1) {
      category = CATEGORY_IDS[(Math.floor(i / 4) + 2) % 6];
      type = 'outer';
    } else {
      category = CATEGORY_IDS[(Math.floor(i / 4) + 3) % 6];
      type = 'outer';
    }

    positions.push({ id, x, y, category, type, angle: angleDeg });
    adjacency[id] = [];
  }

  // Circular connections on outer ring
  for (let i = 0; i < 24; i++) {
    const a = 19 + i;
    const b = 19 + (i + 1) % 24;
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  // Connect last arm square to its outer ring headquarters
  for (let arm = 0; arm < 6; arm++) {
    const lastArm = 1 + arm * 3 + 2;
    const hq = 19 + arm * 4;
    adjacency[lastArm].push(hq);
    adjacency[hq].push(lastArm);
  }

  // Deduplicate adjacency lists
  for (const key in adjacency) {
    adjacency[key] = [...new Set(adjacency[key])];
  }

  return { positions, adjacency, CX, CY, OUTER_RADIUS, CENTER_RADIUS, SQUARE_SIZE };
}

export function getCategoryColor(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.color : '#999';
}

export function getCategoryName(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.name : categoryId;
}
