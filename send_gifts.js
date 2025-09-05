// ==UserScript==
// @name         Автоматизация отправки подарков для pwonline.ru
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Выбор предметов, серверов, персонажей и отправка подарков
// @author       chip_chu
// @match        https://pwonline.ru/promo_items.php
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
            showDebugButton: false,   // Добавляет кнопку для логов
            debugMode: false,         // Добавляет отдельную форму для просмотра логов

            autoSelectItems: true, 
            integrateIntoPage: true,
            preferredServerName: '',
            preferredCharacterNames: [],
        }
    ;

    const COLORS = {
        background: '#f4efe5',      // Основной фон
        border: '#d6c9a8',          // Цвет границы
        text: '#62594e',            // Основной текст
        accent: '#a01116',          // Акцентный цвет (красный)
        success: '#4CAF50',         // Успех (зеленый)
        warning: '#FF9800',         // Предупреждение (оранжевый)
        buttonHover: '#e8dfcc',     // Ховер кнопок
        panelBackground: '#f8f6f0'  // Фон информационной панели
    };

    let debugLogs = [];
    let debugPanelVisible = false;
    let applyTimeout = null;

    // Основная функция инициализации
    function init() {
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'customControls';

        if (CONFIG.integrateIntoPage) {
            // Интегрируем в правую колонку страницы
            const rightColumn = document.querySelector('.pagecontent_table_right');
            if (rightColumn) {
                controlsContainer.style.marginTop = '20px';
                controlsContainer.style.marginBottom = '20px';
                controlsContainer.style.padding = '15px';
                controlsContainer.style.backgroundColor = COLORS.background;
                controlsContainer.style.border = `2px solid ${COLORS.border}`;
                controlsContainer.style.borderRadius = '8px';
                controlsContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
                controlsContainer.style.color = COLORS.text;

                // Вставляем после блока авторизации
                const authBlock = rightColumn.querySelector('.auth_body');
                if (authBlock) {
                    rightColumn.insertBefore(controlsContainer, authBlock.nextSibling);
                } else {
                    rightColumn.insertBefore(controlsContainer, rightColumn.firstChild);
                }
            } else {
                // Вставляем как плавающую панель справа
                placeAsFloatingPanel(controlsContainer);
            }
        } else {
            // Вставляем как плавающую панель справа
            placeAsFloatingPanel(controlsContainer);
        }

        createControls(controlsContainer);
        setupEventListeners();
        loadInitialData();
    }

    // Размещение как плавающей панели
    function placeAsFloatingPanel(container) {
        container.style.position = 'fixed';
        container.style.top = '100px';
        container.style.right = '20px';
        container.style.zIndex = '10000';
        container.style.backgroundColor = COLORS.background;
        container.style.border = `2px solid ${COLORS.border}`;
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        container.style.minWidth = '280px';
        container.style.color = COLORS.text;
        document.body.appendChild(container);
    }

    // Элементы управления
    function createControls(container) {
        // Заголовок
        const title = document.createElement('h3');
        title.textContent = 'Перевод подарков';
        title.style.margin = '0 0 15px 0';
        title.style.color = COLORS.text;
        title.style.textAlign = 'center';
        title.style.fontSize = '16px';
        title.style.fontWeight = 'bold';
        container.appendChild(title);

        // Выбора сервера
        const serverContainer = document.createElement('div');
        serverContainer.style.marginBottom = '10px';
        container.appendChild(serverContainer);

        const serverLabel = document.createElement('label');
        serverLabel.textContent = 'Сервер:';
        serverLabel.style.display = 'block';
        serverLabel.style.marginBottom = '5px';
        serverLabel.style.fontWeight = 'bold';
        serverLabel.style.color = COLORS.text;
        serverContainer.appendChild(serverLabel);

        const serverSelect = document.createElement('select');
        serverSelect.id = 'customServerSelect';
        serverSelect.style.width = '100%';
        serverSelect.style.padding = '8px';
        serverSelect.style.borderRadius = '4px';
        serverSelect.style.border = `1px solid ${COLORS.border}`;
        serverSelect.style.backgroundColor = '#ffffff';
        serverSelect.style.color = COLORS.text;
        serverContainer.appendChild(serverSelect);

        // Выбор персонажа
        const charContainer = document.createElement('div');
        charContainer.style.marginBottom = '15px';
        container.appendChild(charContainer);

        const charLabel = document.createElement('label');
        charLabel.textContent = 'Персонаж:';
        charLabel.style.display = 'block';
        charLabel.style.marginBottom = '5px';
        charLabel.style.fontWeight = 'bold';
        charLabel.style.color = COLORS.text;
        charContainer.appendChild(charLabel);

        const charSelect = document.createElement('select');
        charSelect.id = 'customCharSelect';
        charSelect.style.width = '100%';
        charSelect.style.padding = '8px';
        charSelect.style.borderRadius = '4px';
        charSelect.style.border = `1px solid ${COLORS.border}`;
        charSelect.style.backgroundColor = '#ffffff';
        charSelect.style.color = COLORS.text;
        charContainer.appendChild(charSelect);

        // Кнопки управления
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexDirection = 'column';
        buttonsContainer.style.gap = '8px';
        container.appendChild(buttonsContainer);

        const selectAllBtn = createButton('✓ Выбрать все предметы', COLORS.success);
        buttonsContainer.appendChild(selectAllBtn);

        const transferBtn = createButton('🎁 Отправить подарки', COLORS.accent);
        buttonsContainer.appendChild(transferBtn);

        // Кнопка отладки
        if (CONFIG.showDebugButton) {
            const debugBtn = createButton('🐛 Показать логи', '#9C27B0');
            debugBtn.addEventListener('click', toggleDebugPanel);
            buttonsContainer.appendChild(debugBtn);
        }

        // Информационная панель
        const infoPanel = document.createElement('div');
        infoPanel.id = 'infoPanel';
        infoPanel.style.padding = '10px';
        infoPanel.style.backgroundColor = COLORS.panelBackground;
        infoPanel.style.border = `1px solid ${COLORS.border}`;
        infoPanel.style.borderRadius = '4px';
        infoPanel.style.fontSize = '12px';
        infoPanel.style.marginTop = '10px';
        infoPanel.style.minHeight = '60px';
        infoPanel.style.maxHeight = '120px';
        infoPanel.style.overflowY = 'auto';
        infoPanel.style.color = COLORS.text;
        container.appendChild(infoPanel);
    }

    // Создание кнопки
    function createButton(text, color) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.padding = '10px';
        btn.style.backgroundColor = color;
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.style.width = '100%';
        btn.style.transition = 'all 0.2s ease';

        btn.addEventListener('mouseover', () => {
            btn.style.opacity = '0.9';
            btn.style.transform = 'translateY(-1px)';
        });

        btn.addEventListener('mouseout', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
        });

        btn.addEventListener('mousedown', () => {
            btn.style.transform = 'translateY(1px)';
        });

        btn.addEventListener('mouseup', () => {
            btn.style.transform = 'translateY(0)';
        });

        return btn;
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        const serverSelect = document.getElementById('customServerSelect');
        const charSelect = document.getElementById('customCharSelect');
        const selectAllBtn = document.querySelector('#customControls button:nth-child(1)');
        const transferBtn = document.querySelector('#customControls button:nth-child(2)');

        serverSelect.addEventListener('change', function () {
            addDebugLog(`Выбран сервер: ${this.options[this.selectedIndex].text}`);
            loadCharactersForServer(this.value);
            updateInfoPanel();
        });

        charSelect.addEventListener('change', function () {
            addDebugLog(`Выбран персонаж: ${this.options[this.selectedIndex].text}`);
            updateInfoPanel();
            scheduleAutoApply();
        });

        selectAllBtn.addEventListener('click', selectAllItems);
        transferBtn.addEventListener('click', transferItems);
    }

    // Загрузка начальных данных
    function loadInitialData() {
        setTimeout(() => {
            addDebugLog('Скрипт загружен, инициализация...');
            loadServerAndCharacterData();
            updateInfoPanel();
            setupCheckboxListeners();

            if (CONFIG.autoSelectItems) {
                selectAllItems();
            }
        }, 2000);
    }

    // Панель отладки
    function createDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.display = 'none';
        debugPanel.style.position = 'fixed';
        debugPanel.style.top = '50%';
        debugPanel.style.left = '50%';
        debugPanel.style.transform = 'translate(-50%, -50%)';
        debugPanel.style.width = '80%';
        debugPanel.style.height = '70%';
        debugPanel.style.backgroundColor = COLORS.background;
        debugPanel.style.border = `2px solid ${COLORS.border}`;
        debugPanel.style.borderRadius = '8px';
        debugPanel.style.padding = '20px';
        debugPanel.style.zIndex = '10002';
        debugPanel.style.overflow = 'auto';
        debugPanel.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        debugPanel.style.color = COLORS.text;
        document.body.appendChild(debugPanel);

        const debugTitle = document.createElement('h3');
        debugTitle.textContent = 'Логи отладки';
        debugTitle.style.margin = '0 0 15px 0';
        debugTitle.style.color = COLORS.text;
        debugPanel.appendChild(debugTitle);

        const debugContent = document.createElement('div');
        debugContent.id = 'debugContent';
        debugContent.style.fontFamily = 'monospace';
        debugContent.style.fontSize = '12px';
        debugContent.style.whiteSpace = 'pre-wrap';
        debugContent.style.overflow = 'auto';
        debugContent.style.height = 'calc(100% - 60px)';
        debugContent.style.backgroundColor = COLORS.panelBackground;
        debugContent.style.padding = '10px';
        debugContent.style.borderRadius = '4px';
        debugContent.style.border = `1px solid ${COLORS.border}`;
        debugPanel.appendChild(debugContent);

        const closeDebugBtn = document.createElement('button');
        closeDebugBtn.textContent = 'Закрыть';
        closeDebugBtn.style.padding = '8px 16px';
        closeDebugBtn.style.backgroundColor = COLORS.accent;
        closeDebugBtn.style.color = 'white';
        closeDebugBtn.style.border = 'none';
        closeDebugBtn.style.borderRadius = '4px';
        closeDebugBtn.style.cursor = 'pointer';
        closeDebugBtn.style.position = 'absolute';
        closeDebugBtn.style.top = '15px';
        closeDebugBtn.style.right = '15px';
        closeDebugBtn.addEventListener('click', toggleDebugPanel);
        debugPanel.appendChild(closeDebugBtn);

        const clearDebugBtn = document.createElement('button');
        clearDebugBtn.textContent = 'Очистить логи';
        clearDebugBtn.style.padding = '8px 16px';
        clearDebugBtn.style.backgroundColor = COLORS.warning;
        clearDebugBtn.style.color = 'white';
        clearDebugBtn.style.border = 'none';
        clearDebugBtn.style.borderRadius = '4px';
        clearDebugBtn.style.cursor = 'pointer';
        clearDebugBtn.style.position = 'absolute';
        clearDebugBtn.style.top = '15px';
        clearDebugBtn.style.right = '100px';
        clearDebugBtn.addEventListener('click', clearDebugLogs);
        debugPanel.appendChild(clearDebugBtn);
    }

    // Функция логирования
    function addDebugLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;

        if (CONFIG.debugMode) {
            debugLogs.push(logEntry);

            if (debugLogs.length > 100) {
                debugLogs.shift();
            }

            updateDebugPanel();
        }

        try {
            if (type === 'error') console.error(logEntry);
            else if (type === 'warn') console.warn(logEntry);
            else console.log(logEntry);
        } catch (e) {
        }
    }

    // Обновление панели отладки
    function updateDebugPanel() {
        if (CONFIG.debugMode) {
            const debugContent = document.getElementById('debugContent');
            if (debugContent) {
                debugContent.textContent = debugLogs.join('\n');
                debugContent.scrollTop = debugContent.scrollHeight;
            }
        }
    }

    // Переключение панели отладки
    function toggleDebugPanel() {
        if (!CONFIG.debugMode) return;

        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanelVisible = !debugPanelVisible;
            debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
        }
    }

    // Очистка логов
    function clearDebugLogs() {
        if (!CONFIG.debugMode) return;

        debugLogs = [];
        updateDebugPanel();
        addDebugLog('Логи очищены');
    }

    // Загрузка списка серверов и персонажей
    function loadServerAndCharacterData() {
        try {
            addDebugLog('Начало загрузки данных серверов...');
            const serverSelect = document.getElementById('customServerSelect');
            if (typeof shards !== 'undefined' && shards) {
                serverSelect.innerHTML = '';
                for (const serverId in shards) {
                    if (shards.hasOwnProperty(serverId)) {
                        const server = shards[serverId];
                        const option = document.createElement('option');
                        option.value = serverId;
                        option.textContent = server.name;
                        serverSelect.appendChild(option);
                    }
                }

                let serverToSelect = null;
                // Ищем предпочтительный сервер по имени из конфига
                if (CONFIG.preferredServerName) {
                    addDebugLog(`Поиск предпочтительного сервера: "${CONFIG.preferredServerName}"`);
                    for (const option of serverSelect.options) {
                        if (option.textContent === CONFIG.preferredServerName) {
                            serverToSelect = option.value;
                            addDebugLog(`Найден сервер: ID ${serverToSelect}`);
                            break;
                        }
                    }
                    if (!serverToSelect) {
                        addDebugLog(`Сервер "${CONFIG.preferredServerName}" не найден. Будет выбран первый доступный.`, 'warning');
                    }
                }

                // Устанавливаем найденный сервер или первый по умолчанию
                serverSelect.value = serverToSelect || (serverSelect.options.length > 0 ? serverSelect.options[0].value : '');

                if (serverSelect.value) {
                    loadCharactersForServer(serverSelect.value);
                }

                updateInfoPanel();
                addDebugLog('Данные серверов успешно загружены');
            } else {
                addDebugLog('Ошибка: глобальная переменная shards не найдена', 'error');
            }
        } catch (error) {
            addDebugLog(`Ошибка загрузки данных: ${error}`, 'error');
        }
    }

    // Загрузка персонажей для выбранного сервера
    function loadCharactersForServer(serverId) {
        try {
            const charSelect = document.getElementById('customCharSelect');
            charSelect.innerHTML = '';
            addDebugLog(`Загрузка персонажей для сервера ID: ${serverId}`);

            if (shards && shards[serverId] && shards[serverId].accounts) {
                const accounts = shards[serverId].accounts;
                for (const accountId in accounts) {
                    if (accounts.hasOwnProperty(accountId)) {
                        const account = accounts[accountId];
                        if (account.chars && account.chars.length > 0) {
                            account.chars.forEach(character => {
                                const option = document.createElement('option');
                                option.value = character.id;
                                option.textContent = `${character.name} (${character.occupation} ${character.level} ур.)`;
                                charSelect.appendChild(option);
                            });
                        }
                    }
                }

                let charToSelect = null;
                // Ищем предпочтительного персонажа по массиву имен из конфига
                if (CONFIG.preferredCharacterNames && CONFIG.preferredCharacterNames.length > 0) {
                    addDebugLog(`Поиск предпочтительных персонажей: ${JSON.stringify(CONFIG.preferredCharacterNames)}`);

                    for (const preferredName of CONFIG.preferredCharacterNames) {
                        for (const option of charSelect.options) {
      
                            if (option.textContent.startsWith(preferredName + ' (')) {
                                charToSelect = option.value;
                                addDebugLog(`Найден персонаж: ${preferredName} (ID ${charToSelect})`);
                                break;
                            }
                        }
                        if (charToSelect) break;
                    }

                    if (!charToSelect) {
                        const errorMsg = 'Ни один из персонажей не найден!. Выбран первый из списка';
                        showNotification(errorMsg, 'error', '80px');
                        addDebugLog(errorMsg, 'error');
                    }
                }

                // Устанавливаем найденного персонажа или первого по умолчанию
                charSelect.value = charToSelect || (charSelect.options.length > 0 ? charSelect.options[0].value : '');

                if (charSelect.value) {
                    charSelect.dispatchEvent(new Event('change', {bubbles: true}));
                }

            }

            if (charSelect.options.length === 0) {
                const option = document.createElement('option');
                option.textContent = 'Персонажи не найдены';
                option.disabled = true;
                charSelect.appendChild(option);
            }

        } catch (error) {
            addDebugLog(`Ошибка загрузки персонажей: ${error}`, 'error');
        }
    }

    // Обновление информации на панели
    function updateInfoPanel() {
        const infoPanel = document.getElementById('infoPanel');
        if (!infoPanel) return;

        const checkedCount = document.querySelectorAll('input[type="checkbox"]:not(:disabled):not(.js-item-check):checked').length;
        const totalCount = document.querySelectorAll('input[type="checkbox"]:not(:disabled):not(.js-item-check)').length;

        const serverSelect = document.getElementById('customServerSelect');
        const charSelect = document.getElementById('customCharSelect');
        const selectedServer = serverSelect ? serverSelect.options[serverSelect.selectedIndex] : null;
        const selectedChar = charSelect ? charSelect.options[charSelect.selectedIndex] : null;

        const originalCharSelect = document.querySelector('.js-char');
        const originalCharText = originalCharSelect && originalCharSelect.options[originalCharSelect.selectedIndex] ?
            originalCharSelect.options[originalCharSelect.selectedIndex].text : 'не выбран';

        let info = `📦 Предметы: ${checkedCount}/${totalCount}`;

        if (selectedServer) {
            info += `\n🌎 Сервер: ${selectedServer.textContent}`;
        }

        if (selectedChar && !selectedChar.disabled) {
            info += `\n🦸‍♂️ Персонаж: ${selectedChar.textContent}`;

            if (CONFIG.preferredCharacterNames && CONFIG.preferredCharacterNames.length > 0) {
                const charName = selectedChar.textContent.split(' (')[0];
                if (!CONFIG.preferredCharacterNames.includes(charName)) {
                    info += `\n⚠️ Не из предпочтительного списка:\n   - ${CONFIG.preferredCharacterNames.join('\n   - ')}`;
                }

            }
        }

        if (CONFIG.debugMode) {
            info += `\nВ форме: ${originalCharText}`;
        }

        infoPanel.textContent = info;
    }

    // Выбор всех чекбоксов
    function selectAllItems() {
        try {
            addDebugLog('Начало выбора всех предметов...');

            const checkboxes = document.querySelectorAll('input[type="checkbox"]:not(:disabled):not(.js-item-check)');
            let selectedCount = 0;

            addDebugLog(`Найдено чекбоксов предметов: ${checkboxes.length}`);

            checkboxes.forEach(checkbox => {
                if (!checkbox.checked) {
                    checkbox.checked = true;
                    selectedCount++;
                    const event = new Event('change', {bubbles: true});
                    checkbox.dispatchEvent(event);
                    addDebugLog(`Выбран предмет: ${checkbox.id || checkbox.name}`);
                }
            });

            updateInfoPanel();
            addDebugLog(`Выбрано предметов: ${selectedCount}`, 'success');
            showNotification(`Выбрано ${selectedCount} предметов`, 'success');

        } catch (error) {
            addDebugLog(`Ошибка при выборе предметов: ${error}`, 'error');
            showNotification('Ошибка при выборе предметов', 'error');
        }
    }

    // Применение выбора сервера и персонажа
    function applyServerAndCharacterSelection() {
        try {
            addDebugLog('=== Начало автоматических выборов ===');

            const originalServerSelect = document.querySelector('.js-shard');
            const originalCharSelect = document.querySelector('.js-char');
            const serverSelect = document.getElementById('customServerSelect');
            const charSelect = document.getElementById('customCharSelect');

            if (!originalServerSelect || !originalCharSelect || !serverSelect || !charSelect) {
                addDebugLog('Ошибка: элементы выбора не найдены', 'error');
                return;
            }

            const selectedServerId = serverSelect.value;
            const selectedServerText = serverSelect.options[serverSelect.selectedIndex].text;
            const selectedCharId = charSelect.value;
            const selectedCharText = charSelect.options[charSelect.selectedIndex].text;

            addDebugLog(`Применяем: Сервер: ${selectedServerText} (${selectedServerId}), Персонаж: ${selectedCharText} (${selectedCharId})`);

            originalServerSelect.value = selectedServerId;
            const serverEvent = new Event('change', {bubbles: true});
            originalCharSelect.value = '';
            originalServerSelect.dispatchEvent(serverEvent);

            addDebugLog('Сервер применен, загрузка персонажей...');

            let attempts = 0;
            const maxAttempts = 30;

            const waitForCharacters = setInterval(() => {
                attempts++;
                const charOptions = originalCharSelect.options;

                let charFound = false;
                let foundCharId = null;

                for (let i = 0; i < charOptions.length; i++) {
                    if (charOptions[i].value.endsWith('_' + selectedCharId)) {
                        charFound = true;
                        foundCharId = charOptions[i].value;
                        addDebugLog(`Найден совпадающий персонаж: ${foundCharId}`);
                        break;
                    }
                }

                if (charFound && charOptions.length > 0) {
                    clearInterval(waitForCharacters);

                    originalCharSelect.value = foundCharId;

                    if (originalCharSelect.value === foundCharId) {
                        addDebugLog(`Персонаж выбран!`, 'success');
                        updateInfoPanel();
                        showNotification('Автоматический выбор подарков выполнен!', 'success');
                    }
                } else if (charOptions.length > 0 && attempts >= 5) {
                    clearInterval(waitForCharacters);
                    addDebugLog('Персонажи загружены, но нужный не найден', 'warn');
                } else if (attempts >= maxAttempts) {
                    clearInterval(waitForCharacters);
                    addDebugLog('Таймаут: персонажи не загрузились', 'error');
                }
            }, 100);

        } catch (error) {
            addDebugLog(`Ошибка при применении выбора: ${error}`, 'error');
        }
    }

    // Автоматическое применение с задержкой
    function scheduleAutoApply() {
        if (applyTimeout) {
            clearTimeout(applyTimeout);
        }

        applyTimeout = setTimeout(() => {
            applyServerAndCharacterSelection();
        }, 500);
    }


    // Проверка готовности
    function isReadyForTransfer() {
        const originalCharSelect = document.querySelector('.js-char');
        const checkedCount = document.querySelectorAll('input[type="checkbox"]:not(:disabled):not(.js-item-check):checked').length;

        if (checkedCount === 0) {
            addDebugLog('Проверка: нет выбранных предметов', 'warn');
            showNotification('Нет выбранных предметов', 'warning');
            return false;
        }

        if (!originalCharSelect || !originalCharSelect.value) {
            addDebugLog('Проверка: персонаж не выбран в форме', 'error');
            showNotification('Персонаж не выбран в форме', 'error');
            return false;
        }

        addDebugLog('Проверка: все готово для отправки', 'success');
        return true;
    }

    // Отправка подарков
    function transferItems() {
        try {
            addDebugLog('Попытка отправки подарков...');

            const transferButton = document.querySelector('.js-transfer-go');
            if (!transferButton) {
                addDebugLog('Ошибка: кнопка отправки не найдена', 'error');
                showNotification('Кнопка отправки не найдена', 'error');
                return;
            }

            if (!isReadyForTransfer()) {
                return;
            }

            addDebugLog('Запуск отправки подарков...');
            transferButton.click();
            showNotification('Подарки отправляются...', 'info');

        } catch (error) {
            addDebugLog(`Ошибка при отправке: ${error}`, 'error');
            showNotification('Ошибка при отправке', 'error');
        }
    }

    // Показ уведомлений
    function showNotification(message, type = 'info', topOffset = '20px') {
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = topOffset;
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '6px';
        notification.style.zIndex = '10001';
        notification.style.fontWeight = 'bold';
        notification.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';

        switch (type) {
            case 'success':
                notification.style.backgroundColor = COLORS.success;
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.backgroundColor = COLORS.accent;
                notification.style.color = 'white';
                break;
            case 'warning':
                notification.style.backgroundColor = COLORS.warning;
                notification.style.color = 'white';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
                notification.style.color = 'white';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Отслеживание изменений чекбоксов
    function setupCheckboxListeners() {
        const itemCheckboxes = document.querySelectorAll('input[type="checkbox"]:not(.js-item-check)');

        itemCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function () {
                addDebugLog(`Чекбокс изменен: ${this.checked ? 'отмечен' : 'снят'} - ${this.id || this.name}`);
                updateInfoPanel();

                if (this.checked) {
                    showNotification('Предмет добавлен к отправке', 'success');
                } else {
                    showNotification('Предмет исключен из отправки', 'warning');
                }
            });
        });

        addDebugLog(`Настроено отслеживание для ${itemCheckboxes.length} чекбоксов предметов`);
    }

    const style = document.createElement('style');
    style.textContent = `
    #customControls select:focus {
        outline: none;
        border-color: ${COLORS.accent};
        box-shadow: 0 0 0 2px ${COLORS.accent}20;
    }

    #customControls button:active {
        transform: translateY(1px) !important;
    }

    #infoPanel {
        line-height: 1.5;
        white-space: pre-line;
        font-family: 'Arial', sans-serif;
        min-height: 60px;
        height: auto !important;
        max-height: none !important;
        overflow-y: visible !important;
        overflow: auto;
    }

    /* Стиль для resize handle */
    #infoPanel::-webkit-resizer {
        border-width: 2px;
        border-style: solid;
        border-color: transparent ${COLORS.border} ${COLORS.border} transparent;
    }

    .custom-notification {
        animation: slideIn 0.3s ease-out;
    }

    #debugPanel {
        font-family: Arial, sans-serif;
    }

    #debugContent {
        background: ${COLORS.panelBackground};
        padding: 10px;
        border-radius: 4px;
        border: 1px solid ${COLORS.border};
    }

    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }`;
    document.head.appendChild(style);

    if (CONFIG.debugMode || CONFIG.showDebugButton) {
        createDebugPanel();
    }

    addDebugLog('Скрипт управления подарками инициализирован');
    init();

})();
