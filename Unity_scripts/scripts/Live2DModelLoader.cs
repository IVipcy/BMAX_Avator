using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.Networking;
using System.IO;
using Live2D.Cubism.Core;
using Live2D.Cubism.Framework;
using Live2D.Cubism.Framework.Json;
using Live2D.Cubism.Rendering;
using System.Runtime.InteropServices;
using System.Reflection;

/// <summary>
/// Live2Dモデルの読み込みとフォールバック処理を管理するクラス（完全修正版・サイズ変更問題解決）
/// WebGL環境での動的読み込みに対応、起動時のサイズ変更問題を完全解決
/// </summary>
public class Live2DModelLoader : MonoBehaviour
{
    [Header("=== 読み込み設定 ===")]
    [SerializeField] private string modelJsonPath = "Live2D/mori.model3.json";
    [SerializeField] private string resourcePrefabPath = "mori";
    [SerializeField] private float loadTimeout = 10f;
    
    [Header("=== Transform設定 ===")]
    [SerializeField] private bool useCustomTransform = true;
    [SerializeField] private Vector3 modelPosition = new Vector3(0.2f, -3f, 0f);
    [SerializeField] private Vector3 modelScale = new Vector3(17f, 17f, 16.4f);
    [SerializeField] private Vector3 modelRotation = Vector3.zero;
    
    [Header("=== フォールバック設定 ===")]
    [SerializeField] private Sprite fallbackSprite;
    [SerializeField] private GameObject fallbackPrefab;
    [SerializeField] private bool enableFallback = false;
    
    [Header("=== デバッグ設定 ===")]
    [SerializeField] private bool enableDebugLogs = true;
    
    [Header("=== WebGLBridge連携設定 ===")]
    [SerializeField] private bool enableWebGLBridgeIntegration = true;
    [SerializeField] private bool skipLoadIfControllerExists = true;
    
    // 内部状態管理
    private bool isModelLoaded = false;
    private float loadStartTime;
    private GameObject currentModel;
    private CubismModel cubismModel;
    private bool hasNotifiedSuccess = false;
    
    // エラーハンドリング用
    private string lastErrorMessage = "";
    private bool hasError = false;
    
    // JavaScript連携（WebGLのみ）
    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void NotifyInitialized();
    
    [DllImport("__Internal")]
    private static extern void DebugLog(string message);
    
    [DllImport("__Internal")]
    private static extern void NotifyLive2DStatus(string status);
    
    [DllImport("__Internal")]
    private static extern void SendMessageToJS(string message);
    
    [DllImport("__Internal")]
    private static extern void ErrorLog(string message);
    
    [DllImport("__Internal")]
    private static extern void WarningLog(string message);
    #else
    // エディタ用のダミー実装
    private static void NotifyInitialized() { }
    private static void DebugLog(string message) { Debug.Log(message); }
    private static void NotifyLive2DStatus(string status) { Debug.Log($"Live2D Status: {status}"); }
    private static void SendMessageToJS(string message) { Debug.Log($"[To JS] {message}"); }
    private static void ErrorLog(string message) { Debug.LogError(message); }
    private static void WarningLog(string message) { Debug.LogWarning(message); }
    #endif
    
    // 🔧 修正: 初期化をAwakeに移動してサイズ変更問題を解決
    void Awake()
    {
        Debug.Log("[Live2DLoader] Awake() method called - 即座初期化開始");
        LogDebug("[Live2DLoader] 即座初期化開始");
        
        // 既存オブジェクトを即座に処理（サイズ変更防止）
        HandleExistingObjectsImmediate();
        
        loadStartTime = Time.time;
        Debug.Log("[Live2DLoader] Starting immediate LoadSequence in Awake");
        
        // 即座にコルーチンを開始
        StartCoroutine(LoadSequenceImmediate());
    }

    void Start()
    {
        // Startは空にして、全ての重要な処理をAwakeで完了
        Debug.Log("[Live2DLoader] Start() - メイン処理はAwakeで完了済み");
    }
    
    /// <summary>
    /// 既存オブジェクトの即座処理（修正版・サイズ変更防止）
    /// </summary>
    private void HandleExistingObjectsImmediate()
    {
        GameObject existingRei = GameObject.Find("mori");
        if (existingRei != null && !existingRei.name.Contains("Clone"))
        {
            // WebGLBridgeがManual参照で使用している可能性をチェック
            WebGLBridge bridge = FindObjectOfType<WebGLBridge>();
            if (bridge != null && enableWebGLBridgeIntegration)
            {
                if (IsObjectUsedByWebGLBridge(bridge, existingRei))
                {
                    LogDebug("[Live2DLoader] 既存のreiがWebGLBridge使用中 - 即座非表示");
                    existingRei.SetActive(false); // 削除ではなく非表示で保持
                    return;
                }
            }
            
            // WebGLBridgeで使用されていない場合は即座に削除
            LogDebug("[Live2DLoader] 手動配置のreiを即座削除");
            DestroyImmediate(existingRei); // 即座削除でサイズ変更を防止
        }
    }
    
    /// <summary>
    /// 即座読み込みシーケンス（完全修正版）
    /// </summary>
    IEnumerator LoadSequenceImmediate()
    {
        Debug.Log("[Live2DLoader] LoadSequence immediate started with conflict avoidance");
        
        // 最小限の待機（サイズ変更を最小化）
        yield return null;
        
        // 既存の初期化済みEmotionControllerをチェック
        if (skipLoadIfControllerExists && CheckExistingInitializedController())
        {
            LogDebug("[Live2DLoader] 既存の初期化済みControllerを検出 - 動的読み込みをスキップ");
            isModelLoaded = true;
            NotifySuccess();
            yield break;
        }
        
        Debug.Log("[Live2DLoader] Starting TryLoadModel immediately");
        yield return StartCoroutine(TryLoadModelSafe());
        
        if (isModelLoaded)
        {
            Debug.Log("[Live2DLoader] モデル読み込み成功");
            LogDebug("[Live2DLoader] モデル読み込み成功");
            NotifySuccess();
            InitializeModel();
        }
        else if (enableFallback)
        {
            Debug.LogError("[Live2DLoader] モデル読み込み失敗 → フォールバック");
            LogError("[Live2DLoader] モデル読み込み失敗 → フォールバック");
            ShowFallback();
            NotifyFallback();
        }
        else
        {
            Debug.LogError("[Live2DLoader] モデル読み込み失敗");
            LogError("[Live2DLoader] モデル読み込み失敗");
        }
    }
    
    /// <summary>
    /// WebGLBridgeがオブジェクトを使用しているかチェック
    /// </summary>
    private bool IsObjectUsedByWebGLBridge(WebGLBridge bridge, GameObject obj)
    {
        if (bridge == null || obj == null) return false;
        
        // Reflection を使用してmanualEmotionControllerフィールドにアクセス
        var field = GetManualEmotionControllerField(bridge);
        if (field != null)
        {
            var manualController = field.GetValue(bridge) as Live2DEmotionController;
            if (manualController != null && manualController.gameObject == obj)
            {
                return true;
            }
        }
        
        return false;
    }
    
    /// <summary>
    /// 既存の初期化済みControllerチェック
    /// </summary>
    private bool CheckExistingInitializedController()
    {
        // 既存のmoriオブジェクトをチェック
        GameObject existingRei = GameObject.Find("mori");
        if (existingRei != null)
        {
            Live2DEmotionController existingController = existingRei.GetComponent<Live2DEmotionController>();
            if (existingController != null && existingController.IsInitialized())
            {
                LogDebug("[Live2DLoader] 既存の初期化済みEmotionControllerを発見");
                
                // WebGLBridgeに通知
                if (enableWebGLBridgeIntegration)
                {
                    NotifyWebGLBridge(existingRei);
                }
                
                return true;
            }
        }
        
        // 他のLive2D関連オブジェクトもチェック
        string[] possibleNames = { "mori(Clone)", "Live2DModel", "MORI", "Live2DContainer" };
        foreach (string name in possibleNames)
        {
            GameObject obj = GameObject.Find(name);
            if (obj != null)
            {
                Live2DEmotionController controller = obj.GetComponent<Live2DEmotionController>();
                if (controller == null)
                {
                    controller = obj.GetComponentInChildren<Live2DEmotionController>();
                }
                
                if (controller != null && controller.IsInitialized())
                {
                    LogDebug($"[Live2DLoader] 初期化済みController発見: {controller.name}");
                    if (enableWebGLBridgeIntegration)
                    {
                        NotifyWebGLBridge(controller.gameObject);
                    }
                    return true;
                }
            }
        }
        
        // FindObjectOfTypeでも確認
        Live2DEmotionController[] allControllers = FindObjectsOfType<Live2DEmotionController>();
        foreach (var controller in allControllers)
        {
            if (controller.IsInitialized())
            {
                LogDebug($"[Live2DLoader] 初期化済みController発見（全体検索）: {controller.name}");
                if (enableWebGLBridgeIntegration)
                {
                    NotifyWebGLBridge(controller.gameObject);
                }
                return true;
            }
        }
        
        return false;
    }
    
    /// <summary>
    /// モデル読み込み（安全版）
    /// </summary>
    IEnumerator TryLoadModelSafe()
    {
        LogDebug("[Live2DLoader] モデル読み込み開始");
        
        // Prefabを安全に読み込み
        GameObject modelPrefab = LoadModelPrefabSafely();
        
        if (hasError || modelPrefab == null)
        {
            LogError($"[Live2DLoader] Prefab読み込み失敗: {lastErrorMessage}");
            LogResourcesDebugInfo();
            yield break;
        }
        
        LogDebug("[Live2DLoader] Prefab読み込み成功");
        
        // モデルを安全にインスタンス化（即座適用）
        yield return StartCoroutine(InstantiateModelSafelyImmediate(modelPrefab));
        
        if (hasError || currentModel == null)
        {
            LogError($"[Live2DLoader] インスタンス化失敗: {lastErrorMessage}");
            yield break;
        }
        
        LogDebug("[Live2DLoader] インスタンス化成功");
        
        // モデル設定を即座に適用
        SetupLoadedModelImmediate();
        
        // モデル初期化完了待機
        yield return StartCoroutine(WaitForModelInitializationSafe());
        
        // CubismModel コンポーネント確認
        VerifyModelComponents();
    }
    
    /// <summary>
    /// Prefabを安全に読み込み
    /// </summary>
    private GameObject LoadModelPrefabSafely()
    {
        try
        {
            return Resources.Load<GameObject>(resourcePrefabPath);
        }
        catch (Exception e)
        {
            hasError = true;
            lastErrorMessage = e.Message;
            return null;
        }
    }
    
    /// <summary>
    /// モデルを安全にインスタンス化（即座適用版）
    /// </summary>
    IEnumerator InstantiateModelSafelyImmediate(GameObject modelPrefab)
    {
        // 既存のreiオブジェクトとの名前競合を回避
        string instanceName = GetSafeInstanceName();
        
        // インスタンス化処理
        GameObject instantiatedModel = InstantiateModelObject(modelPrefab, instanceName);
        
        if (hasError)
        {
            yield break;
        }
        
        currentModel = instantiatedModel;
        
        // 🔧 修正: 確実にアクティブにして、正しいTransformを即座適用
        currentModel.SetActive(true);
        ApplyCorrectTransformImmediate();
        
        Debug.Log($"[Live2DLoader] Model instantiated with correct size: {currentModel.name}");
        
        yield return null; // 1フレーム待機
    }
    
    /// <summary>
    /// モデルオブジェクトのインスタンス化
    /// </summary>
    private GameObject InstantiateModelObject(GameObject prefab, string instanceName)
    {
        try
        {
            GameObject instance = Instantiate(prefab, transform);
            instance.name = instanceName;
            return instance;
        }
        catch (Exception e)
        {
            hasError = true;
            lastErrorMessage = e.Message;
            return null;
        }
    }
    
    /// <summary>
    /// 安全なインスタンス名を取得
    /// </summary>
    private string GetSafeInstanceName()
    {
        string baseName = "mori";
        string instanceName = baseName;
        int counter = 1;
        
        while (GameObject.Find(instanceName) != null)
        {
            instanceName = $"{baseName}_dynamic_{counter}";
            counter++;
            
            if (counter > 10) // 無限ループ防止
            {
                instanceName = $"{baseName}_{System.Guid.NewGuid().ToString().Substring(0, 8)}";
                break;
            }
        }
        
        LogDebug($"[Live2DLoader] インスタンス名決定: {instanceName}");
        return instanceName;
    }
    
    /// <summary>
    /// 🔧 新規追加: 正しいTransformを即座に適用
    /// </summary>
    private void ApplyCorrectTransformImmediate()
    {
        if (currentModel == null) return;
        
        Debug.Log("[Live2DLoader] 正しいTransformを即座適用開始");
        
        if (useCustomTransform)
        {
            // カスタム設定を即座に適用
            currentModel.transform.localPosition = modelPosition;
            currentModel.transform.localScale = modelScale;
            currentModel.transform.localRotation = Quaternion.Euler(modelRotation);
            
            LogDebug($"[Live2DLoader] カスタムTransform即座適用完了");
            LogDebug($"  Position: {modelPosition}");
            LogDebug($"  Scale: {modelScale}");
            LogDebug($"  Rotation: {modelRotation}");
        }
        else
        {
            // デフォルト設定を即座に適用
            currentModel.transform.localPosition = Vector3.zero;
            currentModel.transform.localRotation = Quaternion.identity;
            currentModel.transform.localScale = Vector3.one;
            
            LogDebug("[Live2DLoader] デフォルトTransform即座適用完了");
        }
        
        LogDebug($"[Live2DLoader] 最終Transform確認完了: {currentModel.name}");
    }
    
    /// <summary>
    /// 読み込んだモデルの設定（即座適用版）
    /// </summary>
    void SetupLoadedModelImmediate()
    {
        if (currentModel == null) return;
        
        currentModel.transform.SetParent(transform);
        
        // Transform設定は ApplyCorrectTransformImmediate() で既に適用済み
        
        LogDebug($"[Live2DLoader] モデル設定完了: {currentModel.name}");
    }
    
    /// <summary>
    /// モデル初期化完了待機（安全版）
    /// </summary>
    IEnumerator WaitForModelInitializationSafe()
    {
        if (currentModel == null) 
        {
            LogWarning("[Live2DLoader] currentModelがnullです");
            yield break;
        }
        
        Live2DEmotionController controller = currentModel.GetComponent<Live2DEmotionController>();
        if (controller == null)
        {
            controller = currentModel.GetComponentInChildren<Live2DEmotionController>();
        }
        
        if (controller != null)
        {
            float timeout = 15f;
            float elapsed = 0f;
            
            LogDebug("[Live2DLoader] EmotionController初期化待機開始");
            
            while (!controller.IsInitialized() && elapsed < timeout)
            {
                yield return new WaitForSeconds(0.2f);
                elapsed += 0.2f;
                
                // 進捗をログ出力
                if (Mathf.FloorToInt(elapsed) % 5 == 0 && elapsed > 0 && elapsed % 5 < 0.3f)
                {
                    LogDebug($"[Live2DLoader] 初期化待機中... {elapsed:F1}s");
                }
            }
            
            if (controller.IsInitialized())
            {
                LogDebug("[Live2DLoader] EmotionController初期化完了確認");
                // 追加の安定化待機
                yield return new WaitForSeconds(0.5f);
            }
            else
            {
                LogWarning($"[Live2DLoader] EmotionController初期化タイムアウト ({timeout}秒)");
            }
        }
        else
        {
            LogWarning("[Live2DLoader] EmotionControllerが見つかりません");
            yield return new WaitForSeconds(1f);
        }
    }
    
    /// <summary>
    /// モデルコンポーネント確認
    /// </summary>
    void VerifyModelComponents()
    {
        cubismModel = currentModel.GetComponent<CubismModel>();
        if (cubismModel == null)
        {
            cubismModel = currentModel.GetComponentInChildren<CubismModel>();
        }
        
        if (cubismModel != null)
        {
            isModelLoaded = true;
            LogDebug("[Live2DLoader] 動的モデル読み込み成功");
            
            // WebGLBridgeに通知
            if (enableWebGLBridgeIntegration)
            {
                NotifyWebGLBridge(currentModel);
            }
        }
        else
        {
            LogError("[Live2DLoader] CubismModelコンポーネントが見つかりません");
            isModelLoaded = false;
        }
    }
    
    /// <summary>
    /// WebGLBridgeに通知（エラー処理改善版）
    /// </summary>
    private void NotifyWebGLBridge(GameObject modelObject)
    {
        if (!enableWebGLBridgeIntegration || modelObject == null) return;
        
        WebGLBridge bridge = FindObjectOfType<WebGLBridge>();
        if (bridge == null) return;
        
        // WebGLBridgeのmanualEmotionControllerフィールドを更新
        var controller = modelObject.GetComponent<Live2DEmotionController>();
        if (controller == null) return;
        
        var field = GetManualEmotionControllerField(bridge);
        if (field != null)
        {
            SetManualEmotionController(bridge, field, controller);
            TriggerWebGLBridgeRefresh(bridge);
        }
    }
    
    /// <summary>
    /// ManualEmotionControllerを安全に設定
    /// </summary>
    private void SetManualEmotionController(WebGLBridge bridge, FieldInfo field, Live2DEmotionController controller)
    {
        try
        {
            field.SetValue(bridge, controller);
            LogDebug($"[Live2DLoader] WebGLBridge.manualEmotionController更新: {controller.gameObject.name}");
        }
        catch (Exception e)
        {
            LogWarning($"[Live2DLoader] ManualEmotionController設定エラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// WebGLBridgeのリフレッシュをトリガー
    /// </summary>
    private void TriggerWebGLBridgeRefresh(WebGLBridge bridge)
    {
        try
        {
            // ForceRestartSearchメソッドを呼び出し
            var method = bridge.GetType().GetMethod("ForceRestartSearch", BindingFlags.Public | BindingFlags.Instance);
            if (method != null)
            {
                method.Invoke(bridge, null);
                LogDebug("[Live2DLoader] WebGLBridge強制リフレッシュ実行");
            }
        }
        catch (Exception e)
        {
            LogWarning($"[Live2DLoader] WebGLBridge強制リフレッシュエラー: {e.Message}");
        }
    }
    
    /// <summary>
    /// WebGLBridgeのmanualEmotionControllerフィールドを取得
    /// </summary>
    private FieldInfo GetManualEmotionControllerField(WebGLBridge bridge)
    {
        if (bridge == null) return null;
        
        return bridge.GetType().GetField("manualEmotionController", 
                                       BindingFlags.NonPublic | 
                                       BindingFlags.Public | 
                                       BindingFlags.Instance);
    }
    
    /// <summary>
    /// モデル初期化処理（修正版）
    /// </summary>
    void InitializeModel()
    {
        if (currentModel == null) return;
        
        // CubismRenderControllerの設定
        var renderController = currentModel.GetComponent<CubismRenderController>();
        if (renderController == null)
        {
            renderController = currentModel.GetComponentInChildren<CubismRenderController>();
        }
        
        if (renderController != null)
        {
            // Back To Front Orderモードを確実に設定
            renderController.SortingMode = CubismSortingMode.BackToFrontOrder;
            renderController.SortingLayer = "Default";
            
            LogDebug("[Live2DLoader] CubismRenderController設定完了");
        }
        else
        {
            LogWarning("[Live2DLoader] CubismRenderControllerが見つかりません");
        }
        
        // レンダラーの確認
        var renderers = currentModel.GetComponentsInChildren<CubismRenderer>();
        if (renderers != null && renderers.Length > 0)
        {
            LogDebug($"[Live2DLoader] {renderers.Length}個のCubismRenderer検出");
        }
        
        // Animatorの確認
        var animator = currentModel.GetComponent<Animator>();
        if (animator == null)
        {
            animator = currentModel.GetComponentInChildren<Animator>();
        }
        
        if (animator != null)
        {
            LogDebug("[Live2DLoader] Animator検出");
        }
    }
    
    /// <summary>
    /// リソースフォルダのデバッグ情報を出力
    /// </summary>
    private void LogResourcesDebugInfo()
    {
        LogDebug("[Live2DLoader] === Resources フォルダデバッグ情報 ===");
        
        // 基本的なリソース確認
        var testResult = TestResourceLoad(resourcePrefabPath);
        LogDebug($"  再試行結果: {(testResult ? "成功" : "失敗")}");
        
        // 他の可能性のあるパスをチェック
        string[] possiblePaths = { "mori", "MORI", "Live2D/mori", "Models/mori" };
        foreach (string path in possiblePaths)
        {
            var found = TestResourceLoad(path);
            LogDebug($"  {path}: {(found ? "発見" : "なし")}");
        }
        
        LogDebug("===============================");
    }
    
    /// <summary>
    /// リソース読み込みテスト
    /// </summary>
    private bool TestResourceLoad(string path)
    {
        try
        {
            var obj = Resources.Load<GameObject>(path);
            return obj != null;
        }
        catch (Exception e)
        {
            LogWarning($"[Live2DLoader] リソーステストエラー ({path}): {e.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// 成功通知
    /// </summary>
    void NotifySuccess()
    {
        if (hasNotifiedSuccess) return;
        hasNotifiedSuccess = true;
        
        LogDebug("[Live2DLoader] 成功通知送信");
        
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            NotifyLive2DStatus("success");
            SendMessageToJS("Live2DModelLoaded");
            DebugLog("[Live2DLoader] WebGL通知送信完了");
        }
        catch (Exception e)
        {
            LogWarning($"[Live2DLoader] WebGL通知エラー: {e.Message}");
        }
        #endif
    }
    
    /// <summary>
    /// フォールバック通知
    /// </summary>
    void NotifyFallback()
    {
        LogDebug("[Live2DLoader] フォールバック通知送信");
        
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            NotifyLive2DStatus("fallback");
            ErrorLog("[Live2DLoader] フォールバックモード");
        }
        catch (Exception e)
        {
            LogWarning($"[Live2DLoader] フォールバック通知エラー: {e.Message}");
        }
        #endif
    }
    
    /// <summary>
    /// フォールバック表示
    /// </summary>
    void ShowFallback()
    {
        if (fallbackPrefab != null)
        {
            GameObject fallback = Instantiate(fallbackPrefab, transform);
            fallback.name = "mori_fallback";
            LogDebug("[Live2DLoader] フォールバックPrefab表示");
        }
        else if (fallbackSprite != null)
        {
            GameObject fallbackObj = new GameObject("mori_fallback");
            fallbackObj.transform.SetParent(transform);
            
            SpriteRenderer spriteRenderer = fallbackObj.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = fallbackSprite;
            spriteRenderer.sortingOrder = 100;
            
            LogDebug("[Live2DLoader] フォールバックSprite表示");
        }
        else
        {
            LogWarning("[Live2DLoader] フォールバック素材が設定されていません");
        }
    }
    
    // ========== デバッグ用メソッド ==========
    
    /// <summary>
    /// デバッグログ出力（設定により制御）
    /// </summary>
    private void LogDebug(string message)
    {
        if (enableDebugLogs)
        {
            Debug.Log(message);
        }
    }
    
    /// <summary>
    /// 警告ログ出力
    /// </summary>
    private void LogWarning(string message)
    {
        if (enableDebugLogs)
        {
            Debug.LogWarning(message);
        }
    }
    
    /// <summary>
    /// エラーログ出力
    /// </summary>
    private void LogError(string message)
    {
        Debug.LogError(message);
        #if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            ErrorLog(message);
        }
        catch
        {
            // エラー通知失敗は無視
        }
        #endif
    }
    
    // ========== パブリックAPI ==========
    
    /// <summary>
    /// モデル読み込み状態を取得
    /// </summary>
    public bool IsModelLoaded()
    {
        return isModelLoaded;
    }
    
    /// <summary>
    /// 現在のモデルオブジェクトを取得
    /// </summary>
    public GameObject GetCurrentModel()
    {
        return currentModel;
    }
    
    /// <summary>
    /// CubismModelコンポーネントを取得
    /// </summary>
    public CubismModel GetCubismModel()
    {
        return cubismModel;
    }
    
    /// <summary>
    /// エラー状態を取得
    /// </summary>
    public bool HasError()
    {
        return hasError;
    }
    
    /// <summary>
    /// 最後のエラーメッセージを取得
    /// </summary>
    public string GetLastError()
    {
        return lastErrorMessage;
    }
    
    /// <summary>
    /// 読み込み経過時間を取得
    /// </summary>
    public float GetLoadElapsedTime()
    {
        return Time.time - loadStartTime;
    }
}