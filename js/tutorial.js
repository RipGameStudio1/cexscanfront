// tutorial.js - Модуль интерактивного обучения
import { getCurrentUser } from './auth.js';
import { showNotification } from './ui.js';
import { dataService } from './data-service.js';

// Состояние обучения
let tutorialState = {
    isActive: false,        // Активно ли обучение сейчас
    currentStep: 0,         // Текущий шаг обучения
    stepCompleted: false,   // Выполнен ли текущий шаг
    userId: null,           // ID пользователя для сохранения прогресса
    isMobile: false,        // Мобильное ли устройство
    completedTutorial: false, // Завершил ли пользователь обучение ранее
    highlightedElements: [], // Массив для отслеживания подсвеченных элементов
    scrollHandler: null      // Обработчик прокрутки для обновления позиций
};

// Определение шагов обучения - интерактивные задачи
const tutorialSteps = [
    // Шаг 1: Приветствие и знакомство с интерфейсом
    {
        target: '.logo',  // Уточненный селектор - теперь логотип вместо всего хедера
        title: 'Добро пожаловать в CEX-CEX Scan!',
        content: 'Это приложение поможет вам найти арбитражные возможности между криптовалютными биржами. Давайте познакомимся с интерфейсом!',
        position: 'bottom',
        action: 'next',
        mobileAdjust: false
    },
    
    // Шаг 2: Режимы просмотра
    {
        target: '.view-controls',
        title: 'Режимы просмотра',
        content: 'Попробуйте переключиться между режимами визуализации данных. Нажмите на кнопку "Grid" или "List".',
        position: 'bottom',
        action: 'click',
        actionTarget: '.view-btn:not(.active)',
        highlightActionTargets: true,  // Подсвечиваем только цели действия
        mobileAdjust: true,
        mobilePosition: 'bottom'
    },
    
    // Шаг 3: Фильтрация по монетам
    {
        target: '.coin-filters',
        title: 'Фильтр монет',
        content: 'Выберите интересующие вас монеты, нажав на любую неактивную монету из списка.',
        position: 'right',
        action: 'click',
        actionTarget: '.coin-tag:not(.active):not(.all-coins-btn)',  // Уточненный селектор
        highlightActionTargets: true,  // Подсвечиваем только цели действия
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 4: Настройка диапазона спреда
    {
        target: '.range-filter:first-child',
        title: 'Настройка спреда',
        content: 'Установите минимальный или максимальный процент спреда, передвигая ползунки.',
        position: 'right',
        action: 'input',
        actionTarget: '#spreadMin, #spreadMax',
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 5: Просмотр карточек пар
    {
        target: '.stats',  // Уточненный селектор - теперь статистика вместо всего view
        title: 'Статистика торговых пар',
        content: 'Здесь отображается количество доступных пар, максимальный спред и общий объем.',
        position: 'bottom',
        action: 'next',
        mobileAdjust: false
    },
    
    // Шаг 6: Открытие деталей пары
    {
        target: '.heatmap-view.active > div:first-child',  // Первый элемент в активном виде
        title: 'Детали пары',
        content: 'Нажмите на первую карточку, чтобы увидеть подробную информацию о торговой паре.',
        position: 'top',
        action: 'click',
        mobileAdjust: false,
        beforeShow: ensureFirstPairVisible  // Убедимся, что первая пара видна
    },
    
    // Шаг 7: Панель деталей - действия
    {
        target: '.action-buttons',
        title: 'Действия с парой',
        content: 'Здесь вы можете перейти на биржи для покупки и продажи выбранной монеты.',
        position: 'left',
        action: 'next',
        waitForElement: '.details-panel.active',
        mobileAdjust: true,
        mobilePosition: 'top'
    },
    
    // Шаг 8: Закрепление пары
    {
        target: '#detailsPinBtn',
        title: 'Закрепление пары',
        content: 'Нажмите эту кнопку, чтобы закрепить интересующую пару. Закрепленные пары выделяются в списке и всегда показываются первыми в результатах.',
        position: 'top',
        action: 'click',
        mobileAdjust: true,
        mobilePosition: 'top'
    },
    
    // Шаг 9: Закрытие деталей
    {
        target: '#closeDetailsPanel',
        title: 'Закрытие панели',
        content: 'Закройте панель деталей, чтобы вернуться к списку пар.',
        position: 'right',
        action: 'click',
        mobileAdjust: false
    },
    
    // Шаг 10: Просмотр закрепленной пары
    {
        target: '.pinned:first-child', // Первая закрепленная пара
        title: 'Закрепленная пара',
        content: 'Закрепленные пары отмечаются специальным образом и показываются выше остальных в списке результатов.',
        position: 'top',
        action: 'next',
        beforeShow: ensureFirstPinnedPairVisible, // Убедимся, что закрепленная пара видна
        waitForElement: '.pinned', // Дождемся появления закрепленных пар
        mobileAdjust: false
    },
    
    // Шаг 11: Настройка автообновления
    {
        target: '.interval-options',
        title: 'Интервал обновления',
        content: 'Выберите, как часто данные будут обновляться автоматически. Нажмите на любую кнопку интервала.',
        position: 'right',
        action: 'click',
        actionTarget: '.interval-btn:not(.active)',
        highlightActionTargets: true,
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 12: Сортировка
    {
        target: '.sort-options',
        title: 'Сортировка данных',
        content: 'Выберите, как сортировать данные. Попробуйте изменить сортировку, нажав на любую другую кнопку.',
        position: 'right',
        action: 'click',
        actionTarget: '.sort-btn:not(.active)',
        highlightActionTargets: true,
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 13: Завершение
    {
        target: '.tutorial-button',
        title: 'Поздравляем!',
        content: 'Вы успешно прошли обучение! Эта кнопка позволит вам пройти обучение заново в любой момент.',
        position: 'top',
        action: 'next',
        mobileAdjust: false
    }
];

// Функция для обеспечения видимости первой пары
function ensureFirstPairVisible() {
    // Получаем текущий активный вид
    const activeView = document.querySelector('.heatmap-view.active');
    if (!activeView) return;
    
    // Выбираем первый элемент в зависимости от текущего вида
    let firstElement;
    
    if (activeView.id === 'treemapView') {
        firstElement = activeView.querySelector('.heatmap-tile');
    } else if (activeView.id === 'gridView') {
        firstElement = activeView.querySelector('.grid-card');
    } else if (activeView.id === 'listView') {
        firstElement = activeView.querySelector('tbody tr');
    }
    
    if (firstElement) {
        // Прокручиваем до элемента
        firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }
    
    return false;
}

// Функция для обеспечения видимости первой закрепленной пары
function ensureFirstPinnedPairVisible() {
    // Имитируем задержку для подгрузки пар
    return new Promise(resolve => {
        setTimeout(() => {
            // Получаем текущий активный вид
            const activeView = document.querySelector('.heatmap-view.active');
            if (!activeView) {
                resolve(false);
                return;
            }
            
            // Находим первую закрепленную пару
            let pinnedElement;
            
            if (activeView.id === 'treemapView') {
                pinnedElement = activeView.querySelector('.heatmap-tile.pinned');
            } else if (activeView.id === 'gridView') {
                pinnedElement = activeView.querySelector('.grid-card.pinned');
            } else if (activeView.id === 'listView') {
                pinnedElement = activeView.querySelector('tbody tr.pinned');
            }
            
            // Если нет закрепленных пар, переходим к следующему шагу
            if (!pinnedElement) {
                // Попробуем найти любую пару
                console.warn('Закрепленная пара не найдена, ищем любую пару');
                ensureFirstPairVisible();
                resolve(false);
                return;
            }
            
            // Прокручиваем к закрепленной паре
            pinnedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Выделяем закрепленную пару
            pinnedElement.classList.add('highlight-tutorial');
            setTimeout(() => {
                pinnedElement.classList.remove('highlight-tutorial');
            }, 2000);
            
            resolve(true);
        }, 800); // Даем время на обновление интерфейса
    });
}

// Вспомогательные функции для мобильных устройств
function openMobileFilters() {
    const filterPanel = document.querySelector('.filter-panel');
    const filterOverlay = document.querySelector('.filter-overlay');
    
    if (filterPanel && !filterPanel.classList.contains('active')) {
        filterPanel.classList.add('active');
        if (filterOverlay) filterOverlay.classList.add('active');
        
        // Задержка для анимации открытия
        return 300;
    }
    return 0;
}

// Функция debounce для оптимизации частых вызовов
function debounce(func, wait) {
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

// Основные функции модуля
export function initializeTutorial() {
    // Проверка, нужно ли показывать обучение
    const currentUser = getCurrentUser();
    if (currentUser) {
        tutorialState.userId = currentUser.telegram_id;
        tutorialState.completedTutorial = currentUser.settings?.completed_tutorial || false;
    }
    
    // Определение типа устройства
    tutorialState.isMobile = window.innerWidth <= 768;
    
    // Добавление кнопки запуска обучения
    addTutorialButton();
    
    // Автоматический запуск обучения для новых пользователей
    if (!tutorialState.completedTutorial) {
        // Небольшая задержка, чтобы интерфейс успел загрузиться
        setTimeout(() => {
            startTutorial();
        }, 1500);
    }
    
    // Отслеживание изменения размера окна
    window.addEventListener('resize', debounce(() => {
        tutorialState.isMobile = window.innerWidth <= 768;
        if (tutorialState.isActive) {
            updateTutorialUI();
        }
    }, 200));
}

export function startTutorial() {
    // Сброс состояния
    tutorialState.isActive = true;
    tutorialState.currentStep = 0;
    tutorialState.stepCompleted = false;
    tutorialState.highlightedElements = [];
    
    // Создание UI обучения
    createTutorialUI();
    
    // Добавление обработчика скролла для актуализации позиции подсветки
    setupScrollHandler();
    
    // Показ первого шага
    showTutorialStep(0);
}

// Публичный метод для полного перезапуска обучения
export function restartTutorial() {
    // Полностью очищаем UI обучения
    removeTutorialUI();
    
    // Сбрасываем состояние
    tutorialState.isActive = false;
    tutorialState.currentStep = 0;
    tutorialState.stepCompleted = false;
    tutorialState.highlightedElements = [];
    
    // Небольшая задержка для гарантии очистки
    setTimeout(() => {
        startTutorial();
    }, 500);
}

// Добавляем обработчик прокрутки для обновления позиций элементов обучения
function setupScrollHandler() {
    // Очищаем предыдущий обработчик, если он был
    if (tutorialState.scrollHandler) {
        window.removeEventListener('scroll', tutorialState.scrollHandler);
    }
    
    // Создаем новый обработчик с debounce для производительности
    tutorialState.scrollHandler = debounce(() => {
        if (tutorialState.isActive) {
            updateTutorialUI();
        }
    }, 100);
    
    // Добавляем обработчик
    window.addEventListener('scroll', tutorialState.scrollHandler, { passive: true });
}

// Удаление обработчика прокрутки
function removeScrollHandler() {
    if (tutorialState.scrollHandler) {
        window.removeEventListener('scroll', tutorialState.scrollHandler);
        tutorialState.scrollHandler = null;
    }
}

// Добавление кнопки запуска обучения
function addTutorialButton() {
    const filterPanel = document.querySelector('.filter-panel');
    if (!filterPanel) return;
    
    // Проверяем, существует ли уже кнопка
    if (document.querySelector('.tutorial-button-container')) {
        return;
    }
    
    const tutorialButton = document.createElement('button');
    tutorialButton.className = 'tutorial-button';
    tutorialButton.innerHTML = `
        <span class="material-icons-round">school</span>
        <span>Начать обучение</span>
    `;
    
    tutorialButton.addEventListener('click', startTutorial);
    
    // Создаем контейнер для кнопки
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'filter-group tutorial-button-container';
    buttonContainer.appendChild(tutorialButton);
    
    // Добавляем в конец панели фильтров
    filterPanel.appendChild(buttonContainer);
    
    // Добавляем стили
    addTutorialStyles();
}

// Добавление стилей для обучения
function addTutorialStyles() {
    const styleId = 'tutorial-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Стили для кнопки обучения */
        .tutorial-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            background-color: var(--accent-blue);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: var(--transition-fast);
        }
        
        .tutorial-button:hover {
            background-color: var(--accent-blue);
            opacity: 0.9;
        }
        
        .tutorial-button-container {
            margin-top: auto;
            padding-top: 20px;
        }
        
        /* Стили для UI обучения */
        .tutorial-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9998 !important;
            pointer-events: none !important;
        }
        
        .tutorial-spotlight {
            position: absolute;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
            border-radius: 4px;
            pointer-events: none;
            z-index: 9999 !important;
            transition: all 0.3s ease;
        }
        
        .tutorial-tooltip {
            position: absolute;
            background-color: var(--bg-secondary);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
            padding: 16px;
            z-index: 10001 !important;
            min-width: 250px;
            max-width: 350px;
            animation: fadeIn 0.3s ease;
            pointer-events: auto !important;
        }
        
        .tutorial-tooltip-title {
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 8px;
            color: var(--accent-blue);
        }
        
        .tutorial-tooltip-content {
            margin-bottom: 16px;
            line-height: 1.5;
        }
        
        .tutorial-tooltip-actions {
            display: flex;
            justify-content: space-between;
        }
        
        .tutorial-btn {
            padding: 8px 16px;
            border-radius: var(--border-radius);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .tutorial-next-btn {
            background-color: var(--accent-blue);
            color: white;
            border: none;
        }
        
        .tutorial-next-btn:hover {
            background-color: var(--accent-blue);
            opacity: 0.9;
        }
        
        .tutorial-skip-btn {
            background-color: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--text-secondary);
        }
        
        .tutorial-skip-btn:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }
        
        /* Подсветка элемента во время обучения */
        .highlight-tutorial {
            position: relative;
            z-index: 10000;
            animation: pulse-border 1.5s infinite;
        }
        
        /* Анимации */
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0.7), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(41, 98, 255, 0), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
            100% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
        }
        
        @keyframes pulse-border {
            0% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(41, 98, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0); }
        }
        
        .tutorial-spotlight.pulse {
            animation: pulse 1.5s infinite;
        }
        
        /* Анимация окончания обучения */
        .tutorial-ending {
            transition: opacity 0.3s ease;
            opacity: 0;
        }
        
        /* Нормализация z-index */
        .view-controls {
            position: relative;
            z-index: 1;  /* Низкий z-index в обычном состоянии */
        }
        
        /* Мобильные адаптации */
        @media (max-width: 768px) {
            .tutorial-tooltip {
                max-width: 300px;
                min-width: 200px;
            }
        }
        
        @media (max-width: 480px) {
            .tutorial-tooltip {
                max-width: 260px;
                min-width: 200px;
            }
            
            .tutorial-tooltip-title {
                font-size: 14px;
            }
            
            .tutorial-tooltip-content {
                font-size: 12px;
            }
            
            .tutorial-btn {
                padding: 6px 12px;
                font-size: 12px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Создание UI обучения
function createTutorialUI() {
    // Удаляем старые элементы, если они есть
    removeTutorialUI();
    
    // Создаем оверлей
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    document.body.appendChild(overlay);
    
    // Создаем подсветку
    const spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';
    document.body.appendChild(spotlight);
    
    // Создаем тултип
    const tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip';
    document.body.appendChild(tooltip);
}

// Удаление UI обучения и очистка состояний
function removeTutorialUI() {
    const overlay = document.querySelector('.tutorial-overlay');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const tooltip = document.querySelector('.tutorial-tooltip');
    
    if (overlay) overlay.remove();
    if (spotlight) spotlight.remove();
    if (tooltip) tooltip.remove();
    
    // Очищаем стили у подсвеченных элементов
    clearHighlightedElements();
    
    // Восстанавливаем нормальное состояние интерфейса
    restoreUIState();
    
    // Удаляем обработчик прокрутки
    removeScrollHandler();
}

// Очистка стилей у ранее подсвеченных элементов
function clearHighlightedElements() {
    tutorialState.highlightedElements.forEach(element => {
        if (element && element.style) {
            element.style.position = '';
            element.style.zIndex = '';
            element.style.pointerEvents = '';
            element.classList.remove('highlight-tutorial');
        }
    });
    
    tutorialState.highlightedElements = [];
    
    // Принудительно очищаем стили для view-controls
    const viewControls = document.querySelector('.view-controls');
    if (viewControls) {
        viewControls.style.position = '';
        viewControls.style.zIndex = '';
        
        // Очищаем стили для дочерних элементов
        const viewButtons = viewControls.querySelectorAll('.view-btn');
        viewButtons.forEach(button => {
            button.style.position = '';
            button.style.zIndex = '';
            button.style.pointerEvents = '';
        });
    }
}

// Восстановление нормального состояния UI
function restoreUIState() {
    // Получаем все основные элементы интерфейса, которые могли быть изменены
    const elementsToReset = [
        '.view-controls',
        '.view-btn',
        '.sort-btn',
        '.interval-btn',
        '.coin-tag',
        '.exchange-tag',
        '.all-coins-btn',
        '.all-exchanges-btn'
    ];
    
    // Очищаем стили для всех этих элементов
    elementsToReset.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element) {
                element.style.position = '';
                element.style.zIndex = '';
                element.style.pointerEvents = '';
            }
        });
    });
}

// Показ шага обучения
async function showTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        completeTutorial();
        return;
    }
    
    // Очищаем стили предыдущих элементов перед переходом к новому шагу
    clearHighlightedElements();
    
    tutorialState.currentStep = stepIndex;
    tutorialState.stepCompleted = false;
    
    const step = tutorialSteps[stepIndex];
    
    // Проверка наличия элемента ожидания
    if (step.waitForElement) {
        await waitForElement(step.waitForElement);
    }
    
    // Если есть предварительная функция обработки
    if (step.beforeShow) {
        const result = await Promise.resolve(step.beforeShow());
        if (result === false) {
            console.warn(`Пропуск шага ${stepIndex} из-за beforeShow возвращает false`);
            showTutorialStep(stepIndex + 1);
            return;
        }
    }
    
    // Если на мобильных нужны дополнительные действия
    let delay = 0;
    if (tutorialState.isMobile && step.mobileAdjust && step.mobileCallback) {
        delay = step.mobileCallback();
    }
    
    // Задержка для мобильных действий
    setTimeout(async () => {
        let targetElements = [];
        
        // Получение целевого элемента(ов)
        if (step.highlightActionTargets && step.actionTarget) {
            // Если нужно подсветить элементы действия
            targetElements = Array.from(document.querySelectorAll(step.actionTarget));
        } else {
            // Иначе используем основной целевой элемент
            const mainTarget = document.querySelector(step.target);
            if (mainTarget) {
                targetElements = [mainTarget];
            }
        }
        
        if (targetElements.length === 0) {
            console.warn(`Не найден элемент для шага обучения: ${step.target}`);
            
            // Пробуем следующий шаг после небольшой задержки
            setTimeout(() => {
                showTutorialStep(stepIndex + 1);
            }, 500);
            
            return;
        }
        
        // Берем первый элемент для центрирования
        const primaryElement = targetElements[0];
        
        // Прокручиваем страницу к элементу
        scrollToElement(primaryElement);
        
        // Даем время на прокрутку
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Сохраняем ссылки на элементы для последующей очистки
        tutorialState.highlightedElements = [...targetElements];
        
        // Подсвечиваем элемент(ы)
        if (targetElements.length === 1) {
            highlightElement(primaryElement, step);
        } else {
            // Если есть несколько элементов, подсвечиваем их все
            highlightMultipleElements(targetElements, step);
        }
        
        // Показываем тултип
        showTooltip(primaryElement, step);
        
        // Настраиваем действие для завершения шага
        setupStepAction(step, stepIndex);
    }, delay);
}

// Функция для прокрутки к элементу
function scrollToElement(element) {
    if (!element) return;
    
    try {
        // Получаем позицию элемента
        const rect = element.getBoundingClientRect();
        
        // Проверяем, виден ли элемент полностью в области просмотра
        const isInViewport = (
            rect.top >= 50 && // Учитываем верхний отступ для хедера
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight - 50) && // Учитываем нижний отступ
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        // Если элемент не полностью видим, прокручиваем к нему
        if (!isInViewport) {
            // Используем плавную прокрутку
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
            
            // На всякий случай возвращаем промис для ожидания окончания прокрутки
            return new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error('Ошибка при прокрутке к элементу:', error);
    }
    
    return Promise.resolve();
}

// Обновление UI обучения (при изменении размера окна, прокрутке и т.д.)
function updateTutorialUI() {
    if (!tutorialState.isActive) return;
    
    const step = tutorialSteps[tutorialState.currentStep];
    if (!step) return;
    
    // Получаем целевые элементы
    let targetElements = [];
    
    if (step.highlightActionTargets && step.actionTarget) {
        targetElements = Array.from(document.querySelectorAll(step.actionTarget));
    } else {
        const mainTarget = document.querySelector(step.target);
        if (mainTarget) {
            targetElements = [mainTarget];
        }
    }
    
    if (targetElements.length === 0) return;
    
    // Берем первый элемент для позиционирования
    const primaryElement = targetElements[0];
    
    // Обновляем подсветку без прокрутки
    if (targetElements.length === 1) {
        updateHighlightElement(primaryElement, step);
    } else {
        updateHighlightMultipleElements(targetElements, step);
    }
    
    // Обновляем позицию тултипа
    const tooltip = document.querySelector('.tutorial-tooltip');
    if (tooltip) {
        const position = tutorialState.isMobile && step.mobileAdjust && step.mobilePosition 
                        ? step.mobilePosition 
                        : step.position;
                        
        positionTooltip(tooltip, primaryElement, position);
    }
}

// Обновление выделения элемента без прокрутки
function updateHighlightElement(element, step) {
    const spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight || !element) return;
    
    const rect = element.getBoundingClientRect();
    
    // Добавляем немного отступа для лучшей видимости
    const padding = 4;
    
    // Позиция и размеры подсветки
    spotlight.style.top = `${rect.top - padding + window.scrollY}px`;
    spotlight.style.left = `${rect.left - padding + window.scrollX}px`;
    spotlight.style.width = `${rect.width + padding * 2}px`;
    spotlight.style.height = `${rect.height + padding * 2}px`;
}

// Обновление выделения нескольких элементов без прокрутки
function updateHighlightMultipleElements(elements, step) {
    const spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight || elements.length === 0) return;
    
    const firstRect = elements[0].getBoundingClientRect();
    
    const padding = 4;
    
    spotlight.style.top = `${firstRect.top - padding + window.scrollY}px`;
    spotlight.style.left = `${firstRect.left - padding + window.scrollX}px`;
    spotlight.style.width = `${firstRect.width + padding * 2}px`;
    spotlight.style.height = `${firstRect.height + padding * 2}px`;
}

// Ожидание появления элемента
function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve();
        }
        
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Таймаут на случай, если элемент не появится
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 5000);
    });
}

// Функция завершения обучения
function completeTutorial() {
    // Добавляем класс для плавного исчезновения
    const overlay = document.querySelector('.tutorial-overlay');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const tooltip = document.querySelector('.tutorial-tooltip');
    
    if (overlay) overlay.classList.add('tutorial-ending');
    if (spotlight) spotlight.classList.add('tutorial-ending');
    if (tooltip) tooltip.classList.add('tutorial-ending');
    
    // Даем анимации завершиться перед удалением
    setTimeout(() => {
        // Удаление UI обучения
        removeTutorialUI();
        
        // Обновление состояния
        tutorialState.isActive = false;
        tutorialState.completedTutorial = true;
        
        // Сохранение прогресса
        if (tutorialState.userId) {
            saveTutorialProgress();
        }
        
        // Показ уведомления
        showNotification('Обучение завершено! Теперь вы готовы использовать CEX-CEX Scan.', 'success');
    }, 300);
}

// Сохранение прогресса обучения
async function saveTutorialProgress() {
    try {
        const currentUser = getCurrentUser();
        if (currentUser) {
            const updatedSettings = {
                ...(currentUser.settings || {}),
                completed_tutorial: true
            };
            
            await dataService.updateUserSettings(tutorialState.userId, updatedSettings);
        }
    } catch (error) {
        console.error('Ошибка при сохранении прогресса обучения:', error);
    }
}

// Подсветка элемента
function highlightElement(element, step) {
    if (!element) return;
    
    const spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight) return;
    
    const rect = element.getBoundingClientRect();
    
    // Добавляем немного отступа для лучшей видимости
    const padding = 4;
    
    // Позиция и размеры подсветки с учетом прокрутки
    spotlight.style.top = `${rect.top - padding + window.scrollY}px`;
    spotlight.style.left = `${rect.left - padding + window.scrollX}px`;
    spotlight.style.width = `${rect.width + padding * 2}px`;
    spotlight.style.height = `${rect.height + padding * 2}px`;
    
    // Добавляем эффект пульсации, если это нужно
    spotlight.classList.toggle('pulse', step.action === 'click');
    
    // Делаем элемент кликабельным, если это нужно
    if (step.action === 'click' || step.action === 'input') {
        spotlight.style.pointerEvents = 'none';
        element.style.position = 'relative';
        element.style.zIndex = '10000';
        element.style.pointerEvents = 'auto';
    }
}

// Подсветка нескольких элементов
function highlightMultipleElements(elements, step) {
    const spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight || elements.length === 0) return;
    
    // Если элементов нет, скрываем подсветку
    if (elements.length === 0) {
        spotlight.style.display = 'none';
        return;
    }
    
    // Используем первый элемент как основу для подсветки
    const firstRect = elements[0].getBoundingClientRect();
    
    // Делаем все элементы кликабельными
    elements.forEach(element => {
        if (step.action === 'click' || step.action === 'input') {
            element.style.position = 'relative';
            element.style.zIndex = '10000';
            element.style.pointerEvents = 'auto';
        }
    });
    
    // Устанавливаем подсветку на первый элемент
    const padding = 4;
    
    spotlight.style.top = `${firstRect.top - padding + window.scrollY}px`;
    spotlight.style.left = `${firstRect.left - padding + window.scrollX}px`;
    spotlight.style.width = `${firstRect.width + padding * 2}px`;
    spotlight.style.height = `${firstRect.height + padding * 2}px`;
    
    // Добавляем эффект пульсации
    spotlight.classList.toggle('pulse', step.action === 'click');
    spotlight.style.pointerEvents = 'none';
    spotlight.style.display = 'block';
}

// Показ тултипа с проверкой перекрытия
function showTooltip(targetElement, step) {
    const tooltip = document.querySelector('.tutorial-tooltip');
    if (!tooltip || !targetElement) return;
    
    // Наполняем контентом
    tooltip.innerHTML = `
        <div class="tutorial-tooltip-title">${step.title}</div>
        <div class="tutorial-tooltip-content">${step.content}</div>
        <div class="tutorial-tooltip-actions">
            <button class="tutorial-btn tutorial-skip-btn">Пропустить</button>
            <button class="tutorial-btn tutorial-next-btn">${step.action === 'next' ? 'Далее' : 'Готово'}</button>
        </div>
    `;
    
    // Определяем, какую позицию использовать для тултипа
    let position = step.position;
    
    // Для мобильных устройств может быть своя позиция
    if (tutorialState.isMobile && step.mobileAdjust && step.mobilePosition) {
        position = step.mobilePosition;
    }
    
    // Список возможных позиций в порядке приоритета
    const positions = ['top', 'bottom', 'left', 'right'];
    
    // Убеждаемся, что текущая позиция в начале списка
    positions.splice(positions.indexOf(position), 1);
    positions.unshift(position);
    
    // Проверяем каждую позицию, начиная с предпочтительной
    let bestPosition = position;
    let bestOverlap = Infinity;
    
    for (const pos of positions) {
        // Предварительно позиционируем тултип
        tooltip.style.visibility = 'hidden';
        positionTooltipAt(tooltip, targetElement, pos);
        
        // Проверяем перекрытие с целевым элементом
        const overlap = getOverlap(tooltip, targetElement);
        
        // Выбираем позицию с наименьшим перекрытием
        if (overlap < bestOverlap) {
            bestOverlap = overlap;
            bestPosition = pos;
            
            // Если перекрытия нет вообще, сразу используем эту позицию
            if (overlap === 0) break;
        }
    }
    
    // Устанавливаем тултип в лучшую позицию
    tooltip.style.visibility = 'visible';
    positionTooltipAt(tooltip, targetElement, bestPosition);
    
    // Обработчики кнопок
    const skipBtn = tooltip.querySelector('.tutorial-skip-btn');
    const nextBtn = tooltip.querySelector('.tutorial-next-btn');
    
    skipBtn.addEventListener('click', completeTutorial);
    
    if (step.action === 'next') {
        nextBtn.addEventListener('click', () => {
            showTutorialStep(tutorialState.currentStep + 1);
        });
    } else {
        nextBtn.addEventListener('click', () => {
            tutorialState.stepCompleted = true;
            checkStepCompletion();
        });
    }
}

// Определение площади перекрытия двух элементов
function getOverlap(elem1, elem2) {
    const rect1 = elem1.getBoundingClientRect();
    const rect2 = elem2.getBoundingClientRect();
    
    const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
    const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
    
    return xOverlap * yOverlap;
}

// Позиционирование тултипа
function positionTooltip(tooltip, targetElement, position) {
    if (!tooltip || !targetElement) return;
    positionTooltipAt(tooltip, targetElement, position);
}

// Позиционирование тултипа в определенной позиции
function positionTooltipAt(tooltip, targetElement, position) {
    const rect = targetElement.getBoundingClientRect();
    
    // Сначала устанавливаем минимальную ширину, чтобы корректно рассчитать размеры
    tooltip.style.visibility = 'hidden';
    
    // Убедимся, что тултип добавлен в DOM
    if (!tooltip.parentNode || tooltip.parentNode !== document.body) {
        document.body.appendChild(tooltip);
    }
    
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
        case 'top':
            top = rect.top - tooltipRect.height - 10 + window.scrollY;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;
            break;
        case 'bottom':
            top = rect.bottom + 10 + window.scrollY;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;
            break;
        case 'left':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2) + window.scrollY;
            left = rect.left - tooltipRect.width - 10 + window.scrollX;
            break;
        case 'right':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2) + window.scrollY;
            left = rect.right + 10 + window.scrollX;
            break;
        default:
            top = rect.bottom + 10 + window.scrollY;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;
    }
    
    // Проверка, чтобы тултип не выходил за границы экрана
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (left < scrollX + 10) left = scrollX + 10;
    if (left + tooltipRect.width > scrollX + windowWidth - 10) 
        left = scrollX + windowWidth - tooltipRect.width - 10;
    if (top < scrollY + 10) top = scrollY + 10;
    if (top + tooltipRect.height > scrollY + windowHeight - 10)
        top = scrollY + windowHeight - tooltipRect.height - 10;
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = 'visible';
}

// Настройка действия для завершения шага
function setupStepAction(step, stepIndex) {
    if (step.action === 'next') return;
    
    const actionTargets = step.actionTarget 
        ? document.querySelectorAll(step.actionTarget) 
        : [document.querySelector(step.target)];
    
    if (!actionTargets.length) return;
    
    // Конвертируем NodeList в массив
    const targets = Array.from(actionTargets);
    
    switch (step.action) {
        case 'click':
            targets.forEach(target => {
                if (!target) return;
                
                const clickHandler = () => {
                    tutorialState.stepCompleted = true;
                    setTimeout(() => {
                        showTutorialStep(stepIndex + 1);
                    }, 500);
                    
                    // Удаляем обработчики со всех целей
                    targets.forEach(t => t.removeEventListener('click', clickHandler));
                };
                
                target.addEventListener('click', clickHandler);
            });
            break;
            
        case 'input':
            targets.forEach(target => {
                if (!target) return;
                
                const inputHandler = () => {
                    tutorialState.stepCompleted = true;
                    setTimeout(() => {
                        showTutorialStep(stepIndex + 1);
                    }, 500);
                    
                    // Удаляем обработчики со всех целей
                    targets.forEach(t => {
                        t.removeEventListener('input', inputHandler);
                        t.removeEventListener('change', inputHandler);
                    });
                };
                
                target.addEventListener('input', inputHandler);
                target.addEventListener('change', inputHandler);
            });
            break;
    }
}

// Проверка завершения шага
function checkStepCompletion() {
    if (tutorialState.stepCompleted) {
        showTutorialStep(tutorialState.currentStep + 1);
    }
}

// Функция для возможности внешнего сброса прогресса обучения
export function resetTutorialProgress() {
    tutorialState.completedTutorial = false;
    
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.telegram_id) {
        // Сохраняем в настройках пользователя
        const updatedSettings = {
            ...(currentUser.settings || {}),
            completed_tutorial: false
        };
        
        dataService.updateUserSettings(currentUser.telegram_id, updatedSettings).catch(error => {
            console.error('Ошибка при сбросе прогресса обучения:', error);
        });
    }
    
    showNotification('Прогресс обучения сброшен. Вы можете пройти обучение снова.', 'info');
}

// Экспорт дополнительных функций для взаимодействия с другими модулями
export function isTutorialActive() {
    return tutorialState.isActive;
}

export function isTutorialCompleted() {
    return tutorialState.completedTutorial;
}

export function getCurrentTutorialStep() {
    return tutorialState.currentStep;
}
