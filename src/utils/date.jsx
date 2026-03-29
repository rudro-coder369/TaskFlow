// Protidin rat 12 tay reset ebang sync er checker
export const checkAndResetDailyData = (lastLoginDateString) => {
    const today = new Date();
    const lastLogin = new Date(lastLoginDateString);

    // Jodi ajker date r last login date na mele, tarmane notun din (Rat 12ta cross koreche)
    if (today.getDate() !== lastLogin.getDate() || 
        today.getMonth() !== lastLogin.getMonth() || 
        today.getFullYear() !== lastLogin.getFullYear()) {
        return true; // True mane auto-reset trigger korte hobe
    }
    return false;
};

export const getFormattedDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-GB'); // DD/MM/YYYY format
};