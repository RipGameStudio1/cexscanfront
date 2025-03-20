import { getHeatClass, formatPercent, formatPrice, formatNumber, formatCurrency, updateElementTimer } from './utils.js';
import { getCurrentView, getFilteredPairsData, getPairsData, filterAndRenderData, saveUserFilters, setUIHandlers } from './data-manager.js';
import { hasAccessToTradingPairs, getCurrentUser } from './auth.js';
import { dataService } from './data-service.js';

// Глобальные переменные для UI
export let isDetailsPanelOpen = false;
export let currentDetailsPairId = null;
let detailsPanelTimerId = null;

// Делаем доступными через window для доступа из других модулей без циклических зависимостей
window.isDetailsPanelOpen = isDetailsPanelOpen;
window.currentDetailsPairId = currentDetailsPairId;
window.showPairDetails = showPairDetails;

// Регистрация UI-обработчиков для data-manager.js
setUIHandlers({
    renderHeatmap,
    updateStatistics,
    showNotification,
    animateRefreshButton,
    renderPurchaseLicenseMessage,
    updateDetailsPanelTimer
});

// Настройка DOM-элементов
export function setupDOMElements() {
    window.DOM = {
        viewButtons: document.querySelectorAll('.view-btn'),
        intervalButtons: document.querySelectorAll('.interval-btn'),
        coinTags: document.querySelectorAll('.coin-tag'),
        buyExchangeFilters: document.querySelector('.buy-exchanges'),
        sellExchangeFilters: document.querySelector('.sell-exchanges'),
        refreshButton: document.getElementById('refreshData'),
        coinSearch: document.getElementById('coinSearch'),
        treemapView: document.getElementById('treemapView'),
        gridView: document.getElementById('gridView'),
        listView: document.getElementById('listView'),
        detailsPanel: document.getElementById('pairDetailsPanel'),
        closeDetailsBtn: document.getElementById('closeDetailsPanel'),
        detailsPinBtn: document.getElementById('detailsPinBtn'),
        spreadMin: document.getElementById('spreadMin'),
        spreadMax: document.getElementById('spreadMax'),
        volumeMin: document.getElementById('volumeMin'),
        volumeMax: document.getElementById('volumeMax'),
        timeMin: document.getElementById('timeMin'),
        timeMax: document.getElementById('timeMax'),
        spreadMinVal: document.getElementById('spreadMinVal'),
        spreadMaxVal: document.getElementById('spreadMaxVal'),
        volumeMinVal: document.getElementById('volumeMinVal'),
        volumeMaxVal: document.getElementById('volumeMaxVal'),
        timeMinVal: document.getElementById('timeMinVal'),
        timeMaxVal: document.getElementById('timeMaxVal'),
        pairsCount: document.getElementById('pairsCount'),
        maxSpread: document.getElementById('maxSpread'),
        totalVolume: document.getElementById('totalVolume'),
        username: document.querySelector('.username'),
        licenseStatus: document.querySelector('.license-status'),
        mainContent: document.querySelector('.main-content')
    };
}

// Настройка обработчиков событий
export function setupEventListeners() {
    window.DOM.viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('disabled')) return;
            
            // Переключаем активную кнопку
            window.DOM.viewButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const selectedView = this.dataset.view;
            
            // Форсируем немедленное переключение без анимации
            document.querySelectorAll('.heatmap-view').forEach(view => {
                // Сначала убираем все переходы и анимации
                view.style.transition = 'none';
                view.classList.remove('active');
                view.style.display = 'none';
            });
            
            // Вызываем reflow для применения изменений
            document.body.offsetHeight;
            
            // Активируем выбранный вид
            const targetView = document.getElementById(`${selectedView}View`);
            if (targetView) {
                // Сразу устанавливаем display: block перед добавлением класса active
                targetView.style.display = 'block';
                
                // Еще один reflow
                document.body.offsetHeight;
                
                // Добавляем класс active
                targetView.classList.add('active');
            }
            
            // Обновляем состояние в data-manager
            import('./data-manager.js').then(module => {
                module.setCurrentView(selectedView);
                
                // Принудительно перерисовываем нужный вид
                if (selectedView === 'treemap') {
                    renderTreemap();
                } else if (selectedView === 'grid') {
                    renderGrid();
                } else if (selectedView === 'list') {
                    renderList();
                }
            });
        });
    });
    
    setupSortButtons();
    
    window.DOM.intervalButtons.forEach(button => {
        button.addEventListener('click', function() {
            window.DOM.intervalButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const interval = parseInt(this.dataset.interval);
            import('./data-manager.js').then(module => {
                module.startAutoUpdate(interval);
            });
        });
    });
    
    window.DOM.coinSearch.addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        
        window.DOM.coinTags.forEach(tag => {
            const coinText = tag.textContent.toLowerCase();
            
            if (coinText.includes(searchText)) {
                tag.style.display = 'inline-block';
            } else {
                tag.style.display = 'none';
            }
        });
    });
    
    window.DOM.refreshButton.addEventListener('click', function() {
        animateRefreshButton(2000);
        
        import('./data-manager.js').then(module => {
            module.fetchData();
        });
    });
    
    window.DOM.closeDetailsBtn.addEventListener('click', function() {
        window.DOM.detailsPanel.classList.remove('active');
        isDetailsPanelOpen = false;
        window.isDetailsPanelOpen = false;
        currentDetailsPairId = null;
        window.currentDetailsPairId = null;
        window.DOM.mainContent.classList.remove('details-open');
        
        if (detailsPanelTimerId) {
            clearInterval(detailsPanelTimerId);
            detailsPanelTimerId = null;
        }
    });
    
    setupRangeListeners();
}

// Настройка кнопок сортировки
export function setupSortButtons() {
    const sortButtons = document.querySelectorAll('.sort-btn');
    
    sortButtons.forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            import('./data-manager.js').then(module => {
                module.setCurrentSortField(this.dataset.sort);
                module.setCurrentSortOrder(this.dataset.order);
                module.saveSortSettings(this.dataset.sort, this.dataset.order);
                module.filterAndRenderData();
            });
        });
    });
}

// Проверка доступности списочного представления
export function checkListViewAvailability() {
    const listViewBtn = document.querySelector('.view-btn[data-view="list"]');
    
    if (window.innerWidth <= 840) {
        if (listViewBtn) {
            listViewBtn.classList.add('disabled');
            listViewBtn.setAttribute('disabled', 'disabled');
        }
        
        import('./data-manager.js').then(module => {
            if (module.getCurrentView() === 'list') {
                const gridViewBtn = document.querySelector('.view-btn[data-view="grid"]');
                
                if (gridViewBtn) {
                    window.DOM.viewButtons.forEach(btn => btn.classList.remove('active'));
                    gridViewBtn.classList.add('active');
                    
                    module.setCurrentView('grid');
                    module.saveViewMode('grid');
                    
                    document.querySelectorAll('.heatmap-view').forEach(view => {
                        view.classList.remove('active');
                        view.innerHTML = '';
                        view.removeAttribute('style');
                    });
                    
                    document.getElementById('gridView').classList.add('active');
                    renderGrid();
                }
            }
        });
    } else {
        if (listViewBtn) {
            listViewBtn.classList.remove('disabled');
            listViewBtn.removeAttribute('disabled');
        }
    }
}

// Анимация кнопки обновления
export function animateRefreshButton(duration = 1000) {
    if (!window.DOM.refreshButton) return;
    
    window.DOM.refreshButton.classList.add('rotating');
    
    setTimeout(() => {
        window.DOM.refreshButton.classList.remove('rotating');
    }, duration);
}

// Настройка стилей для кнопки обновления
export function ensureRefreshButtonStyle() {
    if (!document.getElementById('refresh-btn-style')) {
        const style = document.createElement('style');
        style.id = 'refresh-btn-style';
        style.textContent = `
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .refresh-btn.rotating {
                animation: rotate 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }
}

// Настройка ползунков диапазонов
export function setupRangeSliders() {
    if (window.DOM.spreadMin) {
        window.DOM.spreadMin.max = 100;
        window.DOM.spreadMin.value = 0;
        window.DOM.spreadMinVal.textContent = '0%';
    }
    
    if (window.DOM.spreadMax) {
        window.DOM.spreadMax.max = 100;
        window.DOM.spreadMax.value = 100;
        window.DOM.spreadMaxVal.textContent = '100%';
    }
    
    if (window.DOM.volumeMax && window.DOM.volumeMin) {
        if (window.volumeMinHandler) {
            window.DOM.volumeMin.removeEventListener('input', window.volumeMinHandler);
        }
        
        if (window.volumeMaxHandler) {
            window.DOM.volumeMax.removeEventListener('input', window.volumeMaxHandler);
        }
        
        const MAX_VOLUME = 10000;
        
        window.DOM.volumeMin.max = MAX_VOLUME;
        window.DOM.volumeMax.max = MAX_VOLUME;
        window.DOM.volumeMin.step = 10;
        window.DOM.volumeMax.step = 10;
        window.DOM.volumeMax.value = MAX_VOLUME;
        window.DOM.volumeMaxVal.textContent = formatCurrency(MAX_VOLUME);
        
        window.volumeMinHandler = function() {
            const minVal = parseInt(this.value);
            const maxVal = parseInt(window.DOM.volumeMax.value);
            
            if(minVal > maxVal) {
                window.DOM.volumeMax.value = minVal;
                window.DOM.volumeMaxVal.textContent = formatCurrency(minVal);
            }
            
            window.DOM.volumeMinVal.textContent = formatCurrency(minVal);
            filterAndRenderData();
        };
        
        window.volumeMaxHandler = function() {
            const maxVal = parseInt(this.value);
            const minVal = parseInt(window.DOM.volumeMin.value);
            
            if(maxVal < minVal) {
                window.DOM.volumeMin.value = maxVal;
                window.DOM.volumeMinVal.textContent = formatCurrency(maxVal);
            }
            
            window.DOM.volumeMaxVal.textContent = formatCurrency(maxVal);
            filterAndRenderData();
        };
        
        window.DOM.volumeMin.addEventListener('input', window.volumeMinHandler);
        window.DOM.volumeMax.addEventListener('input', window.volumeMaxHandler);
    }
    
    if (window.DOM.timeMin) {
        window.DOM.timeMin.max = 1440; 
        window.DOM.timeMin.value = 0;
        window.DOM.timeMinVal.textContent = '0';
    }
    
    if (window.DOM.timeMax) {
        window.DOM.timeMax.max = 1440; 
        window.DOM.timeMax.value = 1440;
        window.DOM.timeMaxVal.textContent = '1440';
    }
}

// Исправление ползунка объема
export function fixVolumeSlider() {
    if (window.DOM.volumeMax) {
        window.DOM.volumeMax.setAttribute('max', '10000');
        window.DOM.volumeMax.setAttribute('value', Math.min(window.DOM.volumeMax.value, 10000));
        window.DOM.volumeMaxVal.textContent = formatCurrency(parseInt(window.DOM.volumeMax.value));
    }
}

// Настройка обработчиков ползунков
export function setupRangeListeners() {
    window.DOM.spreadMin.addEventListener('input', function() {
        const minVal = parseFloat(this.value);
        const maxVal = parseFloat(window.DOM.spreadMax.value);
        
        if(minVal > maxVal) {
            window.DOM.spreadMax.value = minVal;
        }
        
        window.DOM.spreadMinVal.textContent = minVal.toFixed(1) + '%';
        filterAndRenderData();
    });
    
    window.DOM.spreadMax.addEventListener('input', function() {
        const maxVal = parseFloat(this.value);
        const minVal = parseFloat(window.DOM.spreadMin.value);
        
        if(maxVal < minVal) {
            window.DOM.spreadMin.value = maxVal;
        }
        
        window.DOM.spreadMaxVal.textContent = maxVal.toFixed(1) + '%';
        filterAndRenderData();
    });
    
    window.DOM.timeMin.addEventListener('input', function() {
        const minVal = parseFloat(this.value);
        const maxVal = parseFloat(window.DOM.timeMax.value);
        
        if(minVal > maxVal) {
            window.DOM.timeMax.value = minVal;
        }
        
        window.DOM.timeMinVal.textContent = minVal;
        filterAndRenderData();
    });
    
    window.DOM.timeMax.addEventListener('input', function() {
        const maxVal = parseFloat(this.value);
        const minVal = parseFloat(window.DOM.timeMin.value);
        
        if(maxVal < minVal) {
            window.DOM.timeMin.value = maxVal;
        }
        
        window.DOM.timeMaxVal.textContent = maxVal;
        filterAndRenderData();
    });
}

// Замена элементов управления сортировкой
export function replaceSortingControls() {
    const groupingBlock = document.querySelector('.filter-group:nth-child(2)');
    if (!groupingBlock) return;
    
    groupingBlock.innerHTML = `
        <h3>Сортировка</h3>
        <div class="sort-options">
            <button class="sort-btn" data-sort="coin" data-order="asc">
                <span class="material-icons-round">sort_by_alpha</span>
                <span>По монете ↑</span>
            </button>
            <button class="sort-btn" data-sort="coin" data-order="desc">
                <span class="material-icons-round">sort_by_alpha</span>
                <span>По монете ↓</span>
            </button>
            <button class="sort-btn" data-sort="network" data-order="asc">
                <span class="material-icons-round">lan</span>
                <span>По сети ↑</span>
            </button>
            <button class="sort-btn" data-sort="network" data-order="desc">
                <span class="material-icons-round">lan</span>
                <span>По сети ↓</span>
            </button>
            <button class="sort-btn active" data-sort="spread" data-order="desc">
                <span class="material-icons-round">trending_up</span>
                <span>По спреду ↓</span>
            </button>
            <button class="sort-btn" data-sort="spread" data-order="asc">
                <span class="material-icons-round">trending_down</span>
                <span>По спреду ↑</span>
            </button>
            <button class="sort-btn" data-sort="profit" data-order="desc">
                <span class="material-icons-round">payments</span>
                <span>По прибыли ↓</span>
            </button>
            <button class="sort-btn" data-sort="profit" data-order="asc">
                <span class="material-icons-round">payments</span>
                <span>По прибыли ↑</span>
            </button>
        </div>
    `;
}

// Настройка сворачиваемых групп фильтров
export function setupCollapsibleFilterGroups() {
    const filterGroups = document.querySelectorAll('.filter-panel .filter-group');
    
    filterGroups.forEach(group => {
        const heading = group.querySelector('h3');
        if (!heading) return;
        
        const headingContainer = document.createElement('div');
        headingContainer.className = 'filter-heading';
        
        const headingText = document.createElement('h3');
        headingText.textContent = heading.textContent;
        
        const collapseBtn = document.createElement('span');
        collapseBtn.className = 'material-icons-round collapse-btn';
        collapseBtn.textContent = 'expand_less';
        
        headingContainer.appendChild(headingText);
        headingContainer.appendChild(collapseBtn);
        
        heading.parentNode.replaceChild(headingContainer, heading);
        
        const content = document.createElement('div');
        content.className = 'filter-group-content';
        
        while (group.children[1]) {
            content.appendChild(group.children[1]);
        }
        
        group.appendChild(content);
        
        headingContainer.addEventListener('click', function() {
            group.classList.toggle('collapsed');
            
            if (group.classList.contains('collapsed')) {
                collapseBtn.textContent = 'expand_more';
            } else {
                collapseBtn.textContent = 'expand_less';
            }
        });
    });
}

// Настройка кнопки переключения фильтров для мобильных устройств
export function setupMobileFilterToggle() {
    const filterToggleBtn = document.createElement('button');
    filterToggleBtn.className = 'filter-toggle-btn';
    filterToggleBtn.innerHTML = '<span class="material-icons-round">filter_list</span>';
    
    document.body.appendChild(filterToggleBtn);
    
    const filterOverlay = document.createElement('div');
    filterOverlay.className = 'filter-overlay';
    
    document.body.appendChild(filterOverlay);
    
    filterToggleBtn.addEventListener('click', function() {
        const filterPanel = document.querySelector('.filter-panel');
        filterPanel.classList.toggle('active');
        filterOverlay.classList.toggle('active');
    });
    
    filterOverlay.addEventListener('click', function() {
        const filterPanel = document.querySelector('.filter-panel');
        filterPanel.classList.remove('active');
        filterOverlay.classList.remove('active');
    });
}

// Улучшение представления списка
export function enhanceListView() {
    const listView = document.getElementById('listView');
    if (!listView) return;
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';
    
    const existingTable = listView.querySelector('.list-table');
    
    if (existingTable) {
        listView.innerHTML = '';
        scrollContainer.appendChild(existingTable);
        listView.appendChild(scrollContainer);
    } else {
        listView.appendChild(scrollContainer);
    }
}

// Обновление статистики
export function updateStatistics() {
    if (!window.DOM.pairsCount || !window.DOM.maxSpread || !window.DOM.totalVolume) return;
    
    const filteredPairsData = getFilteredPairsData();
    
    window.DOM.pairsCount.textContent = filteredPairsData.length;
    
    const maxSpread = filteredPairsData.length > 0 ? 
        Math.max(...filteredPairsData.map(p => p.spread)) : 0;
    window.DOM.maxSpread.textContent = formatPercent(maxSpread);
    
    const totalVolume = filteredPairsData.reduce((sum, p) => sum + (p.available_volume_usd || 0), 0);
    window.DOM.totalVolume.textContent = formatCurrency(totalVolume);
}

// Рендеринг тепловой карты
export function renderHeatmap() {
    const currentView = getCurrentView();
    
    switch (currentView) {
        case 'treemap':
            renderTreemap();
            break;
        case 'grid':
            renderGrid();
            break;
        case 'list':
            renderList();
            break;
    }
}

// Рендеринг сообщения о необходимости приобретения лицензии
export function renderPurchaseLicenseMessage(container) {
    container.innerHTML = '';
    
    const currentUser = getCurrentUser();
    
    const hasFreeAccount = currentUser && 
        currentUser.license && 
        currentUser.license.type === "Free";
    
    const hasInactiveLicense = currentUser && 
        currentUser.license && 
        !currentUser.license.is_active;
    
    if (!hasFreeAccount && !hasInactiveLicense) {
        return false;
    }
    
    const messageContainer = document.createElement('div');
    messageContainer.className = 'license-required-message';
    
    let message;
    
    if (hasFreeAccount) {
        message = `
            <div class="license-message-content">
                <h2>Для доступа к торговым парам необходима лицензия</h2>
                <p>У вас установлена бесплатная лицензия (Free), которая не предоставляет доступ к торговым парам.</p>
                <p>Для получения полного доступа приобретите лицензию в Telegram боте.</p>
                <button id="purchaseLicenseBtn" class="purchase-btn">Приобрести лицензию</button>
            </div>
        `;
    } else {
        message = `
            <div class="license-message-content">
                <h2>Ваша лицензия неактивна</h2>
                <p>Для восстановления доступа к торговым парам, пожалуйста, продлите вашу лицензию.</p>
                <button id="purchaseLicenseBtn" class="purchase-btn">Продлить лицензию</button>
            </div>
        `;
    }
    
    messageContainer.innerHTML = message;
    container.appendChild(messageContainer);
    
    if (!document.getElementById('license-required-styles')) {
        const style = document.createElement('style');
        style.id = 'license-required-styles';
        style.textContent = `
            .license-required-message {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100%;
                width: 100%;
                padding: 20px;
                text-align: center;
            }
            .license-message-content {
                background-color: var(--bg-secondary);
                border-radius: var(--border-radius);
                padding: 30px;
                max-width: 500px;
                box-shadow: var(--shadow-md);
            }
            .license-message-content h2 {
                color: var(--text-primary);
                margin-bottom: 20px;
            }
            .license-message-content p {
                color: var(--text-secondary);
                margin-bottom: 15px;
            }
            .purchase-btn {
                background-color: var(--accent-blue);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-weight: 500;
                margin-top: 10px;
                transition: background-color 0.2s;
            }
            .purchase-btn:hover {
                background-color: var(--accent-blue-hover);
            }
        `;
        document.head.appendChild(style);
    }
    
    const purchaseBtn = document.getElementById('purchaseLicenseBtn');
    if (purchaseBtn) {
        purchaseBtn.addEventListener('click', function() {
            window.open('https://t.me/example_bot');
        });
    }
    
    return true; 
}

// Рендеринг древовидной карты
export function renderTreemap() {
    const container = window.DOM.treemapView;
    container.innerHTML = '';
    
    if (!hasAccessToTradingPairs()) {
        renderPurchaseLicenseMessage(container);
        return;
    }
    
    const filteredPairsData = getFilteredPairsData();
    
    if (filteredPairsData.length === 0) {
        container.innerHTML = '<div class="no-data">Нет данных, соответствующих фильтрам</div>';
        return;
    }
    
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    container.style.gridAutoRows = 'minmax(100px, auto)';
    container.style.gap = '1px';
    container.style.gridAutoFlow = 'dense';
    container.style.backgroundColor = 'var(--bg-secondary)';
    
    filteredPairsData.forEach((pair, index) => {
        const heatClass = getHeatClass(pair.spread);
        let tileSize = 1;
        
        if (index < 5) {
            tileSize = 2;
        }
        
        const tile = document.createElement('div');
        tile.className = `heatmap-tile ${heatClass}`;
        
        if (tileSize > 1) {
            tile.style.gridColumn = `span ${tileSize}`;
            tile.style.gridRow = `span ${tileSize}`;
        }
        
        tile.style.borderRadius = '0';
        tile.style.margin = '0';
        
        if (pair.alive_time) {
            tile.dataset.aliveTime = pair.alive_time.$date || pair.alive_time;
        }
        
        if (pair.is_pinned) {
            tile.classList.add('pinned');
        }
        
        tile.innerHTML = `
            <div class="tile-content">
                <div class="tile-header">
                    <div class="tile-pair">${pair.coin_pair}</div>
                    <div class="tile-spread">+${formatPercent(pair.spread)}</div>
                </div>
                <div class="tile-body">
                    <div class="tile-exchanges">
                        <span class="exchange-link" data-url="${pair.buy_url || '#'}">${pair.buy_exchange}</span> → 
                        <span class="exchange-link" data-url="${pair.sell_url || '#'}">${pair.sell_exchange}</span>
                    </div>
                </div>
                <div class="tile-footer">
                    <div class="tile-volume">$${formatNumber(pair.available_volume_usd)}</div>
                    <div class="tile-updated"></div>
                </div>
            </div>
        `;
        
        const timeElement = tile.querySelector('.tile-updated');
        if (timeElement && pair.alive_time) {
            updateElementTimer(timeElement, pair.alive_time.$date || pair.alive_time);
        }
        
        tile.addEventListener('click', (e) => {
            if (!e.target.classList.contains('exchange-link')) {
                showPairDetails(pair);
            }
        });
        
        const exchangeLinks = tile.querySelectorAll('.exchange-link');
        exchangeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const url = link.dataset.url;
                if (url && url !== '#') {
                    window.open(url, '_blank');
                }
            });
        });
        
        container.appendChild(tile);
    });
}

// Рендеринг сетки
export function renderGrid() {
    console.time('gridRender'); // замер производительности
    const container = window.DOM.gridView;
    container.innerHTML = '';
    
    if (!hasAccessToTradingPairs()) {
        renderPurchaseLicenseMessage(container);
        return;
    }
    
    const filteredPairsData = getFilteredPairsData();
    
    if (filteredPairsData.length === 0) {
        container.innerHTML = '<div class="no-data">Нет данных, соответствующих фильтрам</div>';
        return;
    }
    
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'grid-cards';
    
    filteredPairsData.forEach(pair => {
        const heatClass = getHeatClass(pair.spread);
        
        const card = document.createElement('div');
        card.className = `grid-card ${heatClass}`;
        
        if (pair.alive_time) {
            card.dataset.aliveTime = pair.alive_time.$date || pair.alive_time;
        }
        
        if (pair.is_pinned) {
            card.classList.add('pinned');
        }
        
        card.innerHTML = `
            <div class="card-content">
                <div class="card-header">
                    <div>
                        <div class="card-pair">${pair.coin_pair}</div>
                        <div class="card-network">${pair.network}</div>
                    </div>
                    <div class="card-spread">+${formatPercent(pair.spread)}</div>
                </div>
                <div class="card-exchanges">
                    <div class="card-buy">
                        <div class="exchange-label">Покупка</div>
                        <div class="exchange-name exchange-link" data-url="${pair.buy_url || '#'}">${pair.buy_exchange}</div>
                        <div class="exchange-price">$${formatPrice(pair.buy_price)}</div>
                    </div>
                    <div class="card-sell">
                        <div class="exchange-label">Продажа</div>
                        <div class="exchange-name exchange-link" data-url="${pair.sell_url || '#'}">${pair.sell_exchange}</div>
                        <div class="exchange-price">$${formatPrice(pair.sell_price)}</div>
                    </div>
                </div>
                <div class="card-footer">
                    <div>Объем: $${formatNumber(pair.available_volume_usd)}</div>
                    <div>Прибыль: $${formatNumber(pair.available_volume_usd * pair.spread / 100)}</div>
                    <div class="card-updated"></div>
                </div>
            </div>
        `;
        
        const timeElement = card.querySelector('.card-updated');
        if (timeElement && pair.alive_time) {
            updateElementTimer(timeElement, pair.alive_time.$date || pair.alive_time);
        }
        
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('exchange-link')) {
                showPairDetails(pair);
            }
        });
        
        const exchangeLinks = card.querySelectorAll('.exchange-link');
        exchangeLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const url = link.dataset.url;
                if (url && url !== '#') {
                    window.open(url, '_blank');
                }
            });
        });
        
        cardsContainer.appendChild(card);
    });
    
    container.appendChild(cardsContainer);
console.timeEnd('gridRender'); // окончание замера
}

// Рендеринг списка
export function renderList() {
    console.time('listRender'); // замер производительности
    const container = window.DOM.listView;
    container.innerHTML = '';
    
    if (!hasAccessToTradingPairs()) {
        renderPurchaseLicenseMessage(container);
        return;
    }
    
    const filteredPairsData = getFilteredPairsData();
    
    if (filteredPairsData.length === 0) {
        container.innerHTML = '<div class="no-data">Нет данных, соответствующих фильтрам</div>';
        return;
    }
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';
    
    const table = document.createElement('table');
    table.className = 'list-table';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Пара', 'Сеть', 'Спред', 'Покупка', 'Продажа', 'Объем', 'Прибыль', 'Обновлено'];
    
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    filteredPairsData.forEach(pair => {
        const heatClass = getHeatClass(pair.spread);
        
        const row = document.createElement('tr');
        
        if (pair.is_pinned) {
            row.classList.add('pinned');
        }
        
        if (pair.alive_time) {
            row.dataset.aliveTime = pair.alive_time.$date || pair.alive_time;
        }
        
        const pairCell = document.createElement('td');
        pairCell.textContent = pair.coin_pair;
        row.appendChild(pairCell);
        
        const networkCell = document.createElement('td');
        networkCell.className = 'list-network';
        networkCell.textContent = pair.network;
        row.appendChild(networkCell);
        
        const spreadCell = document.createElement('td');
        spreadCell.className = `list-spread ${heatClass}`;
        spreadCell.textContent = '+' + formatPercent(pair.spread);
        row.appendChild(spreadCell);
        
        const buyCell = document.createElement('td');
        buyCell.textContent = `${pair.buy_exchange} ($${formatPrice(pair.buy_price)})`;
        row.appendChild(buyCell);
        
        const sellCell = document.createElement('td');
        sellCell.textContent = `${pair.sell_exchange} ($${formatPrice(pair.sell_price)})`;
        row.appendChild(sellCell);
        
        const volumeCell = document.createElement('td');
        volumeCell.className = 'list-volume';
        volumeCell.textContent = '$' + formatNumber(pair.available_volume_usd);
        row.appendChild(volumeCell);
        
        const profitCell = document.createElement('td');
        profitCell.className = 'list-profit';
        profitCell.textContent = '$' + formatNumber(pair.available_volume_usd * pair.spread / 100);
        row.appendChild(profitCell);
        
        const timeCell = document.createElement('td');
        timeCell.className = 'list-updated';
        row.appendChild(timeCell);
        
        if (pair.alive_time) {
            updateElementTimer(timeCell, pair.alive_time.$date || pair.alive_time);
        }
        
        row.addEventListener('click', () => {
            showPairDetails(pair);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    scrollContainer.appendChild(table);
    container.appendChild(scrollContainer);
    console.timeEnd('listRender'); // окончание замера
}

// Отображение деталей пары
export function showPairDetails(pair) {
    if (detailsPanelTimerId) {
        clearInterval(detailsPanelTimerId);
        detailsPanelTimerId = null;
    }
    
    currentDetailsPairId = pair._id.$oid || pair._id;
    window.currentDetailsPairId = currentDetailsPairId;
    
    document.getElementById('detailsPairName').textContent = pair.coin_pair;
    document.getElementById('detailsNetwork').textContent = pair.network;
    
    const spreadElement = document.getElementById('detailsSpread');
    spreadElement.textContent = '+' + formatPercent(pair.spread);
    spreadElement.className = 'spread-badge ' + getHeatClass(pair.spread);
    
    document.getElementById('detailsBuyExchange').textContent = pair.buy_exchange;
    document.getElementById('detailsBuyPrice').textContent = '$' + formatPrice(pair.buy_price);
    
    document.getElementById('detailsSellExchange').textContent = pair.sell_exchange;
    document.getElementById('detailsSellPrice').textContent = '$' + formatPrice(pair.sell_price);
    
    document.getElementById('detailsVolume').textContent = '$' + formatNumber(pair.available_volume_usd);
    
    const commissionText = pair.commission + ' ' + pair.coin_pair.split('/')[0];
    document.getElementById('detailsCommission').textContent = commissionText;
    
    const profit = (pair.available_volume_usd * pair.spread / 100);
    document.getElementById('detailsProfit').textContent = '$' + formatNumber(profit);
    
    const buyBtn = document.getElementById('detailsBuyBtn');
    buyBtn.querySelector('span:last-child').textContent = 'Купить на ' + pair.buy_exchange;
    buyBtn.onclick = function() {
        if (pair.buy_url && pair.buy_url !== '#') {
            window.open(pair.buy_url, '_blank');
        } else {
            showNotification('Ссылка для покупки недоступна', 'warning');
        }
    };
    
    const sellBtn = document.getElementById('detailsSellBtn');
    sellBtn.querySelector('span:last-child').textContent = 'Продать на ' + pair.sell_exchange;
    sellBtn.onclick = function() {
        if (pair.sell_url && pair.sell_url !== '#') {
            window.open(pair.sell_url, '_blank');
        } else {
            showNotification('Ссылка для продажи недоступна', 'warning');
        }
    };
    
    const pinBtn = document.getElementById('detailsPinBtn');
    pinBtn.classList.toggle('active', pair.is_pinned);
    pinBtn.querySelector('span:last-child').textContent = pair.is_pinned ? 'Открепить' : 'Закрепить';
    
    pinBtn.onclick = async function() {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            showNotification('Необходима авторизация', 'warning');
            return;
        }
        
        try {
            const pairId = pair._id.$oid || pair._id;
            
            if (pair.is_pinned) {
                await dataService.unpinPair(pairId, currentUser.telegram_id);
                pinBtn.classList.remove('active');
                pinBtn.querySelector('span:last-child').textContent = 'Закрепить';
            } else {
                await dataService.pinPair(pairId, currentUser.telegram_id);
                pinBtn.classList.add('active');
                pinBtn.querySelector('span:last-child').textContent = 'Открепить';
            }
            
            setTimeout(() => {
                import('./data-manager.js').then(module => {
                    module.fetchData();
                });
            }, 300);
            
            showNotification('Статус закрепления изменен', 'success');
        } catch (error) {
            console.error('Error toggling pin status:', error);
            showNotification('Ошибка при изменении статуса закрепления', 'error');
        }
    };
    
    updateDetailsPanelTimer(pair);
    startDetailsPanelTimer(pair);
    
    window.DOM.mainContent.classList.add('details-open');
    window.DOM.detailsPanel.classList.add('active');
    isDetailsPanelOpen = true;
    window.isDetailsPanelOpen = true;
}

// Обновление таймера на панели деталей
export function updateDetailsPanelTimer(pair) {
    if (!pair.alive_time) return;
    
    const timerElement = document.getElementById('detailsUpdated');
    if (!timerElement) return;
    
    const now = new Date();
    const aliveTime = new Date(pair.alive_time.$date || pair.alive_time);
    const diffInSeconds = Math.floor((now - aliveTime) / 1000);
    
    const hours = Math.floor(diffInSeconds / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    const seconds = diffInSeconds % 60;
    
    const timeStr = 
        (hours > 0 ? hours + 'ч ' : '') + 
        (minutes > 0 ? minutes + 'м ' : '') + 
        seconds + 'с назад';
    
    timerElement.textContent = timeStr;
}

// Запуск таймера для панели деталей
export function startDetailsPanelTimer(pair) {
    if (!pair.alive_time) return;
    
    detailsPanelTimerId = setInterval(() => {
        updateDetailsPanelTimer(pair);
    }, 1000);
    
    return detailsPanelTimerId;
}

// Отображение уведомления
export function showNotification(message, type = 'info') {
    let notification = document.querySelector('.toast');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'toast';
        document.body.appendChild(notification);
    }
    
    notification.className = 'toast';
    
    switch (type) {
        case 'success':
            notification.style.borderColor = 'var(--accent-green)';
            notification.style.color = 'var(--accent-green)';
            break;
        case 'error':
            notification.style.borderColor = 'var(--accent-red)';
            notification.style.color = 'var(--accent-red)';
            break;
        case 'warning':
            notification.style.borderColor = 'var(--heat-warm-2)';
            notification.style.color = 'var(--heat-warm-2)';
            break;
        default:
            notification.style.borderColor = 'var(--accent-blue)';
            notification.style.color = 'var(--accent-blue)';
    }
    
    notification.textContent = message;
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
