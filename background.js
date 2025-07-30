// JSON Key Assistant - Background Script

class JSONKeyAssistant {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.isProcessing = false;
    this.isAutoMode = false; // Флаг автоматического режима
    
    // Инициализация
    this.init();
  }
  
  init() {
    // Слушаем команды горячих клавиш
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });
  }
  
  processClipboardContent(content) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // Пытаемся распарсить JSON
      const jsonData = JSON.parse(content);
      
      // Разравниваем JSON и извлекаем ключи
      const flattenedKeys = this.flattenJSON(jsonData);
      
      // Сортируем ключи по алфавиту (без учета регистра)
      this.keys = flattenedKeys.sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      
      this.currentIndex = 0;
      this.isAutoMode = true; // Включаем автоматический режим
      
      // Сразу копируем первый ключ в буфер обмена
      if (this.keys.length > 0) {
        this.copyKeyToClipboard(this.keys[0]);
        this.currentIndex = 0; // Текущий ключ - первый (уже в буфере)
      }
      
      // Показываем синий значок с количеством ключей
      this.showSuccessBadge(this.keys.length);
      
    } catch (error) {
      // Если JSON невалидный, показываем красный значок
      this.showErrorBadge();
      this.isAutoMode = false;
    }
    
    this.isProcessing = false;
  }
  
  flattenJSON(obj, parentKey = '', result = {}) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        
        if (Array.isArray(obj[key])) {
          // Для массивов берем только первый элемент и используем [*]
          if (obj[key].length > 0) {
            const arrayKey = `${newKey}[*]`;
            if (typeof obj[key][0] === 'object' && obj[key][0] !== null) {
              this.flattenJSON(obj[key][0], arrayKey, result);
            } else {
              result[arrayKey] = obj[key][0];
            }
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Рекурсивно обрабатываем объекты
          this.flattenJSON(obj[key], newKey, result);
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    
    return Object.keys(result);
  }
  
  async copyKeyToClipboard(key) {
    try {
      // Отправляем сообщение в content script для копирования
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'copyToClipboard',
          text: key
        });
        console.log(`Скопирован ключ: ${key}`);
      }
    } catch (error) {
      console.error('Ошибка копирования в буфер обмена:', error);
    }
  }
  
  // Обработка события вставки - копируем следующий ключ
  async handlePasteEvent() {
    if (!this.isAutoMode) {
      return false;
    }
    
    // После вставки текущего ключа, подготавливаем следующий
    const nextIndex = this.currentIndex + 1;
    
    if (nextIndex < this.keys.length) {
      const nextKey = this.keys[nextIndex];
      await this.copyKeyToClipboard(nextKey);
      this.currentIndex = nextIndex;
      
      // Обновляем значок
      const remaining = this.keys.length - this.currentIndex;
      this.showSuccessBadge(remaining);
    } else {
      // Больше ключей нет
      this.hideBadge();
      this.isAutoMode = false;
    }
    
    return true;
  }
  
  showSuccessBadge(count) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#007bff' });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }
  
  showErrorBadge() {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
    
    // Создаем алерт для автоматического скрытия через 3 секунды
    chrome.alarms.create('hideBadge', { delayInMinutes: 0.05 }); // 3 секунды
  }
  
  hideBadge() {
    chrome.action.setBadgeText({ text: '' });
  }
  
  async handleCommand(command) {
    console.log(`Получена команда: ${command}`);
    
    switch (command) {
      case 'copy-next-key':
        // Оставляем для обратной совместимости, но в авто-режиме не используется
        if (!this.isAutoMode) {
          await this.copyNextKey();
        }
        break;
      case 'reset-process':
        console.log('Сброс процесса');
        this.resetProcess();
        break;
    }
  }
  
  // Старый метод для обратной совместимости
  async copyNextKey() {
    if (this.keys.length === 0 || this.currentIndex >= this.keys.length) {
      return;
    }
    
    const keyToCopy = this.keys[this.currentIndex];
    await this.copyKeyToClipboard(keyToCopy);
    
    this.currentIndex++;
    
    // Обновляем значок
    const remaining = this.keys.length - this.currentIndex;
    if (remaining > 0) {
      this.showSuccessBadge(remaining);
    } else {
      this.hideBadge();
    }
  }
  
  resetProcess() {
    this.keys = [];
    this.currentIndex = 0;
    this.isAutoMode = false;
    this.hideBadge();
  }
  
  // Методы для popup
  getState() {
    return {
      keys: this.keys,
      currentIndex: this.currentIndex,
      hasKeys: this.keys.length > 0,
      nextKey: this.currentIndex < this.keys.length ? this.keys[this.currentIndex] : null,
      remaining: this.keys.length - this.currentIndex,
      isAutoMode: this.isAutoMode
    };
  }
}

// Создаем глобальный экземпляр
const assistant = new JSONKeyAssistant();

// Слушаем алерты для скрытия значка ошибки
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hideBadge') {
    assistant.hideBadge();
  }
});

// Обрабатываем сообщения от content script и popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clipboardChanged') {
    console.log('Получены данные из буфера обмена:', request.content.substring(0, 100) + '...');
    assistant.processClipboardContent(request.content);
  } else if (request.action === 'getState') {
    sendResponse(assistant.getState());
  } else if (request.action === 'reset') {
    assistant.resetProcess();
    sendResponse({ success: true });
  } else if (request.action === 'pasteEvent') {
    // Обрабатываем событие вставки
    assistant.handlePasteEvent().then((handled) => {
      sendResponse({ handled });
    });
    return true; // Асинхронный ответ
  }
});