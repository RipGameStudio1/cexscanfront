import { api } from './api.js';

// Централизованный сервис для работы с данными
export const dataService = {
    // Методы для работы с пользователями
    async getUser(telegramId) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}`;
            const data = await api.fetchWithRetry(url);
            if (!data.success && data.error) {
                throw new Error(`User not found: ${data.error}`);
            }
            return data;
        } catch (error) {
            console.error('Failed to get user:', error.message);
            throw new Error(`User not found: ${error.message}`);
        }
    },
    
    async createUser(telegramId, username) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}?username=${encodeURIComponent(username || 'unknown')}`;
            const data = await api.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!data.success && data.error) {
                throw new Error(`Failed to create user: ${data.error}`);
            }
            return data;
        } catch (error) {
            console.error('Failed to create user:', error.message);
            throw new Error(`Failed to create user: ${error.message}`);
        }
    },
    
    // Методы для работы с лицензиями
    async checkLicenseWithThrottling(telegramId) {
        if (api.licenseCheckStatus.inProgress) {
            return null;
        }
        
        const now = Date.now();
        const timeSinceLastCheck = now - api.licenseCheckStatus.lastCheck;
        if (timeSinceLastCheck < api.licenseCheckStatus.nextCheckDelay) {
            return null;
        }
        
        try {
            api.licenseCheckStatus.inProgress = true;
            api.licenseCheckStatus.lastCheck = now;
            
            const licenseData = await this.getUserLicense(telegramId);
            if (licenseData && licenseData.license) {
                api.licenseCheckStatus.errorCount = 0;
                api.licenseCheckStatus.nextCheckDelay = 60000; 
                return licenseData;
            }
            
            throw new Error("Invalid license data");
        } catch (error) {
            api.licenseCheckStatus.errorCount++;
            const baseDelay = 60000; 
            api.licenseCheckStatus.nextCheckDelay = Math.min(
                baseDelay * Math.pow(2, api.licenseCheckStatus.errorCount - 1),
                900000 
            );
            return null;
        } finally {
            api.licenseCheckStatus.inProgress = false;
        }
    },
    
    async getUserLicense(telegramId) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/license`;
            const data = await api.fetchWithRetry(url);
            if (data.success === false) {
                console.warn("Failed to get license data");
                return { success: false, license: null };
            }
            return data;
        } catch (error) {
            return { success: false, license: null };
        }
    },
    
    async updateUserLicense(telegramId, licenseData) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/license`;
            const data = await api.fetchWithRetry(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(licenseData)
            });
            return data;
        } catch (error) {
            return { success: false };
        }
    },
    
    // Методы для работы с биржами и монетами
    async getExchanges() {
        try {
            const url = `${api.baseUrl}/exchanges`;
            const data = await api.fetchWithRetry(url);
            return data;
        } catch (error) {
            console.warn('Failed to get exchanges');
            return [];
        }
    },
    
    async getCoins() {
        try {
            const url = `${api.baseUrl}/coins`;
            const data = await api.fetchWithRetry(url);
            return data;
        } catch (error) {
            console.warn('Failed to get coins');
            return [];
        }
    },
    
    // Методы для работы с торговыми парами
    async getPairs(userId = null) {
        try {
            const url = userId ? `${api.baseUrl}/pairs?user_id=${userId}` : `${api.baseUrl}/pairs`;
            const data = await api.fetchWithRetry(url);
            return data;
        } catch (error) {
            console.warn('Failed to get pairs');
            return { active_pairs: [] };
        }
    },
    
    async pinPair(pairId, userId) {
        if (!userId) {
            return { success: false, message: 'User ID required' };
        }
        try {
            const url = `${api.baseUrl}/pairs/${pairId}/pin?user_id=${userId}`;
            const data = await api.fetchWithRetry(url, {
                method: 'POST'
            });
            return data;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },
    
    async unpinPair(pairId, userId) {
        if (!userId) {
            return { success: false, message: 'User ID required' };
        }
        try {
            const url = `${api.baseUrl}/pairs/${pairId}/pin?user_id=${userId}`;
            const data = await api.fetchWithRetry(url, {
                method: 'DELETE'
            });
            return data;
        } catch (error) {
            return { success: false, message: error.message };
        }
    },
    
    // Методы для работы с настройками пользователя
    async getUserSettings(telegramId) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/settings`;
            const data = await api.fetchWithRetry(url);
            return data;
        } catch (error) {
            return { success: false, settings: {} };
        }
    },
    
    async updateUserSettings(telegramId, settings) {
        try {
            const endpoint = `${api.baseUrl}/users/${telegramId}/settings`;
            if (api._errorStatus[endpoint]) {
                const { errorUntil } = api._errorStatus[endpoint];
                if (Date.now() < errorUntil) {
                    console.warn("Settings update skipped: endpoint temporarily disabled");
                    return { success: true, localOnly: true };
                }
            }
            
            const data = await api.fetchWithRetry(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            return data;
        } catch (error) {
            return { success: true, localOnly: true };
        }
    },
    
    // Другие методы для работы с API
    async updateLastActive(telegramId) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/last_active`;
            const data = await api.fetchWithRetry(url, {
                method: 'PUT'
            });
            return data;
        } catch (error) {
            return { success: false };
        }
    },
    
    async getUserNotifications(telegramId) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/notifications`;
            const data = await api.fetchWithRetry(url);
            return data;
        } catch (error) {
            return { notifications: [] };
        }
    },
    
    async updateNotificationSettings(telegramId, settings) {
        try {
            const url = `${api.baseUrl}/users/${telegramId}/notification_settings`;
            const data = await api.fetchWithRetry(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            return data;
        } catch (error) {
            return { success: false };
        }
    }
};
