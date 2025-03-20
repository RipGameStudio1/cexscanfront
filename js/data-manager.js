import { dataService } from './data-service.js';
import { getCurrentUser, hasAccessToTradingPairs } from './auth.js';
import { formatCurrency, formatPercent, formatNumber, debounce, updateElementTimer } from './utils.js';

// Глобальные переменные для данных и состояния
let currentView = 'treemap'; 
let currentSortField = 'spread'; 
let currentSortOrder = 'desc'; 
let updateInterval = null; 
let pairsData = []; 
let filteredPairsData = []; 
let timerUpdatesInterval = null; 
let buyExchanges = []; 
let sellExchanges = []; 

// UI-обработчики - механизм для устранения циклических зависимостей
let uiHandlers = {
    renderHeatmap: () => console.warn('renderHeatmap not initialized'),
    updateStatistics: () => console.warn('updateStatistics not initialized'),
    showNotification: (message, type) => console.warn('showNotification not initialized: ', message, type),
    animateRefreshButton: (duration) => console.warn('animateRefreshButton not initialized'),
    renderPurchaseLicenseMessage: (container) => console.warn('renderPurchaseLicenseMessage not initialized'),
    updateDetailsPanelTimer: (pair) => {}
};

// Регистрация UI-обработчиков
export function setUIHandlers(handlers) {
    uiHandlers = { ...uiHandlers, ...handlers };
}

// Геттеры и сеттеры для данных
export function getPairsData() {
    return pairsData;
}

export function setPairsData(data) {
    pairsData = data;
}

export function getFilteredPairsData() {
    return filteredPairsData;
}

export function setFilteredPairsData(data) {
    filteredPairsData = data;
}

// Геттеры и сеттеры для параметров отображения
export function setCurrentView(view) {
    currentView = view;
}

export function getCurrentView() {
    return currentView;
}

export function setCurrentSortField(field) {
    currentSortField = field;
}

export function getCurrentSortField() {
    return currentSortField;
}

export function setCurrentSortOrder(order) {
    currentSortOrder = order;
}

export function getCurrentSortOrder() {
    return currentSortOrder;
}

export function getBuyExchanges() {
    return buyExchanges;
}

export function getSellExchanges() {
    return sellExchanges;
}

export function setBuyExchanges(exchanges) {
    buyExchanges = exchanges;
}

export function setSellExchanges(exchanges) {
    sellExchanges = exchanges;
}

// Загрузка данных о биржах и монетах
export async function loadExchangesAndCoins() {
    try {
        const [exchanges, coins] = await Promise.all([
            dataService.getExchanges(),
            dataService.getCoins()
        ]);
        
        if (exchanges && Array.isArray(exchanges)) {
            buyExchanges = exchanges.filter(ex => ex.is_active);
            sellExchanges = exchanges.filter(ex => ex.is_active);
        }
        
        renderCoinTags(coins);
        renderExchangeTags(buyExchanges, 'buy');
        renderExchangeTags(sellExchanges, 'sell');
        
        return { exchanges, coins };
    } catch (error) {
        console.error('Error loading exchanges and coins:', error);
        uiHandlers.showNotification('Ошибка загрузки данных бирж и монет', 'error');
        return { exchanges: [], coins: [] };
    }
}

// Загрузка данных о торговых парах
export async function fetchData() {
    try {
        uiHandlers.animateRefreshButton(2000);
        
        if (!hasAccessToTradingPairs()) {
            console.log("No access to trading pairs due to license restrictions");
            pairsData = [];
            filteredPairsData = [];
            uiHandlers.updateStatistics();
            uiHandlers.renderHeatmap(); 
            return;
        }
        
        const userId = getCurrentUser()?.telegram_id;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        
        const pairsResponse = await dataService.getPairs(userId);
        
        if (pairsResponse.active_pairs) {
            pairsData = pairsResponse.active_pairs.map(pair => {
                const isPinned = pairsResponse.pinned_pairs 
                    ? pairsResponse.pinned_pairs.some(p => 
                        (p.pair_id.$oid || p.pair_id) === (pair._id.$oid || pair._id))
                    : false;
                
                return {
                    ...pair,
                    is_pinned: isPinned
                };
            });
            
            filterAndRenderData();
            
            // Получаем информацию о панели деталей из глобального состояния
            const isDetailsPanelOpen = window.isDetailsPanelOpen || false;
            const currentDetailsPairId = window.currentDetailsPairId;
            
            if (isDetailsPanelOpen && currentDetailsPairId) {
                const pair = pairsData.find(p => 
                    (p._id.$oid || p._id) === currentDetailsPairId);
                if (pair) {
                    window.showPairDetails?.(pair);
                }
            }
        } else {
            uiHandlers.showNotification('Нет активных пар', 'warning');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        uiHandlers.showNotification('Ошибка загрузки данных', 'error');
        
        if (error.message === 'User not authenticated') {
            const { redirectToLogin } = await import('./auth.js');
            redirectToLogin();
        }
    } finally {
        setTimeout(() => {
            window.DOM.refreshButton.classList.remove('rotating');
        }, 500);
    }
}

// Фильтрация и отображение данных
export function filterAndRenderData() {
    const minSpread = parseFloat(window.DOM.spreadMin.value);
    const maxSpread = parseFloat(window.DOM.spreadMax.value);
    const minVolume = parseFloat(window.DOM.volumeMin.value);
    const maxVolume = parseFloat(window.DOM.volumeMax.value);
    const minTime = parseFloat(window.DOM.timeMin.value) * 60; 
    const maxTime = parseFloat(window.DOM.timeMax.value) * 60; 
    
    const activeCoins = Array.from(document.querySelectorAll('.coin-tag.active:not(.all-coins-btn)'))
        .map(tag => tag.dataset.coin);
    
    filteredPairsData = pairsData.filter(pair => {
        if (pair.spread < minSpread || pair.spread > maxSpread) return false;
        if (pair.available_volume_usd < minVolume || pair.available_volume_usd > maxVolume) return false;
        
        if (pair.alive_time) {
            const now = new Date();
            const aliveTime = new Date(pair.alive_time.$date || pair.alive_time);
            const seconds = Math.floor((now - aliveTime) / 1000);
            if (seconds < minTime || seconds > maxTime) return false;
        }
        
        if (activeCoins.length > 0) {
            const pairCoin = pair.coin_pair.split('/')[0];
            if (!activeCoins.includes(pairCoin)) return false;
        }
        
        const activeBuyExchanges = Array.from(document.querySelectorAll('.buy-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
            .map(tag => tag.dataset.exchange);
        
        if (activeBuyExchanges.length > 0) {
            if (!activeBuyExchanges.includes(pair.buy_exchange)) return false;
        }
        
        const activeSellExchanges = Array.from(document.querySelectorAll('.sell-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
            .map(tag => tag.dataset.exchange);
        
        if (activeSellExchanges.length > 0) {
            if (!activeSellExchanges.includes(pair.sell_exchange)) return false;
        }
        
        return true;
    });
    
    filteredPairsData = sortData(filteredPairsData, currentSortField, currentSortOrder);
    
    uiHandlers.updateStatistics();
    uiHandlers.renderHeatmap();
}

// Сортировка данных
export function sortData(data, field, order) {
    return [...data].sort((a, b) => {
        let valueA, valueB;
        
        switch (field) {
            case 'coin':
                valueA = a.coin_pair.split('/')[0];
                valueB = b.coin_pair.split('/')[0];
                break;
            case 'network':
                valueA = a.network;
                valueB = b.network;
                break;
            case 'spread':
                valueA = a.spread;
                valueB = b.spread;
                break;
            case 'profit':
                valueA = a.available_volume_usd * a.spread / 100;
                valueB = b.available_volume_usd * b.spread / 100;
                break;
            default:
                valueA = a.spread;
                valueB = b.spread;
        }
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return order === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        }
        
        return order === 'asc' ? valueA - valueB : valueB - valueA;
    });
}

// Загрузка пользовательских настроек
export function loadUserSettings() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.settings) return;
    
    const settings = currentUser.settings;
    
    if (settings.selected_coins && Array.isArray(settings.selected_coins)) {
        const coinTags = document.querySelectorAll('.coin-tag:not(.all-coins-btn)');
        coinTags.forEach(tag => {
            const coinSymbol = tag.dataset.coin;
            if (settings.selected_coins.includes(coinSymbol)) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });
        
        const allCoinsBtn = document.querySelector('.all-coins-btn');
        if (allCoinsBtn) {
            const allCoins = document.querySelectorAll('.coin-tag:not(.all-coins-btn)');
            allCoinsBtn.classList.toggle('active', settings.selected_coins.length === allCoins.length);
        }
    }
    
    if (settings.selected_buy_exchanges && Array.isArray(settings.selected_buy_exchanges)) {
        const buyExchangeTags = document.querySelectorAll('.buy-exchanges .exchange-tag:not(.all-exchanges-btn)');
        buyExchangeTags.forEach(tag => {
            const exchangeSymbol = tag.dataset.exchange;
            if (settings.selected_buy_exchanges.includes(exchangeSymbol)) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });
        
        const allBuyExchangesBtn = document.querySelector('.buy-exchanges .all-exchanges-btn');
        if (allBuyExchangesBtn) {
            const allBuyExchanges = document.querySelectorAll('.buy-exchanges .exchange-tag:not(.all-exchanges-btn)');
            allBuyExchangesBtn.classList.toggle('active', settings.selected_buy_exchanges.length === allBuyExchanges.length);
        }
    }
    
    if (settings.selected_sell_exchanges && Array.isArray(settings.selected_sell_exchanges)) {
        const sellExchangeTags = document.querySelectorAll('.sell-exchanges .exchange-tag:not(.all-exchanges-btn)');
        sellExchangeTags.forEach(tag => {
            const exchangeSymbol = tag.dataset.exchange;
            if (settings.selected_sell_exchanges.includes(exchangeSymbol)) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });
        
        const allSellExchangesBtn = document.querySelector('.sell-exchanges .all-exchanges-btn');
        if (allSellExchangesBtn) {
            const allSellExchanges = document.querySelectorAll('.sell-exchanges .exchange-tag:not(.all-exchanges-btn)');
            allSellExchangesBtn.classList.toggle('active', settings.selected_sell_exchanges.length === allSellExchanges.length);
        }
    }
    
    if (settings.update_interval) {
        const interval = parseInt(settings.update_interval.$numberInt || settings.update_interval);
        if (!isNaN(interval)) {
            const intervalButtons = document.querySelectorAll('.interval-btn');
            intervalButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.interval) === interval);
            });
            startAutoUpdate(interval);
        }
    }
    
    if (settings.spread_min !== undefined && settings.spread_max !== undefined) {
        try {
            const minSpread = parseFloat(settings.spread_min.$numberDouble || settings.spread_min);
            const maxSpread = parseFloat(settings.spread_max.$numberDouble || settings.spread_max);
            
            if (!isNaN(minSpread) && !isNaN(maxSpread)) {
                window.DOM.spreadMin.value = minSpread;
                window.DOM.spreadMax.value = maxSpread;
                window.DOM.spreadMinVal.textContent = minSpread.toFixed(1) + '%';
                window.DOM.spreadMaxVal.textContent = maxSpread.toFixed(1) + '%';
            }
        } catch (e) {
            console.error('Error loading spread range:', e);
        }
    }
    
    if (settings.volume_min !== undefined && settings.volume_max !== undefined) {
        try {
            const minVolume = parseFloat(settings.volume_min.$numberInt || settings.volume_min);
            const maxVolume = parseFloat(settings.volume_max.$numberInt || settings.volume_max);
            
            if (!isNaN(minVolume) && !isNaN(maxVolume)) {
                window.DOM.volumeMin.value = minVolume;
                window.DOM.volumeMax.value = maxVolume;
                window.DOM.volumeMinVal.textContent = formatCurrency(minVolume);
                window.DOM.volumeMaxVal.textContent = formatCurrency(maxVolume);
            }
        } catch (e) {
            console.error('Error loading volume range:', e);
        }
    }
    
    if (settings.time_min !== undefined && settings.time_max !== undefined) {
        try {
            const minTime = parseFloat(settings.time_min.$numberInt || settings.time_min);
            const maxTime = parseFloat(settings.time_max.$numberInt || settings.time_max);
            
            if (!isNaN(minTime) && !isNaN(maxTime)) {
                window.DOM.timeMin.value = minTime;
                window.DOM.timeMax.value = maxTime;
                window.DOM.timeMinVal.textContent = minTime.toString();
                window.DOM.timeMaxVal.textContent = maxTime.toString();
            }
        } catch (e) {
            console.error('Error loading time range:', e);
        }
    }
    
    if (settings.view_mode) {
        const viewMode = settings.view_mode;
        let canUseList = window.innerWidth > 840 || viewMode !== 'list';
        
        if (canUseList && ['treemap', 'grid', 'list'].includes(viewMode)) {
            currentView = viewMode;
            
            window.DOM.viewButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === viewMode);
            });
            
            document.querySelectorAll('.heatmap-view').forEach(view => {
                view.classList.toggle('active', view.id === viewMode + 'View');
            });
        }
    }
    
    if (settings.sort_field && settings.sort_order) {
        currentSortField = settings.sort_field;
        currentSortOrder = settings.sort_order;
        
        const sortButtons = document.querySelectorAll('.sort-btn');
        sortButtons.forEach(btn => {
            btn.classList.toggle('active', 
                btn.dataset.sort === currentSortField && 
                btn.dataset.order === currentSortOrder);
        });
    }
}

// Сохранение всех пользовательских настроек
export function saveAllUserSettings() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const settings = {
        ...(currentUser.settings || {}),
        selected_coins: Array.from(document.querySelectorAll('.coin-tag.active:not(.all-coins-btn)'))
            .map(tag => tag.dataset.coin),
        selected_buy_exchanges: Array.from(document.querySelectorAll('.buy-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
            .map(tag => tag.dataset.exchange),
        selected_sell_exchanges: Array.from(document.querySelectorAll('.sell-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
            .map(tag => tag.dataset.exchange),
        view_mode: currentView,
        sort_field: currentSortField,
        sort_order: currentSortOrder,
        update_interval: parseInt(document.querySelector('.interval-btn.active')?.dataset.interval || 10),
        spread_min: parseFloat(window.DOM.spreadMin.value),
        spread_max: parseFloat(window.DOM.spreadMax.value),
        volume_min: parseInt(window.DOM.volumeMin.value),
        volume_max: parseInt(window.DOM.volumeMax.value),
        time_min: parseInt(window.DOM.timeMin.value),
        time_max: parseInt(window.DOM.timeMax.value)
    };
    
    dataService.updateUserSettings(currentUser.telegram_id, settings)
        .then(response => {
            if (response.success) {
                currentUser.settings = settings;
            }
        })
        .catch(error => {
            console.error('Error saving user settings:', error);
        });
}

// Настройка обработчиков сохранения настроек
export function setupSettingsSaveListeners() {
    window.DOM.viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('disabled')) return;
            const mode = this.dataset.view;
            saveViewMode(mode);
        });
    });
    
    document.querySelectorAll('.sort-btn').forEach(button => {
        button.addEventListener('click', function() {
            const field = this.dataset.sort;
            const order = this.dataset.order;
            saveSortSettings(field, order);
        });
    });
    
    const debouncedSaveFilters = debounce(saveUserFilters, 500);
    window.DOM.spreadMin.addEventListener('change', debouncedSaveFilters);
    window.DOM.spreadMax.addEventListener('change', debouncedSaveFilters);
    window.DOM.volumeMin.addEventListener('change', debouncedSaveFilters);
    window.DOM.volumeMax.addEventListener('change', debouncedSaveFilters);
    window.DOM.timeMin.addEventListener('change', debouncedSaveFilters);
    window.DOM.timeMax.addEventListener('change', debouncedSaveFilters);
    
    window.addEventListener('beforeunload', saveAllUserSettings);
}

// Сохранение интервала обновления
export function saveUpdateInterval(seconds) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const updatedSettings = {
        ...(currentUser.settings || {}),
        update_interval: seconds
    };
    
    dataService.updateUserSettings(currentUser.telegram_id, updatedSettings)
        .then(response => {
            if (response.success) {
                currentUser.settings = updatedSettings;
            }
        })
        .catch(error => {
            console.error('Error updating interval:', error);
        });
}

// Сохранение настроек сортировки
export function saveSortSettings(field, order) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const updatedSettings = {
        ...(currentUser.settings || {}),
        sort_field: field,
        sort_order: order
    };
    
    dataService.updateUserSettings(currentUser.telegram_id, updatedSettings)
        .then(response => {
            if (response.success) {
                currentUser.settings = updatedSettings;
            }
        })
        .catch(error => {
            console.error('Error updating sort settings:', error);
        });
}

// Сохранение режима просмотра
export function saveViewMode(mode) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const updatedSettings = {
        ...(currentUser.settings || {}),
        view_mode: mode
    };
    
    dataService.updateUserSettings(currentUser.telegram_id, updatedSettings)
        .then(response => {
            if (response.success) {
                currentUser.settings = updatedSettings;
            }
        })
        .catch(error => {
            console.error('Error updating view mode:', error);
        });
}

// Сохранение фильтров пользователя
export function saveUserFilters() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const activeCoins = Array.from(document.querySelectorAll('.coin-tag.active:not(.all-coins-btn)'))
        .map(tag => tag.dataset.coin);
        
    const activeBuyExchanges = Array.from(document.querySelectorAll('.buy-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
        .map(tag => tag.dataset.exchange);
        
    const activeSellExchanges = Array.from(document.querySelectorAll('.sell-exchanges .exchange-tag.active:not(.all-exchanges-btn)'))
        .map(tag => tag.dataset.exchange);
    
    const updatedSettings = {
        ...(currentUser.settings || {}),
        selected_coins: activeCoins,
        selected_buy_exchanges: activeBuyExchanges,
        selected_sell_exchanges: activeSellExchanges,
        spread_min: parseFloat(window.DOM.spreadMin.value),
        spread_max: parseFloat(window.DOM.spreadMax.value),
        volume_min: parseInt(window.DOM.volumeMin.value),
        volume_max: parseInt(window.DOM.volumeMax.value),
        time_min: parseInt(window.DOM.timeMin.value),
        time_max: parseInt(window.DOM.timeMax.value)
    };
    
    dataService.updateUserSettings(currentUser.telegram_id, updatedSettings)
        .then(response => {
            if (response.success) {
                currentUser.settings = updatedSettings;
            }
        })
        .catch(error => {
            console.error('Error updating user filters:', error);
        });
}

// Запуск автоматического обновления
export function startAutoUpdate(seconds) {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    
    if (seconds > 0) {
        updateInterval = setInterval(() => {
            uiHandlers.animateRefreshButton(1000);
            fetchData();
        }, seconds * 1000);
        
        saveUpdateInterval(seconds);
    }
}

// Запуск обновления таймеров
export function startTimerUpdates() {
    if (timerUpdatesInterval) {
        clearInterval(timerUpdatesInterval);
    }
    
    timerUpdatesInterval = setInterval(() => {
        updateAllTimers();
    }, 1000);
}

// Обновление всех таймеров
export function updateAllTimers() {
    const listRows = document.querySelectorAll('tr[data-alive-time]');
    listRows.forEach(row => {
        const timeCell = row.querySelector('.list-updated');
        if (timeCell && row.dataset.aliveTime) {
            updateElementTimer(timeCell, row.dataset.aliveTime);
        }
    });
    
    const gridCards = document.querySelectorAll('.grid-card[data-alive-time]');
    gridCards.forEach(card => {
        const timeElement = card.querySelector('.card-updated');
        if (timeElement && card.dataset.aliveTime) {
            updateElementTimer(timeElement, card.dataset.aliveTime);
        }
    });
    
    const treemapTiles = document.querySelectorAll('.heatmap-tile[data-alive-time]');
    treemapTiles.forEach(tile => {
        const timeElement = tile.querySelector('.tile-updated');
        if (timeElement && tile.dataset.aliveTime) {
            updateElementTimer(timeElement, tile.dataset.aliveTime);
        }
    });
    
    const isDetailsPanelOpen = window.isDetailsPanelOpen || false;
    const currentDetailsPairId = window.currentDetailsPairId;
    
    if (isDetailsPanelOpen) {
        const timerElement = document.getElementById('detailsUpdated');
        const pairData = filteredPairsData.find(p => (p._id.$oid || p._id) === currentDetailsPairId);
        if (timerElement && pairData && pairData.alive_time) {
            uiHandlers.updateDetailsPanelTimer(pairData);
        }
    }
}

// Рендеринг тегов монет
export function renderCoinTags(coins) {
    const container = document.querySelector('.coin-filters');
    container.innerHTML = '';
    
    const allCoinsTag = document.createElement('div');
    allCoinsTag.className = 'coin-tag all-coins-btn';
    allCoinsTag.textContent = 'Все монеты';
    
    let allSelected = false;
    const currentUser = getCurrentUser();
    
    if (currentUser && currentUser.settings && 
        currentUser.settings.selected_coins) {
        allSelected = currentUser.settings.selected_coins.length === coins.length;
    }
    
    if (allSelected) {
        allCoinsTag.classList.add('active');
    }
    
    allCoinsTag.addEventListener('click', function() {
        const isActive = this.classList.contains('active');
        const coinTags = document.querySelectorAll('.coin-tag:not(.all-coins-btn)');
        
        coinTags.forEach(tag => {
            tag.classList.toggle('active', !isActive);
        });
        
        this.classList.toggle('active');
        filterAndRenderData();
        saveUserFilters();
    });
    
    container.appendChild(allCoinsTag);
    
    coins.forEach(coin => {
        const tag = document.createElement('div');
        tag.className = 'coin-tag';
        tag.dataset.coin = coin.symbol;
        tag.textContent = coin.symbol;
        
        if (currentUser && currentUser.settings && 
            currentUser.settings.selected_coins && 
            currentUser.settings.selected_coins.includes(coin.symbol)) {
            tag.classList.add('active');
        }
        
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const allCoinsBtn = document.querySelector('.all-coins-btn');
            const allSelected = 
                document.querySelectorAll('.coin-tag:not(.all-coins-btn)').length === 
                document.querySelectorAll('.coin-tag.active:not(.all-coins-btn)').length;
            
            if (allCoinsBtn) {
                allCoinsBtn.classList.toggle('active', allSelected);
            }
            
            filterAndRenderData();
            saveUserFilters();
        });
        
        container.appendChild(tag);
    });
    
    window.DOM.coinTags = document.querySelectorAll('.coin-tag');
    
    const style = document.createElement('style');
    style.textContent = `
        .all-coins-btn {
            background-color: var(--bg-secondary);
            font-weight: 600;
            border-color: var(--accent-blue);
        }
        .all-coins-btn.active {
            background-color: rgba(41, 98, 255, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// Рендеринг тегов бирж
export function renderExchangeTags(exchanges, type) {
    const container = type === 'buy' ? window.DOM.buyExchangeFilters : window.DOM.sellExchangeFilters;
    container.innerHTML = '';
    
    const allExchangesTag = document.createElement('div');
    allExchangesTag.className = 'exchange-tag all-exchanges-btn';
    allExchangesTag.dataset.type = type;
    allExchangesTag.textContent = 'Все биржи';
    
    let allSelected = true;
    const currentUser = getCurrentUser();
    
    if (currentUser && currentUser.settings) {
        const settingKey = type === 'buy' ? 'selected_buy_exchanges' : 'selected_sell_exchanges';
        if (currentUser.settings[settingKey] && Array.isArray(currentUser.settings[settingKey])) {
            allSelected = currentUser.settings[settingKey].length === exchanges.length;
        }
    }
    
    if (allSelected) {
        allExchangesTag.classList.add('active');
    }
    
    allExchangesTag.addEventListener('click', function() {
        const isActive = this.classList.contains('active');
        const exchangeTags = container.querySelectorAll('.exchange-tag:not(.all-exchanges-btn)');
        
        exchangeTags.forEach(tag => {
            tag.classList.toggle('active', !isActive);
        });
        
        this.classList.toggle('active');
        filterAndRenderData();
        saveUserFilters();
    });
    
    container.appendChild(allExchangesTag);
    
    exchanges.forEach(exchange => {
        const tag = document.createElement('div');
        tag.className = 'exchange-tag';
        tag.dataset.exchange = exchange.symbol;
        tag.dataset.type = type;
        tag.textContent = exchange.name;
        
        const settingKey = type === 'buy' ? 'selected_buy_exchanges' : 'selected_sell_exchanges';
        
        if (currentUser && currentUser.settings && 
            currentUser.settings[settingKey] && 
            currentUser.settings[settingKey].includes(exchange.symbol)) {
            tag.classList.add('active');
        } else if (allSelected) {
            tag.classList.add('active');
        }
        
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const allExchangesBtn = container.querySelector('.all-exchanges-btn');
            const allSelected = 
                container.querySelectorAll('.exchange-tag:not(.all-exchanges-btn)').length === 
                container.querySelectorAll('.exchange-tag.active:not(.all-exchanges-btn)').length;
            
            if (allExchangesBtn) {
                allExchangesBtn.classList.toggle('active', allSelected);
            }
            
            filterAndRenderData();
            saveUserFilters();
        });
        
        container.appendChild(tag);
    });
}
