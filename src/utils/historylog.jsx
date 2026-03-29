// Data format toiri korar function
export const generateDailyLog = (dailyHabits, timerData, dateString) => {
  return {
    date: dateString,
    selfStudy: formatStudyTime(timerData.accumulatedStudyTime), // e.g., "8 h 15 min"
    coding: formatStudyTime(timerData.accumulatedCodingTime), // Jodi alada track koro
    sleep: `7 h ${dailyHabits.sleepChecked ? '✅' : '❌'}`,
    meal: `${dailyHabits.meal} times`,
    prayer: `${dailyHabits.prayer} times`,
    water: `${dailyHabits.water} glass`,
    exercise: `${dailyHabits.exerciseChecked ? '30 min ✅' : '0 min ❌'}`
  };
};

const formatStudyTime = (totalSeconds) => {
  if (!totalSeconds) return "0 h";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
};

// Rat 12 tai auto trigger korar helper
export const isMidnightCrossed = (lastSavedDate) => {
  const today = new Date().toLocaleDateString('en-GB');
  return today !== lastSavedDate;
};