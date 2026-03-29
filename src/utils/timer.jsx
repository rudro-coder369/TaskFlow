import { useState, useEffect } from 'react';

// Eta custom hook hisabe kaaj korbe
export const useBackgroundTimer = (storageKey) => {
  const [timePassed, setTimePassed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isRunning) {
      // Shuru korar somoy local storage e save rakhbo exact start time
      let startTime = localStorage.getItem(storageKey);
      if (!startTime) {
        startTime = Date.now() - timePassed;
        localStorage.setItem(storageKey, startTime.toString());
      }

      interval = setInterval(() => {
        // Just variable barabo na, present time theke start time minus korbo
        // Tahole screen off thakleu data accurate thakbe
        const now = Date.now();
        const difference = now - parseInt(localStorage.getItem(storageKey), 10);
        setTimePassed(Math.floor(difference / 1000)); // second e convert
      }, 1000);
    } else {
      clearInterval(interval);
      localStorage.removeItem(storageKey);
    }

    return () => clearInterval(interval);
  }, [isRunning, storageKey, timePassed]);

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);
  const resetTimer = () => {
    setIsRunning(false);
    setTimePassed(0);
    localStorage.removeItem(storageKey);
  };

  return { timePassed, isRunning, startTimer, pauseTimer, resetTimer };
};