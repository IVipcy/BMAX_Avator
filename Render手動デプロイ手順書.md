# Render.com 手動デプロイ手順書
## AI Avatar CERA - チャットボットシステム

**最終更新日**: 2025年11月19日（ChromaDB問題の解決方法を追加）  
**対象リポジトリ**: https://github.com/IVipcy/CERA_Avator

---

## 📋 目次

1. [事前準備](#事前準備)
2. [Renderアカウント作成・ログイン](#renderアカウント作成ログイン)
3. [Web Service作成](#web-service作成)
4. [基本設定](#基本設定)
5. [環境変数設定](#環境変数設定)
6. [Secret Files設定](#secret-files設定)
7. [デプロイ実行](#デプロイ実行)
8. [永続ディスク追加](#永続ディスク追加)
9. [動作確認](#動作確認)
10. [トラブルシューティング](#トラブルシューティング)

---

## 事前準備

### 必要なもの

✅ GitHubアカウント  
✅ OpenAI APIキー  
✅ Azure Speech Serviceキー（リージョン: japaneast）  
✅ Google Sheets API認証情報（`credentials.json`）  
✅ Google スプレッドシートID  
✅ ElevenLabs APIキー（オプション - 日本語音声用）  
✅ クレジットカード（Render Starterプラン: $7/月）

### 確認事項

- [ ] GitHubリポジトリにコードがプッシュ済み
- [ ] `.gitignore`に以下が含まれている：
  - `venv/`
  - `.env`
  - `credentials.json`
  - `__pycache__/`
- [ ] `requirements.txt`が最新
- [ ] `build.sh`が実行可能
- [ ] `Procfile`が存在する
- [ ] **`runtime.txt`が存在しない**ことを確認 ⚠️ 重要
- [ ] `application.py`が動作確認済み

### ⚠️ 重要な注意事項

**絶対に `runtime.txt` ファイルを作成・プッシュしないでください！**

- Renderのデフォルト環境（Python 3.11.0）で正常に動作します
- `runtime.txt`を追加すると仮想環境のPATH設定が壊れ、gunicornが見つからなくなります
- 環境変数 `PYTHON_VERSION=3.11.0` で管理します

---

## Renderアカウント作成・ログイン

### 手順

1. **Render公式サイトにアクセス**
   ```
   https://render.com
   ```

2. **Sign Upをクリック**
   - 画面右上の「Get Started」または「Sign Up」

3. **GitHubアカウントで登録**
   - 「Sign up with GitHub」を選択
   - GitHubの認証画面で「Authorize Render」をクリック
   - 必要な権限を付与

4. **ダッシュボードにアクセス**
   - 登録完了後、自動的にダッシュボードに遷移

---

## Web Service作成

### 手順

1. **新規サービス作成**
   - Dashboard画面で「**New +**」ボタンをクリック
   - メニューから「**Web Service**」を選択

2. **リポジトリ接続**
   
   **初回の場合（リポジトリが表示されない）:**
   - 「**Configure account**」をクリック
   - GitHubの設定画面に遷移
   - 「Repository access」で以下のいずれかを選択：
     - `All repositories` （すべてのリポジトリ）
     - `Only select repositories` → `CERA_Avator` を選択
   - 「Save」をクリック
   - Renderの画面に戻る

   **リポジトリが表示されている場合:**
   - `IVipcy/CERA_Avator` を探してクリック
   - または検索ボックスで「CERA」と入力

3. **「Connect」をクリック**

---

## 基本設定

次の画面で以下の項目を設定します。

### 1. Name（名前）
```
ai-avatar-cera
```
※この名前がURLの一部になります（例: `https://ai-avatar-cera.onrender.com`）

### 2. Region（リージョン）
```
Singapore
```
※日本から最も近く、レイテンシが低い

### 3. Branch（ブランチ）
```
main
```

### 4. Root Directory（ルートディレクトリ）
```
（空白のまま）
```

### 5. Runtime（ランタイム）
```
Python 3
```
⚠️ **重要**: 必ず「Python 3」を選択してください。Dockerは使用しません。

### 6. Build Command（ビルドコマンド）
```
bash build.sh
```

### 7. Start Command（起動コマンド）

⚠️ **重要**: `web:` プレフィックスは付けません（Procfile用の構文です）

```
gunicorn application:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 --preload --log-level info
```

**必ずポート部分は `$PORT` を使用してください**（Renderが自動で割り当てます）

### 8. Instance Type（インスタンスタイプ）
```
Starter
```
- 月額: **$7**
- RAM: 512MB
- 永続ディスク対応

---

## 環境変数設定

「**Environment Variables**」セクションで、「**Add Environment Variable**」をクリックし、以下をすべて追加します。

### 必須環境変数

| Key | Value | 説明 |
|-----|-------|------|
| `OPENAI_API_KEY` | `sk-proj-xxxxx...` | OpenAI APIキー |
| `AZURE_SPEECH_KEY` | `your-azure-key` | Azure Speech Service キー |
| `AZURE_SPEECH_REGION` | `japaneast` | Azureリージョン（固定） |
| `AZURE_VOICE_NAME` | `ja-JP-NanamiNeural` | Azure音声（女性） |
| `SPREADSHEET_ID` | `1AbC...` | Google スプレッドシートID |
| `AVATAR_NAME` | `Futaba` | アバター名（スプレッドシート識別用） |
| `PYTHON_VERSION` | `3.11.0` | Pythonバージョン（固定） |

### オプション環境変数（ElevenLabs音声 - 推奨）

| Key | Value | 説明 |
|-----|-------|------|
| `ELEVENLABS_API_KEY` | `your-elevenlabs-key` | ElevenLabs APIキー |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` | 音声ID（デフォルト）|
| `ELEVENLABS_ENABLED` | `true` | ElevenLabsを有効化 |

### その他のオプション環境変数

| Key | Value | 説明 |
|-----|-------|------|
| `CHROMA_DB_PATH` | `data/chroma_db` | ChromaDBの保存先 |
| `FLASK_ENV` | `production` | Flask環境設定 |

### トラブルシューティング用環境変数（通常時は不要）

| Key | Value | 説明 |
|-----|-------|------|
| `FORCE_CHROMA_REBUILD` | `true` | ChromaDBを強制削除して再構築 ⚠️ |

⚠️ **`FORCE_CHROMA_REBUILD` の使用方法**:
- **通常時は設定不要です**
- 「データベースの準備ができていません」エラーが出た場合のみ使用
- 設定後に再デプロイすると、古いChromaDBが削除されて新しいDBが作成されます
- データベース再構築後は、**必ずこの環境変数を削除してください**
- 詳細は[トラブルシューティング](#-実行時エラー-データベースの準備ができていません)を参照

### 入力方法

1. 「**Add Environment Variable**」をクリック
2. **Key**: 左の列に変数名を入力（例: `OPENAI_API_KEY`）
3. **Value**: 右の列に値を入力
4. もう一度「**Add Environment Variable**」をクリックして次の変数を追加
5. すべての変数を入力するまで繰り返す

⚠️ **注意**: 
- コピー＆ペースト時に余計なスペースが入らないように注意
- 値は引用符（`"`）なしで入力
- `PYTHON_VERSION` は必ず `3.11.0` にしてください

---

## Secret Files設定

Google Sheets API の認証情報をアップロードします。

### 手順

1. **Secret Filesセクションを探す**
   - Environment Variablesの下にあります
   - 「**Add Secret File**」ボタンをクリック

2. **credentials.json をアップロード**
   
   | 項目 | 値 |
   |------|-----|
   | **Filename** | `credentials.json` |
   | **Contents** | ローカルの `credentials.json` の内容を貼り付け |

3. **保存**
   - 「Save」をクリック

⚠️ **重要**: 
- `credentials.json` は絶対にGitにプッシュしないでください
- `.gitignore` に `credentials.json` が含まれていることを確認

---

## デプロイ実行

### 手順

1. **設定内容を確認**
   - すべての項目が正しく入力されているか確認
   - 環境変数が最低7個（必須のみの場合）設定されているか確認
   - Secret Files に `credentials.json` が追加されているか確認

2. **「Create Web Service」をクリック**
   - 青色の大きなボタンです

3. **ビルド開始**
   - 自動的にビルドプロセスが開始されます
   - ログがリアルタイムで表示されます

4. **ビルド完了を待つ**
   - 初回ビルドは **7〜12分** かかります
   - ログに以下が表示されれば成功：
     ```
     ==> Build successful 🎉
     ==> Deploying...
     ==> Your service is live 🎉
     ```

### ログで確認すべきポイント

✅ Pythonバージョンが3.11.0であること  
✅ `📦 requirements.txtから依存関係をインストール中...` が表示されること  
✅ `Successfully installed ... gunicorn-21.2.0 ...` が表示されること  
✅ ChromaDB、langchain がインストールされていること  
✅ Gunicornが起動していること  
✅ `gunicorn: command not found` エラーが**出ていない**こと  

---

## 永続ディスク追加

**重要**: データ（ChromaDB、アップロードファイル）を永続化するために必須です。

### 手順

1. **デプロイ完了を確認**
   - サービスが「Live」状態になっていることを確認

2. **Settings タブをクリック**
   - 画面上部のタブから「Settings」を選択

3. **Disks セクションまでスクロール**
   - 左メニューまたはページ内の「Disks」セクションを探す

4. **「Add Disk」をクリック**

5. **ディスク設定を入力**
   
   | 項目 | 値 |
   |------|-----|
   | **Name** | `cera-data` |
   | **Mount Path** | `/opt/render/project/src/data` |
   | **Size** | `1` GB |

6. **「Save」をクリック**

7. **自動再起動**
   - ディスク追加後、サービスが自動的に再起動します
   - 再起動完了まで1〜2分待ちます

### 確認方法

- Logsタブで以下のようなメッセージを確認：
  ```
  ==> Mounting disk cera-data to /opt/render/project/src/data
  ```

---

## 動作確認

### 1. デプロイURLを確認

サービス名の下に表示されているURLをクリック：
```
https://ai-avatar-cera.onrender.com
```

### 2. ヘルスチェック

ブラウザで以下にアクセス：
```
https://ai-avatar-cera.onrender.com/health
```

**期待される応答**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-19T12:00:00"
}
```

### 3. アプリケーション動作確認

1. メインページにアクセス
2. チャット機能が動作するか確認
3. 音声再生が動作するか確認
4. Live2Dアバターが表示されるか確認
5. アンケート機能が動作するか確認（Google Sheets連携）

### 4. ログ確認

「**Logs**」タブでエラーがないか確認：
```
✅ No critical errors
✅ Gunicorn workers running
✅ Socket.IO connected
✅ ElevenLabs初期化完了（または Azure Speech Service初期化完了）
```

---

## トラブルシューティング

### ❌ ビルドエラー: "failed to read dockerfile"

**原因**: RuntimeがDockerに設定されている  
**解決**: Settings → Runtimeを「Python 3」に変更

---

### ❌ ビルドエラー: "requirements.txt not found"

**原因**: Root Directoryの設定が間違っている  
**解決**: Settings → Root Directoryを空白にする

---

### ❌ 起動エラー: "gunicorn: command not found" 🔥 最重要

**これが今回のデプロイで起きた問題です！**

**原因1**: `runtime.txt` ファイルが存在する  
**解決1**: 
1. ローカルで `runtime.txt` を削除
2. Gitにコミット＆プッシュ
   ```bash
   git rm runtime.txt
   git commit -m "Remove runtime.txt"
   git push origin main
   ```
3. Renderで Manual Deploy

**原因2**: Start Commandに `web:` プレフィックスがある  
**解決2**: Start Commandを確認（`web:` は不要）：
```
gunicorn application:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 --preload --log-level info
```

**原因3**: Procfileに絶対パスが書かれている  
**解決3**: Procfileを以下に修正：
```
web: gunicorn application:app --bind 0.0.0.0:8000 --workers 1 --threads 4 --timeout 120 --preload
```

**デバッグ方法**:
1. ログで `Successfully installed ... gunicorn-21.2.0 ...` が表示されているか確認
2. 表示されていない場合は `requirements.txt` にgunicornがあるか確認
3. 表示されているのにエラーが出る場合は上記の原因1〜3を確認

---

### ❌ 起動エラー: "Module 'application' not found"

**原因**: Start Commandが間違っている  
**解決**: Settings → Start Commandを確認：
```
gunicorn application:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 --preload --log-level info
```

---

### ❌ 実行時エラー: "OpenAI API key not found"

**原因**: 環境変数が設定されていない  
**解決**: 
1. Settings → Environment Variables
2. `OPENAI_API_KEY` が正しく設定されているか確認
3. 変更後、「Manual Deploy」で再デプロイ

---

### ❌ Google Sheets API エラー

**原因**: credentials.json が設定されていない  
**解決**:
1. Settings → Secret Files
2. `credentials.json` が追加されているか確認
3. ファイル名が正確に `credentials.json` か確認
4. 環境変数 `SPREADSHEET_ID` が設定されているか確認

---

### ❌ データが消える

**原因**: 永続ディスクが設定されていない  
**解決**: [永続ディスク追加](#永続ディスク追加)を参照

---

### ❌ 503 Service Unavailable

**原因**: サービスがまだ起動中、またはクラッシュ  
**解決**:
1. Logsタブでエラーを確認
2. 必要に応じて「Manual Deploy」で再デプロイ
3. それでも解決しない場合は環境変数を再確認

---

### ❌ 音声が再生されない

**原因1**: Azure Speech Serviceの設定エラー  
**解決1**:
1. `AZURE_SPEECH_KEY` が正しいか確認
2. `AZURE_SPEECH_REGION` が `japaneast` になっているか確認
3. `AZURE_VOICE_NAME` が `ja-JP-NanamiNeural` になっているか確認

**原因2**: ElevenLabsの設定エラー  
**解決2**:
1. `ELEVENLABS_API_KEY` が正しいか確認
2. `ELEVENLABS_ENABLED` が `true` になっているか確認
3. Logsで「ElevenLabs初期化完了」が表示されているか確認

---

### ❌ 実行時エラー: "データベースの準備ができていません" 🔥 重要

**これが今回のChromaDB問題で起きたエラーです！**

**症状**:
- アプリは正常に起動する
- チャットで任意のメッセージを送信すると以下のエラーが表示される：
  ```
  [Emotion:neutral] 申し訳ございません。現在、知識データベースを初期化しています。
  通常は数秒で完了しますので、10秒ほど待ってからもう一度お試しください。
  すぐにお答えできるようになります！
  ```
- 何秒待っても改善しない

**原因**: Persistent Diskに古いChromaDBが残っており、バージョン不整合が発生  
- RenderのPersistent Diskはデプロイを跨いで保持される
- ChromaDBのバージョンが変わると、古いデータベースと互換性がなくなる
- ログに以下のようなエラーが表示される：
  ```
  ValueError: An instance of Chroma already exists for data/chroma_db with different settings
  sqlite3.OperationalError: no such column: collections.topic
  ```

**解決方法**:

**ステップ1: 環境変数を追加**
1. Render Dashboard → 対象サービス → Settings
2. Environment Variables セクションまでスクロール
3. 「Add Environment Variable」をクリック
4. 以下を入力：
   - **Key**: `FORCE_CHROMA_REBUILD`
   - **Value**: `true`
5. 「Save Changes」をクリック

**ステップ2: 手動デプロイを実行**
1. Render Dashboard画面に戻る
2. 「Manual Deploy」ボタンをクリック
3. 「Deploy latest commit」を選択
4. デプロイログを確認：
   ```
   🔄 FORCE_CHROMA_REBUILD=trueが検出されました。データベースを強制削除します...
   ✅ データベースディレクトリを削除しました
   📁 新しいデータベースディレクトリを作成しました
   ```

**ステップ3: 動作確認**
1. デプロイ完了後、アプリにアクセス
2. チャットで任意のメッセージを送信
3. 正常に応答が返ってくることを確認

**ステップ4: 環境変数を削除（必須）**
1. Settings → Environment Variables
2. `FORCE_CHROMA_REBUILD` の右側にある「×」または「Delete」をクリック
3. 「Save Changes」をクリック
4. ⚠️ **削除しないと、次回デプロイ時に毎回データベースが削除されます**

**予防策**:
- この問題は、ローカル環境では発生せず、本番環境のPersistent Diskでのみ発生します
- 通常のデプロイでは問題ありませんが、ChromaDBバージョンを更新する際は注意が必要です
- `FORCE_CHROMA_REBUILD` を常に設定する必要はありません（エラー時のみ）

**デバッグ方法**:
1. Logsタブで ChromaDB 関連のエラーを確認
2. `ValueError: An instance of Chroma already exists` が出ていれば、この問題です
3. `sqlite3.OperationalError: no such column` が出ていれば、バージョン不整合です

---

## 再デプロイ方法

コードを更新した場合の再デプロイ手順：

### 自動デプロイ（推奨）

1. ローカルでコードを修正
2. Gitにコミット＆プッシュ
   ```bash
   git add .
   git commit -m "Update message"
   git push origin main
   ```
3. Renderが自動的にビルド＆デプロイ

### 手動デプロイ

1. Render Dashboard → 対象サービスをクリック
2. 「**Manual Deploy**」ボタンをクリック
3. 「Deploy latest commit」を選択

---

## 環境変数の更新方法

1. Settings → Environment Variables
2. 変更したい変数の「Edit」をクリック
3. 新しい値を入力
4. 「Save Changes」をクリック
5. サービスが自動的に再起動

---

## コスト管理

### Starter プラン: $7/月

- 512MB RAM
- 永続ディスク 1GB
- 自動スリープなし（常時稼働）

### 無料期間

- 初回サインアップ時に $5 のクレジット付与
- クレジット期間中は実質無料

### 支払い方法

1. Dashboard → Account Settings
2. Billing タブ
3. クレジットカード情報を登録

---

## セキュリティ推奨事項

### ✅ 必須対応

- [ ] 環境変数に機密情報を保存（ハードコードしない）
- [ ] `.env` と `credentials.json` を `.gitignore` に追加
- [ ] GitHubのSecret Scanningを有効化
- [ ] 定期的にAPIキーをローテーション

### ✅ 推奨対応

- [ ] カスタムドメインの設定（オプション）
- [ ] HTTPSの使用（Renderはデフォルトで有効）
- [ ] ログの定期確認
- [ ] エラー通知の設定

---

## ファイル構成チェックリスト

デプロイ前に以下を確認：

### ✅ 必須ファイル

- [ ] `application.py` - メインアプリケーション
- [ ] `requirements.txt` - Python依存関係（gunicorn含む）
- [ ] `build.sh` - ビルドスクリプト
- [ ] `Procfile` - プロセス定義
- [ ] `.gitignore` - Git除外設定

### ❌ 作成・プッシュ禁止

- [ ] `runtime.txt` - **絶対に作成しないこと**
- [ ] `credentials.json` - Secret Filesで管理
- [ ] `.env` - 環境変数で管理
- [ ] `__pycache__/` - Pythonキャッシュ

### 📝 Procfile の正しい内容

```
web: gunicorn application:app --bind 0.0.0.0:8000 --workers 1 --threads 4 --timeout 120 --preload
```

**注意**: 
- `web:` プレフィックスは必要（Procfile用）
- ポートは固定（8000）でOK
- Start Commandとは異なります

---

## サポート・問い合わせ

### Render公式サポート

- ドキュメント: https://render.com/docs
- コミュニティ: https://community.render.com
- トラブルシューティング: https://render.com/docs/troubleshooting-deploys

### プロジェクト担当者

- Email: suguru.fukushima@congen-ai.com
- GitHub: https://github.com/IVipcy/CERA_Avator

---

## チェックリスト（完了確認用）

デプロイ完了後、以下をすべてチェック：

### デプロイ設定
- [ ] Runtimeが「Python 3」
- [ ] Build Commandが `bash build.sh`
- [ ] Start Commandが正しい（`web:` なし、`$PORT` 使用）
- [ ] `runtime.txt` が存在しない

### 環境変数（必須7個）
- [ ] `OPENAI_API_KEY`
- [ ] `AZURE_SPEECH_KEY`
- [ ] `AZURE_SPEECH_REGION`
- [ ] `AZURE_VOICE_NAME`
- [ ] `SPREADSHEET_ID`
- [ ] `AVATAR_NAME`
- [ ] `PYTHON_VERSION`

### Secret Files
- [ ] `credentials.json` がアップロード済み

### サービス状態
- [ ] サービスが「Live」状態
- [ ] URLにアクセスできる
- [ ] `/health`エンドポイントが正常応答
- [ ] ログに `gunicorn: command not found` エラーがない

### 機能確認
- [ ] チャット機能が動作
- [ ] 音声再生が動作
- [ ] Live2Dアバターが表示
- [ ] アンケート機能が動作（Google Sheets連携）

### ディスク設定
- [ ] 永続ディスクが追加済み
- [ ] Mount Pathが `/opt/render/project/src/data`

---

## デプロイ成功の最終確認

ログで以下が表示されていれば完璧です：

```
✅ Python 3.11.0
✅ 📦 requirements.txtから依存関係をインストール中...
✅ Collecting gunicorn==21.2.0
✅ Successfully installed ... gunicorn-21.2.0 ...
✅ 📦 ChromaDB関連をインストール中...
✅ 🎉 ビルド完了！
✅ ==> Build successful 🎉
✅ ==> Deploying...
✅ ==> Your service is live 🎉
```

---

**デプロイ成功おめでとうございます！🎉**

このドキュメントは実際のデプロイ経験に基づいて作成されました。  
特に以下の問題の解決方法は、実際のトラブルシューティング結果を反映しています：
- 「gunicorn: command not found」エラー
- 「データベースの準備ができていません」エラー（ChromaDB問題）
