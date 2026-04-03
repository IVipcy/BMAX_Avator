// chat.js - Live2D Avatar Chat System - Unity統合完全修正版
// 2025年最新 - Unity/WebGLBridge/Live2DEmotionControllerとの完全整合版

(function() {
    'use strict';
    
    console.log('🎬 Chat.js Unity統合完全修正版 loading...');
    
    // ====== Unity通信ハンドラー(最優先で定義) ======
    // Unity準備完了通知 - スクリプトロード直後に定義
    window.unityReady = function() {
        console.log('🎮 Unity準備完了通知を受信');
        // 実際の処理は初期化後に設定される
        if (window.unityReadyCallback) {
            window.unityReadyCallback();
        }
    };
    
    console.log('✅ window.unityReady を事前定義しました');
    
    // ====== 会話記憶システム ======
    class ConversationMemory {
        constructor() {
            this.history = [];
            this.maxHistory = 20;
            this.currentTopic = null;
            this.previousTopics = [];
        }
        
        addMessage(role, content, emotion = null) {
            this.history.push({
                role: role,
                content: content,
                emotion: emotion,
                timestamp: Date.now()
            });
            
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
        }
        
        getRecentContext(count = 5) {
            return this.history.slice(-count);
        }
        
        getFullHistory() {
            return this.history;
        }
        
        updateTopic(topic) {
            if (this.currentTopic && this.currentTopic !== topic) {
                this.previousTopics.push(this.currentTopic);
                if (this.previousTopics.length > 10) {
                    this.previousTopics.shift();
                }
            }
            this.currentTopic = topic;
        }
        
        getSummary() {
            const topics = [...new Set(this.previousTopics)];
            const userQuestions = this.history
                .filter(m => m.role === 'user')
                .map(m => m.content);
            
            return {
                topics: topics,
                currentTopic: this.currentTopic,
                turnCount: this.history.length,
                userQuestions: userQuestions.slice(-5)
            };
        }
    }
    
    // ====== 自己紹介管理システム ======
    class IntroductionManager {
        constructor() {
            this.status = 'pending';
            this.lastExecutionTime = 0;
            this.debugMode = true;
            this.requesterLog = [];
            this.pendingIntroData = null;
            this.waitingForStartMotion = false;
        }
        
        canStartIntroduction(requester = 'unknown') {
            const now = Date.now();
            const timeSinceLastExecution = now - this.lastExecutionTime;
            
            this.requesterLog.push({requester, time: now, status: this.status});
            
            if (this.status === 'completed') {
                this.debugLog(`自己紹介スキップ: 既に完了済み (要求者: ${requester})`);
                return false;
            }
            
            if (this.status === 'running' || this.status === 'waiting_unity' || this.status === 'waiting_start_motion') {
                this.debugLog(`自己紹介スキップ: 現在実行中/待機中 (要求者: ${requester})`);
                return false;
            }
            
            if (timeSinceLastExecution < 3000 && this.lastExecutionTime > 0) {
                this.debugLog(`自己紹介スキップ: 前回から${timeSinceLastExecution}ms経過 (要求者: ${requester})`);
                return false;
            }
            
            return true;
        }
        
        startIntroduction(requester = 'unknown', data = null) {
            if (!this.canStartIntroduction(requester)) {
                return false;
            }
            
            if (!isUnityFullyReady()) {
                this.status = 'waiting_unity';
                this.pendingIntroData = data;
                this.lastExecutionTime = Date.now();
                this.debugLog(`🎬 自己紹介部長:Unity初期化待ち (要求者: ${requester})`);
                return true;
            }
            
            this.status = 'running';
            this.lastExecutionTime = Date.now();
            this.debugLog(`🎬 自己紹介部長:自己紹介を開始します (承認要求者: ${requester})`);
            
            return true;
        }
        
        completeIntroduction() {
            this.status = 'completed';
            this.pendingIntroData = null;
            this.debugLog('🏁 自己紹介部長:自己紹介完了');
        }
        
        onUnityReady() {
            if (this.status === 'waiting_unity' && this.pendingIntroData) {
                this.debugLog('🎮 Unity準備完了 - Startモーション完了を待機');
                this.status = 'waiting_start_motion';
                this.waitingForStartMotion = true;
            }
        }
        
        executeAfterStartMotion() {
            if (this.status === 'waiting_start_motion' && this.pendingIntroData) {
                this.debugLog('🎬 Startモーション完了 - 自己紹介を実行');
                this.status = 'running';
                this.waitingForStartMotion = false;
                
                if (this.pendingIntroData.greetingData) {
                    console.log('🎭 保留中の挨拶メッセージを実行');
                    executeGreetingWithIntroduction(
                        this.pendingIntroData.greetingData, 
                        this.pendingIntroData.emotion
                    );
                } else {
                    executeIntroduction(this.pendingIntroData);
                }
            }
        }
        
        reset() {
            this.status = 'pending';
            this.lastExecutionTime = 0;
            this.requesterLog = [];
            this.pendingIntroData = null;
            this.waitingForStartMotion = false;
            this.debugLog('🔄 自己紹介部長:状態をリセットしました');
        }
        
        debugLog(message, data = null) {
            if (this.debugMode) {
                console.log(`[IntroductionManager] ${message}`, data || '');
            }
        }
    }
    
    // ====== 訪問者管理システム ======
    class VisitorManager {
        constructor() {
            this.visitorId = this.getOrCreateVisitorId();
            this.visitData = this.loadVisitData();
            this.updateVisitData();
        }
        
        getOrCreateVisitorId() {
            let id = localStorage.getItem('visitor_id');
            if (!id) {
                id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                localStorage.setItem('visitor_id', id);
            }
            return id;
        }
        
        loadVisitData() {
            const stored = localStorage.getItem('visit_data');
            if (stored) {
                return JSON.parse(stored);
            }
            return {
                visitCount: 1,
                firstVisit: Date.now(),
                lastVisit: Date.now(),
                totalConversations: 0,
                totalQuestions: 0,
                questionHistory: {},
                topics: [],
                relationshipLevel: 1,
                selectedSuggestions: []
            };
        }
        
        updateVisitData() {
            this.visitData.visitCount++;
            this.visitData.lastVisit = Date.now();
            this.saveVisitData();
        }
        
        incrementConversationCount() {
            this.visitData.totalConversations++;
            this.saveVisitData();
            return this.visitData.totalConversations;
        }
        
        incrementQuestionCount(question) {
            this.visitData.totalQuestions++;
            const lowerQuestion = question.toLowerCase();
            if (!this.visitData.questionHistory[lowerQuestion]) {
                this.visitData.questionHistory[lowerQuestion] = 0;
            }
            this.visitData.questionHistory[lowerQuestion]++;
            this.saveVisitData();
            return this.visitData.questionHistory[lowerQuestion];
        }
        
        addTopic(topic) {
            if (topic && !this.visitData.topics.includes(topic)) {
                this.visitData.topics.push(topic);
                if (this.visitData.topics.length > 20) {
                    this.visitData.topics.shift();
                }
                this.saveVisitData();
            }
        }
        
        updateRelationshipLevel(level) {
            this.visitData.relationshipLevel = level;
            this.saveVisitData();
        }
        
        addSelectedSuggestion(suggestion) {
            if (!this.visitData.selectedSuggestions.includes(suggestion)) {
                this.visitData.selectedSuggestions.push(suggestion);
                if (this.visitData.selectedSuggestions.length > 100) {
                    this.visitData.selectedSuggestions = this.visitData.selectedSuggestions.slice(-50);
                }
                this.saveVisitData();
            }
        }
        
        getSelectedSuggestions() {
            return this.visitData.selectedSuggestions || [];
        }
        
        clearSelectedSuggestions() {
            this.visitData.selectedSuggestions = [];
            this.saveVisitData();
        }
        
        saveVisitData() {
            localStorage.setItem('visit_data', JSON.stringify(this.visitData));
        }
    }
    
    // ====== 関係性レベルシステム（理解度メーター対応版） ======
    class RelationshipManager {
        constructor() {
            // 🎯 修正1: 質問回数ベースのレベルシステムに変更
            this.levels = [
                { level: 0, name: '-', minConversations: 0, style: 'formal' },
                { level: 1, name: 'Level 1', minConversations: 2, style: 'casual_polite' },
                { level: 2, name: 'Level 2', minConversations: 4, style: 'friendly' },
                { level: 3, name: 'Level 3', minConversations: 6, style: 'close' },
                { level: 4, name: 'MAX', minConversations: 8, style: 'best_friend' },
                { level: 5, name: 'Master', minConversations: 999, style: 'best_friend' }  // 🎯 クイズ完了時のみ到達
            ];
            this.previousLevel = 0;
        }
        
        calculateLevel(conversationCount) {
            // 🎯 修正: クイズ完了チェックを最優先
            if (quizState.hasCompletedQuiz) {
                return {
                    level: 5,
                    name: 'Master',
                    style: 'best_friend',
                    nextLevel: null,
                    progressToNext: 100,
                    conversationsToNext: 0
                };
            }
            
            // 通常のレベル計算（level 0-4のみ）
            let currentLevel = this.levels[0];
            
            for (let i = Math.min(this.levels.length - 2, 4); i >= 0; i--) {
                if (conversationCount >= this.levels[i].minConversations) {
                    currentLevel = this.levels[i];
                    break;
                }
            }
            
            let nextLevel = null;
            let progressToNext = 0;
            
            const currentIndex = this.levels.indexOf(currentLevel);
            if (currentIndex < 4) { // level 4 (MAX) までの計算
                nextLevel = this.levels[currentIndex + 1];
                const currentMin = currentLevel.minConversations;
                const nextMin = nextLevel.minConversations;
                progressToNext = ((conversationCount - currentMin) / (nextMin - currentMin)) * 100;
            } else {
                progressToNext = 100;
            }
            
            return {
                level: currentLevel.level,
                name: currentLevel.name,
                style: currentLevel.style,
                nextLevel: nextLevel,
                progressToNext: Math.min(100, Math.max(0, progressToNext)),
                conversationsToNext: nextLevel ? nextLevel.minConversations - conversationCount : 0
            };
        }
        
        getCurrentLevelStyle(conversationCount) {
            const levelInfo = this.calculateLevel(conversationCount);
            return levelInfo.style;
        }
        
        updateUI(levelInfo, conversationCount) {
            if (!domElements.relationshipLevel) return;
            
            const isJapanese = appState.currentLanguage === 'ja';
            
            // 🎯 修正2: レベル表示の変更
            if (levelInfo.level === 0) {
                // Level 0の場合は「ー」のみ表示
                domElements.relationshipLevel.innerHTML = `
                    <div class="level-name" style="font-size: 16px; color: #999;">ー</div>
                `;
            } else if (levelInfo.name === 'Master') {
                // 🎯 新規追加: Masterレベル表示
                domElements.relationshipLevel.innerHTML = `
                    <div class="level-badge master-badge">Master</div>
                `;
            } else if (levelInfo.name === 'MAX') {
                // MAXの場合は「MAX」バッジのみ表示
                domElements.relationshipLevel.innerHTML = `
                    <div class="level-badge">MAX</div>
                `;
                
                // 🎯 修正: MAX到達時は会話終了後にクイズ提案するフラグをセット
                if (!quizState.hasCompletedQuiz && !quizState.isActive && !quizState.isQuizAvailable) {
                    quizState.isQuizAvailable = true;
                    quizState.shouldProposeQuizAfterConversation = true;  // 次の会話終了時にクイズ提案
                    console.log('🎯 MAX到達：次の会話終了後にクイズを提案します');
                }
            } else {
                // Level 1-3の場合は「Lv.X」表示
                domElements.relationshipLevel.innerHTML = `
                    <div class="level-badge">Lv.${levelInfo.level}</div>
                `;
            }
            
            if (domElements.relationshipProgress) {
                domElements.relationshipProgress.style.width = `${levelInfo.progressToNext}%`;
            }
            
            // 🎯 修正3: 次のレベルまでの表示変更
            if (domElements.relationshipExp) {
                if (levelInfo.level === 0) {
                    // Level 0の時は「?」表示
                    domElements.relationshipExp.textContent = '?';
                } else if (levelInfo.nextLevel) {
                    // 次のレベルがある場合
                    const expText = isJapanese ? 
                        `次まであと${levelInfo.conversationsToNext}回` : 
                        `${levelInfo.conversationsToNext} more`;
                    domElements.relationshipExp.textContent = expText;
                } else {
                    // 最大レベルの場合
                    domElements.relationshipExp.textContent = 'MAX';
                }
            }
            
            if (levelInfo.level > this.previousLevel) {
                this.showLevelUpEffect(levelInfo);
                this.previousLevel = levelInfo.level;
            }
        }
        
        showLevelUpEffect(levelInfo) {
            const isJapanese = appState.currentLanguage === 'ja';
            
            // 🎯 修正4: レベルアップメッセージの変更
            let message;
            if (levelInfo.name === 'MAX') {
                // MAXレベル到達時の特別メッセージ
                message = isJapanese ? 
                    '🎉 最大Levelに到達!!' : 
                    '🎉 MAX Level Reached!!';
            } else {
                // Level 1-3の通常メッセージ
                message = isJapanese ? 
                    '🎉 Level Up!!' : 
                    '🎉 Level Up!!';
            }
            
            const levelUpDiv = document.createElement('div');
            levelUpDiv.className = 'level-up-notification';
            levelUpDiv.textContent = message;
            document.body.appendChild(levelUpDiv);
            
            setTimeout(() => {
                levelUpDiv.classList.add('show');
                playSystemSound('levelup');
            }, 100);
            
            setTimeout(() => {
                levelUpDiv.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(levelUpDiv)) {
                        document.body.removeChild(levelUpDiv);
                    }
                }, 500);
            }, 3000);
        }
    }
    
    // ====== インスタンス作成 ======
    const introductionManager = new IntroductionManager();
    const visitorManager = new VisitorManager();
    const conversationMemory = new ConversationMemory();
    const relationshipManager = new RelationshipManager();
    
    // ====== 状態管理システム(修正版) ======
    let unityState = {
        instance: null,
        isReady: false,
        isFullyInitialized: false,
        startMotionCompleted: false,
        retryCount: 0,
        maxRetries: 10,
        lastMessageTime: Date.now(),
        connectionCheckInterval: null,
        messageQueue: [],
        isSending: false,
        sessionId: generateSessionId(),
        activeAudioElement: null,
        currentEmotion: 'neutral',
        currentTalkingState: false,
        lastEmotionChangeTime: 0,
        emotionChangeDebounceTime: 100,
        maxEmotionChangesPerSecond: 10,
        currentConversationId: null,
        pendingGreeting: null,
        audioPlaybackActive: false,
        currentConversationEmotion: 'neutral',
        hasUserInteracted: false,
        instanceCheckTimers: new Set()
    };

    let conversationState = {
        isActive: false,
        startTime: 0,
        audioElement: null,
        currentEmotion: 'neutral',
        conversationId: null,
        audioTimers: new Set()
    };

    // ====== クイズシステム状態管理 ======
    let quizState = {
        isActive: false,
        isQuizAvailable: false,
        hasCompletedQuiz: localStorage.getItem('quiz_completed') === 'true', // 🎯 永続化対応
        currentQuestion: 0,
        correctAnswers: 0,
        totalQuestions: 3,
        userAnswers: [],
        quizData: null,
        shouldProposeQuizAfterConversation: false,  // 🎯 新規追加: 会話終了後にクイズ提案するフラグ
        quizDeclined: false  // 🎯 新規追加: クイズを断ったフラグ
    };
    
    // アンケート状態管理
    let surveyState = {
        isOpen: false,
        questions: [],
        quizScore: 0
    };
    
    /** アバター会話音声（TTS）の再生速度（1.0＝等速） */
    const VOICE_PLAYBACK_RATE = 1.12;
    
    let audioState = {
        recorder: null,
        chunks: [],
        isRecording: false,
        audioContext: null,
        analyser: null,
        gainNode: null,
        initialized: false,
        isMuted: false,
        originalVolume: 1.0
    };
    
    let appState = {
        currentLanguage: 'ja',
        isWaitingResponse: false,
        debugMode: false,
        messageHistory: [],
        lastResponseTime: 0,
        connectionStatus: 'disconnected',
        conversationCount: 0,
        interactionCount: 0,
        userTypeSelectionTimer: null  // 🔧 追加: 属性選択UIタイマー
    };
    
    // 🆕 京セラCERA用: ユーザー属性管理
    let userTypeSelected = false;
    
    // 言語切り替え時の挨拶処理フラグ
    let expectingLanguageChangeGreeting = false;
    
    // システム音声の管理
    const systemSounds = {
        start: null,
        end: null,
        error: null,
        levelup: null
    };
    
    // グローバル変数
    let socket = null;
    let domElements = {};
    
    // Socket.IOをグローバルに公開(デバッグ用)
    window.socket = null;
    
    // ====== Unity通信ハンドラー(修正版) ======
    // Unity準備完了コールバックを設定
    window.unityReadyCallback = function() {
        console.log('🎮 Unity準備完了コールバック実行');
        unityState.isReady = true;
        updateConnectionStatus('connected');
        
        if (introductionManager) {
            introductionManager.onUnityReady();
        }
    };
    
    // Unity完全初期化完了通知
    window.onUnityInitComplete = function(status) {
        console.log('🎮 Unity完全初期化完了:', status);
        unityState.isFullyInitialized = true;
        
        // 保留中の処理を実行
        if (unityState.pendingGreeting && status === 'success') {
            setTimeout(() => {
                executeGreetingWithIntroduction(
                    unityState.pendingGreeting.data,
                    unityState.pendingGreeting.emotion
                );
                unityState.pendingGreeting = null;
            }, 500);
        }
    };
    
    // Live2Dモデル読み込み完了通知
    window.onLive2DModelLoaded = function(status) {
        console.log('🎨 Live2Dモデル読み込み完了:', status);
        if (status === 'loaded' || status === 'success') {
            unityState.isFullyInitialized = true;
        }
    };
    
    // Startモーション完了通知
    window.onStartMotionComplete = function() {
        console.log('🎬 Startモーション完了通知を受信');
        unityState.startMotionCompleted = true;
        
        if (introductionManager && introductionManager.status === 'waiting_start_motion') {
            console.log('🎭 Startモーション完了 - 自己紹介を実行');
            introductionManager.executeAfterStartMotion();
        }
    };
    
    // モーション変更通知
    window.onMotionChanged = function(motionName) {
        console.log('🎭 モーション変更通知:', motionName);
        
        // startモーションの完了を検出
        if (motionName === 'start' || motionName === 'Start') {
            setTimeout(() => {
                window.onStartMotionComplete();
            }, 1500);
        }
    };
    
    // 感情変更通知
    window.onEmotionChange = function(emotion, isTalking) {
        console.log('🎭 Unity側から感情変更通知:', emotion, 'Talking:', isTalking);
    };
    
    // エイリアス(旧バージョン互換)
    window.onUnityEmotionChange = window.onEmotionChange;
    window.onStartMotionCompleted = window.onStartMotionComplete;
    
    // ====== 基本システム初期化 ======
    function initialize() {
        console.log('📱 アプリケーションを初期化中...');
        
        initializeDomElements();
        setupEventListeners();
        initializeSocketConnection();
        initializeUnityConnection();
        initializeAudioSystem();
        // initializeSystemSounds(); // 効果音機能は無効化
        initializeRelationshipLevel();
        loadMuteState();
        // 日本語固定：起動時モーダルは出さずサーバにも ja を通知
        selectLanguage('ja');
        
        // 訪問者情報をサーバーに送信
        sendVisitorInfo();
        
        console.log('✅ アプリケーションの初期化が完了しました');
    }
    
    // ====== DOM要素の初期化(修正版) ======
    function initializeDomElements() {
        domElements = {
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            voiceButton: document.getElementById('voice-button'),
            muteButton: document.getElementById('mute-button'),
            muteControlLabel: document.getElementById('mute-control-label'),
            languageButton: document.getElementById('change-language-btn'),
            languageDisplay: document.getElementById('current-language'),
            changeLanguageBtn: document.getElementById('change-language-btn'),
            currentLanguageDisplay: document.getElementById('current-language'),
            statusIndicator: document.querySelector('.status-indicator'),
            languageModal: document.getElementById('language-modal'),
            selectJapanese: document.getElementById('select-japanese'),
            selectEnglish: document.getElementById('select-english'),
            unityFrame: document.getElementById('unity-frame'),
            relationshipLevel: document.querySelector('.relationship-level'),
            relationshipProgress: document.querySelector('.relationship-progress'),
            relationshipExp: document.querySelector('.relationship-exp'),
            inputArea: document.getElementById('input-area') || document.querySelector('.input-area'),
            inputToggle: document.getElementById('input-toggle') || document.querySelector('.input-toggle'),
            messagesContainer: document.querySelector('.chat-messages'),
            chatContainer: document.querySelector('.chat-container')
        };
        
        // 必須要素のチェックと修正
        checkAndFixDomElements();
        
        const missingElements = [];
        Object.entries(domElements).forEach(([key, element]) => {
            if (!element && ['chatMessages', 'messageInput', 'sendButton'].includes(key)) {
                missingElements.push(key);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('❌ 必須要素が見つかりません:', missingElements);
            createMissingElements(missingElements);
        }
    }
    
    // DOM要素のチェックと修正
    function checkAndFixDomElements() {
        // 入力エリアが非表示になっていないか確認
        if (domElements.inputArea && domElements.inputArea.style.display === 'none') {
            domElements.inputArea.style.display = '';
        }
        
        // メッセージ入力欄が無効化されていないか確認
        if (domElements.messageInput) {
            domElements.messageInput.disabled = false;
            domElements.messageInput.readOnly = false;
        }
        
        // 送信ボタンが無効化されていないか確認
        if (domElements.sendButton) {
            domElements.sendButton.disabled = false;
        }
    }
    
    // 足りない要素を作成
    function createMissingElements(missingElements) {
        const chatContainer = document.querySelector('.chat-container') || 
                            document.getElementById('chat-container') || 
                            document.body;
        
        if (missingElements.includes('chatMessages') && !domElements.chatMessages) {
            const messagesDiv = document.createElement('div');
            messagesDiv.id = 'chat-messages';
            messagesDiv.className = 'chat-messages';
            chatContainer.appendChild(messagesDiv);
            domElements.chatMessages = messagesDiv;
            console.log('✅ chat-messages要素を作成しました');
        }
        
        if (missingElements.includes('messageInput') && !domElements.messageInput) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'message-input';
            input.className = 'message-input';
            input.placeholder = 'メッセージを入力...';
            
            const inputArea = domElements.inputArea || chatContainer;
            inputArea.appendChild(input);
            domElements.messageInput = input;
            console.log('✅ message-input要素を作成しました');
        }
        
        if (missingElements.includes('sendButton') && !domElements.sendButton) {
            const button = document.createElement('button');
            button.id = 'send-button';
            button.className = 'send-button';
            button.textContent = '送信';
            
            const inputArea = domElements.inputArea || chatContainer;
            inputArea.appendChild(button);
            domElements.sendButton = button;
            console.log('✅ send-button要素を作成しました');
        }
    }
    
    // ====== イベントリスナーの設定 ======
    function setupEventListeners() {
        // ユーザーインタラクションの追跡
        const trackUserInteraction = () => {
            if (!unityState.hasUserInteracted) {
                unityState.hasUserInteracted = true;
                console.log('✅ ユーザーインタラクションを検出');
                initializeAudioContextAfterUserGesture();
            }
        };
        
        // 各種クリックイベントでユーザーインタラクションを記録
        document.addEventListener('click', trackUserInteraction, { once: true });
        document.addEventListener('touchstart', trackUserInteraction, { once: true });
        
        if (domElements.sendButton) {
            domElements.sendButton.addEventListener('click', sendTextMessage);
        }
        
        if (domElements.messageInput) {
            domElements.messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendTextMessage();
                }
            });
        }
        
        if (domElements.voiceButton) {
            domElements.voiceButton.addEventListener('click', toggleVoiceRecording);
        }
        
        if (domElements.muteButton) {
            domElements.muteButton.addEventListener('click', toggleMute);
        }
        
        // 言語切替UIは廃止（日本語のみ）
        
        if (domElements.inputToggle) {
            domElements.inputToggle.addEventListener('click', toggleInputArea);
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', function(e) {
            if (e.key === ' ' && e.ctrlKey && !audioState.isRecording) {
                e.preventDefault();
                startVoiceRecording();
            }
        });
        
        document.addEventListener('keyup', function(e) {
            if (e.key === ' ' && e.ctrlKey && audioState.isRecording) {
                e.preventDefault();
                stopVoiceRecording();
            }
        });
        
        // ページ離脱時のクリーンアップ
        window.addEventListener('beforeunload', cleanupResources);
        
        // ビジビリティ変更時の処理
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Unityメッセージハンドラー
        window.addEventListener('message', handleUnityMessage, false);
        
        // カスタムイベントリスナー(Unity通信用)
        window.addEventListener('UnityReady', function() {
            console.log('📨 UnityReadyイベントを受信');
            unityState.isReady = true;
        });
        
        window.addEventListener('UnityMessage', function(event) {
            console.log('📨 UnityMessageイベントを受信:', event.detail);
        });
    }
    
    // ====== AudioContext初期化(ユーザー操作後) ======
    function initializeAudioContextAfterUserGesture() {
        if (audioState.audioContext && audioState.audioContext.state !== 'closed') {
            return;
        }
        
        try {
            audioState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (audioState.audioContext.state === 'suspended') {
                audioState.audioContext.resume().then(() => {
                    console.log('🎵 AudioContext resumed successfully');
                    audioState.initialized = true;
                });
            } else {
                audioState.initialized = true;
                console.log('🎵 AudioContext初期化成功');
            }
        } catch (error) {
            console.error('❌ AudioContext初期化失敗:', error);
            audioState.initialized = false;
        }
    }
    
    // ====== Socket.IO接続 ======
    function initializeSocketConnection() {
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
        
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const socketUrl = `${protocol}//${window.location.host}`;
            
            socket = io(socketUrl, {
                transports: ['polling', 'websocket'],
                upgrade: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                forceNew: true
            });
            
            window.socket = socket;
            
            socket.on('connect', handleSocketConnect);
            socket.on('current_language', handleLanguageUpdate);
            socket.on('language_changed', handleLanguageUpdate);
            socket.on('greeting', handleGreetingMessage);
            socket.on('response', handleResponseMessage);
            socket.on('transcription', handleTranscription);
            socket.on('error', handleErrorMessage);
            socket.on('conversation_start', handleConversationStart);
            socket.on('unity_conversation_end', handleConversationEnd);
            // 🆕 京セラCERA用: ユーザー属性選択イベント
            socket.on('user_type_selected', handleUserTypeSelected);
            // 🎯 新規追加: クイズ用Socket.IOイベントリスナー
            socket.on('quiz_proposal', handleQuizProposal);
            socket.on('quiz_question', handleQuizQuestion);
            socket.on('quiz_answer_result', handleQuizAnswerResult);
            socket.on('quiz_final_result', handleQuizFinalResult);
            // 🎯 追加: 次の問題リクエストのレスポンス（同じハンドラを再利用）
            socket.on('next_quiz_question', handleQuizQuestion);
            // 🎯 新規追加: stage3サジェスチョンのレスポンス
            socket.on('stage3_suggestions', (data) => {
                console.log('📋 stage3サジェスチョンを受信:', data.suggestions);
                if (data.suggestions && data.suggestions.length > 0) {
                    showSuggestions(data.suggestions);
                }
            });
            
            // アンケート質問を受信
            socket.on('survey_questions', function(data) {
                console.log('📋 アンケート質問受信:', data.questions.length, '問');
                displaySurveyModal(data.questions);
            });
            
            // アンケート送信完了を受信（v3.0: 常に報酬表示＋Masterレベル昇格）
            socket.on('survey_submitted', function(data) {
                console.log('✅ アンケート送信完了:', data);
                
                closeSurvey();
                
                // お礼メッセージを表示
                addMessage(data.message, false, { skipSound: true });
                
                // 感情を送信（音声があればtalking状態）
                const isTalking = !!data.audio;
                sendEmotionToAvatar('happy', isTalking, 'survey_thanks');
                
                // 音声再生
                if (data.audio) {
                    startConversation('happy', data.audio);
                }
                
                // 🔧 v3.0: Masterレベルに昇格（アンケート回答完了時）
                if (domElements.relationshipLevel) {
                    domElements.relationshipLevel.innerHTML = `
                    <div class="level-badge master-badge">Master</div>
                `;
                }
                visitorManager.visitData.relationshipLevel = 5;
                visitorManager.visitData.quizCompleted = true;
                visitorManager.saveVisitData();
                
                if (domElements.relationshipProgress) {
                    domElements.relationshipProgress.style.width = '100%';
                }
                if (domElements.relationshipExp) {
                    domElements.relationshipExp.textContent = 'Master';
                }
                
                // 🎁 報酬をチャットに表示（v3.0: 常に表示）
                if (data.show_reward && data.reward_image_url) {
                    setTimeout(() => {
                        showRewardInChat(data.reward_image_url);
                    }, 3000);  // 3秒後に表示
                }
            });
            
            updateConnectionStatus('connecting');
        } catch (e) {
            console.error('Socket.IO接続エラー:', e);
            showError('サーバーへの接続に失敗しました。');
        }
    }
    
    // ====== 音声システムの初期化 ======
    function initializeAudioSystem() {
        console.log('🎵 音声システムを初期化中...');
        audioState.initialized = false;
        console.log('🎵 AudioContext初期化は最初のユーザー操作後に実行されます');
    }
    
    // システム音声の初期化
    function initializeSystemSounds() {
        const soundFiles = {
            start: '/sounds/start.mp3',
            end: '/sounds/end.mp3', 
            error: '/sounds/error.mp3',
            levelup: '/sounds/levelup.mp3'
        };
        
        Object.entries(soundFiles).forEach(([soundName, path]) => {
            loadSystemSound(soundName, path);
        });
    }
    
    // 個別の音声ファイル読み込み
    function loadSystemSound(soundName, path) {
        try {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.volume = 0.3;
            
            audio.addEventListener('canplaythrough', () => {
                console.log(`✅ システム音声 '${soundName}' を読み込みました`);
                systemSounds[soundName] = audio;
            });
            
            audio.addEventListener('error', () => {
                console.log(`⚠️ システム音声 '${soundName}' は利用できません(ファイルなし)`);
                systemSounds[soundName] = null;
            });
            
            audio.src = path;
            audio.load();
        } catch (e) {
            console.log(`⚠️ システム音声 '${soundName}' の初期化をスキップ`);
            systemSounds[soundName] = null;
        }
    }
    
    // ====== Unity接続管理(修正版) ======
    function initializeUnityConnection() {
        findUnityInstance();
        unityState.connectionCheckInterval = setInterval(checkUnityConnection, 2000);
        console.log('Unity接続の監視を開始しました');
    }
    
    function findUnityInstance() {
        const unityFrame = domElements.unityFrame;
        
        if (!unityFrame || !unityFrame.contentWindow) {
            console.warn('Unity frameが見つかりません');
            return false;
        }
        
        const frameWindow = unityFrame.contentWindow;
        
        const possibleInstances = [
            frameWindow.unityInstance,
            frameWindow.Module?.unityInstance,
            frameWindow.gameInstance,
            frameWindow.MyUnityInstance,
            frameWindow.window?.unityInstance
        ];
        
        for (const instance of possibleInstances) {
            if (instance && (typeof instance.SendMessage === 'function' || instance.Module?.SendMessage)) {
                unityState.instance = instance;
                unityState.isReady = true;
                console.log('✅ Unity instanceを取得しました');
                
                sendMessageToUnity({
                    type: "init_check",
                    timestamp: Date.now()
                });
                
                return true;
            }
        }
        
        if (!frameWindow.unityInstance && frameWindow.Module) {
            console.log('⏳ Unity instance登録を待機中...');
        }
        
        return false;
    }
    
    function checkUnityConnection() {
        if (!unityState.instance) {
            if (unityState.retryCount < unityState.maxRetries) {
                unityState.retryCount++;
                if (findUnityInstance()) {
                    console.log('Unity instanceの接続に成功しました');
                    sendEmotionToAvatar('neutral', false, 'initialization');
                    unityState.isReady = true;
                    checkUnityFullInitialization();
                    
                    if (appState.connectionStatus === 'unity_disconnected') {
                        updateConnectionStatus('connected');
                    }
                }
            } else {
                unityState.instance = null;
                unityState.retryCount = 0;
                console.log('⚠️ Unity instance取得をリセット - 再試行開始');
            }
        }
    }
    
    function checkUnityFullInitialization() {
        if (!unityState.isFullyInitialized && unityState.instance) {
            let checkCount = 0;
            const maxChecks = 20;
            
            const checkTimer = setInterval(() => {
                checkCount++;
                
                sendMessageToUnity({
                    type: "status_check",
                    timestamp: Date.now()
                });
                
                if (unityState.isFullyInitialized || checkCount >= maxChecks) {
                    clearInterval(checkTimer);
                    unityState.instanceCheckTimers.delete(checkTimer);
                    
                    if (!unityState.isFullyInitialized) {
                        console.log('⚠️ Unity初期化タイムアウト - 強制的に初期化完了とみなす');
                        unityState.isFullyInitialized = true;
                        unityState.startMotionCompleted = true;
                    }
                }
            }, 500);
            
            unityState.instanceCheckTimers.add(checkTimer);
        }
    }
    
    // ====== 関係性レベルの初期化 ======
    function initializeRelationshipLevel() {
        const conversationCount = visitorManager.visitData.totalConversations;
        const levelInfo = relationshipManager.calculateLevel(conversationCount);
        relationshipManager.previousLevel = levelInfo.level;
        relationshipManager.updateUI(levelInfo, conversationCount);
        console.log(`🎯 関係性レベル初期化: Lv.${levelInfo.level} ${levelInfo.name} (会話数: ${conversationCount})`);
    }
    
    // ====== ミュート状態の管理 ======
    function loadMuteState() {
        try {
            const savedMuteState = localStorage.getItem('audio_muted');
            if (savedMuteState !== null) {
                audioState.isMuted = savedMuteState === 'true';
                console.log(`🔊 ミュート状態を復元: ${audioState.isMuted ? 'ミュート中(OFF表示)' : '音声あり(ON表示)'}`);
            }
        } catch (e) {
            console.warn('ミュート状態の復元に失敗:', e);
        }
        
        updateMuteButtonIcon();
    }
    
    function toggleMute() {
        audioState.isMuted = !audioState.isMuted;
        
        Object.values(systemSounds).forEach(audio => {
            if (audio) {
                audio.muted = audioState.isMuted;
            }
        });
        
        if (unityState.activeAudioElement) {
            unityState.activeAudioElement.muted = audioState.isMuted;
        }
        
        updateMuteButtonIcon();
        
        try {
            localStorage.setItem('audio_muted', audioState.isMuted.toString());
        } catch (e) {
            console.warn('ミュート設定の保存に失敗:', e);
        }
        
        console.log(`🔊 ミュート: ${audioState.isMuted ? 'ON' : 'OFF'}`);
    }
    
    function updateMuteButtonIcon() {
        if (domElements.muteButton) {
            const isJapanese = appState.currentLanguage === 'ja';
            
            if (audioState.isMuted) {
                domElements.muteButton.innerHTML = '🔇';
                domElements.muteButton.title = isJapanese ? 'タップで音声オン（再生）' : 'Unmute';
                domElements.muteButton.classList.add('muted');
            } else {
                domElements.muteButton.innerHTML = '🔊';
                domElements.muteButton.title = isJapanese ? 'タップで音声オフ（ミュート）' : 'Mute';
                domElements.muteButton.classList.remove('muted');
            }
            
            // 音声マークの下：ON＝再生あり / OFF＝ミュート中
            if (domElements.muteControlLabel) {
                domElements.muteControlLabel.textContent = audioState.isMuted ? 'OFF' : 'ON';
                domElements.muteControlLabel.classList.toggle('mute-status-off', audioState.isMuted);
                domElements.muteControlLabel.classList.toggle('mute-status-on', !audioState.isMuted);
            }
        }
    }
    
    // ====== 言語設定（日本語のみ・英語UIは無効） ======
    function showLanguageModal() {
        selectLanguage('ja');
    }
    
    function selectLanguage(language) {
        language = 'ja';
        appState.currentLanguage = language;
        
        if (socket && socket.connected) {
            socket.emit('set_language', { language: language });
        }
        
        updateUILanguage(language);
        updateMuteButtonIcon();
        
        const conversationCount = visitorManager.visitData.totalConversations;
        const levelInfo = relationshipManager.calculateLevel(conversationCount);
        relationshipManager.updateUI(levelInfo, conversationCount);
        
        if (domElements.languageModal) {
            domElements.languageModal.style.display = 'none';
        }
        
        if (domElements.unityFrame) {
            domElements.unityFrame.style.display = 'block';
        }
        
        initializeAudioContextAfterUserGesture();
    }
    
    function updateUILanguage(language) {
        language = 'ja';
        const translations = {
            ja: {
                languageDisplay: '言語: 日本語',
                messagePlaceholder: 'メッセージを入力...',
                sendButton: '送信',
                voiceButton: '🎤',
                statusConnected: '接続済み',
                statusDisconnected: '切断',
                statusProcessing: '処理中...',
                relationshipLabel: '理解度'
            },
        };
        
        const t = translations.ja;
        
        if (domElements.currentLanguageDisplay) {
            domElements.currentLanguageDisplay.textContent = t.languageDisplay;
        }
        
        if (domElements.messageInput) {
            domElements.messageInput.placeholder = t.messagePlaceholder;
        }
        
        if (domElements.sendButton) {
            domElements.sendButton.textContent = t.sendButton;
        }
        
        // 🎯 新規追加: 理解度ラベルの多言語対応
        const relationshipLabel = document.querySelector('.relationship-label');
        if (relationshipLabel) {
            relationshipLabel.textContent = t.relationshipLabel;
        }
        
        if (domElements.inputToggle) {
            const isExpanded = domElements.inputArea?.classList.contains('expanded');
            if (isExpanded) {
                domElements.inputToggle.innerHTML = `<i>✕</i><span>閉じる</span>`;
            } else {
                domElements.inputToggle.innerHTML = `<i>💬</i><span>メッセージを入力</span>`;
            }
        }
        
        try {
            localStorage.setItem('preferred_language', 'ja');
        } catch (e) {
            console.warn('言語設定の保存に失敗:', e);
        }
    }
    
    // ====== メッセージ送信 ======
    function sendTextMessage() {
        if (!domElements.messageInput) return;
        
        const message = domElements.messageInput.value.trim();
        if (!message) return;
        
        if (socket && socket.connected && !appState.isWaitingResponse) {
            appState.isWaitingResponse = true;
            appState.interactionCount++;
            updateConnectionStatus('processing');
            
            conversationMemory.addMessage('user', message, null);
            
            const questionCount = visitorManager.incrementQuestionCount(message);
            console.log(`📊 この質問の回数: ${questionCount}回目`);
            
            addMessage(message, true);
            
            socket.emit('message', { 
                message: message,
                language: appState.currentLanguage,
                visitorId: visitorManager.visitorId,
                conversationHistory: conversationMemory.getRecentContext(5),
                questionCount: questionCount,
                visitData: visitorManager.visitData,
                interactionCount: appState.interactionCount,
                relationshipLevel: relationshipManager.getCurrentLevelStyle(visitorManager.visitData.totalConversations),
                selectedSuggestions: visitorManager.getSelectedSuggestions()
            });
            
            domElements.messageInput.value = '';
            
            appState.messageHistory.push({
                type: 'user',
                content: message,
                timestamp: Date.now()
            });
            
            setTimeout(() => {
                collapseInputArea();
            }, 100);
        }
    }
    
    // ====== メッセージ追加関数(修正版) ======
    function addMessage(message, isUser, options = {}) {
        if (!domElements.chatMessages) {
            console.error('❌ チャットメッセージエリアが見つかりません');
            return null;
        }
        
        // メッセージラッパーを作成
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper');
        messageWrapper.classList.add(isUser ? 'user-wrapper' : 'assistant-wrapper');
        
        // メッセージバブルを作成
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble');
        
        // メッセージ本体を作成
        const messageDiv = document.createElement('div');
        messageDiv.classList.add(isUser ? 'user-message' : 'assistant-message');
        
        if (options.isGreeting) {
            messageDiv.classList.add('greeting-message');
        }
        
        // メッセージ内容をエスケープしてリンク化
        const messageContent = escapeHtml(message);
        const linkedMessage = linkifyUrls(messageContent);
        
        messageDiv.innerHTML = linkedMessage;
        
        // 構造を組み立て
        messageBubble.appendChild(messageDiv);
        
        // ====== メディア表示の追加 ======
        if (options.media && !isUser) {
            try {
                const mediaContainer = createMediaContainer(options.media);
                if (mediaContainer) {
                    messageBubble.appendChild(mediaContainer);
                }
            } catch (error) {
                console.error('❌ メディアコンテナ作成エラー:', error);
            }
        }
        
        messageWrapper.appendChild(messageBubble);
        
        // チャットエリアに追加
        domElements.chatMessages.appendChild(messageWrapper);
        
        // アニメーション用にクラスを追加
        setTimeout(() => {
            messageWrapper.classList.add('fade-in');
        }, 10);
        
        // スクロール
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 100);
        
        // 効果音
        if (!options.skipSound) {
            playSystemSound(isUser ? 'send' : 'end');
        }
        
        // アシスタントメッセージの場合、ラッパーを返す
        return isUser ? null : messageWrapper;
    }
    
    /**
     * メディアコンテナを作成
     * @param {Object} media - メディアデータ { images: [...], videos: [...] }
     * @returns {HTMLElement|null} メディアコンテナ要素
     */
    function createMediaContainer(media) {
        // 🔧 v3.3: reward, link, images, videosに対応
        if (!media || (!media.images?.length && !media.videos?.length && !media.link && media.type !== 'reward')) {
            return null;
        }
        
        const container = document.createElement('div');
        container.classList.add('media-container');
        
        // 🆕 報酬タイプの特別処理
        if (media.type === 'reward') {
            container.classList.add('reward-media-container');
            
            // 🔧 v3.4: コンテナスタイルも確実に適用
            container.style.marginTop = '15px';
            container.style.padding = '20px';
            container.style.background = 'linear-gradient(135deg, #fff5f7 0%, #ffe5ec 100%)';
            container.style.border = '2px solid #ff69b4';
            container.style.borderRadius = '15px';
            container.style.textAlign = 'center';
            
            // 報酬画像
            const rewardImage = document.createElement('img');
            rewardImage.src = media.imageUrl;
            rewardImage.alt = '報酬画像';
            rewardImage.classList.add('reward-media-image');
            rewardImage.loading = 'lazy';
            
            // 🔧 v3.4: インラインスタイルで確実にサイズ制限
            rewardImage.style.width = '100%';
            rewardImage.style.maxWidth = '280px';
            rewardImage.style.height = 'auto';
            rewardImage.style.display = 'block';
            rewardImage.style.margin = '0 auto 15px';
            
            // エラーハンドリング
            rewardImage.onerror = function() {
                console.error('報酬画像読み込みエラー:', media.imageUrl);
                this.style.display = 'none';
            };
            
            container.appendChild(rewardImage);
            
            // ダウンロードボタン
            const downloadButton = document.createElement('a');
            downloadButton.href = media.downloadUrl;
            downloadButton.download = 'nagami.png';
            downloadButton.className = 'reward-media-download';
            downloadButton.textContent = media.downloadText;
            downloadButton.target = '_blank';
            downloadButton.rel = 'noopener noreferrer';
            
            // 🔧 v3.4: ボタンスタイルも確実に適用
            downloadButton.style.display = 'inline-block';
            downloadButton.style.padding = '12px 28px';
            downloadButton.style.background = 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)';
            downloadButton.style.color = 'white';
            downloadButton.style.textDecoration = 'none';
            downloadButton.style.borderRadius = '25px';
            downloadButton.style.fontSize = '15px';
            downloadButton.style.fontWeight = '600';
            
            container.appendChild(downloadButton);
            
            return container;
        }
        
        // 画像表示
        if (media.images && media.images.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.classList.add('media-images-container');
            
            media.images.forEach((img, index) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.classList.add('media-image-wrapper');
                
                const imgElement = document.createElement('img');
                imgElement.src = img.url;
                imgElement.alt = img.alt || '画像';
                imgElement.classList.add('media-image');
                imgElement.loading = 'lazy';
                
                // エラーハンドリング
                imgElement.onerror = function() {
                    console.error('画像読み込みエラー:', img.url);
                    this.style.display = 'none';
                };
                
                // クリックでライトボックス表示
                imgElement.addEventListener('click', () => {
                    openLightbox(media.images, index);
                });
                
                imgWrapper.appendChild(imgElement);
                
                // キャプションがあれば追加
                if (img.caption) {
                    const caption = document.createElement('div');
                    caption.classList.add('media-caption');
                    caption.textContent = img.caption;
                    imgWrapper.appendChild(caption);
                }
                
                imagesContainer.appendChild(imgWrapper);
            });
            
            container.appendChild(imagesContainer);
        }
        
        // 動画表示（サムネイル＋ライトボックス方式）
        if (media.videos && media.videos.length > 0) {
            const videosContainer = document.createElement('div');
            videosContainer.classList.add('media-videos-container');
            
            media.videos.forEach((video, index) => {
                const videoWrapper = document.createElement('div');
                videoWrapper.classList.add('media-video-wrapper');
                
                // サムネイル画像を表示
                const thumbnail = document.createElement('img');
                thumbnail.src = video.thumbnail || video.url; // サムネイルがなければ動画URLをフォールバック
                thumbnail.alt = video.caption || '動画';
                thumbnail.classList.add('media-video-thumbnail');
                thumbnail.setAttribute('data-video-url', video.url);
                thumbnail.setAttribute('data-video-caption', video.caption || '');
                
                // 再生アイコンオーバーレイ
                const playIcon = document.createElement('div');
                playIcon.classList.add('video-play-icon');
                playIcon.innerHTML = '▶'; // 再生アイコン
                
                // クリックイベント設定（サムネイルとラッパーの両方）
                const openVideo = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎬 動画クリック:', video.url);
                    openVideoLightbox(video.url, video.caption);
                };
                
                thumbnail.addEventListener('click', openVideo);
                playIcon.addEventListener('click', openVideo);
                videoWrapper.style.cursor = 'pointer';
                
                videoWrapper.appendChild(thumbnail);
                videoWrapper.appendChild(playIcon);
                
                // キャプションがあれば追加
                if (video.caption) {
                    const caption = document.createElement('div');
                    caption.classList.add('media-caption');
                    caption.textContent = video.caption;
                    videoWrapper.appendChild(caption);
                }
                
                videosContainer.appendChild(videoWrapper);
            });
            
            container.appendChild(videosContainer);
        }
        
        // 🆕 外部リンク表示
        if (media.link) {
            const linkContainer = document.createElement('div');
            linkContainer.classList.add('media-link-container');
            
            const linkButton = document.createElement('a');
            linkButton.href = media.link.url;
            linkButton.target = '_blank';
            linkButton.rel = 'noopener noreferrer';
            linkButton.classList.add('media-external-link');
            
            // テキスト部分
            const textSpan = document.createElement('span');
            textSpan.textContent = media.link.text.replace(' →', '');
            linkButton.appendChild(textSpan);
            
            // アイコン
            const icon = document.createElement('span');
            icon.classList.add('link-icon');
            icon.textContent = '→';
            linkButton.appendChild(icon);
            
            linkContainer.appendChild(linkButton);
            container.appendChild(linkContainer);
        }
        
        return container;
    }
    
    /**
     * ライトボックスを開く
     * @param {Array} images - 画像配列
     * @param {Number} startIndex - 表示開始インデックス
     */
    function openLightbox(images, startIndex = 0) {
        // 既存のライトボックスを削除
        const existingLightbox = document.getElementById('media-lightbox');
        if (existingLightbox) {
            existingLightbox.remove();
        }
        
        // ライトボックスコンテナ
        const lightbox = document.createElement('div');
        lightbox.id = 'media-lightbox';
        lightbox.classList.add('lightbox');
        
        // オーバーレイ
        const overlay = document.createElement('div');
        overlay.classList.add('lightbox-overlay');
        overlay.addEventListener('click', () => {
            closeLightbox();
        });
        
        // コンテンツ
        const content = document.createElement('div');
        content.classList.add('lightbox-content');
        
        // 閉じるボタン
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('lightbox-close');
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', '閉じる');
        closeBtn.addEventListener('click', () => {
            closeLightbox();
        });
        
        // 画像要素
        const img = document.createElement('img');
        img.classList.add('lightbox-image');
        img.src = images[startIndex].url;
        img.alt = images[startIndex].alt || '画像';
        
        // キャプション
        const caption = document.createElement('div');
        caption.classList.add('lightbox-caption');
        caption.textContent = images[startIndex].caption || images[startIndex].alt || '';
        
        // ナビゲーション（複数画像の場合）
        let currentIndex = startIndex;
        
        if (images.length > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.classList.add('lightbox-nav', 'lightbox-prev');
            prevBtn.innerHTML = '&#10094;';
            prevBtn.setAttribute('aria-label', '前の画像');
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                updateLightboxImage(img, caption, images[currentIndex]);
                updateCounter();
            });
            
            const nextBtn = document.createElement('button');
            nextBtn.classList.add('lightbox-nav', 'lightbox-next');
            nextBtn.innerHTML = '&#10095;';
            nextBtn.setAttribute('aria-label', '次の画像');
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex + 1) % images.length;
                updateLightboxImage(img, caption, images[currentIndex]);
                updateCounter();
            });
            
            content.appendChild(prevBtn);
            content.appendChild(nextBtn);
            
            // カウンター
            const counter = document.createElement('div');
            counter.classList.add('lightbox-counter');
            counter.textContent = `${currentIndex + 1} / ${images.length}`;
            content.appendChild(counter);
            
            // カウンター更新関数
            const updateCounter = () => {
                counter.textContent = `${currentIndex + 1} / ${images.length}`;
            };
            
            // キーボードナビゲーション
            const keyHandler = (e) => {
                if (e.key === 'ArrowLeft') {
                    prevBtn.click();
                } else if (e.key === 'ArrowRight') {
                    nextBtn.click();
                }
            };
            document.addEventListener('keydown', keyHandler);
            lightbox.addEventListener('remove', () => {
                document.removeEventListener('keydown', keyHandler);
            });
        }
        
        // 組み立て
        content.appendChild(closeBtn);
        content.appendChild(img);
        content.appendChild(caption);
        lightbox.appendChild(overlay);
        lightbox.appendChild(content);
        document.body.appendChild(lightbox);
        
        // フェードイン
        setTimeout(() => {
            lightbox.classList.add('lightbox-active');
        }, 10);
        
        // ESCキーで閉じる
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    /**
     * ライトボックスの画像を更新
     */
    function updateLightboxImage(imgElement, captionElement, imageData) {
        imgElement.src = imageData.url;
        imgElement.alt = imageData.alt || '画像';
        captionElement.textContent = imageData.caption || imageData.alt || '';
    }
    
    /**
     * ライトボックスを閉じる
     */
    function closeLightbox() {
        const lightbox = document.getElementById('media-lightbox');
        if (lightbox) {
            lightbox.classList.remove('lightbox-active');
            setTimeout(() => {
                lightbox.remove();
            }, 300);
        }
    }
    
    /**
     * 動画ライトボックスを開く
     * @param {string} videoUrl - 動画のURL
     * @param {string} caption - 動画のキャプション
     */
    function openVideoLightbox(videoUrl, caption = '') {
        console.log('📹 動画ライトボックスを開く:', videoUrl);
        
        // ライトボックスコンテナ作成
        const lightbox = document.createElement('div');
        lightbox.classList.add('lightbox');
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-label', '動画プレーヤー');
        
        // コンテンツコンテナ（動画を囲む）
        const content = document.createElement('div');
        content.classList.add('lightbox-content');
        
        // 動画プレーヤー作成
        const videoPlayer = document.createElement('video');
        videoPlayer.src = videoUrl;
        videoPlayer.controls = true;
        videoPlayer.autoplay = true;
        videoPlayer.classList.add('lightbox-video');
        videoPlayer.setAttribute('playsinline', ''); // iOSでインライン再生
        
        // 閉じるボタン
        const closeButton = document.createElement('button');
        closeButton.classList.add('lightbox-close');
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', '閉じる');
        closeButton.addEventListener('click', () => closeVideoLightbox(lightbox, videoPlayer));
        
        // キャプション表示
        if (caption) {
            const captionElement = document.createElement('div');
            captionElement.classList.add('lightbox-caption');
            captionElement.textContent = caption;
            content.appendChild(captionElement);
        }
        
        // コンテンツに動画と閉じるボタンを追加
        content.appendChild(closeButton);
        content.appendChild(videoPlayer);
        
        // ライトボックスにコンテンツを追加
        lightbox.appendChild(content);
        
        // 背景クリックで閉じる
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) {
                closeVideoLightbox(lightbox, videoPlayer);
            }
        });
        
        // ESCキーで閉じる
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                closeVideoLightbox(lightbox, videoPlayer);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // DOMに追加
        document.body.appendChild(lightbox);
        
        // フェードイン（画像と同じクラス名に統一）
        setTimeout(() => {
            lightbox.classList.add('lightbox-active');
        }, 10);
    }
    
    /**
     * 動画ライトボックスを閉じる
     * @param {HTMLElement} lightbox - ライトボックス要素
     * @param {HTMLVideoElement} videoPlayer - 動画プレーヤー要素
     */
    function closeVideoLightbox(lightbox, videoPlayer) {
        if (!lightbox) return;
        
        // 動画を停止
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.src = ''; // リソース解放
        }
        
        // フェードアウト（画像と同じクラス名に統一）
        lightbox.classList.remove('lightbox-active');
        
        // DOM削除
        setTimeout(() => {
            lightbox.remove();
        }, 300);
    }
    
    // ====== サジェスチョン表示関数(修正版) ======
    function showSuggestions(suggestions, targetMessageWrapper = null) {
        if (!suggestions || suggestions.length === 0) return;
        
        // 既存のサジェスチョンを削除
        document.querySelectorAll('.suggestions-wrapper, .message-suggestions').forEach(elem => elem.remove());
        
        const SUGGESTION_FREE_INPUT = '自由入力で具体条件を書く';
        const SUGGESTION_BACK_MAIN = '戻る（質問候補を表示）';
        
        const regularItems = [];
        const navItems = [];
        
        suggestions.forEach((suggestion) => {
            if (suggestion === SUGGESTION_FREE_INPUT || suggestion === SUGGESTION_BACK_MAIN) {
                navItems.push(suggestion);
            } else {
                regularItems.push(suggestion);
            }
        });
        
        // ラッパーを作成（通常候補＋ナビをまとめる）
        const wrapper = document.createElement('div');
        wrapper.className = 'suggestions-wrapper';
        
        // スクロール可能なグリッドコンテナ（通常候補のみ）
        if (regularItems.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'suggestions-grid';
            regularItems.forEach((suggestion, index) => {
                const button = document.createElement('button');
                button.className = 'suggestion-button';
                button.textContent = suggestion;
                button.style.animationDelay = `${index * 0.06}s`;
                button.addEventListener('click', () => handleSuggestionClick(suggestion));
                grid.appendChild(button);
            });
            wrapper.appendChild(grid);
        }
        
        // ナビボタン（常に下部に固定表示）
        if (navItems.length > 0) {
            const nav = document.createElement('div');
            nav.className = 'suggestions-nav';
            navItems.forEach((suggestion) => {
                const button = document.createElement('button');
                button.className = 'suggestion-button';
                if (suggestion === SUGGESTION_FREE_INPUT) {
                    button.classList.add('suggestion-button--nav', 'suggestion-button--free-input');
                } else if (suggestion === SUGGESTION_BACK_MAIN) {
                    button.classList.add('suggestion-button--nav', 'suggestion-button--back-main');
                }
                button.textContent = suggestion;
                button.addEventListener('click', () => handleSuggestionClick(suggestion));
                nav.appendChild(button);
            });
            wrapper.appendChild(nav);
        }
        
        // クイズボタン
        if (quizState.quizDeclined && !quizState.hasCompletedQuiz && !quizState.isActive) {
            const isJapanese = appState.currentLanguage === 'ja';
            const quizButton = document.createElement('button');
            quizButton.className = 'suggestion-button quiz-challenge-button';
            quizButton.textContent = isJapanese ? '🎯 クイズに挑戦する' : '🎯 Challenge Quiz';
            quizButton.style.animationDelay = `${suggestions.length * 0.06}s`;
            quizButton.style.background = 'linear-gradient(135deg, #FFB6C1, #FF69B4)';
            quizButton.style.fontWeight = '600';
            quizButton.addEventListener('click', () => {
                quizState.quizDeclined = false;
                startQuiz();
            });
            (wrapper.querySelector('.suggestions-nav') || wrapper).appendChild(quizButton);
        }
        
        // 配置場所を決定
        const target = targetMessageWrapper
            || (() => {
                const msgs = domElements.chatMessages.querySelectorAll('.assistant-wrapper');
                return msgs.length > 0 ? msgs[msgs.length - 1] : domElements.chatMessages;
            })();
        target.appendChild(wrapper);
        
        // アニメーション
        setTimeout(() => wrapper.classList.add('fade-in'), 100);
    }
    
    // ====== サジェスチョンクリック処理(修正版) ======
    function handleSuggestionClick(suggestion) {
        if (appState.isWaitingResponse) return;
        
        visitorManager.addSelectedSuggestion(suggestion);
        
        if (domElements.messageInput) {
            domElements.messageInput.value = suggestion;
            sendTextMessage();
        }
        
        // クリックされたサジェスチョンを非表示にする
        const allSuggestions = document.querySelectorAll('.suggestions-wrapper, .message-suggestions');
        allSuggestions.forEach(container => {
            container.classList.add('fade-out');
            setTimeout(() => {
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            }, 500);
        });
    }
    
    // ====== 入力エリアのトグル ======
    function toggleInputArea() {
        if (!domElements.inputArea) return;
        
        if (domElements.inputArea.classList.contains('collapsed')) {
            expandInputArea();
        } else {
            collapseInputArea();
        }
    }
    
    function expandInputArea() {
        if (!domElements.inputArea) return;
        
        domElements.inputArea.classList.remove('collapsed');
        domElements.inputArea.classList.add('expanded');
        
        if (domElements.messageInput) {
            domElements.messageInput.focus();
        }
        
        if (domElements.inputToggle) {
            const language = appState.currentLanguage || 'ja';
            const closeText = language === 'ja' ? '閉じる' : 'Close';
            domElements.inputToggle.innerHTML = `<i>✕</i><span>${closeText}</span>`;
        }
    }
    
    function collapseInputArea() {
        if (!domElements.inputArea) return;
        
        domElements.inputArea.classList.remove('expanded');
        domElements.inputArea.classList.add('collapsed');
        
        if (domElements.inputToggle) {
            const language = appState.currentLanguage || 'ja';
            const buttonText = language === 'ja' ? 'メッセージを入力' : 'Type a message';
            domElements.inputToggle.innerHTML = `<i>💬</i><span>${buttonText}</span>`;
        }
    }
    
    // ====== 音声録音 ======
    function toggleVoiceRecording() {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            showError('安全な接続(HTTPS)が必要です。HTTPSでアクセスしてください。');
            return;
        }
        
        if (audioState.isRecording) {
            stopVoiceRecording();
        } else {
            startVoiceRecording();
        }
    }
    
    function startVoiceRecording() {
        updateConnectionStatus('recording');
        playSystemSound('start');
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                appState.isWaitingResponse = true;
                audioState.recorder = new MediaRecorder(stream);
                audioState.chunks = [];
                
                audioState.recorder.ondataavailable = function(e) {
                    audioState.chunks.push(e.data);
                };
                
                audioState.recorder.onstop = function() {
                    const audioBlob = new Blob(audioState.chunks, { type: 'audio/webm' });
                    
                    convertBlobToBase64(audioBlob).then(base64data => {
                        socket.emit('audio_message', { 
                            audio: base64data,
                            language: appState.currentLanguage || 'ja',
                            visitorId: visitorManager.visitorId,
                            conversationHistory: conversationMemory.getRecentContext(5),
                            visitData: visitorManager.visitData,
                            interactionCount: appState.interactionCount,
                            relationshipLevel: relationshipManager.getCurrentLevelStyle(visitorManager.visitData.totalConversations),
                            selectedSuggestions: visitorManager.getSelectedSuggestions()
                        });
                    });
                    
                    stream.getTracks().forEach(track => track.stop());
                };
                
                audioState.recorder.start();
                
                if (domElements.voiceButton) {
                    domElements.voiceButton.textContent = '■';
                    domElements.voiceButton.classList.add('recording');
                }
                
                audioState.isRecording = true;
            })
            .catch(function(err) {
                console.error('マイクの使用が許可されていません:', err);
                showError('マイクの使用が許可されていません');
                audioState.isRecording = false;
                appState.isWaitingResponse = false;
                updateConnectionStatus('connected');
            });
    }
    
    function stopVoiceRecording() {
        if (!audioState.recorder || audioState.recorder.state === 'inactive') return;
        
        playSystemSound('end');
        
        try {
            audioState.recorder.stop();
        } catch (e) {
            console.error('録音停止エラー:', e);
        }
        
        if (domElements.voiceButton) {
            domElements.voiceButton.textContent = '🎤';
            domElements.voiceButton.classList.remove('recording');
        }
        
        audioState.isRecording = false;
        updateConnectionStatus('processing');
    }
    
    // ====== 感情送信システム(修正版) ======
    function sendEmotionToAvatar(emotion, isTalking = false, reason = 'manual', conversationId = null) {
        const now = Date.now();
        
        console.log(`感情送信: ${emotion}, 会話=${isTalking}, 理由=${reason}, 会話ID=${conversationId}`);
        
        // 会話開始/終了時は即座に実行
        if (reason === 'conversation_start' || reason === 'conversation_end') {
            return executeEmotionChange(emotion, isTalking, reason, now, conversationId);
        }
        
        // デバウンス処理(改善版)
        const timeSinceLastChange = now - unityState.lastEmotionChangeTime;
        if (timeSinceLastChange < unityState.emotionChangeDebounceTime) {
            console.log(`デバウンス中(${timeSinceLastChange}ms < ${unityState.emotionChangeDebounceTime}ms)`);
            return false;
        }
        
        // 同じ状態への変更をスキップ
        const newState = `${emotion}_${isTalking}`;
        const currentState = `${unityState.currentEmotion}_${unityState.currentTalkingState}`;
        
        if (newState === currentState && reason !== 'force_neutral') {
            console.log('同じ状態のためスキップ');
            return false;
        }
        
        return executeEmotionChange(emotion, isTalking, reason, now, conversationId);
    }
    
    function executeEmotionChange(emotion, isTalking, reason, timestamp, conversationId = null) {
        try {
            const messageData = {
                type: "emotion",
                emotion: emotion,
                talking: isTalking,
                sequence: unityState.messageQueue.length,
                sessionId: unityState.sessionId,
                timestamp: timestamp,
                reason: reason,
                conversationId: conversationId
            };
            
            const success = sendMessageToUnity(messageData);
            
            if (success) {
                unityState.currentEmotion = emotion;
                unityState.currentTalkingState = isTalking;
                unityState.lastEmotionChangeTime = timestamp;
                unityState.currentConversationId = conversationId;
                
                console.log(`✅ 感情送信成功: ${emotion} (会話=${isTalking}) - ${reason}`);
                return true;
            } else {
                console.error('❌ Unity送信失敗');
                return false;
            }
        } catch (error) {
            console.error('感情送信エラー:', error);
            return false;
        }
    }
    
    function sendMessageToUnity(messageData) {
        if (!unityState.instance) {
            console.warn('Unity インスタンスが見つかりません - 再取得を試行');
            
            if (!findUnityInstance()) {
                console.error('❌ Unity instance取得失敗 - iframe方式で強制再取得を試行');
                
                const unityFrame = domElements.unityFrame || document.querySelector('#unity-frame');
                if (unityFrame && unityFrame.contentWindow && unityFrame.contentWindow.unityInstance) {
                    unityState.instance = unityFrame.contentWindow.unityInstance;
                    console.log('✅ 強制再取得成功');
                } else {
                    console.error('❌ 強制再取得も失敗');
                    return false;
                }
            }
        }
        
        try {
            unityState.messageQueue.push(messageData);
            
            if (!unityState.isSending) {
                processUnityMessageQueue();
            }
            
            return true;
        } catch (error) {
            console.error('Unity メッセージ送信エラー:', error);
            return false;
        }
    }
    
    function processUnityMessageQueue() {
        if (unityState.isSending || unityState.messageQueue.length === 0) {
            return;
        }
        
        unityState.isSending = true;
        
        // インスタンスチェック
        if (!unityState.instance) {
            if (!findUnityInstance()) {
                const retryTimer = setTimeout(() => {
                    unityState.isSending = false;
                    processUnityMessageQueue();
                }, 500);
                
                if (unityState.instanceCheckTimers) {
                    unityState.instanceCheckTimers.add(retryTimer);
                }
                return;
            }
        }
        
        const messageToSend = unityState.messageQueue.shift();
        
        try {
            let messageSent = false;
            
            if (unityState.instance.Module?.SendMessage) {
                unityState.instance.Module.SendMessage(
                    'WebGLBridge',
                    'OnMessage',
                    JSON.stringify(messageToSend)
                );
                messageSent = true;
            } else if (unityState.instance.SendMessage) {
                unityState.instance.SendMessage(
                    'WebGLBridge',
                    'OnMessage',
                    JSON.stringify(messageToSend)
                );
                messageSent = true;
            }
            
            if (!messageSent) {
                throw new Error('Unity SendMessage関数が見つかりません');
            }
            
            console.log('Unity SendMessage成功:', messageToSend.type, messageToSend.emotion);
            unityState.lastMessageTime = Date.now();
            
            const processTimer = setTimeout(() => {
                unityState.isSending = false;
                processUnityMessageQueue();
            }, 30);
            
            if (unityState.instanceCheckTimers) {
                unityState.instanceCheckTimers.add(processTimer);
            }
            
        } catch (error) {
            console.error('Unity SendMessageエラー:', error);
            
            unityState.instance = null;
            unityState.isReady = false;
            
            unityState.messageQueue.unshift(messageToSend);
            
            const retryTimer = setTimeout(() => {
                unityState.isSending = false;
                processUnityMessageQueue();
            }, 1000);
            
            if (unityState.instanceCheckTimers) {
                unityState.instanceCheckTimers.add(retryTimer);
            }
        }
    }
    
    // ====== 会話フロー制御 ======
    function startConversation(emotion, audioData) {
        console.log('🎬 会話開始:', emotion);
        
        stopAllAudio();
        
        const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        
        conversationState.isActive = true;
        conversationState.startTime = Date.now();
        conversationState.currentEmotion = emotion;
        conversationState.conversationId = conversationId;
        
        sendEmotionToAvatar(emotion, true, 'conversation_start', conversationId);
        
        if (audioData && !isAudioPlaying()) {
            playAudioWithLipSync(audioData, emotion);
        } else if (!audioData) {
            const endTimer = setTimeout(() => {
                endConversation();
            }, 3000);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(endTimer);
            }
        }
    }
    
    function isAudioPlaying() {
        return unityState.activeAudioElement && 
               !unityState.activeAudioElement.paused && 
               !unityState.activeAudioElement.ended;
    }
    
    function stopAllAudio() {
        // 既存の音声を停止
        if (unityState.activeAudioElement) {
            unityState.activeAudioElement.pause();
            unityState.activeAudioElement.currentTime = 0;
            unityState.activeAudioElement = null;
        }
        
        if (conversationState.audioElement) {
            conversationState.audioElement.pause();
            conversationState.audioElement.currentTime = 0;
            conversationState.audioElement = null;
        }
        
        // タイマーをクリア
        if (conversationState.audioTimers) {
            conversationState.audioTimers.forEach(timer => clearTimeout(timer));
            conversationState.audioTimers.clear();
        }
        
        console.log('🔇 すべての音声を停止しました');
    }
    
    function playAudioWithLipSync(audioData, emotion) {
        const audioSrc = audioData.startsWith('data:') ? 
            audioData : `data:audio/mp3;base64,${audioData}`;
        const audio = new Audio(audioSrc);
        audio.muted = audioState.isMuted;
        audio.playbackRate = VOICE_PLAYBACK_RATE;
        
        unityState.activeAudioElement = audio;
        conversationState.audioElement = audio;
        
        // 🔧 修正: 音声長を動的に推定して最大再生時間を設定（再生速度に応じた壁時計時間）
        const estimatedDuration = estimateAudioDuration(audioData);
        const wallClockSec = estimatedDuration / VOICE_PLAYBACK_RATE;
        const maxPlayTime = Math.max(
            wallClockSec * 1000 + 5000,  // 推定の実再生時間 + 5秒バッファ
            60000  // 最低60秒を保証
        );
        console.log(`🎵 最大再生時間: ${maxPlayTime / 1000}秒 (推定元: ${estimatedDuration.toFixed(1)}秒, ${VOICE_PLAYBACK_RATE}x速)`);
        
        let playbackTimer = null;
        let hasEnded = false;
        
        const handleAudioEnd = () => {
            if (hasEnded) return;
            hasEnded = true;
            
            console.log('🎵 音声終了処理開始');
            
            // 🔧 修正: audioTimersから削除してからnullにする（順序重要）
            if (playbackTimer) {
                if (conversationState.audioTimers) {
                    conversationState.audioTimers.delete(playbackTimer);
                    console.log('⏹️ playbackTimerをaudioTimersから削除しました');
                }
                clearTimeout(playbackTimer);
                console.log('⏹️ playbackTimerをキャンセルしました');
                playbackTimer = null;
            }
            
            if (socket && socket.connected) {
                socket.emit('conversation_ended');
                console.log('💬 サーバーに会話終了を通知');
            }
            
            endConversation();
        };
        
        audio.oncanplaythrough = function() {
            console.log('🔊 音声準備完了');
        };
        
        audio.onplay = function() {
            console.log(`🔊 音声再生開始 (ミュート: ${audioState.isMuted})`);
            
            playbackTimer = setTimeout(() => {
                console.log('⏰ 最大再生時間到達 - 強制終了');
                audio.pause();
                handleAudioEnd();
            }, maxPlayTime);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(playbackTimer);
            }
        };
        
        audio.onended = function() {
            console.log('🔊 音声再生完了(正常終了)');
            handleAudioEnd();
        };
        
        audio.onerror = function(error) {
            console.error('🔊 音声再生エラー:', error);
            const errorTimer = setTimeout(() => {
                handleAudioEnd();
            }, 2000);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(errorTimer);
            }
        };
        
        // 🔧 v3.5: 常に音声を自動再生（言語選択時にAudioContextは初期化済み）
        audio.play().catch(error => {
            console.error('🔊 音声再生開始エラー:', error);
            
            const fallbackTimer = setTimeout(() => {
                handleAudioEnd();
            }, 2000);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(fallbackTimer);
            }
        });
    }
    
    function endConversation() {
        console.log('🏁 会話終了処理開始');
        
        stopAllAudio();
        
        sendEmotionToAvatar('neutral', false, 'conversation_end');
        
        // 複数回Neutral送信で確実性を高める
        const neutralTimer1 = setTimeout(() => {
            sendEmotionToAvatar('neutral', false, 'ensure_neutral');
        }, 100);
        
        const neutralTimer2 = setTimeout(() => {
            if (unityState.currentEmotion !== 'neutral' || unityState.currentTalkingState !== false) {
                console.log('⚠️ まだNeutralになっていない - 再送信');
                sendEmotionToAvatar('neutral', false, 'force_neutral');
            }
        }, 500);
        
        if (conversationState.audioTimers) {
            conversationState.audioTimers.add(neutralTimer1);
            conversationState.audioTimers.add(neutralTimer2);
        }
        
        resetConversationState();
        
        // 🎯 クイズ提案が必要な場合は送信
        if (quizState.shouldProposeQuizAfterConversation && !quizState.hasCompletedQuiz && !quizState.isActive) {
            console.log('🎯 音声終了：クイズ提案を送信します');
            quizState.shouldProposeQuizAfterConversation = false;  // フラグをリセット
            
            setTimeout(() => {
                if (socket && socket.connected) {
                    socket.emit('request_quiz_proposal', {
                        language: appState.currentLanguage
                    });
                }
            }, 1000);  // 1秒後にクイズ提案（余裕を持って）
        }
        
        console.log('🏁 会話終了処理完了');
    }
    
    function resetConversationState() {
        conversationState.isActive = false;
        conversationState.startTime = 0;
        conversationState.audioElement = null;
        conversationState.currentEmotion = 'neutral';
        conversationState.conversationId = null;
        
        // タイマーをクリア
        if (conversationState.audioTimers) {
            conversationState.audioTimers.forEach(timer => clearTimeout(timer));
            conversationState.audioTimers.clear();
        }
        
        console.log('🏁 会話状態リセット完了');
    }
    
    // ====== Unity完全準備状態チェック ======
    function isUnityFullyReady() {
        return unityState.isReady && 
               unityState.isFullyInitialized &&
               unityState.startMotionCompleted &&
               appState.connectionStatus === 'connected' && 
               audioState.initialized;
    }
    
    function isSystemReady() {
        return unityState.isReady && 
               appState.connectionStatus === 'connected' && 
               audioState.initialized;
    }
    
    // ====== 自己紹介実行 ======
    function requestIntroduction(requester, data = null) {
        if (!isSystemReady()) {
            introductionManager.debugLog(`自己紹介延期: システム準備未完了 (要求者: ${requester})`);
            return false;
        }
        
        if (introductionManager.startIntroduction(requester, data)) {
            if (introductionManager.status === 'running') {
                executeIntroduction(data);
            }
            return true;
        }
        return false;
    }
    
    function executeIntroduction(data = null) {
        introductionManager.debugLog('🎭 自己紹介実行開始', data);
        
        if (!isUnityFullyReady()) {
            introductionManager.debugLog('⚠️ Unity未初期化のため自己紹介を延期');
            introductionManager.status = 'waiting_unity';
            introductionManager.pendingIntroData = data;
            return;
        }
        
        if (data && data.audio) {
            const emotion = data.emotion || 'happy';
            introductionManager.debugLog(`🎵 音声付き自己紹介: ${emotion}`);
            
            const introTimer = setTimeout(() => {
                startConversation(emotion, data.audio);
            }, 200);
            
            const completeTimer = setTimeout(() => {
                introductionManager.completeIntroduction();
            }, 5000);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(introTimer);
                conversationState.audioTimers.add(completeTimer);
            }
        } else {
            introductionManager.debugLog('⏳ 音声データなし - 挨拶メッセージ待機中');
            introductionManager.status = 'pending';
        }
    }
    
    // 🆕 京セラCERA用: 属性選択UI表示関数（🔧 修正版）
    function showUserTypeSelection() {
        console.log('🎭🎭🎭 属性選択UIを表示 - 開始 🎭🎭🎭');
        console.log(`📊 現在の状態: userTypeSelected=${userTypeSelected}, language=${appState.currentLanguage}`);
        
        const isJapanese = appState.currentLanguage === 'ja';
        
        // 🔧 修正: addMessage()を使用して既存のCSSを適用
        const messageText = isJapanese 
            ? 'あなたについて教えてください。'
            : 'Tell me about yourself.';
        console.log(`📝 メッセージテキスト: ${messageText}`);
        const messageWrapper = addMessage(messageText, false);
        
        if (!messageWrapper) {
            console.error('❌ メッセージ表示に失敗しました');
            return;
        }
        console.log('✅ メッセージ表示成功');
        
        // ボタンコンテナを作成
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'message-suggestions';  // 既存のサジェスチョンコンテナと同じクラス
        buttonContainer.style.marginTop = '10px';
        
        // 🔧 修正: ビジネスボタン（通常のサジェスチョンと同じスタイル）
        const businessButton = document.createElement('button');
        businessButton.className = 'suggestion-button';
        businessButton.textContent = isJapanese 
            ? 'ビジネス・協業に興味がある'
            : 'Business / Collaboration';
        businessButton.addEventListener('click', () => handleUserTypeSelection('business', buttonContainer));
        
        // 🔧 修正: 学生ボタン（通常のサジェスチョンと同じスタイル）
        const studentButton = document.createElement('button');
        studentButton.className = 'suggestion-button';
        studentButton.textContent = isJapanese 
            ? '学生・キャリアに興味がある'
            : 'Student / Career';
        studentButton.addEventListener('click', () => handleUserTypeSelection('student', buttonContainer));
        
        buttonContainer.appendChild(businessButton);
        buttonContainer.appendChild(studentButton);
        messageWrapper.appendChild(buttonContainer);
        
        console.log('✅ ボタンコンテナをDOMに追加しました');
        console.log(`📋 ボタン数: ${buttonContainer.children.length}`);
        
        // スクロール調整
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 100);
        
        console.log('🎭🎭🎭 属性選択UIを表示 - 完了 🎭🎭🎭');
    }
    
    // 🆕 京セラCERA用: 属性選択ハンドラー（🔧 修正版）
    function handleUserTypeSelection(type, buttonContainer) {
        console.log(`📋 ユーザー属性選択: ${type}`);
        
        // 🔧 追加: 属性選択タイマーをクリア（二重表示防止）
        if (appState.userTypeSelectionTimer) {
            clearTimeout(appState.userTypeSelectionTimer);
            appState.userTypeSelectionTimer = null;
            console.log('⏹️ 属性選択タイマーをクリアしました');
        }
        
        // ボタンを無効化
        if (buttonContainer) {
            buttonContainer.remove();
        }
        
        // フラグ設定
        userTypeSelected = true;
        
        // 🔧 修正: Socket.IOではsocket.connectedを使用
        if (socket && socket.connected) {
            socket.emit('select_user_type', {
                type: type,
                language: appState.currentLanguage
            });
            
            console.log(`✅ 属性選択を送信: ${type}`);
        } else {
            console.error('❌ Socket未接続 - 属性選択を送信できません');
        }
    }
    
    function executeGreetingWithIntroduction(data, emotion) {
        console.log('🎭 音声付き自己紹介を実行開始');
        
        if (!unityState.isReady) {
            console.warn('⚠️ Unity未準備 - 実行を延期');
            const retryTimer = setTimeout(() => executeGreetingWithIntroduction(data, emotion), 500);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(retryTimer);
            }
            return;
        }
        
        const messageWrapper = addMessage(data.message, false, { isGreeting: true });
        
        conversationMemory.addMessage('assistant', data.message, data.emotion);
        appState.conversationCount++;
        
        if (data.suggestions) {
            showSuggestions(data.suggestions, messageWrapper);
        }
        
        startConversation(emotion, data.audio);
        
        // 🐶 属性選択UI表示制御（Futaba用は無効化）
        console.log(`🔍 属性選択チェック: enableUserTypeSelection=${data.enableUserTypeSelection}, userTypeSelected=${userTypeSelected}, isGreeting=${data.isGreeting}`);
        
        if (data.enableUserTypeSelection && !userTypeSelected && data.isGreeting) {
            console.log('✅ 3秒後に属性選択UIを表示します');
            const delayTimer = setTimeout(() => {
                console.log('⏰ 3秒経過 - 属性選択UI表示を実行');
                showUserTypeSelection();
            }, 3000);  // 自己紹介の3秒後
            
            // 🔧 重要: このタイマーはaudioTimersに追加しない（会話終了時にクリアされないように）
            appState.userTypeSelectionTimer = delayTimer;
        } else {
            console.log(`❌ 属性選択UI非表示: enableUserTypeSelection=${data.enableUserTypeSelection}, userTypeSelected=${userTypeSelected}, isGreeting=${data.isGreeting}`);
        }
    }
    
    // ====== イベントハンドラー(続き) ======
    function handleSocketConnect() {
        console.log('サーバーに接続しました');
        updateConnectionStatus('connected');
        
        try {
            localStorage.setItem('preferred_language', 'ja');
        } catch (e) {
            console.warn('言語設定の保存に失敗:', e);
        }
        selectLanguage('ja');
        
        const visitorTimer = setTimeout(() => {
            sendVisitorInfo();
        }, 2000);
        
        if (conversationState.audioTimers) {
            conversationState.audioTimers.add(visitorTimer);
        }
    }
    
    function handleLanguageUpdate(data) {
        console.log('言語が設定/変更されました:', data.language);
        appState.currentLanguage = 'ja';
        updateUILanguage('ja');
        
        // 言語切り替えによる挨拶が来ることを通知
        expectingLanguageChangeGreeting = true;
        console.log('🚩 言語切り替えフラグをON - 次の挨拶で履歴をクリアしません');
    }
    
    function handleGreetingMessage(data) {
        console.log('🎵 挨拶メッセージを受信:', data);
        
        // 言語切り替え中でなければ履歴をクリア
        if (!expectingLanguageChangeGreeting && domElements.chatMessages) {
            domElements.chatMessages.innerHTML = '';
            console.log('🗑️ チャット履歴をクリアしました');
        } else if (expectingLanguageChangeGreeting) {
            console.log('✅ 言語切り替え中のため履歴を保持します');
        }
        
        // フラグをリセット
        expectingLanguageChangeGreeting = false;
        
        const emotion = data.emotion || 'start';
        
        if (data.audio) {
            console.log('🎵 音声付き挨拶メッセージ');
            
            if (isUnityFullyReady()) {
                console.log('🎮 Unity準備完了 - 即座に挨拶実行');
                executeGreetingWithIntroduction(data, emotion);
            } else {
                console.log('🎮 Unity初期化待ち - 挨拶を保留');
                unityState.pendingGreeting = {
                    data: data,
                    emotion: emotion
                };
                
                const timeoutTimer = setTimeout(() => {
                    if (unityState.pendingGreeting) {
                        console.log('⚠️ タイムアウト - 挨拶を強制実行');
                        executeGreetingWithIntroduction(
                            unityState.pendingGreeting.data,
                            unityState.pendingGreeting.emotion
                        );
                        unityState.pendingGreeting = null;
                    }
                }, 10000);
                
                if (conversationState.audioTimers) {
                    conversationState.audioTimers.add(timeoutTimer);
                }
            }
        } else {
            console.log('📝 テキストのみ挨拶メッセージ');
            const messageWrapper = addMessage(data.message, false, { isGreeting: true });
            conversationMemory.addMessage('assistant', data.message, data.emotion);
            appState.conversationCount++;
            showSuggestions(data.suggestions, messageWrapper);
            
            sendEmotionToAvatar('neutral', false, 'greeting_text_only');
        }
        
        appState.isWaitingResponse = false;
        updateConnectionStatus('connected');
        
        // 🎯 追加: 再接続時にMAXレベル＆クイズ未完了ならクイズ提案フラグを立てる
        if (data.relationshipLevelName === 'MAX' && !quizState.hasCompletedQuiz && !quizState.isActive) {
            console.log('🎯 再接続時MAX検出：クイズ提案フラグをセット');
            quizState.isQuizAvailable = true;
            quizState.shouldProposeQuizAfterConversation = true;
        }
    }
    
    // 🆕 京セラCERA用: ユーザー属性選択完了ハンドラー
    function handleUserTypeSelected(data) {
        console.log('📋 属性選択完了受信', data);
        
        // メッセージ表示
        const messageWrapper = addMessage(data.message, false);
        
        // 会話メモリに追加
        conversationMemory.addMessage('assistant', data.message, data.emotion);
        appState.conversationCount++;
        
        // 🔧 修正: 通常の応答と同じ音声再生ロジックを使用
        let emotion = data.emotion || 'neutral';
        
        if (data.audio) {
            // 音声再生とリップシンク（感情同期も含む）
            startConversation(emotion, data.audio);
        } else {
            console.log('🔇 音声データなし - テキストのみ応答');
            
            // 音声なしの場合は感情のみ送信
            if (isUnityFullyReady()) {
                sendEmotionToAvatar(emotion, true, 'text_response_start');
                
                const textLength = data.message ? data.message.length : 20;
                const duration = Math.min(Math.max(textLength * 100, 2000), 8000);
                
                const endTimer = setTimeout(() => {
                    sendEmotionToAvatar('neutral', false, 'text_response_end');
                    console.log(`✅ ${duration}ms後にNeutralに復帰`);
                }, duration);
                
                if (conversationState.audioTimers) {
                    conversationState.audioTimers.add(endTimer);
                }
            }
        }
        
        // サジェスチョン表示
        if (data.suggestions && data.suggestions.length > 0) {
            setTimeout(() => {
                showSuggestions(data.suggestions, messageWrapper);
            }, 500);
        }
        
        console.log(`✅ 属性: ${data.userType}, サジェスチョン: ${data.suggestions?.length || 0}個`);
    }
    
    function handleResponseMessage(data) {
        try {
            appState.isWaitingResponse = false;
            updateConnectionStatus('connected');
            appState.lastResponseTime = Date.now();
            
            console.log('📨 応答受信:', data);
            
            if (data.clearSelectedSuggestions) {
                visitorManager.clearSelectedSuggestions();
                console.log('🔙 サーバー指示: 選択済みサジェスチョンをクリア');
            }
            
            // メディアデータがあるか確認
            const hasMedia = data.media && (data.media.images?.length > 0 || data.media.videos?.length > 0);
            if (hasMedia) {
                console.log('📷 メディア付き応答:', data.media);
            }
            
            // メッセージ表示（メディアを含む）
            const options = {
                media: data.media || null
            };
            
            const messageWrapper = addMessage(data.message, false, options);
            
            conversationMemory.addMessage('assistant', data.message, data.emotion);
            appState.conversationCount++;
            
            const newConversationCount = visitorManager.incrementConversationCount();
            const levelInfo = relationshipManager.calculateLevel(newConversationCount);
            relationshipManager.updateUI(levelInfo, newConversationCount);
            visitorManager.updateRelationshipLevel(levelInfo.level);
            
            if (data.currentTopic) {
                conversationMemory.updateTopic(data.currentTopic);
                visitorManager.addTopic(data.currentTopic);
            }
            
            let emotion = data.emotion || 'neutral';
            
            if (data.audio) {
                startConversation(emotion, data.audio);
            } else {
                console.log('🔇 音声データなし - テキストのみ応答');
                
                sendEmotionToAvatar(emotion, true, 'text_response_start');
                
                const textLength = data.message ? data.message.length : 20;
                const duration = Math.min(Math.max(textLength * 100, 2000), 8000);
                
                const endTimer = setTimeout(() => {
                    sendEmotionToAvatar('neutral', false, 'text_response_end');
                    console.log(`✅ ${duration}ms後にNeutralに復帰`);
                }, duration);
                
                if (conversationState.audioTimers) {
                    conversationState.audioTimers.add(endTimer);
                }
            }
            
            // 🔧 修正: 音声再生の有無に関わらず、テキスト表示後すぐにサジェスチョンを表示
            if (data.suggestions && data.suggestions.length > 0) {
                // 常に800ms後にサジェスチョンを表示（ユーザーがテキストを読む時間を確保）
                const suggestionTimer = setTimeout(() => {
                    showSuggestions(data.suggestions, messageWrapper);
                    console.log('📋 サジェスチョン表示完了');
                }, 800);
                
                if (conversationState.audioTimers) {
                    conversationState.audioTimers.add(suggestionTimer);
                }
            }
            
        } catch (error) {
            console.error('レスポンス処理エラー:', error);
            sendEmotionToAvatar('neutral', false, 'error_recovery');
        }
    }
    
    function handleTranscription(data) {
        addMessage(data.text, true);
        conversationMemory.addMessage('user', data.text, null);
        appState.interactionCount++;
        
        const questionCount = visitorManager.incrementQuestionCount(data.text);
        console.log(`📊 音声質問の回数: ${questionCount}回目`);
    }
    
    function handleErrorMessage(data) {
        console.error('エラー:', data.message);
        appState.isWaitingResponse = false;
        showError(data.message || '不明なエラーが発生しました');
        updateConnectionStatus('error');
        sendEmotionToAvatar('neutral', false, 'emergency');
    }
    
    function handleConversationStart(data) {
        console.log('💬 サーバーから会話開始通知:', data);
        
        unityState.audioPlaybackActive = true;
        unityState.currentConversationEmotion = data.emotion || 'neutral';
        
        sendEmotionToAvatar(data.emotion || 'neutral', true, 'server_conversation_start');
    }
    
    function handleConversationEnd(data) {
        console.log('💬 Unity側への会話終了通知:', data);
        
        unityState.audioPlaybackActive = false;
        
        sendEmotionToAvatar('neutral', false, 'server_conversation_end');
    }
    
    function handleUnityMessage(event) {
        if (!event.data || typeof event.data !== 'object') return;
        
        if (event.data.type === 'unity-ready') {
            console.log('Unityから準備完了の通知を受信しました');
            
            const readyTimer = setTimeout(() => {
                if (findUnityInstance()) {
                    console.log('Unity instanceの準備完了');
                    unityState.isReady = true;
                    updateConnectionStatus('connected');
                }
            }, 500);
            
            if (unityState.instanceCheckTimers) {
                unityState.instanceCheckTimers.add(readyTimer);
            }
        }
        
        if (event.data.type === 'unity-fully-initialized') {
            console.log('🎮 Unityから完全初期化通知を受信');
            unityState.isFullyInitialized = true;
            
            const initTimer = setTimeout(() => {
                unityState.startMotionCompleted = true;
                console.log('✅ Startモーション完了 - システム準備完了');
                
                if (unityState.pendingGreeting) {
                    console.log('🎭 保留中の挨拶を実行');
                    executeGreetingWithIntroduction(
                        unityState.pendingGreeting.data,
                        unityState.pendingGreeting.emotion
                    );
                    unityState.pendingGreeting = null;
                }
            }, 3500);
            
            if (unityState.instanceCheckTimers) {
                unityState.instanceCheckTimers.add(initTimer);
            }
        }
        
        if (event.data.type === 'start-motion-completed' || event.data.type === 'motion-changed') {
            console.log('🎬 モーション変更通知を受信:', event.data.motion || 'start');
            
            if (event.data.motion === 'start' || event.data.type === 'start-motion-completed') {
                unityState.startMotionCompleted = true;
                
                if (unityState.pendingGreeting) {
                    console.log('🎭 保留中の挨拶を実行(モーション完了後)');
                    executeGreetingWithIntroduction(
                        unityState.pendingGreeting.data,
                        unityState.pendingGreeting.emotion
                    );
                    unityState.pendingGreeting = null;
                }
            }
        }
        
        if (event.data.type === 'unity-emotion-change') {
            console.log('🎭 Unity側から感情変更通知:', event.data.emotion, 'Talking:', event.data.isTalking);
        }
    }
    
    // ====== 訪問者情報送信 ======
    function sendVisitorInfo() {
        const infoTimer = setTimeout(() => {
            if (socket && socket.connected) {
                socket.emit('visitor_info', {
                    visitorId: visitorManager.visitorId,
                    visitData: visitorManager.visitData
                });
                console.log('👤 訪問者情報をサーバーに送信');
            }
        }, 1000);
        
        if (conversationState.audioTimers) {
            conversationState.audioTimers.add(infoTimer);
        }
    }
    
    // ====== ユーティリティ関数 ======
    function updateConnectionStatus(status) {
        if (appState.connectionStatus === status) return;
        
        appState.connectionStatus = status;
        
        if (!domElements.statusIndicator) return;
        
        switch (status) {
            case 'disconnected':
                domElements.statusIndicator.style.backgroundColor = '#999';
                domElements.statusIndicator.title = '切断されています';
                break;
            case 'connecting':
                domElements.statusIndicator.style.backgroundColor = '#FFA500';
                domElements.statusIndicator.title = '接続中...';
                break;
            case 'connected':
                domElements.statusIndicator.style.backgroundColor = '#00FF00';
                domElements.statusIndicator.title = '接続済み';
                break;
            case 'processing':
                domElements.statusIndicator.style.backgroundColor = '#0000FF';
                domElements.statusIndicator.title = '処理中...';
                break;
            case 'recording':
                domElements.statusIndicator.style.backgroundColor = '#FF0000';
                domElements.statusIndicator.title = '録音中...';
                break;
            case 'error':
                domElements.statusIndicator.style.backgroundColor = '#FF0000';
                domElements.statusIndicator.title = 'エラーが発生しました';
                break;
        }
        
        console.log(`接続状態を更新: ${status}`);
    }
    
    function generateSessionId() {
        return 'session_' + Math.random().toString(36).substring(2, 9) + '_' + 
               new Date().getTime().toString(36);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function linkifyUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.classList.add('error-message');
        errorDiv.textContent = message;
        
        if (domElements.chatMessages) {
            domElements.chatMessages.appendChild(errorDiv);
        } else {
            document.body.appendChild(errorDiv);
        }
        
        const errorTimer = setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
        
        if (conversationState.audioTimers) {
            conversationState.audioTimers.add(errorTimer);
        }
    }
    
    function playSystemSound(soundName) {
        if (!systemSounds[soundName] || audioState.isMuted) {
            return;
        }
        
        try {
            const audio = systemSounds[soundName];
            
            if (audio && audio.readyState >= 2) {
                audio.currentTime = 0;
                audio.play().catch(() => {
                    // 音声再生エラーは無視
                });
            }
        } catch (e) {
            // エラーは無視
        }
    }
    
    function convertBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = function() {
                resolve(reader.result);
            };
            reader.onerror = function() {
                reject(new Error("ファイル変換エラー"));
            };
            reader.readAsDataURL(blob);
        });
    }
    
    function cleanupResources() {
        // タイマーをクリア
        if (unityState.instanceCheckTimers) {
            unityState.instanceCheckTimers.forEach(timer => clearTimeout(timer));
            unityState.instanceCheckTimers.clear();
        }
        
        if (conversationState.audioTimers) {
            conversationState.audioTimers.forEach(timer => clearTimeout(timer));
            conversationState.audioTimers.clear();
        }
        
        // インターバルをクリア
        if (unityState.connectionCheckInterval) {
            clearInterval(unityState.connectionCheckInterval);
        }
        
        // Socket.IOを切断
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
        
        // 音声録音を停止
        if (audioState.recorder && audioState.recorder.state === 'recording') {
            audioState.recorder.stop();
        }
        
        // AudioContextをクローズ
        if (audioState.audioContext && audioState.audioContext.state !== 'closed') {
            audioState.audioContext.close().catch(e => {
                console.warn('AudioContextのクローズに失敗:', e);
            });
        }
        
        // 会話状態をリセット
        if (conversationState.isActive) {
            resetConversationState();
        }
        
        // 音声を停止
        stopAllAudio();
        
        console.log('リソースをクリーンアップしました');
    }
    
    // ====== クイズシステム関数 ======

    /**
     * クイズ提案を受信して表示
     */
    function handleQuizProposal(data) {
        if (quizState.isActive || quizState.hasCompletedQuiz) return;
        
        // optionsオブジェクトを正しく設定
        const messageWrapper = addMessage(data.message, false, { isGreeting: false });
        
        // 感情とモーション
        sendEmotionToAvatar(data.emotion, true, 'quiz_proposal');
        
        // 音声再生
        if (data.audio) {
            startConversation(data.emotion, data.audio);
        }
        
        // 選択ボタンを表示
        setTimeout(() => {
            showQuizChoiceButtons(messageWrapper);
        }, 500);
    }

    /**
     * クイズ問題を受信して表示
     */
    function handleQuizQuestion(data) {
        quizState.quizData = data;
        
        const isJapanese = appState.currentLanguage === 'ja';
        const questionNumber = data.questionIndex + 1;
        
        // 問題文を表示
        const questionText = `${isJapanese ? '問題' : 'Question'} ${questionNumber}: ${data.question}`;
        const messageWrapper = addMessage(questionText, false, { skipSound: true });
        
        // 感情とモーション
        sendEmotionToAvatar('neutraltalking', true, 'quiz_question');
        
        // 音声再生
        if (data.audio) {
            startConversation('neutraltalking', data.audio);
        }
        
        // 選択肢ボタンを表示
        setTimeout(() => {
            showQuizOptions(data, messageWrapper);
        }, 500);
    }

    /**
     * Base64エンコードされた音声データから長さ（秒）を推定
     * @param {string} audioBase64 - Base64エンコードされた音声データ
     * @returns {number} - 推定される音声の長さ（秒）
     */
    function estimateAudioDuration(audioBase64) {
        if (!audioBase64) return 0;
        
        try {
            // Base64のデータ部分を取得（data:audio/wav;base64, を除く）
            const base64Data = audioBase64.split(',')[1] || audioBase64;
            
            // Base64の文字数からバイト数を計算（Base64は4文字で3バイトを表現）
            const byteLength = (base64Data.length * 3) / 4;
            
            // WAVヘッダーサイズを引く（通常44バイト）
            const audioDataSize = byteLength - 44;
            
            // OpenAI TTSの標準設定（24kHz, 16bit, モノラル）
            const sampleRate = 24000;
            const bytesPerSample = 2;  // 16bit = 2 bytes
            const channels = 1;  // モノラル
            
            // 長さを計算
            const duration = audioDataSize / (sampleRate * bytesPerSample * channels);
            
            console.log(`🎵 音声長推定: ${duration.toFixed(2)}秒 (${audioDataSize}バイト)`);
            
            return Math.max(0, duration);
        } catch (e) {
            console.error('音声長の推定に失敗:', e);
            return 3;  // エラー時はデフォルト3秒
        }
    }

    /**
     * 回答結果を受信して表示（🎯 修正: 音声長に基づいて遅延時間を計算）
     */
    function handleQuizAnswerResult(data) {
        const isJapanese = appState.currentLanguage === 'ja';
        
        // 結果メッセージ表示
        addMessage(data.resultMessage, false, { skipSound: true });
        
        // 感情とモーション
        sendEmotionToAvatar(data.emotion, true, 'quiz_result');
        
        // 解説を表示
        setTimeout(() => {
            const explanationMessage = `${isJapanese ? '正解' : 'Answer'}: ${data.correctOption}\n\n${data.explanation}`;
            addMessage(explanationMessage, false, {});
            
            // 音声再生
            if (data.audio) {
                startConversation(data.emotion, data.audio);
            }
            
        }, 1000);
        
        // 🎯 修正: 音声長に基づいて次の処理までの遅延時間を計算
        let delayTime = 3000;  // デフォルト3秒
        if (data.audio) {
            const audioDuration = estimateAudioDuration(data.audio);
            const wallSec = audioDuration / VOICE_PLAYBACK_RATE;
            // 実再生時間 + 余裕（2秒）— 再生速度と整合
            delayTime = Math.max(3000, (wallSec + 2) * 1000);
            console.log(`⏱️ 次の処理まで ${(delayTime / 1000).toFixed(1)}秒待ちます`);
        }
        
        setTimeout(() => {
            if (data.hasNextQuestion && data.nextQuestionIndex !== null) {
                // 次の問題をサーバーにリクエスト
                if (socket && socket.connected) {
                    socket.emit('request_next_quiz_question', {
                        questionIndex: data.nextQuestionIndex,
                        language: appState.currentLanguage
                    });
                }
            } else if (data.isFinalResult) {
                // 最終結果をサーバーにリクエスト
                if (socket && socket.connected) {
                    socket.emit('request_quiz_final_result', {
                        totalCorrect: data.totalCorrect,
                        language: appState.currentLanguage
                    });
                }
            }
        }, delayTime);
    }

    /**
     * クイズ最終結果を受信して表示（🎯 修正: localStorage永続化追加）
     */
    function handleQuizFinalResult(data) {
        quizState.isActive = false;
        
        // 🔧 修正v3.0: 正解数に関わらず同じ処理
        // メッセージを表示
        addMessage(data.message, false, { skipSound: true });
        
        // 感情をアバターに送信（常にhappy、音声があればtalking状態）
        const isTalking = !!data.audio;
        sendEmotionToAvatar('happy', isTalking, data.allCorrect ? 'quiz_perfect' : 'quiz_finished');
        
        // 音声再生
        if (data.audio) {
            startConversation('happy', data.audio);
        }
        
        // クイズ完了フラグをlocalStorageに永続化
        quizState.hasCompletedQuiz = true;
        localStorage.setItem('quiz_completed', 'true');
        
        // 🔧 注意: Masterレベル昇格はアンケート回答後に行う（ここでは行わない）
        
        // 常にアンケートを表示（5秒後）
        if (data.showSurvey) {
            setTimeout(() => {
                showSurveyAfterQuiz(data.score);
            }, 5000);
        }
    }

    /**
     * クイズ挑戦の選択ボタンを表示
     */
    function showQuizChoiceButtons(targetWrapper) {
        const isJapanese = appState.currentLanguage === 'ja';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'quiz-choice-buttons';
        
        const acceptButton = document.createElement('button');
        acceptButton.className = 'quiz-choice-button accept';
        acceptButton.textContent = isJapanese ? '挑戦する！' : 'Challenge!';
        acceptButton.addEventListener('click', () => {
            buttonContainer.remove();
            startQuiz();
        });
        
        const declineButton = document.createElement('button');
        declineButton.className = 'quiz-choice-button decline';
        declineButton.textContent = isJapanese ? '今はやめておく' : 'Not now';
        declineButton.addEventListener('click', () => {
            buttonContainer.remove();
            
            // 🎯 修正: クイズを断ったフラグをセット
            quizState.quizDeclined = true;
            console.log('🚫 クイズを断りました - 今後の応答にクイズボタンを表示します');
            
            // サーバーに辞退を通知
            if (socket && socket.connected) {
                socket.emit('quiz_declined');
            }
            
            sendEmotionToAvatar('neutral', false, 'quiz_declined');
        });
        
        buttonContainer.appendChild(acceptButton);
        buttonContainer.appendChild(declineButton);
        
        if (targetWrapper) {
            targetWrapper.appendChild(buttonContainer);
        } else {
            domElements.chatMessages.appendChild(buttonContainer);
        }
        
        // スクロール調整
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 100);
    }

    /**
     * クイズを開始
     */
    function startQuiz() {
        quizState.isActive = true;
        quizState.currentQuestion = 0;
        quizState.correctAnswers = 0;
        quizState.userAnswers = [];
        
        // サーバーにクイズ開始を通知
        if (socket && socket.connected) {
            socket.emit('quiz_start', {
                language: appState.currentLanguage
            });
        }
    }

    /**
     * クイズ選択肢を表示
     */
    function showQuizOptions(questionData, targetWrapper) {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'quiz-options-container';
        
        questionData.options.forEach((option, index) => {
            const optionButton = document.createElement('button');
            optionButton.className = 'quiz-option-button';
            optionButton.textContent = option;
            optionButton.addEventListener('click', () => {
                handleQuizAnswer(index, questionData);
                optionsContainer.remove();
            });
            
            optionsContainer.appendChild(optionButton);
        });
        
        if (targetWrapper) {
            targetWrapper.appendChild(optionsContainer);
        } else {
            domElements.chatMessages.appendChild(optionsContainer);
        }
        
        // スクロール調整
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 100);
    }

    /**
     * クイズ回答を処理
     */
    function handleQuizAnswer(selectedIndex, questionData) {
        const isCorrect = selectedIndex === questionData.correct;
        
        if (isCorrect) {
            quizState.correctAnswers++;
        }
        
        quizState.currentQuestion++;
        quizState.userAnswers.push({
            question: questionData.questionIndex,
            selected: selectedIndex,
            correct: isCorrect
        });
        
        // サーバーに回答を送信
        if (socket && socket.connected) {
            socket.emit('quiz_answer', {
                questionIndex: questionData.questionIndex,
                selectedIndex: selectedIndex,
                isCorrect: isCorrect,
                currentQuestion: quizState.currentQuestion,
                totalCorrect: quizState.correctAnswers,
                language: appState.currentLanguage
            });
        }
    }

    /**
     * 再挑戦ボタンを表示
     */
    function showQuizRetryButtons(targetWrapper) {
        const isJapanese = appState.currentLanguage === 'ja';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'quiz-choice-buttons';
        
        const retryButton = document.createElement('button');
        retryButton.className = 'quiz-choice-button accept';
        retryButton.textContent = isJapanese ? 'もう一度挑戦する' : 'Try again';
        retryButton.addEventListener('click', () => {
            buttonContainer.remove();
            startQuiz();
        });
        
        const quitButton = document.createElement('button');
        quitButton.className = 'quiz-choice-button decline';
        quitButton.textContent = isJapanese ? 'また今度にする' : 'Maybe later';
        quitButton.addEventListener('click', () => {
            buttonContainer.remove();
            
            // サーバーに辞退を通知
            if (socket && socket.connected) {
                socket.emit('quiz_quit');
            }
            
            sendEmotionToAvatar('neutral', false, 'quiz_quit');
        });
        
        buttonContainer.appendChild(retryButton);
        buttonContainer.appendChild(quitButton);
        
        if (targetWrapper) {
            targetWrapper.appendChild(buttonContainer);
        } else {
            domElements.chatMessages.appendChild(buttonContainer);
        }
    }

    /**
     * 報酬(待ち受け画像)を表示
     */
    function showQuizReward() {
        const isJapanese = appState.currentLanguage === 'ja';
        
        const rewardContainer = document.createElement('div');
        rewardContainer.className = 'quiz-reward-container';
        
        const rewardTitle = document.createElement('h3');
        rewardTitle.textContent = isJapanese ? '🎁 特別なプレゼント' : '🎁 Special Present';
        rewardContainer.appendChild(rewardTitle);
        
        const rewardImage = document.createElement('img');
        rewardImage.src = '/api/reward-image';
        rewardImage.alt = 'Nagami Wallpaper';
        rewardImage.className = 'reward-image';
        rewardContainer.appendChild(rewardImage);
        
        const downloadButton = document.createElement('a');
        downloadButton.href = '/api/reward-image';
        downloadButton.download = 'nagami.png';
        downloadButton.className = 'reward-download-button';
        downloadButton.textContent = isJapanese ? 'ダウンロード' : 'Download';
        rewardContainer.appendChild(downloadButton);
        
        domElements.chatMessages.appendChild(rewardContainer);
        
        // 🎯 新規追加: 追加メッセージを表示
        const additionalMessage = isJapanese 
            ? 'ほかに確認したいことがありましたら、お気軽にご質問ください。' 
            : 'If you have anything else you would like to confirm, please feel free to ask.';
        
        setTimeout(() => {
            const messageWrapper = addMessage(additionalMessage, false, { skipSound: true });
            
            // 🎯 stage3のサジェスチョンをサーバーにリクエスト
            if (socket && socket.connected) {
                socket.emit('request_stage3_suggestions', {
                    language: appState.currentLanguage
                });
            }
        }, 500);
        
        // スクロール調整
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 1000);
    }
    
    function handleVisibilityChange() {
        if (document.hidden) {
            console.log('ページが非表示になりました');
            
            if (audioState.isRecording) {
                stopVoiceRecording();
            }
        } else {
            console.log('ページが表示されました');
            
            if (!unityState.instance) {
                findUnityInstance();
            }
        }
    }
    
    // ====== デバッグ機能 ======
    window.debugUnity = function() {
        console.log('Unity State:', unityState);
    };
    
    window.debugSocket = function() {
        console.log('Socket:', socket);
        console.log('Connected:', socket?.connected);
        console.log('App State:', appState);
    };
    
    window.debugAudio = function() {
        console.log('Audio State:', audioState);
    };
    
    window.debugConversation = function() {
        console.log('Conversation State:', conversationState);
    };
    
    window.testEmotion = function(emotion, talking = false) {
        sendEmotionToAvatar(emotion, talking, 'manual_test');
    };
    
    window.resetVisitorData = function() {
        localStorage.removeItem('visitor_id');
        localStorage.removeItem('visit_data');
        console.log('訪問者データをリセットしました。ページをリロードしてください。');
    };
    
    window.forceNeutral = function() {
        console.log('🔧 強制的にNeutralに戻します');
        endConversation();
        for (let i = 0; i < 3; i++) {
            const neutralTimer = setTimeout(() => {
                sendEmotionToAvatar('neutral', false, `force_neutral_${i}`);
            }, i * 200);
            
            if (conversationState.audioTimers) {
                conversationState.audioTimers.add(neutralTimer);
            }
        }
    };
    
    // ====== アンケートシステム関数 ======
    
    /**
     * アンケート質問をサーバーから取得
     */
    function fetchSurveyQuestions() {
        if (socket && socket.connected) {
            socket.emit('get_survey_questions');
        }
    }
    
    /**
     * クイズ完了後にアンケートを表示
     * @param {number} quizScore - クイズのスコア (0-3)
     */
    function showSurveyAfterQuiz(quizScore) {
        console.log('🎯 アンケート表示: Score =', quizScore);
        
        surveyState.quizScore = quizScore;
        
        // アンケート質問を取得
        fetchSurveyQuestions();
    }
    
    /**
     * アンケートモーダルを表示
     * @param {Array} questions - アンケート質問配列
     */
    function displaySurveyModal(questions) {
        console.log('🎯 displaySurveyModal 開始:', questions);
        
        try {
            surveyState.questions = questions;
            surveyState.isOpen = true;
            
            const isJapanese = appState.currentLanguage === 'ja';
            console.log('🌐 言語:', isJapanese ? '日本語' : '英語');
            
            // 質問HTMLを個別に生成してログ出力
            const questionHTMLs = [];
            for (let i = 0; i < questions.length; i++) {
                console.log(`📝 質問${i + 1}を生成中:`, questions[i]);
                try {
                    const html = generateQuestionHTML(questions[i], i);
                    questionHTMLs.push(html);
                    console.log(`✅ 質問${i + 1}のHTML生成成功`);
                } catch (e) {
                    console.error(`❌ 質問${i + 1}のHTML生成エラー:`, e);
                    throw e;
                }
            }
            
            // モーダルHTML生成（v3.2: インラインスタイル強化版＋スマホ最適化）
            const modalHTML = `
                <style>
                    @media (max-width: 768px) {
                        #survey-form { padding: 30px !important; }
                        .survey-question { padding: 25px !important; margin-bottom: 45px !important; }
                        .survey-radio-group, .survey-checkbox-group { gap: 16px !important; }
                        .survey-radio-label, .survey-checkbox-label { padding: 16px 18px !important; }
                        .survey-btn { width: 100% !important; }
                    }
                </style>
                <div id="survey-modal" class="survey-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; opacity: 0; transition: opacity 0.3s ease;">
                    <div class="survey-content" style="background: white; border-radius: 20px; width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);">
                        <div class="survey-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 20px 20px 0 0;">
                            <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">${isJapanese ? 'アンケートにご協力ください' : 'Please take our survey'}</h2>
                            <p class="survey-subtitle" style="margin: 0; font-size: 15px; opacity: 0.9;">
                                ${isJapanese ? 'あなたのフィードバックは私たちの改善に役立ちます' : 'Your feedback helps us improve'}
                            </p>
                        </div>
                        
                        <form id="survey-form" style="padding: 50px; counter-reset: question-counter;">
                            ${questionHTMLs.join('')}
                            
                            <div class="survey-actions" style="display: flex; justify-content: center; gap: 15px; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
                                <button type="submit" class="survey-btn survey-btn-submit" style="width: 60%; padding: 18px 32px; font-size: 18px; font-weight: 600; border: none; border-radius: 12px; cursor: pointer; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; transition: all 0.3s ease;">
                                    ${isJapanese ? '送信' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            console.log('📄 モーダルHTMLを生成しました');
            
            // モーダルを挿入
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            console.log('✅ モーダルをDOMに挿入しました');
            
            // フォーム送信イベント
            const form = document.getElementById('survey-form');
            if (form) {
                form.addEventListener('submit', handleSurveySubmit);
                console.log('✅ フォーム送信イベントを登録しました');
            } else {
                console.error('❌ survey-formが見つかりません');
            }
            
            // モーダル表示アニメーション
            setTimeout(() => {
                const modal = document.getElementById('survey-modal');
                if (modal) {
                    modal.classList.add('show');
                    modal.style.opacity = '1'; // 強制的に表示
                    console.log('✅ モーダルを表示しました');
                } else {
                    console.error('❌ survey-modalが見つかりません');
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ displaySurveyModal エラー:', error);
            console.error('スタックトレース:', error.stack);
        }
    }
    
    /**
     * アンケート質問のHTMLを生成
     * @param {Object} question - 質問オブジェクト
     * @param {number} index - インデックス
     * @returns {string} HTML文字列
     */
    function generateQuestionHTML(question, index) {
        const required = question.id === 'q1' || question.id === 'q2' ? 'required' : '';
        
        if (question.type === 'radio') {
            // ラジオボタン式の質問（単一選択）v3.2: インラインスタイル追加
            return `
                <div class="survey-question" style="margin-bottom: 60px; padding: 35px; background: #f8f9fa; border-radius: 15px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); position: relative; counter-increment: question-counter;">
                    <div style="display: block; font-size: 16px; font-weight: 700; color: #5566cc; margin-bottom: 15px; letter-spacing: 0.5px;">Q${index + 1}.</div>
                    <label class="survey-question-label" style="display: block; font-size: 18px; font-weight: 700; color: #4169e1; margin-bottom: 20px; line-height: 1.6;">
                        ${question.question}
                        ${required ? '<span class="required-mark" style="color: #e74c3c; margin-left: 4px; font-size: 20px;">*</span>' : ''}
                    </label>
                    <div class="survey-radio-group" style="display: flex; flex-direction: column; gap: 22px;">
                        ${question.options.map((opt, i) => `
                            <label class="survey-radio-label" style="display: flex; align-items: center; padding: 20px 22px; border: 2px solid #e0e0e0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
                                <input 
                                    type="radio" 
                                    name="${question.id}" 
                                    value="${opt.value}"
                                    class="survey-radio"
                                    style="width: 22px; height: 22px; margin-right: 14px; cursor: pointer; accent-color: #667eea;"
                                    ${required}
                                >
                                <span style="font-size: 16px; color: #333; line-height: 1.5;">${opt.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (question.type === 'rating') {
            // 評価式の質問 (1-5) v3.2: インラインスタイル追加
            return `
                <div class="survey-question" style="margin-bottom: 60px; padding: 35px; background: #f8f9fa; border-radius: 15px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); position: relative; counter-increment: question-counter;">
                    <div style="display: block; font-size: 16px; font-weight: 700; color: #5566cc; margin-bottom: 15px; letter-spacing: 0.5px;">Q${index + 1}.</div>
                    <label class="survey-question-label" style="display: block; font-size: 18px; font-weight: 700; color: #4169e1; margin-bottom: 20px; line-height: 1.6;">
                        ${question.question}
                        ${required ? '<span class="required-mark" style="color: #e74c3c; margin-left: 4px; font-size: 20px;">*</span>' : ''}
                    </label>
                    <select name="${question.id}" class="survey-select" style="width: 100%; padding: 14px 16px; font-size: 16px; border: 2px solid #e0e0e0; border-radius: 12px; background: white; cursor: pointer; transition: border-color 0.2s ease;" ${required}>
                        <option value="">選択してください / Please select</option>
                        ${question.options.map(opt => 
                            `<option value="${opt.value}">${opt.label}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else if (question.type === 'checkbox') {
            // チェックボックス式の質問（複数選択）v3.2: インラインスタイル追加
            return `
                <div class="survey-question" style="margin-bottom: 60px; padding: 35px; background: #f8f9fa; border-radius: 15px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); position: relative; counter-increment: question-counter;">
                    <div style="display: block; font-size: 16px; font-weight: 700; color: #5566cc; margin-bottom: 15px; letter-spacing: 0.5px;">Q${index + 1}.</div>
                    <label class="survey-question-label" style="display: block; font-size: 18px; font-weight: 700; color: #4169e1; margin-bottom: 20px; line-height: 1.6;">
                        ${question.question}
                        ${required ? '<span class="required-mark" style="color: #e74c3c; margin-left: 4px; font-size: 20px;">*</span>' : ''}
                    </label>
                    <div class="survey-checkbox-group" style="display: flex; flex-direction: column; gap: 22px;">
                        ${question.options.map((opt, i) => `
                            <label class="survey-checkbox-label" style="display: flex; align-items: center; padding: 20px 22px; border: 2px solid #e0e0e0; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
                                <input 
                                    type="checkbox" 
                                    name="${question.id}" 
                                    value="${opt.value}"
                                    class="survey-checkbox"
                                    style="width: 22px; height: 22px; margin-right: 14px; cursor: pointer; accent-color: #667eea;"
                                >
                                <span style="font-size: 16px; color: #333; line-height: 1.5;">${opt.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return '';
    }
    
    /**
     * アンケート送信処理
     * @param {Event} event - フォーム送信イベント
     */
    function handleSurveySubmit(event) {
        console.log('🚀 handleSurveySubmit が呼ばれました');
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        console.log('📝 FormData エントリー数:', Array.from(formData.entries()).length);
        
        // 回答データを整理（チェックボックス対応）
        const answers = {};
        
        // チェックボックスの値を配列として収集
        const checkboxValues = {};
        for (let [key, value] of formData.entries()) {
            console.log(`  - ${key}: ${value}`);
            if (form.querySelector(`input[name="${key}"][type="checkbox"]`)) {
                if (!checkboxValues[key]) {
                    checkboxValues[key] = [];
                }
                checkboxValues[key].push(value);
            } else {
                answers[key] = value;
            }
        }
        
        // チェックボックスの値をカンマ区切りの文字列に変換
        for (let key in checkboxValues) {
            answers[key] = checkboxValues[key].join(',');
        }
        
        console.log('📤 アンケート送信データ:', answers);
        console.log('🎯 クイズスコア:', surveyState.quizScore);
        
        // サーバーに送信
        if (socket && socket.connected) {
            console.log('✅ Socket接続OK - データ送信中...');
            socket.emit('submit_survey', {
                ...answers,
                quiz_score: surveyState.quizScore
            });
            
            // 送信中表示
            const submitBtn = form.querySelector('.survey-btn-submit');
            if (submitBtn) {
                submitBtn.textContent = appState.currentLanguage === 'ja' ? '送信中...' : 'Submitting...';
                submitBtn.disabled = true;
            }
        } else {
            console.error('❌ Socket接続なし:', {
                socket: !!socket,
                connected: socket ? socket.connected : false
            });
        }
    }
    
    /**
     * アンケートモーダルを閉じる
     */
    function closeSurvey() {
        const modal = document.getElementById('survey-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.opacity = '0'; // フェードアウト
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
        
        surveyState.isOpen = false;
    }
    
    /**
     * 報酬画像をチャット内にメッセージとして表示（v3.3: メッセージバブル内に統合）
     * @param {string} imageUrl - 画像URL
     */
    function showRewardInChat(imageUrl) {
        const isJapanese = appState.currentLanguage === 'ja';
        
        console.log('🎁 報酬画像をメッセージとして表示:', imageUrl);
        
        // 報酬メッセージのテキスト
        const rewardMessage = isJapanese ? '🎁 特別なプレゼントです！' : '🎁 Here\'s your special reward!';
        
        // 報酬用のメディアオブジェクトを作成
        const rewardMedia = {
            type: 'reward',
            imageUrl: imageUrl,
            downloadUrl: imageUrl,
            downloadText: isJapanese ? '📥 ダウンロード' : '📥 Download'
        };
        
        // 通常のメッセージとして表示（メディア付き）
        const messageWrapper = addMessage(rewardMessage, false, {
            media: rewardMedia,
            skipSound: true
        });
        
        // スクロール
        setTimeout(() => {
            if (domElements.chatMessages) {
                domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
            }
        }, 100);
        
        console.log('✅ 報酬をメッセージとして追加しました');
    }
    
    // closeSurvey をグローバルに公開
    window.closeSurvey = closeSurvey;
    
    // ====== 初期化実行 ======
    document.addEventListener('DOMContentLoaded', initialize);
    
    if (window.location.search.includes('debug=1')) {
        appState.debugMode = true;
        console.log('デバッグモードが有効化されました');
    }
    
    console.log('🎬 Chat.js Unity統合完全修正版 読み込み完了');
})();