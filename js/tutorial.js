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
    completedTutorial: false // Завершил ли пользователь обучение ранее
};

// Определение шагов обучения - интерактивные задачи
const tutorialSteps = [
    // Шаг 1: Приветствие и знакомство с интерфейсом
    {
        target: '.app-header',
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
        content: 'Попробуйте переключиться между режимами визуализации данных. Нажмите на любую другую кнопку вида.',
        position: 'bottom',
        action: 'click',
        actionTarget: '.view-btn:not(.active)',
        mobileAdjust: true,
        mobilePosition: 'bottom'
    },
    
    // Шаг 3: Фильтрация по монетам
    {
        target: '.coin-filters',
        title: 'Фильтр монет',
        content: 'Выберите интересующие вас монеты, нажав на один из тегов.',
        position: 'right',
        action: 'click',
        actionTarget: '.coin-tag:not(.active)',
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 4: Настройка диапазона спреда
    {
        target: '.range-filter:first-child',
        title: 'Настройка спреда',
        content: 'Установите минимальный и максимальный процент спреда, передвигая ползунки.',
        position: 'right',
        action: 'input',
        actionTarget: '#spreadMin, #spreadMax',
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 5: Просмотр карточек пар
    {
        target: '.heatmap-view.active',
        title: 'Карточки торговых пар',
        content: 'Здесь отображаются пары с возможностью арбитража. Цвет карточки указывает на величину спреда - чем "горячее", тем выше процент.',
        position: 'top',
        action: 'next',
        mobileAdjust: false
    },
    
    // Шаг 6: Открытие деталей пары
    {
        target: '.heatmap-view.active > div:first-child',
        title: 'Детали пары',
        content: 'Нажмите на карточку, чтобы увидеть подробную информацию о торговой паре.',
        position: 'top',
        action: 'click',
        mobileAdjust: false
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
        content: 'Нажмите эту кнопку, чтобы закрепить интересующую пару. Закрепленные пары выделяются в списке и всегда отображаются первыми.',
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
    
    // Шаг 10: Настройка автообновления
    {
        target: '.interval-options',
        title: 'Интервал обновления',
        content: 'Выберите, как часто данные будут обновляться автоматически. Нажмите на любую кнопку интервала.',
        position: 'right',
        action: 'click',
        actionTarget: '.interval-btn:not(.active)',
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 11: Сортировка
    {
        target: '.sort-options',
        title: 'Сортировка данных',
        content: 'Выберите, как сортировать данные. Попробуйте изменить сортировку.',
        position: 'right',
        action: 'click',
        actionTarget: '.sort-btn:not(.active)',
        mobileAdjust: true,
        mobileCallback: openMobileFilters
    },
    
    // Шаг 12: Завершение
    {
        target: '.app-header',
        title: 'Поздравляем!',
        content: 'Вы успешно прошли обучение и теперь готовы использовать CEX-CEX Scan для поиска лучших арбитражных возможностей!',
        position: 'bottom',
        action: 'next',
        mobileAdjust: false
    }
];

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
    window.addEventListener('resize', () => {
        tutorialState.isMobile = window.innerWidth <= 768;
        if (tutorialState.isActive) {
            // Перепозиционирование элементов обучения
            const currentStep = tutorialSteps[tutorialState.currentStep];
            const targetElement = document.querySelector(currentStep.target);
            if (targetElement) {
                highlightElement(targetElement, currentStep);
                repositionTooltip();
            }
        }
    });
}

export function startTutorial() {
    // Сброс состояния
    tutorialState.isActive = true;
    tutorialState.currentStep = 0;
    tutorialState.stepCompleted = false;
    
    // Создание UI обучения
    createTutorialUI();
    
    // Показ первого шага
    showTutorialStep(0);
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

// Добавление кнопки запуска обучения
function addTutorialButton() {
    const filterPanel = document.querySelector('.filter-panel');
    if (!filterPanel) return;
    
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
            z-index: 9998;
            pointer-events: none;
        }
        
        .tutorial-spotlight {
            position: absolute;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
            border-radius: 4px;
            pointer-events: none;
            z-index: 9999;
            transition: all 0.3s ease;
        }
        
        .tutorial-tooltip {
            position: absolute;
            background-color: var(--bg-secondary);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
            padding: 16px;
            z-index: 10000;
            min-width: 250px;
            max-width: 350px;
            animation: fadeIn 0.3s ease;
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
        
        /* Анимации */
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(41, 98, 255, 0), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
            100% { box-shadow: 0 0 0 0 rgba(41, 98, 255, 0), 0 0 0 9999px rgba(0, 0, 0, 0.7); }
        }
        
        .tutorial-spotlight.pulse {
            animation: pulse 1.5s infinite;
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

// Удаление UI обучения
function removeTutorialUI() {
    const overlay = document.querySelector('.tutorial-overlay');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const tooltip = document.querySelector('.tutorial-tooltip');
    
    if (overlay) overlay.remove();
    if (spotlight) spotlight.remove();
    if (tooltip) tooltip.remove();
}

// Показ шага обучения
async function showTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        completeTutorial();
        return;
    }
    
    tutorialState.currentStep = stepIndex;
    tutorialState.stepCompleted = false;
    
    const step = tutorialSteps[stepIndex];
    
    // Проверка наличия элемента ожидания
    if (step.waitForElement) {
        await waitForElement(step.waitForElement);
    }
    
    // Если на мобильных нужны дополнительные действия
    let delay = 0;
    if (tutorialState.isMobile && step.mobileAdjust && step.mobileCallback) {
        delay = step.mobileCallback();
    }
    
    // Задержка для мобильных действий
    setTimeout(() => {
        const targetElement = document.querySelector(step.target);
        
        if (!targetElement) {
            console.warn(`Не найден элемент для шага обучения: ${step.target}`);
            showTutorialStep(stepIndex + 1);
            return;
        }
        
        // Подсвечиваем элемент
        highlightElement(targetElement, step);
        
        // Показываем тултип
        showTooltip(targetElement, step);
        
        // Настраиваем действие для завершения шага
        setupStepAction(step, stepIndex);
    }, delay);
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
    const spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight) return;
    
    const rect = element.getBoundingClientRect();
    
    // Позиция и размеры подсветки
    spotlight.style.top = `${rect.top}px`;
    spotlight.style.left = `${rect.left}px`;
    spotlight.style.width = `${rect.width}px`;
    spotlight.style.height = `${rect.height}px`;
    
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

// Показ тултипа
function showTooltip(targetElement, step) {
    const tooltip = document.querySelector('.tutorial-tooltip');
    if (!tooltip) return;
    
    // Наполняем контентом
    tooltip.innerHTML = `
        <div class="tutorial-tooltip-title">${step.title}</div>
        <div class="tutorial-tooltip-content">${step.content}</div>
        <div class="tutorial-tooltip-actions">
            <button class="tutorial-btn tutorial-skip-btn">Пропустить</button>
            <button class="tutorial-btn tutorial-next-btn">${step.action === 'next' ? 'Далее' : 'Готово'}</button>
        </div>
    `;
    
    // Позиционирование тултипа
    const position = tutorialState.isMobile && step.mobileAdjust && step.mobilePosition 
                    ? step.mobilePosition 
                    : step.position;
                    
    positionTooltip(tooltip, targetElement, position);
    
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

// Позиционирование тултипа
function positionTooltip(tooltip, targetElement, position) {
    const rect = targetElement.getBoundingClientRect();
    
    // Сначала установим минимальную ширину, чтобы корректно рассчитать размеры
    tooltip.style.visibility = 'hidden';
    document.body.appendChild(tooltip);
    
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
        case 'top':
            top = rect.top - tooltipRect.height - 10;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            break;
        case 'bottom':
            top = rect.bottom + 10;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            break;
        case 'left':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
            left = rect.left - tooltipRect.width - 10;
            break;
        case 'right':
            top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
            left = rect.right + 10;
            break;
        default:
            top = rect.bottom + 10;
            left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    }
    
    // Проверка, чтобы тултип не выходил за границы экрана
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) 
        left = window.innerWidth - tooltipRect.width - 10;
    if (top < 10) top = 10;
    if (top + tooltipRect.height > window.innerHeight - 10)
        top = window.innerHeight - tooltipRect.height - 10;
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = 'visible';
}

// Перепозиционирование тултипа при изменении размера окна
function repositionTooltip() {
    const tooltip = document.querySelector('.tutorial-tooltip');
    const step = tutorialSteps[tutorialState.currentStep];
    const targetElement = document.querySelector(step.target);
    
    if (tooltip && targetElement) {
        const position = tutorialState.isMobile && step.mobileAdjust && step.mobilePosition 
                        ? step.mobilePosition 
                        : step.position;
                        
        positionTooltip(tooltip, targetElement, position);
    }
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
