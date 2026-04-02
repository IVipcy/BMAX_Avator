using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.Runtime.InteropServices;
using System;
using System.Text.RegularExpressions;

/// <summary>
/// WebGLとUnity間の通信を管理するブリッジクラス（完全修正版）
/// JavaScriptからのメッセージ受信とUnityからのメッセージ送信を処理
/// Live2DModelLoaderとの競合問題を解決
/// 🔧 ResponseReady削除版 + 初期化タイミング改善版 + 修正ガイド適用版 + Talking状態解析改善版
/// </summary>
public class WebGLBridge : MonoBehaviour
{
    [Header("=== 基本設定 ===")]
    [SerializeField] private float initTimeout = 15f;
    [SerializeField] private GameObject fallbackAvatarPrefab;
    [SerializeField] private bool enableFallback = false;
    
    [Header("=== デバッグ設定 ===")]
    [SerializeField] private bool enableDebugLogs = true;
    [SerializeField] private bool useAdvancedMessageProcessing = true;
    
    [Header("=== キュー設定 ===")]
    [SerializeField] private int maxMessageQueueSize = 100;
    
    [Header("=== コンポーネント参照 ===")]
    private Live2DEmotionController emotionController;
    public Live2DEmotionController manualEmotionController;
    private AudioSource audioSource;
    
    // インスタンス管理
    private static WebGLBridge instance;
    
    // 通信状態管理
    private bool isInitialized = false;
    private float initStartTime;
    private bool hasReceivedFirstMessage = false;
    
    // メッセージ処理用のキュー
    private Queue<string> messageQueue = new Queue<string>();
    private bool isProcessingMessage = false;
    
    // 感情状態管理
    private string currentEmotion = "neutral";
    private bool isTalking = false;
    private float lastEmotionChangeTime = 0f;
    
    // 統計情報
    private int messageCount = 0;
    private int errorCount = 0;
    private int droppedMessageCount = 0;
    private Dictionary<string, int> emotionCounters = new Dictionary<string, int>();
    
    // ========== JavaScript連携用のDllImport定義 ==========
    #if UNITY_WEBGL && !UNITY_EDITOR
    
    [DllImport("__Internal")]
    private static extern void SendMessageToJS(string message);
    
    [DllImport("__Internal")]
    private static extern void NotifyUnityReady();
    
    [DllImport("__Internal")]
    private static extern void RegisterUnityInstance();
    
    [DllImport("__Internal")]
    private static extern void WebGLDebugLog(string message);
    
    [DllImport("__Internal")]
    private static extern void ErrorLog(string message);
    
    [DllImport("__Internal")]
    private static extern void WarningLog(string message);
    
    // 🎯 新規追加：JavaScript関数を直接呼び出すための汎用メソッド
    [DllImport("__Internal")]
    private static extern void CallJavaScriptFunction(string functionName, string param);
    
    // 🎯 新規追加：感情変更をJavaScript側に通知
    [DllImport("__Internal")]
    private static extern void NotifyEmotionChange(string emotion, string isTalking);
    
    #else
    // エディタ用のダミー実装
    private static void SendMessageToJS(string message) 
    {
        Debug.Log($"[WebGL Bridge] Would send to JS: {message}");
    }
    
    private static void NotifyUnityReady() 
    {
        Debug.Log("[WebGL Bridge] Unity Ready (Editor)");
    }
    
    private static void RegisterUnityInstance() 
    {
        Debug.Log("[WebGL Bridge] Register Unity Instance (Editor)");
    }
    
    private static void WebGLDebugLog(string message) 
    {
        Debug.Log($"[WebGL Debug] {message}");
    }
    
    private static void ErrorLog(string message) 
    {
        Debug.LogError($"[WebGL Error] {message}");
    }
    
    private static void WarningLog(string message) 
    {
        Debug.LogWarning($"[WebGL Warning] {message}");
    }
    
    private static void CallJavaScriptFunction(string functionName, string param)
    {
        Debug.Log($"[Editor Mode] JavaScript function call: {functionName}({param})");
    }
    
    private static void NotifyEmotionChange(string emotion, string isTalking)
    {
        Debug.Log($"[Editor Mode] Emotion change: {emotion}, Talking: {isTalking}");
    }
    #endif
    
    void Awake()
    {
        // === 強制ログ表示（Debug.LogError使用で確実に表示） ===
        Debug.LogError("=== WebGLBridge Awake() CALLED ===");
        Debug.LogError($"GameObject名: {gameObject.name}, Active: {gameObject.activeInHierarchy}, Enabled: {enabled}");
        
        // シングルトンパターン（修正版：このコンポーネントのみ削除）
        if (instance != null && instance != this)
        {
            Debug.LogWarning("WebGLBridge: Duplicate instance detected, destroying this component");
            Destroy(this);  // gameObjectではなくコンポーネントのみ削除
            return;
        }
        instance = this;
        
        // 初期化
        initStartTime = Time.time;
        InitializeEmotionCounters();
        
        Debug.LogError("WebGLBridge: Awake completed successfully");
        print("WebGLBridge: Awake completed (using print)");
    }
    
    void Start()
    {
        // === 強制ログ表示 ===
        Debug.LogError("=== WebGLBridge Start() CALLED ===");
        Debug.LogError($"Time: {Time.time}, GameObject: {gameObject.name}");
        print("WebGLBridge Start() called (using print)");
        
        try
        {
            StartCoroutine(InitializationRoutineWrapper());
            Debug.LogError("Initialization routine started successfully");
            print("Initialization routine started");
        }
        catch (System.Exception e)
        {
            Debug.LogError($"Failed to start initialization routine: {e.Message}");
        }
        
        #if UNITY_WEBGL && !UNITY_EDITOR
        InitializeWebGLCommunication();
        Debug.LogError("WebGL communication initialized");
        #endif
        
        Debug.LogError("=== WebGLBridge Start() completed ===");
        print("WebGLBridge Start() completed");
    }
    
    /// <summary>
    /// 初期化ルーチン（完全修正版）
    /// Live2DModelLoaderとの競合問題を解決
    /// CS1626とCS1623エラーを修正：try-catch内でのyield使用とoutパラメータを回避
    /// </summary>
    IEnumerator InitializationRoutineWrapper()
    {
        Debug.LogError("=== WebGLBridge Initialization Starting ===");
        print("WebGLBridge Initialization Starting");
        
        // Live2DModelLoaderの完了を待つ
        Debug.LogError("Waiting for Live2DModelLoader...");
        yield return StartCoroutine(WaitForLive2DModelLoader());
        Debug.LogError("Live2DModelLoader check completed");
        
        // EmotionController検索
        Debug.LogError("Searching for EmotionController...");
        yield return StartCoroutine(FindEmotionControllerWithRetry());
        Debug.LogError("EmotionController search completed");
        
        // AudioSource初期化
        Debug.LogError("Initializing AudioSource...");
        SafeInitializeAudioSource();
        Debug.LogError("AudioSource initialization completed");
        
        // 結果確認と最終設定
        if (emotionController != null)
        {
            isInitialized = true;
            Debug.LogError($"✅ WebGLBridge Initialization SUCCESSFUL! EmotionController found: {emotionController.gameObject.name}");
            print($"SUCCESS: EmotionController found: {emotionController.gameObject.name}");
            NotifyInitializationComplete();
        }
        else
        {
            Debug.LogWarning("⚠️ WebGLBridge Initialization completed but EmotionController not found - Running in fallback mode");
            print("WARNING: EmotionController not found");
        }
        
        Debug.LogError("=== WebGLBridge Initialization Completed ===");
        print("WebGLBridge Initialization Completed");
    }
    
    /// <summary>
    /// AudioSource初期化（安全版）
    /// </summary>
    private void SafeInitializeAudioSource()
    {
        try
        {
            InitializeAudioSource();
        }
        catch (System.Exception e)
        {
            Debug.LogError($"AudioSource initialization failed: {e.Message}");
        }
    }
    
    /// <summary>
    /// 新規追加：Live2DModelLoaderの完了を待つ
    /// </summary>
    IEnumerator WaitForLive2DModelLoader()
    {
        Live2DModelLoader loader = FindObjectOfType<Live2DModelLoader>();
        if (loader != null)
        {
            Debug.Log("📱 Live2DModelLoader detected, waiting for model to load...");
            
            float timeout = 15f;
            float elapsed = 0f;
            
            while (!loader.IsModelLoaded() && elapsed < timeout)
            {
                yield return new WaitForSeconds(0.2f);
                elapsed += 0.2f;
            }
            
            if (loader.IsModelLoaded())
            {
                Debug.Log("✅ Live2DModelLoader completed successfully");
                yield return new WaitForSeconds(1f); // 追加待機
            }
            else
            {
                Debug.LogWarning("⚠️ Live2DModelLoader timeout - proceeding anyway");
            }
        }
        else
        {
            Debug.Log("📱 No Live2DModelLoader found - using standard initialization");
            // Live2DModelLoaderがない場合は通常の待機
            yield return new WaitForSeconds(3f);
        }
    }
    
    /// <summary>
    /// 新規追加：リトライ機能付きEmotionController検索
    /// </summary>
    IEnumerator FindEmotionControllerWithRetry()
    {
        Debug.LogError("🔍 Searching for EmotionController...");
        print("Searching for EmotionController...");
        
        int maxAttempts = 10;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            Debug.LogError($"Search attempt {attempt}/{maxAttempts}");
            
            // Method 1: Manual設定の確認（最優先）
            if (manualEmotionController != null)
            {
                if (manualEmotionController.gameObject != null && manualEmotionController.gameObject.activeInHierarchy)
                {
                    var controller = manualEmotionController.GetComponent<Live2DEmotionController>();
                    if (controller != null && controller.IsInitialized())
                    {
                        emotionController = controller;
                        Debug.LogError($"✅ Manual EmotionController found: {controller.gameObject.name} (attempt {attempt})");
                        print($"Manual EmotionController found: {controller.gameObject.name}");
                        yield break;
                    }
                }
            }
            
            // Method 2: シーン内検索
            Live2DEmotionController[] controllers = FindObjectsOfType<Live2DEmotionController>();
            Debug.LogError($"Found {controllers.Length} EmotionController(s) in scene");
            
            foreach (var controller in controllers)
            {
                if (controller != null && controller.gameObject.activeInHierarchy && controller.IsInitialized())
                {
                    emotionController = controller;
                    Debug.LogError($"✅ EmotionController found: {controller.gameObject.name} (attempt {attempt})");
                    print($"EmotionController found: {controller.gameObject.name}");
                    yield break;
                }
            }
            
            // Method 3: "mori"オブジェクト内検索
            GameObject reiObject = GameObject.Find("mori");
            if (reiObject != null)
            {
                Live2DEmotionController controller = reiObject.GetComponentInChildren<Live2DEmotionController>();
                if (controller != null && controller.IsInitialized())
                {
                    emotionController = controller;
                    Debug.LogError($"✅ EmotionController found in 'rei': {controller.gameObject.name} (attempt {attempt})");
                    print($"EmotionController found in rei: {controller.gameObject.name}");
                    yield break;
                }
            }
            
            // Method 4: その他の可能な名前での検索
            string[] possibleNames = { "mori(Clone)", "Live2DModel", "MORI", "Live2DContainer" };
            foreach (string name in possibleNames)
            {
                GameObject obj = GameObject.Find(name);
                if (obj != null)
                {
                    Live2DEmotionController controller = obj.GetComponentInChildren<Live2DEmotionController>();
                    if (controller != null && controller.IsInitialized())
                    {
                        emotionController = controller;
                        Debug.LogError($"✅ EmotionController found in '{name}': {controller.gameObject.name} (attempt {attempt})");
                        print($"EmotionController found in {name}: {controller.gameObject.name}");
                        yield break;
                    }
                }
            }
            
            // 短い待機後に再試行
            yield return new WaitForSeconds(1f);
        }
        
        Debug.LogError("⚠️ EmotionController not found after all attempts");
        print("WARNING: EmotionController not found after all attempts");
    }
    
    /// <summary>
    /// EmotionController検索（同期版 - 修正版）
    /// </summary>
    public void FindEmotionController()
    {
        Debug.Log("WebGLBridge: EmotionController検索（同期版）");
        
        // Manual設定の確認
        if (manualEmotionController != null)
        {
            emotionController = manualEmotionController.GetComponent<Live2DEmotionController>();
            if (emotionController != null && emotionController.IsInitialized())
            {
                Debug.Log("WebGLBridge: Manual EmotionController確認済み");
                return;
            }
        }
        
        // シーン内のEmotionControllerを検索
        Live2DEmotionController[] controllers = FindObjectsOfType<Live2DEmotionController>();
        Debug.Log($"WebGLBridge: 検出されたEmotionController数: {controllers.Length}");
        
        foreach (var controller in controllers)
        {
            if (controller.gameObject.activeInHierarchy && controller.IsInitialized())
            {
                emotionController = controller;
                Debug.Log($"WebGLBridge: EmotionController発見: {controller.gameObject.name}");
                return;
            }
        }
        
        // "mori"オブジェクト内を検索
        GameObject reiObject = GameObject.Find("mori");
        if (reiObject != null)
        {
            Live2DEmotionController controller = reiObject.GetComponentInChildren<Live2DEmotionController>();
            if (controller != null && controller.IsInitialized())
            {
                emotionController = controller;
                Debug.Log("WebGLBridge: rei内でEmotionController発見");
                return;
            }
        }
        
        if (emotionController == null)
        {
            Debug.LogError("WebGLBridge: EmotionController検索失敗");
            LogDebugInfo();
        }
    }
    
    void InitializeEmotionCounters()
    {
        emotionCounters.Clear();
        // 🔧 修正: responseready を削除
        string[] emotions = { "neutral", "happy", "sad", "angry", "surprise", "surprised", 
                            "dangerquestion", "start", "neutraltalking" };
        foreach (string emotion in emotions)
        {
            emotionCounters[emotion] = 0;
        }
    }
    
    void InitializeAudioSource()
    {
        if (audioSource == null)
        {
            audioSource = GetComponent<AudioSource>();
        }
        if (audioSource == null)
        {
            audioSource = gameObject.AddComponent<AudioSource>();
        }
        Debug.Log("WebGLBridge: AudioSource初期化完了");
    }
    
    void InitializeWebGLCommunication()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        Debug.Log("WebGLBridge: Initializing WebGL communication");
        RegisterUnityInstance();
        SendMessageToJS("unity-initializing");
        SendInitializationProgress("unity-initializing", "{}");
        #endif
    }
    
    /// <summary>
    /// 🎯 修正版：初期化完了通知の強化
    /// </summary>
    void NotifyInitializationComplete()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        NotifyUnityReady();
        SendMessageToJS("unity-ready");
        SendMessageToJS("unity-fully-initialized");
        SendInitializationProgress("unity-fully-initialized", "{}");
        
        // 🎯 新規追加：グローバル関数の呼び出し
        try
        {
            CallJavaScriptFunction("window.unityReady", "");
            Debug.Log("📞 window.unityReady()を呼び出しました");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"⚠️ window.unityReady()呼び出しエラー: {e.Message}");
        }
        #endif
        
        Debug.Log("✅ WebGLBridge: Unity初期化完了 - JavaScript通信準備完了");
    }
    
    void ShowFallbackAvatar()
    {
        if (enableFallback && fallbackAvatarPrefab != null)
        {
            GameObject fallback = Instantiate(fallbackAvatarPrefab, transform);
            fallback.name = "FallbackAvatar";
            Debug.LogWarning("WebGLBridge: Using fallback avatar");
        }
    }
    
    // ========== 新規追加：初期化通知メソッド ==========
    
    /// <summary>
    /// 🎯 修正版：Startモーション完了を通知（改善版）
    /// </summary>
    public void SendStartMotionCompleted()
    {
        try
        {
            // より詳細な情報を含む通知
            string json = "{\"type\":\"start-motion-completed\",\"timestamp\":" + 
                         ((long)(Time.time * 1000)).ToString() + "}";
            
            SendMessageToJS("start-motion-completed", json);
            
            // 🎯 新規追加：グローバル関数も呼び出し
            #if UNITY_WEBGL && !UNITY_EDITOR
            CallJavaScriptFunction("window.onStartMotionCompleted", "");
            #endif
            
            if (enableDebugLogs)
            {
                Debug.Log("✅ WebGLBridge: Startモーション完了通知を送信しました");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ Startモーション完了通知エラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// モーション変更を通知
    /// </summary>
    public void SendMotionChanged(string motionName)
    {
        string json = $"{{\"type\":\"motion-changed\",\"motion\":\"{motionName}\"}}";
        SendMessageToJS("motion-changed", json);
        
        if (enableDebugLogs)
        {
            Debug.Log($"WebGLBridge: Sent motion-changed notification: {motionName}");
        }
    }
    
    /// <summary>
    /// 初期化進行状況を通知（新規追加）
    /// </summary>
    void SendInitializationProgress(string status, string data)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            string message = $"{{\"type\":\"{status}\",\"data\":{data}}}";
            SendMessageToJS(message);
            
            if (enableDebugLogs)
            {
                Debug.Log($"WebGLBridge: Sent initialization progress: {status}");
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"WebGLBridge: Failed to send initialization progress: {e.Message}");
        }
        #endif
    }
    
    /// <summary>
    /// 改善版：メッセージ送信（typeとdataを分離）
    /// </summary>
    void SendMessageToJS(string type, string data)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            string message = $"{{\"type\":\"{type}\",\"data\":{data}}}";
            SendMessageToJS(message);
            
            if (enableDebugLogs)
            {
                Debug.Log($"WebGLBridge: Sent to JS - Type: {type}, Data: {data}");
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"WebGLBridge: Failed to send message to JS: {e.Message}");
            ErrorLog($"Failed to send message: {e.Message}");
        }
        #else
        if (enableDebugLogs)
        {
            Debug.Log($"WebGLBridge: [Editor Mode] Would send to JS - Type: {type}, Data: {data}");
        }
        #endif
    }
    
    // ========== JavaScriptからのメッセージ受信 ==========
    
    public void OnMessage(string message)
    {
        if (string.IsNullOrEmpty(message))
        {
            Debug.LogWarning("WebGLBridge: Received empty message");
            return;
        }
        
        messageCount++;
        
        if (enableDebugLogs)
        {
            Debug.Log($"WebGLBridge: Received message #{messageCount}: {message}");
        }
        
        if (!hasReceivedFirstMessage)
        {
            hasReceivedFirstMessage = true;
            Debug.Log("WebGLBridge: First message received from JavaScript");
        }
        
        if (messageQueue.Count >= maxMessageQueueSize)
        {
            string droppedMessage = messageQueue.Dequeue();
            droppedMessageCount++;
            
            if (enableDebugLogs)
            {
                Debug.LogWarning($"WebGLBridge: Message queue full. Dropped: {droppedMessage}");
            }
        }
        
        messageQueue.Enqueue(message);
        
        if (!isProcessingMessage)
        {
            StartCoroutine(ProcessMessageQueue());
        }
    }
    
    IEnumerator ProcessMessageQueue()
    {
        isProcessingMessage = true;
        
        while (messageQueue.Count > 0)
        {
            string message = messageQueue.Dequeue();
            
            try
            {
                ProcessMessage(message);
            }
            catch (Exception e)
            {
                errorCount++;
                Debug.LogError($"WebGLBridge: Error processing message: {e.Message}");
                #if UNITY_WEBGL && !UNITY_EDITOR
                ErrorLog($"Message processing error: {e.Message}");
                #endif
            }
            
            yield return null;
        }
        
        isProcessingMessage = false;
    }
    
    /// <summary>
    /// 🎯 修正版：感情とTalking状態通知の改善
    /// </summary>
    void ProcessMessage(string message)
    {
        if (useAdvancedMessageProcessing)
        {
            ProcessMessageAdvanced(message);
        }
        else
        {
            ProcessMessageSimple(message);
        }
        
        // 🎯 新規追加：処理後にJavaScript側に状態を通知
        if (emotionController != null && enableDebugLogs)
        {
            // Live2DEmotionControllerの実際のメソッドを使用
            string emotion = emotionController.GetCurrentEmotion();
            bool talking = emotionController.IsTalking();
            string currentStatus = $"{{\"emotion\":\"{emotion}\",\"isTalking\":{talking.ToString().ToLower()}}}";
            Debug.Log($"📊 現在の状態: {currentStatus}");
        }
    }
    
    void ProcessMessageSimple(string message)
    {
        string emotionToSet = ExtractEmotionFromMessage(message);
        bool talking = message.Contains("talking") || message.Contains("true");
        
        if (!string.IsNullOrEmpty(emotionToSet))
        {
            SetEmotion(emotionToSet, talking);
        }
    }
    
    void ProcessMessageAdvanced(string message)
    {
        try
        {
            if (message.Contains("{") && message.Contains("}"))
            {
                ProcessJsonMessage(message);
            }
            else if (message.Contains("conversation") || message.Contains("status"))
            {
                // 🎯 新規追加：会話制御メッセージの処理
                ProcessConversationControlMessage(message);
            }
            else
            {
                ProcessEmotionMessageSimple(message);
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"WebGLBridge: Fallback to simple processing: {e.Message}");
            ProcessEmotionMessageSimple(message);
        }
    }
    
    void ProcessJsonMessage(string message)
    {
        string emotion = ExtractEmotionFromJson(message);
        string state = ExtractStateFromJson(message);  // 元のコードを保持
        
        // 修正箇所：ExtractTalkingFromJsonを使用してより正確に判定
        bool talking = ExtractTalkingFromJson(message);  
        // 元のコード（問題あり）: bool talking = state.ToLower().Contains("talking");
        
        if (!string.IsNullOrEmpty(emotion))
        {
            SetEmotion(emotion, talking);
            UpdateEmotionCounter(emotion);
            
            currentEmotion = emotion;
            isTalking = talking;
        }
    }
    
    void ProcessEmotionMessageSimple(string message)
    {
        string emotion = ExtractEmotionStateSimple(message);
        bool isTalking = message.ToLower().Contains("talking");
        
        if (!string.IsNullOrEmpty(emotion))
        {
            string validatedEmotion = ValidateEmotion(emotion);
            
            // neutral + talking の場合は neutraltalking に自動変換
            if (validatedEmotion == "neutral" && isTalking)
            {
                validatedEmotion = "neutraltalking";
                Debug.Log("WebGLBridge: Auto-converting neutral+talking to neutraltalking");
            }
            
            ProcessEmotionMessageSafe(validatedEmotion, isTalking);
        }
    }
    
    void ProcessEmotionMessageSafe(string emotion, bool isTalking)
    {
        if (emotionController == null)
        {
            Debug.LogError("WebGLBridge: EmotionController is null, cannot process emotion");
            #if UNITY_WEBGL && !UNITY_EDITOR
            ErrorLog("EmotionController not found");
            #endif
            
            // EmotionController再検索
            StartCoroutine(FindEmotionControllerWithRetry());
            return;
        }
        
        emotion = ValidateEmotion(emotion);
        
        if (emotion == "neutral" && isTalking)
        {
            emotion = "neutraltalking";
            Debug.Log("WebGLBridge: Auto-converting neutral+talking to neutraltalking");
        }
        
        if (emotionCounters.ContainsKey(emotion))
        {
            emotionCounters[emotion]++;
        }
        else
        {
            emotionCounters[emotion] = 1;
        }
        
        currentEmotion = emotion;
        this.isTalking = isTalking;
        lastEmotionChangeTime = Time.time;
        
        emotionController.SetEmotion(emotion, isTalking);
        
        // モーション変更通知を送信
        SendMotionChanged(emotion);
        
        if (enableDebugLogs)
        {
            string logMessage = $"WebGLBridge: Emotion set to '{emotion}', talking: {isTalking}";
            Debug.Log(logMessage);
            
            #if UNITY_WEBGL && !UNITY_EDITOR
            WebGLDebugLog(logMessage);
            #endif
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：会話制御メッセージの処理
    /// </summary>
    private void ProcessConversationControlMessage(string message)
    {
        try
        {
            if (message.Contains("start_conversation"))
            {
                string emotion = ExtractValueFromMessage(message, "emotion");
                if (string.IsNullOrEmpty(emotion)) emotion = "neutral";
                
                NotifyConversationStarted(emotion);
                
                // EmotionControllerに会話開始を通知（実装に合わせて修正）
                if (emotionController != null)
                {
                    // 会話開始時は感情をtalkingモードで設定
                    emotionController.SetEmotion(emotion, true);
                    if (enableDebugLogs)
                    {
                        Debug.Log($"EmotionController: 会話開始 - {emotion}(talking)");
                    }
                }
            }
            else if (message.Contains("end_conversation"))
            {
                NotifyConversationEnded();
            }
            else if (message.Contains("request_status"))
            {
                SendSystemStatus();
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ 会話制御メッセージ処理エラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：メッセージから値を抽出するヘルパーメソッド
    /// </summary>
    private string ExtractValueFromMessage(string message, string key)
    {
        try
        {
            string pattern = $"\"{key}\"\\s*:\\s*\"([^\"]+)\"";
            var match = System.Text.RegularExpressions.Regex.Match(message, pattern);
            return match.Success ? match.Groups[1].Value : "";
        }
        catch
        {
            return "";
        }
    }
    
    void UpdateEmotionCounter(string emotion)
    {
        if (emotionCounters.ContainsKey(emotion))
        {
            emotionCounters[emotion]++;
        }
        else
        {
            emotionCounters[emotion] = 1;
        }
    }
    
    // UpdateEmotionStats エイリアス（修正ガイドとの互換性のため）
    void UpdateEmotionStats(string emotion)
    {
        UpdateEmotionCounter(emotion);
    }
    
    string ValidateEmotion(string emotion)
    {
        if (string.IsNullOrEmpty(emotion))
        {
            return "neutral";
        }
        
        emotion = emotion.ToLower().Trim();
        
        // 🔧 修正: responseready を削除した有効な感情リスト
        string[] validEmotions = { 
            "neutral", "happy", "sad", "angry", "surprise", "surprised", 
            "dangerquestion", "start", "neutraltalking" 
        };
        
        if (System.Array.IndexOf(validEmotions, emotion) >= 0)
        {
            return emotion;
        }
        
        // 類似する感情へのマッピング
        if (emotion.Contains("joy") || emotion.Contains("excited"))
            return "happy";
        if (emotion.Contains("fear") || emotion.Contains("worried"))
            return "sad";
        if (emotion.Contains("mad") || emotion.Contains("annoyed"))
            return "angry";
        if (emotion.Contains("shock") || emotion.Contains("amazed"))
            return "surprise";
        
        Debug.LogWarning($"WebGLBridge: Unknown emotion '{emotion}', defaulting to neutral");
        return "neutral";
    }
    
    // ========== メッセージパース関連 ==========
    
    string ExtractEmotionFromMessage(string message)
    {
        string[] patterns = {
            @"emotion[\""\s]*:\s*[\""]([^\""\s]+)[\""]",
            @"[\""]emotion[\""]:\s*[\""]([^\""\s]+)[\""]",
            @"emotion=([^,\s&]+)",
            @"SetEmotion\([\""]([^\""\s]+)[\""]"
        };
        
        foreach (string pattern in patterns)
        {
            Match match = Regex.Match(message, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value.ToLower();
            }
        }
        
        return ExtractEmotionStateSimple(message);
    }
    
    string ExtractEmotionFromJson(string message)
    {
        try
        {
            Match match = Regex.Match(message, @"""emotion"":\s*""([^""]+)""", RegexOptions.IgnoreCase);
            return match.Success ? match.Groups[1].Value : "";
        }
        catch (Exception e)
        {
            Debug.LogWarning($"WebGLBridge: JSON extraction error: {e.Message}");
            return "";
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：JSONメッセージからtalking状態を正確に抽出する関数
    /// </summary>
    bool ExtractTalkingFromJson(string message)
    {
        try
        {
            // booleanとして送信された場合: "talking":true または "talking":false
            if (message.Contains("\"talking\":true"))
                return true;
            if (message.Contains("\"talking\":false"))
                return false;
                
            // 文字列として送信された場合: "talking":"true"
            Match match = Regex.Match(message, @"""talking""\s*:\s*""?(true|false)""?", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value.ToLower() == "true";
            }
            
            // 古い形式のサポート（後方互換性）
            if (message.Contains("\"isTalking\":true") || message.Contains("\"is_talking\":true"))
                return true;
            if (message.Contains("\"isTalking\":false") || message.Contains("\"is_talking\":false"))
                return false;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"Talking状態の解析エラー: {e.Message}");
        }
        
        return false;
    }
    
    string ExtractStateFromJson(string message)
    {
        try
        {
            Match match = Regex.Match(message, @"""state"":\s*""([^""]+)""", RegexOptions.IgnoreCase);
            return match.Success ? match.Groups[1].Value : "";
        }
        catch (Exception e)
        {
            Debug.LogWarning($"WebGLBridge: JSON extraction error: {e.Message}");
            return "";
        }
    }
    
    string ExtractEmotionStateSimple(string message)
    {
        // 🔧 修正: responseready を削除
        string[] emotions = { "happy", "sad", "angry", "surprise", "surprised", "dangerquestion", 
                            "start", "neutraltalking" };
        
        foreach (string emotion in emotions)
        {
            if (message.ToLower().Contains(emotion))
            {
                return emotion;
            }
        }
        
        return "neutral";
    }
    
    // ========== JavaScriptへのメッセージ送信 ==========
    
    void SendMessageToJavaScript(string message)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            SendMessageToJS(message);
            if (enableDebugLogs)
            {
                Debug.Log($"WebGLBridge: Sent to JS: {message}");
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"WebGLBridge: Failed to send message to JS: {e.Message}");
            ErrorLog($"Failed to send message: {e.Message}");
        }
        #else
        if (enableDebugLogs)
        {
            Debug.Log($"WebGLBridge: [Editor Mode] Would send to JS: {message}");
        }
        #endif
    }
    
    // ========== パブリックAPI ==========
    
    /// <summary>
    /// 🎯 修正版：SetEmotionメソッドの拡張
    /// </summary>
    public void SetEmotion(string emotion, bool talking = false)
    {
        if (emotionController != null)
        {
            string previousEmotion = currentEmotion;
            bool previousTalking = isTalking;
            
            currentEmotion = emotion;
            isTalking = talking;
            
            emotionController.SetEmotion(emotion, talking);
            
            // 統計更新
            UpdateEmotionStats(emotion);
            
            // モーション変更通知
            SendMotionChanged(emotion);
            
            // 🎯 新規追加：JavaScript側に変更を通知
            #if UNITY_WEBGL && !UNITY_EDITOR
            try
            {
                NotifyEmotionChange(emotion, talking.ToString().ToLower());
                
                // 状態変更をJSON形式でも送信
                string stateJson = $"{{\"emotion\":\"{emotion}\",\"talking\":{talking.ToString().ToLower()},\"previous\":{{\"emotion\":\"{previousEmotion}\",\"talking\":{previousTalking.ToString().ToLower()}}}}}";
                SendMessageToJS("emotion-state-changed", stateJson);
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"⚠️ JavaScript通知エラー: {e.Message}");
            }
            #endif
            
            if (enableDebugLogs)
            {
                Debug.Log($"✅ WebGLBridge: 感情を{emotion}に設定, 発話: {talking}");
                if (previousEmotion != emotion || previousTalking != talking)
                {
                    Debug.Log($"📈 状態変更: {previousEmotion}({previousTalking}) → {emotion}({talking})");
                }
            }
        }
        else
        {
            Debug.LogWarning("❌ WebGLBridge: EmotionControllerが見つかりません");
            // 再検索を試行
            StartCoroutine(FindEmotionControllerWithRetry());
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：会話開始を通知
    /// </summary>
    public void NotifyConversationStarted(string emotion)
    {
        try
        {
            string json = $"{{\"type\":\"conversation-started\",\"emotion\":\"{emotion}\",\"timestamp\":{(long)(Time.time * 1000)}}}";
            SendMessageToJS("conversation-started", json);
            
            #if UNITY_WEBGL && !UNITY_EDITOR
            CallJavaScriptFunction("window.onConversationStarted", emotion);
            #endif
            
            if (enableDebugLogs)
            {
                Debug.Log($"💬 会話開始通知を送信: {emotion}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ 会話開始通知エラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：会話終了を通知
    /// </summary>
    public void NotifyConversationEnded()
    {
        try
        {
            string json = $"{{\"type\":\"conversation-ended\",\"timestamp\":{(long)(Time.time * 1000)}}}";
            SendMessageToJS("conversation-ended", json);
            
            #if UNITY_WEBGL && !UNITY_EDITOR
            CallJavaScriptFunction("window.onConversationEnded", "");
            #endif
            
            // EmotionControllerにも通知（実装に合わせて修正）
            if (emotionController != null)
            {
                // 会話終了時はneutralの非talkingモードに戻す
                emotionController.SetEmotion("neutral", false);
                if (enableDebugLogs)
                {
                    Debug.Log("EmotionController: 会話終了 - neutral(非talking)");
                }
            }
            
            if (enableDebugLogs)
            {
                Debug.Log("💬 会話終了通知を送信");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ 会話終了通知エラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// 🎯 新規追加：システム状態をJavaScriptに送信
    /// </summary>
    public void SendSystemStatus()
    {
        try
        {
            // EmotionControllerから実際の状態を取得
            string emotionFromController = currentEmotion;
            bool talkingFromController = isTalking;
            
            if (emotionController != null)
            {
                emotionFromController = emotionController.GetCurrentEmotion();
                talkingFromController = emotionController.IsTalking();
            }
            
            string status = $"{{" +
                $"\"initialized\":{isInitialized.ToString().ToLower()}," +
                $"\"emotionController\":{(emotionController != null).ToString().ToLower()}," +
                $"\"currentEmotion\":\"{emotionFromController}\"," +
                $"\"isTalking\":{talkingFromController.ToString().ToLower()}," +
                $"\"messageCount\":{messageCount}," +
                $"\"errorCount\":{errorCount}" +
                $"}}";
                
            SendMessageToJS("system-status", status);
            
            if (enableDebugLogs)
            {
                Debug.Log($"📊 システム状態を送信: {status}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"❌ システム状態送信エラー: {e.Message}");
        }
    }
    
    public void TestEmotion(string emotion)
    {
        Debug.Log($"WebGLBridge: Testing emotion '{emotion}'");
        SetEmotion(emotion, false);
    }
    
    public string GetCurrentEmotion()
    {
        return currentEmotion;
    }
    
    public bool IsTalking()
    {
        return isTalking;
    }
    
    public bool IsInitialized()
    {
        return isInitialized;
    }
    
    public static WebGLBridge GetInstance()
    {
        return instance;
    }
    
    public Dictionary<string, int> GetEmotionStatistics()
    {
        return new Dictionary<string, int>(emotionCounters);
    }
    
    public void ResetStatistics()
    {
        messageCount = 0;
        errorCount = 0;
        droppedMessageCount = 0;
        InitializeEmotionCounters();
        Debug.Log("WebGLBridge: Statistics reset");
    }
    
    public int GetMessageCount() { return messageCount; }
    public int GetErrorCount() { return errorCount; }
    public int GetDroppedMessageCount() { return droppedMessageCount; }
    public bool HasReceivedFirstMessage() { return hasReceivedFirstMessage; }
    public float GetLastEmotionChangeTime() { return lastEmotionChangeTime; }
    
    /// <summary>
    /// 詳細デバッグ情報出力
    /// </summary>
    private void LogDebugInfo()
    {
        Debug.LogError("=== WebGLBridge デバッグ情報 ===");
        Debug.LogError($"Manual Emotion Controller: {(manualEmotionController != null ? manualEmotionController.name : "null")}");
        
        Live2DEmotionController[] allControllers = FindObjectsOfType<Live2DEmotionController>();
        Debug.LogError($"Scene内のEmotionController数: {allControllers.Length}");
        
        foreach (var controller in allControllers)
        {
            Debug.LogError($"- {controller.gameObject.name} (Active: {controller.gameObject.activeInHierarchy}, Initialized: {controller.IsInitialized()})");
        }
        
        GameObject reiObj = GameObject.Find("mori");
        Debug.LogError($"mori GameObject: {(reiObj != null ? reiObj.name + " (Active: " + reiObj.activeInHierarchy + ")" : "null")}");
        
        Debug.LogError("=============================");
    }
    
    // ========== デバッグ用メニュー項目 ==========
    
    [ContextMenu("Show Debug Status")]
    public void ShowDebugStatus()
    {
        Debug.Log("==========================================");
        Debug.Log("=== WebGLBridge Debug Status ===");
        Debug.Log($"Initialized: {isInitialized}");
        Debug.Log($"Emotion Controller: {(emotionController != null ? "Found" : "Not Found")}");
        Debug.Log($"Current Emotion: {currentEmotion}");
        Debug.Log($"Is Talking: {isTalking}");
        Debug.Log($"Messages Received: {messageCount}");
        Debug.Log($"Messages Dropped: {droppedMessageCount}");
        Debug.Log($"Errors: {errorCount}");
        Debug.Log($"Has Received First Message: {hasReceivedFirstMessage}");
        Debug.Log($"Last Emotion Change: {lastEmotionChangeTime}");
        
        Debug.Log("=== Emotion Counters ===");
        foreach (var kvp in emotionCounters)
        {
            Debug.Log($"  {kvp.Key}: {kvp.Value}");
        }
        Debug.Log("==========================================");
        
        if (emotionController == null)
        {
            LogDebugInfo();
        }
    }
    
    [ContextMenu("Force Find EmotionController")]
    public void ForceRestartSearch()
    {
        emotionController = null;
        StartCoroutine(FindEmotionControllerWithRetry());
    }
    
    [ContextMenu("Test Happy Emotion")]
    public void TestHappyEmotion()
    {
        TestEmotion("happy");
    }
    
    [ContextMenu("Test Sad Emotion")]
    public void TestSadEmotion()
    {
        TestEmotion("sad");
    }
    
    [ContextMenu("Test Neutral Talking")]
    public void TestNeutralTalking()
    {
        SetEmotion("neutral", true);
    }
    
    [ContextMenu("Send Start Motion Completed")]
    public void TestSendStartMotionCompleted()
    {
        SendStartMotionCompleted();
    }
    
    [ContextMenu("Send Motion Changed Test")]
    public void TestSendMotionChanged()
    {
        SendMotionChanged("test_motion");
    }
}