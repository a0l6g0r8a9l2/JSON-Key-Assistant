// Content Script для JSON Key Assistant

let lastClipboardContent = '';
let isProcessingClipboard = false;
let isProcessingPaste = false;

// Функция для проверки буфера обмена
async function checkClipboard() {
  if (isProcessingClipboard || isProcessingPaste) return;
  
  try {
    const text = await navigator.clipboard.readText();
    if (text !== lastClipboardContent && text.trim()) {
      lastClipboardContent = text;
      
      // Отправляем данные в background script
      chrome.runtime.sendMessage({
        action: 'clipboardChanged',
        content: text
      });
    }
  } catch (error) {
    // Игнорируем ошибки доступа к буферу обмена
  }
}

// Функция для обработки события вставки
async function handlePasteEvent(event) {
  if (isProcessingPaste) return;
  
  isProcessingPaste = true;
  
  try {
    // Небольшая задержка, чтобы вставка успела произойти
    setTimeout(async () => {
      try {
        // Отправляем сообщение в background script о событии вставки
        await chrome.runtime.sendMessage({
          action: 'pasteEvent'
        });
      } catch (error) {
        console.error('Ошибка обработки события вставки:', error);
      } finally {
        setTimeout(() => {
          isProcessingPaste = false;
        }, 200);
      }
    }, 50);
    
  } catch (error) {
    console.error('Ошибка обработки события вставки:', error);
    isProcessingPaste = false;
  }
}

// Мониторим события копирования
document.addEventListener('copy', () => {
  setTimeout(checkClipboard, 100);
});

// Мониторим события вставки
document.addEventListener('paste', handlePasteEvent);

// Также проверяем периодически (для случаев копирования из других приложений)
setInterval(checkClipboard, 1000);

// Слушаем сообщения от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'copyToClipboard') {
    isProcessingClipboard = true;
    
    navigator.clipboard.writeText(request.text).then(() => {
      console.log(`Content script: скопирован текст "${request.text}"`);
      
      // Обновляем lastClipboardContent, чтобы избежать повторной обработки
      lastClipboardContent = request.text;
      
      setTimeout(() => {
        isProcessingClipboard = false;
      }, 200);
      
      sendResponse({ success: true });
    }).catch((error) => {
      console.log('Clipboard API недоступен, используем fallback');
      
      // Fallback для старых браузеров
      try {
        const textArea = document.createElement('textarea');
        textArea.value = request.text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log(`Content script fallback: скопирован текст "${request.text}"`);
          lastClipboardContent = request.text;
        }
        
        setTimeout(() => {
          isProcessingClipboard = false;
        }, 200);
        
        sendResponse({ success: successful });
      } catch (fallbackError) {
        console.error('Ошибка fallback копирования:', fallbackError);
        isProcessingClipboard = false;
        sendResponse({ success: false });
      }
    });
    
    return true; // Указывает, что ответ будет асинхронным
  }
});