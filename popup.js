// JSON Key Assistant - Popup Script

class PopupUI {
  constructor() {
    this.elements = {
      emptyState: document.getElementById('empty-state'),
      keysList: document.getElementById('keys-list'),
      counter: document.getElementById('counter'),
      resetBtn: document.getElementById('reset-btn'),
      keysTitleText: document.getElementById('keys-title-text')
    };
    
    this.init();
  }
  
  async init() {
    // Загружаем текущее состояние
    await this.loadState();
    
    // Обработчик кнопки сброса
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetProcess();
    });
    
    // Периодически обновляем состояние для отображения прогресса
    setInterval(() => {
      this.loadState();
    }, 1000);
  }
  
  async loadState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getState' });
      this.updateUI(response);
    } catch (error) {
      console.error('Ошибка загрузки состояния:', error);
      this.showEmptyState();
    }
  }
  
  updateUI(state) {
    if (!state.hasKeys || state.keys.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.showKeysList(state);
  }
  
  showEmptyState() {
    this.elements.emptyState.style.display = 'block';
    this.elements.keysList.style.display = 'none';
    this.elements.counter.style.display = 'none';
    this.elements.resetBtn.style.display = 'none';
    this.elements.keysTitleText.textContent = 'Ключи для вставки';
  }
  
  showKeysList(state) {
    this.elements.emptyState.style.display = 'none';
    this.elements.keysList.style.display = 'block';
    this.elements.counter.style.display = 'block';
    this.elements.resetBtn.style.display = 'block';
    
    // Обновляем счетчик
    this.elements.counter.textContent = state.remaining;
    
    // Обновляем заголовок в зависимости от режима
    if (state.isAutoMode) {
      this.elements.keysTitleText.textContent = `Авто-режим (${state.remaining} из ${state.keys.length})`;
    } else {
      this.elements.keysTitleText.textContent = `Ключи для вставки (${state.remaining} из ${state.keys.length})`;
    }
    
    // Очищаем список
    this.elements.keysList.innerHTML = '';
    
    // Заполняем список ключей
    state.keys.forEach((key, index) => {
      const li = document.createElement('li');
      li.className = 'key-item';
      li.textContent = key;
      
      if (index < state.currentIndex) {
        // Уже вставленные ключи
        li.classList.add('completed');
      } else if (index === state.currentIndex && state.isAutoMode) {
        // В авто-режиме текущий ключ уже в буфере обмена
        li.classList.add('next');
        li.title = 'В буфере обмена - нажмите Ctrl+V для вставки';
      } else if (index === state.currentIndex) {
        // В ручном режиме следующий ключ для копирования
        li.classList.add('next');
        li.title = 'Следующий ключ для копирования';
      }
      
      this.elements.keysList.appendChild(li);
    });
    
    // Прокручиваем к текущему ключу
    const nextKeyElement = this.elements.keysList.querySelector('.next');
    if (nextKeyElement) {
      nextKeyElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
    
    // Добавляем подсказку в авто-режиме
    if (state.isAutoMode && state.remaining > 0) {
      const hint = document.createElement('div');
      hint.style.cssText = `
        margin-top: 8px;
        padding: 8px;
        background: #e3f2fd;
        border-radius: 4px;
        font-size: 11px;
        color: #1976d2;
        text-align: center;
      `;
      hint.textContent = 'Авто-режим: просто нажимайте Ctrl+V для вставки ключей';
      this.elements.keysList.parentNode.appendChild(hint);
    }
  }
  
  async resetProcess() {
    try {
      await chrome.runtime.sendMessage({ action: 'reset' });
      this.showEmptyState();
    } catch (error) {
      console.error('Ошибка сброса процесса:', error);
    }
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
});