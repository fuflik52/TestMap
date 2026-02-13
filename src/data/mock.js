const generateRounds = (baseDamage, count = 8) => {
  return Array.from({ length: count }, (_, i) => ({
    round: i + 1,
    damage: Math.max(
      0,
      Math.floor(baseDamage / count + (Math.random() * 2000 - 1000)),
    ),
    kills: Math.floor(Math.random() * 3),
    deaths: Math.floor(Math.random() * 2),
  }));
};

const enrichPlayer = (player) => {
  const shots = Math.floor(player.damage / 20 + Math.random() * 100);
  const accuracy = 20 + Math.random() * 30; // 20-50%
  const hits = Math.floor((shots * accuracy) / 100);
  const hs = Math.floor(15 + Math.random() * 40); // 15-55%
  const elo = Math.floor(1200 + Math.random() * 1500);
  const impact = (
    (player.kills * 2 + player.assists + player.damage / 1000) /
    (player.deaths || 1) /
    3
  ).toFixed(2);

  return {
    ...player,
    elo,
    impact,
    shots,
    hits,
    acc: `${accuracy.toFixed(1)}%`,
    hs: `${hs}%`,
    history: generateRounds(player.damage),
  };
};

const rawMatches = [
  {
    id: "m-8912",
    timestamp: "2023-11-04T18:30:00Z",
    duration: "42:15",
    map: "Cyber District",
    score: { red: 16, blue: 14 },
    winner: "red",
    totalDamage: { red: 145020, blue: 138900 },
    teams: {
      red: [
        {
          id: "r1",
          name: "Viper",
          role: "Carry",
          damage: 42000,
          kills: 28,
          deaths: 12,
          assists: 8,
        },
        {
          id: "r2",
          name: "Shadow",
          role: "Support",
          damage: 15000,
          kills: 5,
          deaths: 10,
          assists: 25,
        },
        {
          id: "r3",
          name: "TankBot",
          role: "Tank",
          damage: 35000,
          kills: 12,
          deaths: 8,
          assists: 15,
        },
        {
          id: "r4",
          name: "SniperX",
          role: "Flex",
          damage: 38000,
          kills: 22,
          deaths: 14,
          assists: 6,
        },
        {
          id: "r5",
          name: "HealerPro",
          role: "Healer",
          damage: 15020,
          kills: 4,
          deaths: 9,
          assists: 30,
        },
      ],
      blue: [
        {
          id: "b1",
          name: "Azure",
          role: "Carry",
          damage: 39000,
          kills: 25,
          deaths: 15,
          assists: 5,
        },
        {
          id: "b2",
          name: "Frost",
          role: "Tank",
          damage: 45000,
          kills: 14,
          deaths: 12,
          assists: 10,
        },
        {
          id: "b3",
          name: "Mist",
          role: "Support",
          damage: 12000,
          kills: 3,
          deaths: 14,
          assists: 20,
        },
        {
          id: "b4",
          name: "Gale",
          role: "Flex",
          damage: 28900,
          kills: 18,
          deaths: 16,
          assists: 8,
        },
        {
          id: "b5",
          name: "Storm",
          role: "Healer",
          damage: 14000,
          kills: 5,
          deaths: 14,
          assists: 22,
        },
      ],
    },
  },
  {
    id: "m-8913",
    timestamp: "2023-11-04T20:45:00Z",
    duration: "28:05",
    map: "Neon City",
    score: { red: 5, blue: 13 },
    winner: "blue",
    totalDamage: { red: 82000, blue: 110500 },
    teams: {
      red: [
        {
          id: "r1",
          name: "Viper",
          role: "Carry",
          damage: 22000,
          kills: 12,
          deaths: 18,
          assists: 2,
        },
        {
          id: "r2",
          name: "Shadow",
          role: "Support",
          damage: 11000,
          kills: 2,
          deaths: 15,
          assists: 8,
        },
        {
          id: "r3",
          name: "TankBot",
          role: "Tank",
          damage: 25000,
          kills: 8,
          deaths: 12,
          assists: 5,
        },
        {
          id: "r4",
          name: "SniperX",
          role: "Flex",
          damage: 18000,
          kills: 10,
          deaths: 16,
          assists: 3,
        },
        {
          id: "r5",
          name: "HealerPro",
          role: "Healer",
          damage: 6000,
          kills: 1,
          deaths: 14,
          assists: 10,
        },
      ],
      blue: [
        {
          id: "b1",
          name: "Krush",
          role: "Carry",
          damage: 35000,
          kills: 22,
          deaths: 5,
          assists: 10,
        },
        {
          id: "b2",
          name: "Wall",
          role: "Tank",
          damage: 30000,
          kills: 8,
          deaths: 4,
          assists: 15,
        },
        {
          id: "b3",
          name: "Pixie",
          role: "Support",
          damage: 15000,
          kills: 5,
          deaths: 6,
          assists: 25,
        },
        {
          id: "b4",
          name: "Dash",
          role: "Flex",
          damage: 20500,
          kills: 15,
          deaths: 8,
          assists: 12,
        },
        {
          id: "b5",
          name: "Bolt",
          role: "Healer",
          damage: 10000,
          kills: 3,
          deaths: 4,
          assists: 20,
        },
      ],
    },
  },
  {
    id: "m-8914",
    timestamp: "2023-11-03T15:00:00Z",
    duration: "55:30",
    map: "Rust Valley",
    score: { red: 12, blue: 13 },
    winner: "blue",
    totalDamage: { red: 190000, blue: 195000 },
    teams: {
      red: [
        {
          id: "r1",
          name: "Viper",
          role: "Carry",
          damage: 55000,
          kills: 35,
          deaths: 30,
          assists: 15,
        },
        {
          id: "r2",
          name: "Shadow",
          role: "Support",
          damage: 25000,
          kills: 5,
          deaths: 25,
          assists: 40,
        },
        {
          id: "r3",
          name: "TankBot",
          role: "Tank",
          damage: 60000,
          kills: 20,
          deaths: 28,
          assists: 30,
        },
        {
          id: "r4",
          name: "SniperX",
          role: "Flex",
          damage: 30000,
          kills: 15,
          deaths: 22,
          assists: 20,
        },
        {
          id: "r5",
          name: "HealerPro",
          role: "Healer",
          damage: 20000,
          kills: 2,
          deaths: 20,
          assists: 55,
        },
      ],
      blue: [
        {
          id: "b1",
          name: "Ghost",
          role: "Carry",
          damage: 58000,
          kills: 38,
          deaths: 28,
          assists: 10,
        },
        {
          id: "b2",
          name: "Iron",
          role: "Tank",
          damage: 62000,
          kills: 22,
          deaths: 25,
          assists: 25,
        },
        {
          id: "b3",
          name: "Wisp",
          role: "Support",
          damage: 22000,
          kills: 4,
          deaths: 20,
          assists: 45,
        },
        {
          id: "b4",
          name: "Flash",
          role: "Flex",
          damage: 33000,
          kills: 20,
          deaths: 26,
          assists: 18,
        },
        {
          id: "b5",
          name: "Mend",
          role: "Healer",
          damage: 20000,
          kills: 3,
          deaths: 18,
          assists: 50,
        },
      ],
    },
  },
  {
    id: "m-8915",
    timestamp: "2023-11-02T19:20:00Z",
    duration: "34:10",
    map: "Orbital Station",
    score: { red: 13, blue: 8 },
    winner: "red",
    totalDamage: { red: 95000, blue: 78000 },
    teams: {
      red: [
        {
          id: "r1",
          name: "Viper",
          role: "Carry",
          damage: 30000,
          kills: 20,
          deaths: 8,
          assists: 5,
        },
        {
          id: "r2",
          name: "Shadow",
          role: "Support",
          damage: 10000,
          kills: 2,
          deaths: 5,
          assists: 15,
        },
        {
          id: "r3",
          name: "TankBot",
          role: "Tank",
          damage: 25000,
          kills: 8,
          deaths: 6,
          assists: 10,
        },
        {
          id: "r4",
          name: "SniperX",
          role: "Flex",
          damage: 20000,
          kills: 12,
          deaths: 7,
          assists: 4,
        },
        {
          id: "r5",
          name: "HealerPro",
          role: "Healer",
          damage: 10000,
          kills: 1,
          deaths: 4,
          assists: 18,
        },
      ],
      blue: [
        {
          id: "b1",
          name: "Nova",
          role: "Carry",
          damage: 28000,
          kills: 15,
          deaths: 12,
          assists: 6,
        },
        {
          id: "b2",
          name: "Rock",
          role: "Tank",
          damage: 20000,
          kills: 6,
          deaths: 10,
          assists: 8,
        },
        {
          id: "b3",
          name: "Leaf",
          role: "Support",
          damage: 8000,
          kills: 1,
          deaths: 8,
          assists: 12,
        },
        {
          id: "b4",
          name: "Spark",
          role: "Flex",
          damage: 15000,
          kills: 8,
          deaths: 11,
          assists: 5,
        },
        {
          id: "b5",
          name: "Dew",
          role: "Healer",
          damage: 7000,
          kills: 0,
          deaths: 6,
          assists: 10,
        },
      ],
    },
  },
];

// --- Test match m-777 ---
function generateMockActivity777() {
  const worldSize = 4000;
  const mapScale = 0.5;
  const margin = 500;
  const mapPixelSize = worldSize * mapScale + margin * 2;

  const waypoints = [
    [0.38, 0.28], [0.35, 0.35], [0.32, 0.43], [0.36, 0.50],
    [0.42, 0.55], [0.48, 0.58], [0.53, 0.54], [0.50, 0.46],
    [0.44, 0.40], [0.40, 0.45], [0.43, 0.52], [0.50, 0.56],
    [0.56, 0.60], [0.58, 0.66], [0.53, 0.70], [0.47, 0.66],
    [0.42, 0.60], [0.38, 0.55], [0.40, 0.48], [0.46, 0.44],
    [0.52, 0.48], [0.55, 0.55], [0.58, 0.50], [0.54, 0.42],
    [0.48, 0.38], [0.42, 0.42], [0.45, 0.50], [0.50, 0.58],
    [0.55, 0.62], [0.52, 0.55],
  ];

  const samples = [];
  const stepsPerSeg = 12;
  let t = 0;
  const seededRand = (i) => Math.sin(i * 9301 + 49297) % 1;

  for (let w = 0; w < waypoints.length - 1; w++) {
    const [u0, v0] = waypoints[w];
    const [u1, v1] = waypoints[w + 1];
    for (let s = 0; s < stepsPerSeg; s++) {
      const f = s / stepsPerSeg;
      const noise = seededRand(t) * 0.006 - 0.003;
      const u = u0 + (u1 - u0) * f + noise;
      const v = v0 + (v1 - v0) * f + seededRand(t + 1000) * 0.006 - 0.003;
      const wx = (u * mapPixelSize - margin) / mapScale - worldSize / 2;
      const wz = (v * mapPixelSize - margin) / mapScale - worldSize / 2;
      samples.push({
        t: +(t).toFixed(2),
        wx: +wx.toFixed(1),
        wz: +wz.toFixed(1),
        u: +u.toFixed(6),
        v: +v.toFixed(6),
      });
      t += 1;
    }
  }

  return {
    id: "m-777",
    playerId: "76561198000000777",
    playerName: "TestPlayer",
    seed: 1337,
    worldSize,
    mapScale,
    margin,
    startedAt: Date.now() - 290 * 1000,
    endedAt: Date.now(),
    endReason: "death",
    mapPngUrl: "/simplemap/match/m-777/map.png",
    sampleCount: samples.length,
    samples,
    deaths: [
      { at: Date.now() - 200000, wx: 100, wz: 320, u: 0.48, v: 0.58 },
      { at: Date.now() - 120000, wx: 280, wz: 640, u: 0.56, v: 0.60 },
      { at: Date.now() - 50000, wx: 100, wz: 800, u: 0.53, v: 0.70 },
      { at: Date.now(), wx: 80, wz: 200, u: 0.52, v: 0.55 },
    ],
  };
}

export const mockActivity777 = generateMockActivity777();

// m-777 match entry for the match list
rawMatches.unshift({
  id: "m-777",
  timestamp: new Date().toISOString(),
  duration: "04:50",
  map: "Test Island",
  score: { red: 7, blue: 3 },
  winner: "red",
  totalDamage: { red: 52000, blue: 31000 },
  teams: {
    red: [
      { id: "r1", name: "TestPlayer", role: "Carry", damage: 28000, kills: 18, deaths: 4, assists: 5 },
      { id: "r2", name: "AllyBot", role: "Support", damage: 12000, kills: 4, deaths: 3, assists: 15 },
      { id: "r3", name: "TankDude", role: "Tank", damage: 12000, kills: 5, deaths: 5, assists: 8 },
    ],
    blue: [
      { id: "b1", name: "Enemy1", role: "Carry", damage: 15000, kills: 10, deaths: 8, assists: 3 },
      { id: "b2", name: "Enemy2", role: "Flex", damage: 10000, kills: 6, deaths: 7, assists: 4 },
      { id: "b3", name: "Enemy3", role: "Healer", damage: 6000, kills: 2, deaths: 6, assists: 10 },
    ],
  },
});

// Apply enrichment to all players
export const matches = rawMatches.map((match) => ({
  ...match,
  teams: {
    red: match.teams.red.map(enrichPlayer),
    blue: match.teams.blue.map(enrichPlayer),
  },
}));
