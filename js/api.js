// Базовый API-клиент для взаимодействия с сервером
export const api = {
    baseUrl: 'https://underground-mia-slimeapp-847f161d.koyeb.app',
    _errorStatus: {}, 

    // Метод для выполнения HTTP-запросов с автоматическими повторами
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        const endpoint = url.split('?')[0]; 
        const currentTime = Date.now();
        
        // Проверка, не заблокирован ли эндпоинт из-за ошибок
        if (this._errorStatus[endpoint]) {
            const { errorUntil, errorCount } = this._errorStatus[endpoint];
            if (currentTime < errorUntil) {
                console.warn(`Skipping request to ${endpoint.split('/').slice(-2).join('/')} due to recent errors. Retry in ${Math.ceil((errorUntil - currentTime)/1000)}s`);
                throw new Error('API endpoint temporarily disabled due to errors');
            }
        }
        
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); 
                
                const fullOptions = {
                    ...options,
                    signal: controller.signal
                };
                
                if (attempt > 0) {
                    console.log(`Retry ${attempt}/${maxRetries} for: ${url.split('/').slice(-2).join('/')}`);
                }
                
                const response = await fetch(url, fullOptions);
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    if (response.status >= 500) {
                        this._registerEndpointError(endpoint);
                        throw new Error(`Server Error: ${response.status}`);
                    }
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                
                this._resetEndpointError(endpoint);
                const data = await response.json();
                return data;
            } catch (error) {
                lastError = error;
                const isServerError = error.message.includes('Server Error') || 
                error.message.includes('500');
                
                if (error.name === 'AbortError') {
                    console.warn('Request timed out');
                }
                
                if (attempt < maxRetries - 1) {
                    const baseDelay = isServerError ? 3000 : 1000;
                    const delay = baseDelay * Math.pow(2, attempt);
                    const jitter = Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay + jitter));
                }
            }
        }
        
        this._registerEndpointError(endpoint);
        console.error(`API request failed for: ${url.split('/').slice(-2).join('/')}`);
        return { success: false, error: lastError?.message || 'Unknown error' };
    },
    
    // Регистрация ошибки эндпоинта и временное отключение
    _registerEndpointError(endpoint) {
        const currentData = this._errorStatus[endpoint] || { errorCount: 0, errorUntil: 0 };
        const newErrorCount = currentData.errorCount + 1;
        let disablePeriod = Math.min(10000 * Math.pow(2, Math.min(newErrorCount - 1, 4)), 300000);
        
        this._errorStatus[endpoint] = {
            errorCount: newErrorCount,
            errorUntil: Date.now() + disablePeriod
        };
    },
    
    // Сброс ошибок для эндпоинта
    _resetEndpointError(endpoint) {
        if (this._errorStatus[endpoint]) {
            delete this._errorStatus[endpoint];
        }
    },
    
    // Состояние проверки лицензии
    licenseCheckStatus: {
        inProgress: false,
        lastCheck: 0,
        errorCount: 0,
        nextCheckDelay: 60000
    },
    
    // Сброс всех ошибок
    resetAllErrorStatus() {
        this._errorStatus = {};
        this.licenseCheckStatus.errorCount = 0;
        this.licenseCheckStatus.nextCheckDelay = 60000;
        console.log("API error status reset");
    },
    
    // Мониторинг сетевого соединения
    startNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log("Network connection restored");
            this.resetAllErrorStatus();
        });
    }
};
