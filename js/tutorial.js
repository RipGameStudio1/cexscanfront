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

// Остальные функции модуля...
// (Добавлю остальные функции в следующей секции)
