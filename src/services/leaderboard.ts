export const getLeaderboard = (category: string) => {
  const data = localStorage.getItem(`leaderboard_${category}`);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to parse leaderboard data', err);
    }
  }
  return [];
};

export const saveScore = (category: string, playerName: string, score: number) => {
  const leaderboard = getLeaderboard(category);
  
  const existingEntryIndex = leaderboard.findIndex((entry: any) => entry.playerName === playerName);
  
  if (existingEntryIndex !== -1) {
    if (score > leaderboard[existingEntryIndex].score) {
      leaderboard[existingEntryIndex].score = score;
      leaderboard[existingEntryIndex].date = new Date().toISOString();
    }
  } else {
    leaderboard.push({ playerName, score, date: new Date().toISOString() });
  }
  
  leaderboard.sort((a: any, b: any) => b.score - a.score);
  const top10 = leaderboard.slice(0, 10);
  localStorage.setItem(`leaderboard_${category}`, JSON.stringify(top10));
};

export const removeScore = (category: string, playerName: string) => {
  const leaderboard = getLeaderboard(category);
  const updatedLeaderboard = leaderboard.filter((entry: any) => entry.playerName !== playerName);
  localStorage.setItem(`leaderboard_${category}`, JSON.stringify(updatedLeaderboard));
};

export const clearLeaderboard = (category?: string) => {
  if (category) {
    localStorage.removeItem(`leaderboard_${category}`);
  } else {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('leaderboard_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
};
