/**
 * CEX-CEX Scan - Главный файл приложения
 * Инициализирует и координирует работу всех модулей системы
 */

import { api } from './api.js';
import { dataService } from './data-service.js';
import { initializeUser, getCurrentUser, hasAccessToTradingPairs } from './auth.js';
import { 
    setupDOMElements, 
    setupEventListeners, 
    setupRangeSliders, 
    replaceSortingControls, 
    ensureRefreshButtonStyle, 
    setupCollapsibleFilterGroups, 
    setupMobileFilterToggle, 
    enhanceListView, 
    checkListViewAvailability, 
    fixVolumeSlider
} from './ui.js';
import { 
    loadExchangesAndCoins, 
    fetchData, 
    startAutoUpdate, 
    startTimerUpdates, 
    setupSettingsSaveListeners
} from './data-manager.js';

// Состояние приложения
let appState = {
    initialized: false,
    lastWindowWidth: window.innerWidth,
    version: '1.0.0',
    buildDate: '2025-03-20'
};

/**
 * Отслеживание изменения размеров окна
 */
function handleWindowResize() {
    const currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - appState.lastWindowWidth) > 50) {
        appState.lastWindowWidth = currentWidth;
        checkListViewAvailability();
        
        if (window.currentView === 'treemap') {
            import('./ui.js').then(UI => {
                UI.renderTreemap();
            });
        }
    }
}

/**
 * Вывод информации о версии в консоль
 */
function logAppInfo() {
    console.log(
        `%cCEX-CEX Scan v${appState.version}`,
        'color: #2962ff; font-size: 18px; font-weight: bold;'
    );
    console.log(
        `%cBuild date: ${appState.buildDate}`,
        'color: #26a69a; font-size: 12px;'
    );
    console.log(
        '%cInitializing application...',
        'color: #b3b3b3; font-style: italic;'
    );
}

/**
 * Регистрация обработчиков сервисных событий
 */
function setupServiceWorker() {
    // Это пример с заглушкой - добавьте реальный код при необходимости
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registered with scope:', registration.scope);
            }).catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
        });
    }
}

/**
 * Обработка ошибок на уровне приложения
 */
function setupErrorHandling() {
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global error handler:', {message, source, lineno, colno, error});
        
        // Отправка ошибки на сервер аналитики (заглушка)
        if (appState.initialized && source.includes('app.js')) {
            try {
                import('./ui.js').then(UI => {
                    UI.showNotification('Произошла ошибка в приложении', 'error');
                });
            } catch (e) {
                // В случае ошибки в обработчике ошибок - последняя линия защиты
                console.error('Failed to show notification:', e);
            }
        }
        
        // Разрешаем браузеру выполнить стандартную обработку ошибки
        return false;
    };
    
    // Обработка необработанных Promise rejection
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
    });
}

/**
 * Мониторинг сетевого соединения
 */
function setupNetworkMonitoring() {
    // Обработка потери/восстановления соединения
    window.addEventListener('online', () => {
        console.log('🌐 Network connection restored');
        import('./ui.js').then(UI => {
            UI.showNotification('Соединение восстановлено', 'success');
        });
        
        // Сбросить счетчики ошибок API и обновить данные
        api.resetAllErrorStatus?.();
        fetchData();
    });
    
    window.addEventListener('offline', () => {
        console.log('❌ Network connection lost');
        import('./ui.js').then(UI => {
            UI.showNotification('Соединение потеряно', 'error');
        });
    });
}

/**
 * Главная функция инициализации приложения
 */
async function initializeApp() {
    try {
        logAppInfo();
        
        // Базовая настройка UI и обработчиков
        setupDOMElements();
        const isAuthenticated = await initializeUser();
        if (!isAuthenticated) return;
        
        // Настройка UI элементов
        setupRangeSliders();
        replaceSortingControls();
        ensureRefreshButtonStyle();
        setupCollapsibleFilterGroups();
        setupEventListeners();
        
        // Загрузка базовых данных и настройка фильтров
        await loadExchangesAndCoins();
        
        // Загрузка данных о торговых парах
        await fetchData();
        
        // Запуск таймеров и обновлений
        startTimerUpdates();
        startAutoUpdate(10); 
        
        // Настройка адаптивности и отзывчивости интерфейса
        window.addEventListener('resize', handleWindowResize);
        setupMobileFilterToggle();
        enhanceListView();
        checkListViewAvailability();
        fixVolumeSlider();
        
        // Настройка сохранения настроек
        setupSettingsSaveListeners();
        
        // Настройка мониторинга сети
        setupNetworkMonitoring();
        
        // Настройка обработки ошибок
        setupErrorHandling();
        
        // Дополнительные настройки при необходимости
        setupServiceWorker();
        
        // Инициализация завершена
        appState.initialized = true;
        console.log('✅ Application initialized successfully');
        
        // Анализ URL параметров (если нужно)
        handleUrlParameters();
        
    } catch (error) {
        console.error('❌ Error initializing application:', error);
        
        // Показываем сообщение об ошибке пользователю
        const errorContainer = document.createElement('div');
        errorContainer.style.position = 'fixed';
        errorContainer.style.top = '50%';
        errorContainer.style.left = '50%';
        errorContainer.style.transform = 'translate(-50%, -50%)';
        errorContainer.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        errorContainer.style.color = 'white';
        errorContainer.style.padding = '20px';
        errorContainer.style.borderRadius = '8px';
        errorContainer.style.zIndex = '9999';
        errorContainer.innerHTML = `
            <h3>Ошибка инициализации приложения</h3>
            <p>${error.message || 'Неизвестная ошибка'}</p>
            <button onclick="location.reload()">Перезагрузить</button>
        `;
        document.body.appendChild(errorContainer);
    }
}

/**
 * Обработка параметров URL (для глубоких ссылок)
 */
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Пример: открытие определенной пары по параметру ?pair=123
    const pairId = urlParams.get('pair');
    if (pairId) {
        console.log(`Opening pair details for ID: ${pairId}`);
        setTimeout(() => {
            import('./data-manager.js').then(DataManager => {
                const pairsData = DataManager.getPairsData();
                const pair = pairsData.find(p => (p._id.$oid || p._id) === pairId);
                
                if (pair) {
                    import('./ui.js').then(UI => {
                        UI.showPairDetails(pair);
                    });
                }
            });
        }, 1000); // Даем время на загрузку данных
    }
    
    // Пример: установка определенного вида ?view=grid
    const view = urlParams.get('view');
    if (view && ['treemap', 'grid', 'list'].includes(view)) {
        setTimeout(() => {
            const viewBtn = document.querySelector(`.view-btn[data-view="${view}"]`);
            if (viewBtn && !viewBtn.classList.contains('disabled')) {
                viewBtn.click();
            }
        }, 500);
    }
}

/**
 * Добавление анимаций при начальной загрузке
 */
function setupLoadingAnimations() {
    // Создаем и добавляем стиль анимации загрузки
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
        }
        
        .loading-shimmer {
            background: linear-gradient(to right, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 100%);
            background-size: 1000px 100%;
            animation: shimmer 2s infinite linear;
        }
    `;
    document.head.appendChild(style);
    
    // Применяем анимацию к главным элементам
    document.querySelector('.app-container').classList.add('fade-in');
}

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async function() {
    setupLoadingAnimations();
    await initializeApp();
});

// Экспорт основных функций для доступа из консоли (для отладки)
window.app = {
    reloadData: fetchData,
    getAppState: () => ({...appState}),
    getUserInfo: getCurrentUser,
    hasAccess: hasAccessToTradingPairs,
    version: appState.version
};
