using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Live2D.Cubism.Framework.Motion;
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;
using System.Runtime.InteropServices;

/// <summary>
/// Live2D感情制御システム - JS制御版（NeutralTalkingランダム対応版）
/// ChatGPT APIと連携して感情表現とモーション制御を行う
/// 🎲 NeutralTalkingモーションのランダム選択機能追加
/// </summary>
public class Live2DEmotionController : MonoBehaviour
{
    [Header("=== モーション設定 ===")]
    [SerializeField] private AnimationClip startMotion;
    [SerializeField] private AnimationClip neutralMotion;
    
    // 🎲 変更：NeutralTalkingモーションを配列に変更
    [Header("=== NeutralTalking モーション（5つ設定）===")]
    [SerializeField] private AnimationClip[] neutralTalkingMotions = new AnimationClip[5];
    
    [SerializeField] private AnimationClip happyMotion;
    [SerializeField] private AnimationClip sadMotion;
    [SerializeField] private AnimationClip angryMotion;
    [SerializeField] private AnimationClip surpriseMotion;
    [SerializeField] private AnimationClip dangerQuestionMotion;
    
    [Header("=== 動作設定 ===")]
    [SerializeField] private int motionPriority = 10;
    [SerializeField] private bool forceBodyParameters = true;
    
    [Header("=== デバッグ設定 ===")]
    [SerializeField] private bool showDebugLog = true;
    [SerializeField] private bool showParameterInfo = false;
    
    [Header("=== キュー設定 ===")]
    [SerializeField] private int maxMessageQueueSize = 100;
    
    // コンポーネント参照
    private CubismMotionController motionController;
    private Animator animator;
    
    // 内部状態
    private bool isInitialized = false;
    private string currentEmotion = "neutral";
    private bool isTalking = false;
    private float lastMotionTime = 0f;
    private bool isWebGLBuild = false;
    private bool isPlayingStartMotion = false;
    private string lastPlayedMotionKey = "";
    
    // 🎲 追加：NeutralTalkingモーションのランダム選択用
    private int lastNeutralTalkingIndex = -1;
    
    // Live2D関連
    private CubismParameter[] allParameters;
    private Dictionary<string, CubismParameter> parameterCache;
    private Dictionary<string, AnimationClip> emotionClips;
    private List<string> bodyParameterIds = new List<string>();
    
    // エディタテスト用
    #if UNITY_EDITOR
    [Header("=== エディタテスト機能 ===")]
    [SerializeField] private string[] testEmotions = {"neutral", "happy", "sad", "angry", "surprise", "dangerquestion"};
    private bool isTestTalking = false;
    private int currentTestEmotionIndex = 0;
    #endif
    
    // ========== 初期化 ==========
    
    void Awake()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        isWebGLBuild = true;
        #endif
        
        Debug.Log($"Live2DEmotionController Awake() 呼び出し");
        Debug.Log($"GameObject名: {gameObject.name}");
        Debug.Log($"isWebGLBuild: {isWebGLBuild}");
    }
    
    void Start()
    {
        StartCoroutine(InitializeSystem());
    }
    
    IEnumerator InitializeSystem()
    {
        Debug.Log("Live2D感情制御システム初期化開始（NeutralTalkingランダム対応版）");
        
        // コンポーネント取得
        motionController = GetComponent<CubismMotionController>();
        if (motionController == null)
        {
            motionController = GetComponentInChildren<CubismMotionController>();
        }
        
        animator = GetComponent<Animator>();
        if (animator == null)
        {
            animator = GetComponentInChildren<Animator>();
        }
        
        if (motionController == null)
        {
            Debug.LogError("❌ CubismMotionControllerが見つかりません！");
            yield break;
        }
        
        // モーションコントローラーが完全に初期化されるまで待機
        yield return new WaitForSeconds(0.5f);
        
        // パラメータキャッシュの初期化
        yield return StartCoroutine(WaitAndCacheParameters());
        
        // 感情クリップの初期化
        InitializeEmotionClips();
        
        // モーションシステムの設定
        ConfigureMotionSystem();
        
        // 初期化完了
        isInitialized = true;
        Debug.Log("Live2D感情制御システム初期化完了");
        
        // 初期化完了通知
        NotifyInitializationComplete();
        
        // システム状態の表示
        if (showDebugLog)
        {
            PrintSystemStatus();
        }
    }
    
    void NotifyInitializationComplete()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            NotifyWebGLInitComplete();
            Debug.Log("📤 WebGL初期化完了通知送信");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"⚠️ WebGL通知エラー: {e.Message}");
        }
        #else
        if (showDebugLog)
        {
            Debug.Log("[Editor Mode] 初期化完了通知");
        }
        #endif
    }
    
    void PrintSystemStatus()
    {
        Debug.Log("=== システム状態 ===");
        Debug.Log($"🎯 初期化: {isInitialized}");
        Debug.Log($"🎭 現在の感情: {currentEmotion}");
        Debug.Log($"🎤 発話中: {isTalking}");
        Debug.Log($"🎬 Motion Controller: {(motionController != null ? "OK" : "なし")}");
        Debug.Log($"🎮 Animator: {(animator != null ? "OK" : "なし")}");
        Debug.Log($"✅ WebGLビルド: {isWebGLBuild}");
        Debug.Log($"🎮 JS制御モード: 有効（自動復帰なし）");
        Debug.Log($"📋 最後のモーション: {lastPlayedMotionKey}");
        Debug.Log($"🎲 NeutralTalkingモーション数: {neutralTalkingMotions.Length}");
    }
    
    IEnumerator WaitAndCacheParameters()
    {
        int maxAttempts = 20;
        int attempt = 0;
        
        while (attempt < maxAttempts)
        {
            attempt++;
            CacheParameters();
            
            if (allParameters != null && allParameters.Length > 0)
            {
                if (showDebugLog)
                {
                    Debug.Log($"✅ パラメータキャッシュ完了 (試行 {attempt})");
                }
                break;
            }
            
            yield return new WaitForSeconds(0.2f);
        }
        
        if (allParameters == null || allParameters.Length == 0)
        {
            Debug.LogWarning("⚠️ Live2Dパラメータの取得に失敗しました");
        }
    }
    
    void CacheParameters()
    {
        allParameters = GetComponentsInChildren<CubismParameter>();
        parameterCache = new Dictionary<string, CubismParameter>();
        
        if (allParameters == null || allParameters.Length == 0)
        {
            Debug.LogWarning("⚠️ CubismParameterが見つかりません。Live2Dモデルの初期化を待っています...");
            return;
        }
        
        foreach (var param in allParameters)
        {
            if (param != null && !string.IsNullOrEmpty(param.Id))
            {
                parameterCache[param.Id] = param;
                
                if (IsBodyParameter(param.Id))
                {
                    bodyParameterIds.Add(param.Id);
                }
            }
            else
            {
                Debug.LogWarning("⚠️ 無効なCubismParameterを検出しました");
            }
        }
        
        if (showDebugLog)
        {
            Debug.Log($"📊 総パラメータ数: {allParameters.Length}");
            Debug.Log($"📊 体パラメータ数: {bodyParameterIds.Count}");
        }
    }
    
    void InitializeEmotionClips()
    {
        emotionClips = new Dictionary<string, AnimationClip>
        {
            {"start", startMotion},
            {"neutral", neutralMotion},
            {"happy", happyMotion},
            {"sad", sadMotion},
            {"angry", angryMotion},
            {"surprise", surpriseMotion},
            {"surprised", surpriseMotion},
            {"dangerquestion", dangerQuestionMotion ?? neutralMotion}
        };
        
        // 🎲 NeutralTalkingモーションを個別に登録
        for (int i = 0; i < neutralTalkingMotions.Length; i++)
        {
            if (neutralTalkingMotions[i] != null)
            {
                emotionClips[$"neutraltalking_{i}"] = neutralTalkingMotions[i];
            }
            else
            {
                Debug.LogWarning($"⚠️ NeutralTalkingモーション[{i}]が未設定です");
            }
        }
        
        // Talkingモーションのフォールバック設定
        if (!emotionClips.ContainsKey("happytalking"))
        {
            if (happyMotion != null)
            {
                emotionClips["happytalking"] = happyMotion;
                Debug.Log("🎭 HappyTalkingモーション: Happyモーションを使用");
            }
        }
        
        if (!emotionClips.ContainsKey("sadtalking"))
        {
            if (sadMotion != null)
            {
                emotionClips["sadtalking"] = sadMotion;
                Debug.Log("🎭 SadTalkingモーション: Sadモーションを使用");
            }
        }
        
        if (!emotionClips.ContainsKey("angrytalking"))
        {
            if (angryMotion != null)
            {
                emotionClips["angrytalking"] = angryMotion;
                Debug.Log("🎭 AngryTalkingモーション: Angryモーションを使用");
            }
        }
        
        if (!emotionClips.ContainsKey("surprisedtalking"))
        {
            if (surpriseMotion != null)
            {
                emotionClips["surprisedtalking"] = surpriseMotion;
                Debug.Log("🎭 SurprisedTalkingモーション: Surprisedモーションを使用");
            }
        }
        
        // 必須モーションの確認
        if (neutralMotion == null)
        {
            Debug.LogError("❌ Neutralモーションが設定されていません！これは必須です！");
        }
        
        int validCount = 0;
        foreach (var pair in emotionClips)
        {
            if (pair.Value != null)
            {
                validCount++;
                if (showDebugLog)
                {
                    Debug.Log($"✅ モーション登録: {pair.Key}");
                }
            }
        }
        
        Debug.Log($"✅ 有効なモーション数: {validCount}/{emotionClips.Count}");
        
        if (showDebugLog)
        {
            int validNeutralTalkingCount = 0;
            foreach (var clip in neutralTalkingMotions)
            {
                if (clip != null) validNeutralTalkingCount++;
            }
            Debug.Log($"🎲 有効なNeutralTalkingモーション: {validNeutralTalkingCount}個");
            
            foreach (var clip in emotionClips)
            {
                if (clip.Value != null)
                {
                    Debug.Log($"📋 登録モーション: {clip.Key} = {clip.Value.name}");
                }
            }
        }
    }
    
    void ConfigureMotionSystem()
    {
        if (motionController != null)
        {
            if (animator != null && animator.enabled)
            {
                Debug.Log("✅ Animatorが有効です（正常）");
            }
            
            Debug.Log($"📋 Motion Layers: {motionController.LayerCount}");
            
            if (showParameterInfo)
            {
                DisplayParameterInfo();
            }
        }
    }
    
    void DisplayParameterInfo()
    {
        Debug.Log("=== パラメータ詳細情報 ===");
        
        int faceCount = 0, bodyCount = 0, otherCount = 0;
        
        foreach (var param in allParameters)
        {
            if (param.Id.Contains("Eye") || param.Id.Contains("Mouth") || param.Id.Contains("Brow"))
            {
                faceCount++;
            }
            else if (IsBodyParameter(param.Id))
            {
                bodyCount++;
            }
            else
            {
                otherCount++;
            }
        }
        
        Debug.Log($"📊 顔パラメータ: {faceCount}");
        Debug.Log($"📊 体パラメータ: {bodyCount}");
        Debug.Log($"📊 その他: {otherCount}");
    }
    
    IEnumerator PlayStartMotion()
    {
        if (startMotion == null)
        {
            Debug.LogWarning("⚠️ Startモーションが設定されていません");
            yield break;
        }
        
        Debug.Log("🎬 Startモーション開始");
        isPlayingStartMotion = true;
        
        bool hasError = false;
        
        motionController.StopAllAnimation();
        yield return null;
        
        try
        {
            motionController.PlayAnimation(
                startMotion,
                priority: motionPriority + 2,
                isLoop: false
            );
            
            currentEmotion = "start";
            lastPlayedMotionKey = "start";
        }
        catch (System.Exception e)
        {
            Debug.LogError($"Startモーション再生エラー: {e.Message}");
            hasError = true;
        }
        
        if (!hasError)
        {
            yield return new WaitForSeconds(startMotion.length);
            Debug.Log("🎬 Startモーション完了");
            NotifyStartMotionComplete();
        }
        
        isPlayingStartMotion = false;
        yield return StartCoroutine(PlayMotionForced("neutral"));
    }
    
    void NotifyStartMotionComplete()
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            NotifyWebGLStartMotionComplete();
            Debug.Log("📤 Startモーション完了通知送信");
            
            JS_NotifyMotionChanged("start_motion_completed");
            Debug.Log("📤 JavaScript側にStartモーション完了を通知");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"⚠️ Startモーション完了通知エラー: {e.Message}");
        }
        #else
        if (showDebugLog)
        {
            Debug.Log("[Editor Mode] Startモーション完了通知");
        }
        #endif
    }
    
    // ========== 感情制御 ==========
    
    public void SetEmotion(string emotion, bool talking = false)
    {
        if (!isInitialized)
        {
            Debug.LogWarning($"⚠️ まだ初期化されていません。感情: {emotion}");
            return;
        }
        
        if (isPlayingStartMotion)
        {
            Debug.Log("🎬 Startモーション再生中は感情変更を無視");
            return;
        }
        
        emotion = emotion.ToLower();
        
        string newMotionKey = DetermineOptimalMotion(emotion, talking);
        
        if (newMotionKey == lastPlayedMotionKey)
        {
            if (showDebugLog)
            {
                Debug.Log($"同じモーション '{newMotionKey}' ({(talking ? "発話中" : "静止中")}) のモーション再生中");
            }
            return;
        }
        
        currentEmotion = emotion;
        isTalking = talking;
        
        if (showDebugLog)
        {
            Debug.Log($"選択されたモーション: {newMotionKey} (感情: {emotion}, 発話: {talking})");
        }
        
        StartCoroutine(PlayMotionWithDelay(newMotionKey));
        NotifyEmotionChangeToJS(emotion, talking);
        
        if (showDebugLog)
        {
            Debug.Log($"🎭 感情設定完了: {emotion} {(talking ? "(発話)" : "(静止)")} [JS制御]");
        }
    }
    
    private string DetermineOptimalMotion(string emotion, bool talking)
    {
        if (talking)
        {
            switch (emotion)
            {
                case "neutral":
                    return GetRandomNeutralTalkingMotion();
                case "happy":
                    return "happytalking";
                case "sad":
                    return "sadtalking";
                case "angry":
                    return "angrytalking";
                case "surprised":
                    return "surprisedtalking";
                case "dangerquestion":
                    return "dangerquestion";
                default:
                    return GetRandomNeutralTalkingMotion();
            }
        }
        else
        {
            switch (emotion)
            {
                case "neutral":
                    return "neutral";
                case "happy":
                    return "happy";
                case "sad":
                    return "sad";
                case "angry":
                    return "angry";
                case "surprised":
                    return "surprised";
                case "dangerquestion":
                    return "dangerquestion";
                default:
                    return "neutral";
            }
        }
    }
    
    private string GetRandomNeutralTalkingMotion()
    {
        List<int> validIndices = new List<int>();
        for (int i = 0; i < neutralTalkingMotions.Length; i++)
        {
            if (neutralTalkingMotions[i] != null)
            {
                validIndices.Add(i);
            }
        }
        
        if (validIndices.Count == 0)
        {
            Debug.LogWarning("⚠️ 有効なNeutralTalkingモーションがありません。Neutralにフォールバック");
            return "neutral";
        }
        
        if (validIndices.Count == 1)
        {
            return $"neutraltalking_{validIndices[0]}";
        }
        
        int selectedIndex;
        int attempts = 0;
        do
        {
            selectedIndex = validIndices[Random.Range(0, validIndices.Count)];
            attempts++;
            
            if (attempts >= 10)
            {
                break;
            }
        } while (selectedIndex == lastNeutralTalkingIndex && validIndices.Count > 1);
        
        lastNeutralTalkingIndex = selectedIndex;
        
        string motionKey = $"neutraltalking_{selectedIndex}";
        
        if (showDebugLog)
        {
            Debug.Log($"🎲 NeutralTalkingモーション選択: {motionKey} (インデックス: {selectedIndex})");
        }
        
        return motionKey;
    }
    
    public void StartTalking()
    {
        SetEmotion(currentEmotion, true);
    }
    
    public void StopTalking()
    {
        SetEmotion(currentEmotion, false);
    }
    
    public void EndConversation()
    {
        if (showDebugLog)
        {
            Debug.Log("🔚 会話終了 → Neutralモーション復帰");
        }
        
        SetEmotion("neutral", false);
    }
    
    // ========== モーション制御 ==========
    
    IEnumerator PlayMotionWithDelay(string motionKey)
    {
        if (!emotionClips.ContainsKey(motionKey) || emotionClips[motionKey] == null)
        {
            Debug.LogWarning($"⚠️ モーション '{motionKey}' が見つかりません");
            yield break;
        }
        
        try
        {
            motionController.StopAllAnimation();
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"モーション停止エラー: {e.Message}");
        }
        
        yield return null;
        
        AnimationClip clip = emotionClips[motionKey];
        
        try
        {
            motionController.PlayAnimation(
                clip,
                priority: motionPriority,
                isLoop: true
            );
            
            lastPlayedMotionKey = motionKey;
            lastMotionTime = Time.time;
            
            if (showDebugLog)
            {
                Debug.Log($"▶️ モーション再生成功: {motionKey}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"モーション再生エラー: {e.Message}");
        }
    }
    
    IEnumerator PlayMotionForced(string motionKey)
    {
        if (!emotionClips.ContainsKey(motionKey) || emotionClips[motionKey] == null)
        {
            Debug.LogWarning($"⚠️ モーション '{motionKey}' が見つかりません");
            yield break;
        }
        
        if (lastPlayedMotionKey == motionKey)
        {
            if (showDebugLog)
            {
                Debug.Log($"🔄 同じモーション '{motionKey}' は既に再生中");
            }
            yield break;
        }
        
        try
        {
            motionController.StopAllAnimation();
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"モーション停止エラー: {e.Message}");
        }
        
        yield return null;
        
        AnimationClip clip = emotionClips[motionKey];
        
        try
        {
            motionController.PlayAnimation(
                clip,
                priority: motionPriority + 1,
                isLoop: true
            );
            
            lastPlayedMotionKey = motionKey;
            lastMotionTime = Time.time;
            
            Debug.Log($"▶️ モーション強制再生成功: {motionKey}");
            NotifyMotionChanged(motionKey);
        }
        catch (System.Exception e)
        {
            Debug.LogError($"モーション強制再生エラー: {e.Message}");
        }
    }
    
    IEnumerator ForcePlayMotionCoroutine(string motionKey)
    {
        if (!emotionClips.ContainsKey(motionKey) || emotionClips[motionKey] == null)
        {
            Debug.LogWarning($"⚠️ モーション '{motionKey}' が見つかりません");
            yield break;
        }
        
        try
        {
            motionController.StopAllAnimation();
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"モーション停止エラー: {e.Message}");
        }
        
        yield return null;
        yield return null;
        
        AnimationClip clip = emotionClips[motionKey];
        
        try
        {
            motionController.PlayAnimation(
                clip,
                priority: motionPriority + 2,
                isLoop: true
            );
            
            lastPlayedMotionKey = motionKey;
            currentEmotion = motionKey.Replace("talking", "").Replace("_0", "").Replace("_1", "").Replace("_2", "").Replace("_3", "").Replace("_4", "");
            isTalking = motionKey.Contains("talking");
            
            Debug.Log($"✅ モーション強制再生成功: {motionKey}");
        }
        catch (System.Exception e)
        {
            Debug.LogError($"モーション強制再生エラー: {e.Message}");
        }
    }
    
    void PlayMotion(string motionKey)
    {
        if (!emotionClips.ContainsKey(motionKey) || emotionClips[motionKey] == null)
        {
            Debug.LogWarning($"⚠️ モーション '{motionKey}' が見つかりません");
            return;
        }
        
        AnimationClip clip = emotionClips[motionKey];
        
        try
        {
            motionController.PlayAnimation(
                clip,
                priority: motionPriority,
                isLoop: true
            );
            
            if (showDebugLog)
            {
                Debug.Log($"▶️ モーション再生: {motionKey}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogError($"モーション再生エラー: {e.Message}");
        }
        
        lastMotionTime = Time.time;
    }
    
    void ResetMotionSystem()
    {
        if (motionController != null)
        {
            try
            {
                motionController.StopAllAnimation();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"モーション停止エラー: {e.Message}");
            }
        }
        
        currentEmotion = "neutral";
        isTalking = false;
        lastPlayedMotionKey = "";
        lastNeutralTalkingIndex = -1;
        
        if (showDebugLog)
        {
            Debug.Log("🔄 モーションシステムリセット完了");
        }
    }
    
    string GetMotionKey(string emotion, bool talking)
    {
        if (talking && emotion == "neutral")
        {
            return "neutraltalking";
        }
        return emotion;
    }
    
    // ========== エディタテスト機能 ==========
    
    #if UNITY_EDITOR
    void Update()
    {
        if (isInitialized)
        {
            HandleTestKeyboardInput();
        }
    }
    
    void HandleTestKeyboardInput()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) TestSetEmotion("neutral");
        if (Input.GetKeyDown(KeyCode.Alpha2)) TestSetEmotion("happy");
        if (Input.GetKeyDown(KeyCode.Alpha3)) TestSetEmotion("sad");
        if (Input.GetKeyDown(KeyCode.Alpha4)) TestSetEmotion("angry");
        if (Input.GetKeyDown(KeyCode.Alpha5)) TestSetEmotion("surprise");
        if (Input.GetKeyDown(KeyCode.Alpha6)) TestSetEmotion("dangerquestion");
        if (Input.GetKeyDown(KeyCode.Alpha0)) TestSetEmotion("start");
        
        if (Input.GetKeyDown(KeyCode.Space))
        {
            isTestTalking = !isTestTalking;
            SetEmotion(currentEmotion, isTestTalking);
            Debug.Log($"🎤 テスト: 発話状態 = {(isTestTalking ? "ON" : "OFF")}");
        }
        
        if (Input.GetKeyDown(KeyCode.R))
        {
            TestRandomEmotion();
        }
        
        if (Input.GetKeyDown(KeyCode.RightArrow))
        {
            TestNextEmotion();
        }
        else if (Input.GetKeyDown(KeyCode.LeftArrow))
        {
            TestPreviousEmotion();
        }
        
        if (Input.GetKeyDown(KeyCode.T))
        {
            StartCoroutine(TestConversationSimulation());
        }
        
        if (Input.GetKeyDown(KeyCode.N))
        {
            StartCoroutine(ForcePlayMotionCoroutine("neutral"));
        }
        
        if (Input.GetKeyDown(KeyCode.D))
        {
            showDebugLog = !showDebugLog;
            Debug.Log($"デバッグログ: {(showDebugLog ? "ON" : "OFF")}");
        }
        
        if (Input.GetKeyDown(KeyCode.P))
        {
            showParameterInfo = !showParameterInfo;
            if (showParameterInfo) DisplayParameterInfo();
        }
        
        if (Input.GetKeyDown(KeyCode.S))
        {
            PrintSystemStatus();
        }
    }
    
    void TestSetEmotion(string emotion)
    {
        SetEmotion(emotion, isTestTalking);
        Debug.Log($"🎭 テスト: 感情を「{emotion}」に設定（発話: {isTestTalking}）");
    }
    
    void TestRandomEmotion()
    {
        string randomEmotion = testEmotions[Random.Range(0, testEmotions.Length)];
        TestSetEmotion(randomEmotion);
    }
    
    void TestNextEmotion()
    {
        currentTestEmotionIndex = (currentTestEmotionIndex + 1) % testEmotions.Length;
        TestSetEmotion(testEmotions[currentTestEmotionIndex]);
    }
    
    void TestPreviousEmotion()
    {
        currentTestEmotionIndex--;
        if (currentTestEmotionIndex < 0) currentTestEmotionIndex = testEmotions.Length - 1;
        TestSetEmotion(testEmotions[currentTestEmotionIndex]);
    }
    
    IEnumerator TestConversationSimulation()
    {
        Debug.Log("🎬 会話シミュレーション開始（JS制御モード）");
        
        TestSetEmotion("happy");
        StartTalking();
        yield return new WaitForSeconds(2f);
        StopTalking();
        yield return new WaitForSeconds(0.5f);
        
        TestSetEmotion("neutral");
        yield return new WaitForSeconds(1f);
        
        TestSetEmotion("dangerquestion");
        yield return new WaitForSeconds(1.5f);
        
        TestSetEmotion("neutral");
        StartTalking();
        yield return new WaitForSeconds(3f);
        StopTalking();
        
        TestSetEmotion("neutral");
        yield return new WaitForSeconds(0.5f);
        
        Debug.Log("🎬 会話シミュレーション終了");
    }
    #endif
    
    // ========== Context Menu デバッグ機能 ==========
    
    [ContextMenu("Show Status")]
    public void ShowStatus()
    {
        Debug.Log("==========================================");
        Debug.Log("=== Live2DEmotionController Status ===");
        Debug.Log($"Initialized: {isInitialized}");
        Debug.Log($"Current Emotion: {currentEmotion}");
        Debug.Log($"Is Talking: {isTalking}");
        Debug.Log($"Last Played Motion: {lastPlayedMotionKey}");
        Debug.Log($"Last NeutralTalking Index: {lastNeutralTalkingIndex}");
        Debug.Log($"Motion Controller: {(motionController != null ? "OK" : "Missing")}");
        Debug.Log($"Parameters Cached: {(parameterCache != null ? parameterCache.Count : 0)}");
        Debug.Log($"WebGL Build: {isWebGLBuild}");
        Debug.Log($"Control Mode: JavaScript (No Auto-Return)");
        Debug.Log($"Playing Start Motion: {isPlayingStartMotion}");
        Debug.Log($"NeutralTalking Motions Count: {neutralTalkingMotions.Length}");
        Debug.Log("==========================================");
    }
    
    [ContextMenu("Test Happy")]
    public void TestHappy()
    {
        SetEmotion("happy", false);
    }
    
    [ContextMenu("Test Happy Talking")]
    public void TestHappyTalking()
    {
        SetEmotion("happy", true);
    }
    
    [ContextMenu("Test Neutral")]
    public void TestNeutral()
    {
        SetEmotion("neutral", false);
    }
    
    [ContextMenu("Test Neutral Talking")]
    public void TestNeutralTalking()
    {
        SetEmotion("neutral", true);
    }
    
    [ContextMenu("Force Neutral Motion")]
    public void ForceNeutralMotion()
    {
        StartCoroutine(ForcePlayMotionCoroutine("neutral"));
    }
    
    [ContextMenu("Reset to Neutral")]
    public void ResetToNeutral()
    {
        SetEmotion("neutral", false);
    }
    
    [ContextMenu("Force Reset System")]
    public void ForceResetSystem()
    {
        StopAllCoroutines();
        isTalking = false;
        currentEmotion = "neutral";
        lastPlayedMotionKey = "";
        isPlayingStartMotion = false;
        lastNeutralTalkingIndex = -1;
        
        if (motionController != null && motionController.isActiveAndEnabled)
        {
            StartCoroutine(ForcePlayMotionCoroutine("neutral"));
        }
        
        Debug.Log("🔄 システム強制リセット完了（JS制御モード）");
    }
    
    [ContextMenu("システム情報表示")]
    public void PrintSystemDebugInfo()
    {
        Debug.Log("=== Live2Dシステム情報 ===");
        Debug.Log($"初期化状態: {isInitialized}");
        Debug.Log($"発話状態: {isTalking}");
        Debug.Log($"現在の感情: {currentEmotion}");
        Debug.Log($"最後のモーション: {lastPlayedMotionKey}");
        Debug.Log($"Startモーション再生中: {isPlayingStartMotion}");
        Debug.Log($"WebGLビルド: {isWebGLBuild}");
        Debug.Log($"制御モード: JavaScript");
        Debug.Log($"自動復帰: 無効（JS側で制御）");
        Debug.Log($"パラメータキャッシュ: {parameterCache?.Count ?? 0}個");
        Debug.Log($"登録モーション数: {emotionClips?.Count ?? 0}個");
        Debug.Log($"NeutralTalkingバリエーション数: {neutralTalkingMotions.Length}個");
        Debug.Log("===============================");
    }
    
    // ========== ユーティリティ ==========
    
    bool IsBodyParameter(string paramId)
    {
        return paramId.Contains("Body") || 
               paramId.Contains("Arm") || 
               paramId.Contains("Shoulder") ||
               paramId.Contains("Angle") ||
               paramId.Contains("Position");
    }
    
    public bool IsInitialized() => isInitialized;
    public bool IsTalking() => isTalking;
    public string GetCurrentEmotion() => currentEmotion;
    public string GetLastPlayedMotion() => lastPlayedMotionKey;
    
    public string GetCurrentStatus()
    {
        return $"Emotion: {currentEmotion}, Talking: {isTalking}, LastMotion: {lastPlayedMotionKey}";
    }
    
    // ========== WebGL連携 ==========
    
    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void NotifyEmotionChange(string emotion, bool isTalking);
    
    [DllImport("__Internal")]
    private static extern void NotifyWebGLInitComplete();
    
    [DllImport("__Internal")]
    private static extern void NotifyWebGLStartMotionComplete();
    
    [DllImport("__Internal")]
    private static extern void JS_NotifyMotionChanged(string motionName);
    #else
    private static void NotifyEmotionChange(string emotion, bool isTalking) 
    {
        Debug.Log($"[WebGL Bridge] Emotion: {emotion}, Talking: {isTalking}");
    }
    
    private static void NotifyWebGLInitComplete()
    {
        Debug.Log("[Editor Mode] 初期化完了通知");
    }
    
    private static void NotifyWebGLStartMotionComplete()
    {
        Debug.Log("[Editor Mode] Startモーション完了通知");
    }
    
    private static void JS_NotifyMotionChanged(string motionName)
    {
        Debug.Log($"[Editor Mode] モーション変更通知: {motionName}");
    }
    #endif
    
    void NotifyEmotionChangeToJS(string emotion, bool talking)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            NotifyEmotionChange(emotion, talking);
        }
        catch (System.Exception e)
        {
            Debug.LogError($"WebGL通知エラー: {e.Message}");
        }
        #endif
    }
    
    private void NotifyMotionChanged(string motionName)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            JS_NotifyMotionChanged(motionName);
            if (showDebugLog)
            {
                Debug.Log($"📤 JavaScript側にモーション変更を通知: {motionName}");
            }
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"⚠️ JavaScript通知エラー: {e.Message}");
        }
        #else
        if (showDebugLog)
        {
            Debug.Log($"[Editor Mode] モーション変更通知: {motionName}");
        }
        #endif
    }
}