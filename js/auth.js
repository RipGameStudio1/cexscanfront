import { dataService } from './data-service.js';
import { showNotification } from './ui.js';
import { formatTimeRemaining } from './utils.js';
import { loadUserSettings, updateStatistics, renderHeatmap, setPairsData, setFilteredPairsData, setupSettingsSaveListeners } from './data-manager.js';

// Глобальная переменная для текущего пользователя
let currentUser = null;

// Геттер и сеттер для текущего пользователя
export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

// Проверка доступа к торговым парам
export function hasAccessToTradingPairs() {
    if (!currentUser || !currentUser.license) return false;
    const license = currentUser.license;
    if (license.type === "Free") {
        return false;
    }
    if (!license.is_active) {
        return false;
    }
    return true;
}

// Инициализация пользователя
export async function initializeUser() {
    console.log('🚀 Начало инициализации пользователя');
    if (window.Telegram && window.Telegram.WebApp) {
        try {
            const telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
            if (telegramUser) {
                console.log('📱 Данные пользователя Telegram получены:', 
                    `ID:${telegramUser.id}, Username:${telegramUser.username || 'не указан'}`);
                try {
                    console.log(`📡 Запрос данных пользователя с ID:${telegramUser.id} с сервера`);
                    currentUser = await dataService.getUser(telegramUser.id.toString());
                    
                    if (window.DOM.username) {
                        window.DOM.username.textContent = '@' + (telegramUser.username || 'user');
                    }
                    
                    updateLicenseStatus(currentUser.license);
                    const hasAccess = hasAccessToTradingPairs();
                    console.log("👮 Доступ пользователя к торговым парам:", hasAccess ? "Разрешен" : "Запрещен");
                    
                    if (!hasAccess) {
                        setPairsData([]);
                        setFilteredPairsData([]);
                        updateStatistics();
                        renderHeatmap();
                    }
                    
                    loadUserSettings();
                    
                    try {
                        licenseChecker.startChecking(currentUser.telegram_id);
                    } catch (error) {
                        console.error("❌ Ошибка при запуске проверки лицензии:", error);
                    }
                    
                    return true;
                } catch (error) {
                    // Пользователь не найден, создаем нового
                    const username = telegramUser.username || telegramUser.first_name || 'unknown';
                    console.log('🆕 Создание нового пользователя:', {
                        id: telegramUser.id.toString(),
                        username: username
                    });
                    
                    try {
                        currentUser = await dataService.createUser(telegramUser.id.toString(), username);
                        if (window.DOM.username) {
                            window.DOM.username.textContent = '@' + username;
                        }
                        
                        updateLicenseStatus(currentUser.license);
                        
                        try {
                            licenseChecker.startChecking(currentUser.telegram_id);
                        } catch (error) {
                            console.error("❌ Ошибка при запуске проверки лицензии:", error);
                        }
                        
                        return true;
                    } catch (createError) {
                        console.error("❌ Ошибка при создании пользователя:", createError);
                        throw createError;
                    }
                }
            } else {
                console.error("❌ Данные пользователя Telegram отсутствуют в WebApp");
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации пользователя Telegram:', error);
        }
    } else {
        console.error("❌ Telegram WebApp не обнаружен");
    }
    
    console.log("⚠️ Авторизация не удалась, перенаправление на экран входа");
    redirectToLogin();
    return false;
}

// Перенаправление на страницу логина
export function redirectToLogin() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.innerHTML = `
            <div class="auth-required">
                <div class="auth-message">
                    <h2>Требуется авторизация</h2>
                    <p>Пожалуйста, откройте приложение через Telegram для авторизации.</p>
                    <button id="retryAuth" class="auth-btn">Попробовать снова</button>
                </div>
            </div>
        `;
        
        // Добавление стилей для экрана авторизации
        const style = document.createElement('style');
        style.textContent = `
            .auth-required {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--bg-primary);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            .auth-message {
                background-color: var(--bg-secondary);
                padding: 30px;
                border-radius: var(--border-radius);
                text-align: center;
                max-width: 80%;
                box-shadow: var(--shadow-md);
            }
            .auth-message h2 {
                margin-bottom: 15px;
                color: var(--text-primary);
            }
            .auth-message p {
                margin-bottom: 20px;
                color: var(--text-secondary);
            }
            .auth-btn {
                background-color: var(--accent-blue);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-weight: 500;
                transition: background-color 0.2s;
            }
            .auth-btn:hover {
                background-color: var(--accent-blue-hover);
            }
        `;
        document.head.appendChild(style);
        
        // Добавление обработчика кнопки "Попробовать снова"
        const retryBtn = document.getElementById('retryAuth');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                location.reload();
            });
        }
    }
}

// Обновление отображения статуса лицензии
export function updateLicenseStatus(license) {
    if (!window.DOM.licenseStatus || !license) return;
    
    window.DOM.licenseStatus.classList.remove('license-expiring');
    
    if (license.type === "Free") {
        window.DOM.licenseStatus.style.backgroundColor = 'rgba(41, 98, 255, 0.1)';
        window.DOM.licenseStatus.style.color = 'var(--accent-blue)';
        window.DOM.licenseStatus.innerHTML = 'Free';
        return;
    }
    
    let licenseColor = 'rgba(38, 166, 154, 0.1)'; 
    let textColor = 'var(--accent-green)';
    
    if (!license.is_active) {
        licenseColor = 'rgba(239, 83, 80, 0.1)'; 
        textColor = 'var(--accent-red)';
        window.DOM.licenseStatus.style.backgroundColor = licenseColor;
        window.DOM.licenseStatus.style.color = textColor;
        window.DOM.licenseStatus.innerHTML = 'Неактивна';
        return;
    }
    
    window.DOM.licenseStatus.style.backgroundColor = licenseColor;
    window.DOM.licenseStatus.style.color = textColor;
    
    const timeRemaining = formatTimeRemaining(license.expires_at);
    window.DOM.licenseStatus.innerHTML = timeRemaining;
    
    try {
        let timestamp;
        const expiresAt = license.expires_at;
        
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
        const diff = expires - now;
        
        if (diff < 60 * 60 * 1000 && diff > 0) {
            window.DOM.licenseStatus.classList.add('license-expiring');
            
            if (!document.getElementById('license-animation-style')) {
                const style = document.createElement('style');
                style.id = 'license-animation-style';
                style.textContent = `
                    @keyframes blink {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                    .license-expiring {
                        animation: blink 1s infinite;
                    }
                `;
                document.head.appendChild(style);
            }
        }
    } catch (error) {
        console.error('Error checking license expiry for animation:', error);
    }
}

// Применение ограничений лицензии
export function enforceLicenseRestrictions() {
    console.log("Enforcing license restrictions");
    
    const hasFreeAccount = currentUser && 
        currentUser.license && 
        currentUser.license.type === "Free";
    
    const hasInactiveLicense = currentUser && 
        currentUser.license && 
        !currentUser.license.is_active;
    
    if (hasFreeAccount || hasInactiveLicense) {
        console.log("Blocking data access:", 
            hasFreeAccount ? "Free account" : "Inactive license");
        
        setPairsData([]);
        setFilteredPairsData([]);
        updateStatistics();
        renderHeatmap();
        
        if (hasFreeAccount && !document.querySelector('.license-purchase-notification')) {
            showLicensePurchaseNotification();
        }
    } else {
        console.log("User has access to data, reloading...");
        import('./data-manager.js').then(module => {
            module.fetchData();
        });
    }
}

// Отображение уведомления о покупке лицензии
export function showLicensePurchaseNotification() {
    const notification = document.createElement('div');
    notification.className = 'license-purchase-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>Приобретите лицензию для доступа ко всем функциям</h3>
            <p>У вас активирована бесплатная лицензия. Для доступа к торговым парам необходимо обновить лицензию.</p>
            <button id="buyLicenseBtn">Приобрести лицензию</button>
            <button id="closeLicenseNotification">Закрыть</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    const style = document.createElement('style');
    style.textContent = `
        .license-purchase-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            background-color: var(--bg-secondary);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
            border-left: 4px solid var(--accent-blue);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .notification-content {
            padding: 15px;
        }
        .notification-content h3 {
            margin-bottom: 10px;
            color: var(--text-primary);
            font-size: 16px;
        }
        .notification-content p {
            margin-bottom: 15px;
            color: var(--text-secondary);
            font-size: 14px;
        }
        .notification-content button {
            padding: 8px 12px;
            border-radius: var(--border-radius);
            font-size: 14px;
            cursor: pointer;
            margin-right: 10px;
        }
        #buyLicenseBtn {
            background-color: var(--accent-blue);
            color: white;
            border: none;
        }
        #closeLicenseNotification {
            background-color: transparent;
            color: var(--text-secondary);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
    `;
    
    document.head.appendChild(style);
    
    document.getElementById('buyLicenseBtn').addEventListener('click', () => {
        window.open('https://t.me/example_bot');
    });
    
    document.getElementById('closeLicenseNotification').addEventListener('click', () => {
        notification.remove();
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 15000);
}

// Модуль проверки лицензии
export const licenseChecker = {
    checkInterval: null,
    checkFrequency: 5 * 1000,
    isFirstCheck: true,
    
    startChecking(userId) {
        console.log('🔍 License Checker: Запуск механизма проверки лицензии');
        
        if (!userId) {
            console.error('❌ License Checker: Невозможно запустить проверку - отсутствует ID пользователя');
            return;
        }
        
        this.stopChecking();
        
        const performCheck = async () => {
            const isFirst = this.isFirstCheck;
            if (isFirst) {
                this.isFirstCheck = false;
                console.log('License Checker: Выполняется первоначальная проверка лицензии');
            } else {
                console.log('License Checker: Выполняется периодическая проверка лицензии');
            }
            
            try {
                if (!currentUser) {
                    console.warn('⚠️ License Checker: Объект currentUser недоступен, пропуск проверки');
                    return;
                }
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                
                const response = await Promise.race([
                    dataService.getUserLicense(userId),
                    timeoutPromise
                ]);
                
                const licenseData = response.license || response;
                
                if (licenseData && typeof licenseData === 'object' && 
                    ('type' in licenseData) && ('is_active' in licenseData)) {
                    this._checkLicenseChanges(licenseData);
                } else {
                    console.warn('⚠️ License Checker: Получен некорректный ответ от API (нет данных о лицензии)');
                    console.debug('Содержимое ответа:', response);
                }
            } catch (error) {
                console.error('❌ License Checker: Ошибка при проверке лицензии:', error.message);
                if (error.stack) {
                    console.debug('Стек ошибки:', error.stack);
                }
            }
        };
        
        this.checkInterval = setInterval(performCheck, this.checkFrequency);
        performCheck();
    },
    
    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    },
    
    _checkLicenseChanges(newLicense) {
        if (!currentUser) {
            return;
        }
        
        if (!currentUser.license) {
            currentUser.license = newLicense;
            updateLicenseStatus(newLicense);
            enforceLicenseRestrictions();
            return;
        }
        
        const oldLicense = currentUser.license;
        const typeChanged = oldLicense.type !== newLicense.type;
        const statusChanged = oldLicense.is_active !== newLicense.is_active;
        
        if (typeChanged || statusChanged) {
            console.log('🔄 License Checker: Обнаружены изменения в лицензии!');
            currentUser.license = newLicense;
            
            try {
                updateLicenseStatus(newLicense);
            } catch (error) {
                console.error('❌ License Checker: Ошибка при обновлении отображения:', error);
            }
            
            try {
                enforceLicenseRestrictions();
            } catch (error) {
                console.error('❌ License Checker: Ошибка при применении ограничений:', error);
            }
            
            try {
                console.log('🔔 License Checker: Отображение уведомления об изменении лицензии');
                this._showLicenseChangeNotification(oldLicense, newLicense);
            } catch (error) {
                console.error('❌ License Checker: Ошибка при отображении уведомления:', error);
            }
        } else {
            console.log('✅ License Checker: Изменений в лицензии не обнаружено');
        }
    },
    
    _showLicenseChangeNotification(oldLicense, newLicense) {
        if (newLicense.type === "Free") {
            showNotification('Ваша лицензия изменилась на Free. Доступ ограничен.', 'warning');
            if (!document.querySelector('.license-purchase-notification')) {
                showLicensePurchaseNotification();
            }
        } else if (newLicense.is_active && !oldLicense.is_active) {
            showNotification('Ваша лицензия активирована!', 'success');
        } else if (!newLicense.is_active && oldLicense.is_active) {
            showNotification('Ваша лицензия деактивирована.', 'warning');
        }
    }
};
