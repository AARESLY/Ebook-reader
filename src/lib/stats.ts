export interface DailyStats {
  date: string; // YYYY-MM-DD
  readingTime: number; // minutes
  chaptersRead: number;
}

const STATS_KEY = 'epub_reader_stats';

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getStats(): DailyStats[] {
  try {
    const data = localStorage.getItem(STATS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStats(stats: DailyStats[]) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function trackReadingMinute() {
  const today = getTodayString();
  const stats = getStats();
  
  const todayStat = stats.find(s => s.date === today);
  if (todayStat) {
    todayStat.readingTime += 1;
  } else {
    stats.push({
      date: today,
      readingTime: 1,
      chaptersRead: 0
    });
  }
  
  saveStats(stats);
}

export function trackChapterCompleted() {
  const today = getTodayString();
  const stats = getStats();
  
  const todayStat = stats.find(s => s.date === today);
  if (todayStat) {
    todayStat.chaptersRead += 1;
  } else {
    stats.push({
      date: today,
      readingTime: 0,
      chaptersRead: 1
    });
  }
  
  saveStats(stats);
}

export function getWeeklyReadingStats() {
  const stats = getStats();
  const now = new Date();
  
  const weeklyStats = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dayStat = stats.find(s => s.date === dateStr);
    weeklyStats.push({
      day: dayName,
      date: dateStr,
      readingTime: dayStat ? dayStat.readingTime : 0,
      chaptersRead: dayStat ? dayStat.chaptersRead : 0
    });
  }
  
  return weeklyStats;
}

export function seedMockStats() {
  const stats = getStats();
  if (stats.length === 0) {
    const now = new Date();
    const mockStats = [];
    // Seed previous 6 days
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      mockStats.push({
        date: dateStr,
        readingTime: Math.floor(Math.random() * 40) + 15,
        chaptersRead: Math.floor(Math.random() * 3) + 1
      });
    }
    saveStats(mockStats);
  }
}
