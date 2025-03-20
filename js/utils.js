// Форматирование оставшегося времени
export function formatTimeRemaining(expiresAt) {
    if (!expiresAt) return 'не указано';
    
    try {
        let timestamp;
        
        if (expiresAt.$date) {
            if (typeof expiresAt.$date === 'string') {
                timestamp = new Date(expiresAt.$date).getTime();
            } else if (expiresAt.$date.$numberLong) {
                timestamp = parseInt(expiresAt.$date.$numberLong);
            } else {
                timestamp = expiresAt.$date;
            }
        } else {
            timestamp = expiresAt;
        }
        
        const now = new Date();
        const expires = new Date(timestamp);
        
        if (isNaN(expires.getTime())) {
            console.error('Invalid date:', expiresAt);
            return 'ошибка даты';
        }
        
        const diff = expires - now;
        
        if (diff <= 0) return 'истекла';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (days > 0) {
            return `${days}д ${hours}ч`;
        } else if (hours > 0) {
            return `${hours}ч ${minutes}м`;
        } else if (minutes > 0) {
            return `${minutes}м ${seconds}с`;
        } else {
            return `${seconds}с`;
        }
    } catch (error) {
        console.error('Error formatting time:', error, JSON.stringify(expiresAt));
        return 'ошибка';
    }
}

// Получение CSS-класса для тепловой карты
export function getHeatClass(spread) {
    if (spread < 0.5) return 'cold';
    if (spread < 1) return 'cool';
    if (spread < 2) return 'warm';
    if (spread < 3) return 'warmer';
    if (spread < 5) return 'hot';
    return 'very-hot';
}

// Форматирование цены
export function formatPrice(price) {
    if (price === undefined || price === null) return '0';
    
    let str = price.toString();
    
    if (str.includes('e')) {
        const parts = str.split('e');
        const base = parts[0];
        const exponent = parseInt(parts[1]);
        
        if (parts[1].includes('-')) {
            let result = '0.';
            
            for (let i = 0; i < Math.abs(exponent) - 1; i++) {
                result += '0';
            }
            
            return result + base.replace('.', '');
        } else {
            const baseWithoutDot = base.replace('.', '');
            const zerosToAdd = exponent - (baseWithoutDot.length - 1);
            let result = baseWithoutDot;
            
            for (let i = 0; i < zerosToAdd; i++) {
                result += '0';
            }
            
            return result;
        }
    }
    
    return str;
}

// Форматирование валюты
export function formatCurrency(value) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
}

// Форматирование процентов
export function formatPercent(value) {
    return value.toFixed(2) + '%';
}

// Форматирование числа
export function formatNumber(value) {
    return new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 2
    }).format(value);
}

// Обновление таймера для элемента
export function updateElementTimer(element, aliveTimeStr, appendSuffix = false) {
    const now = new Date();
    const aliveTime = new Date(aliveTimeStr);
    const seconds = Math.floor((now - aliveTime) / 1000);
    
    let timerText;
    
    if (seconds < 60) {
        timerText = `${seconds}с`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        timerText = `${minutes}м`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        timerText = `${hours}ч`;
    } else {
        const days = Math.floor(seconds / 86400);
        timerText = `${days}д`;
    }
    
    if (appendSuffix) {
        timerText += ' назад';
    }
    
    element.textContent = timerText;
}

// Функция debounce
export function debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
