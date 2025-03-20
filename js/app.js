import { setupDOMElements, setupEventListeners, setupRangeSliders, replaceSortingControls, 
         ensureRefreshButtonStyle, setupCollapsibleFilterGroups, setupMobileFilterToggle, 
         enhanceListView, checkListViewAvailability, fixVolumeSlider, renderHeatmap } from './ui.js';
import { initializeUser } from './auth.js';
import { loadExchangesAndCoins, fetchData, startAutoUpdate, startTimerUpdates, 
         getCurrentView, setupSettingsSaveListeners } from './data-manager.js';

// Глобальные переменные
let lastWindowWidth = window.innerWidth;
export function getLastWindowWidth() { return lastWindowWidth; }
export function setLastWindowWidth(width) { lastWindowWidth = width; }

// Обработчик события изменения размера окна
function handleWindowResize() {
    const currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - lastWindowWidth) > 50) {
        lastWindowWidth = currentWidth;
        checkListViewAvailability();
        if (getCurrentView() === 'treemap') {
            renderTreemap();
        }
    }
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async function() {
    setupDOMElements();
    const isAuthenticated = await initializeUser();
    if (!isAuthenticated) return;
    
    setupRangeSliders();
    replaceSortingControls();
    ensureRefreshButtonStyle();
    setupCollapsibleFilterGroups();
    setupEventListeners();
    
    await loadExchangesAndCoins();
    await fetchData();
    
    startTimerUpdates();
    startAutoUpdate(10); 
    
    window.addEventListener('resize', handleWindowResize);
    setupMobileFilterToggle();
    enhanceListView();
    checkListViewAvailability();
    fixVolumeSlider();
    setupSettingsSaveListeners();
});
