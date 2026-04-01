# AI Avatar Futaba - 京友禅チャットボットシステム

Flaskベースの音声対応AIチャットボットシステム。Unity Live2Dアバター、OpenAI GPT、Azure Speech Service、RAG（Retrieval-Augmented Generation）を統合しています。

## 🚀 主な機能

- **Live2D アバター**: Unityで作成された表情豊かなキャラクター
- **音声会話**: Azure Speech Serviceによる日本語音声合成
- **AI チャット**: OpenAI GPT-4による自然な会話
- **RAG システム**: ChromaDBを使用した知識ベース検索
- **リアルタイム通信**: Socket.IOによる双方向通信
- **データ管理**: 管理画面からパーソナリティや知識を編集可能

## 📦 技術スタック

- **バックエンド**: Flask, Socket.IO, Gunicorn
- **AI/ML**: OpenAI API, LangChain, ChromaDB
- **音声処理**: Azure Speech Service
- **フロントエンド**: HTML, CSS, JavaScript, Unity WebGL
- **データベース**: Supabase
- **デプロイ**: Render.com

## 🔧 ローカル環境構築

### 前提条件

- Python 3.11+
- Git
- OpenAI APIキー
- Azure Speech Serviceキー

### セットアップ手順

1. **リポジトリのクローン**
```bash
git clone https://github.com/IVipcy/Futaba_ver1.0.git
cd Futaba_ver1.0
```

2. **仮想環境の作成と有効化**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

3. **依存関係のインストール**
```bash
pip install -r requirements.txt
```

4. **環境変数の設定**
`.env`ファイルを作成し、以下を設定：
```bash
OPENAI_API_KEY=your_openai_api_key
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=japaneast
AZURE_VOICE_NAME=ja-JP-MayuNeural
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
COEFONT_ENABLED=false
CHROMA_DB_PATH=data/chroma_db
```

5. **アプリケーションの起動**
```bash
python application.py
```

ブラウザで `http://localhost:5000` にアクセス

## 🌐 Render.comへのデプロイ

### 手順

1. **Renderアカウント作成**
   - https://render.com にアクセス
   - GitHubアカウントで登録

2. **新しいWeb Serviceを作成**
   - Dashboard → "New +" → "Web Service"
   - GitHubリポジトリを接続: `https://github.com/IVipcy/Futaba_ver1.0`

3. **基本設定**
   - Name: `ai-avatar-futaba`
   - Region: `Singapore` (日本に最も近い)
   - Branch: `main`
   - Build Command: `bash build.sh`
   - Start Command: `gunicorn application:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 --preload`

4. **環境変数の設定**
   "Environment" タブで以下を追加：
   ```
   OPENAI_API_KEY=your_openai_api_key
   AZURE_SPEECH_KEY=your_azure_speech_key
   AZURE_SPEECH_REGION=japaneast
   AZURE_VOICE_NAME=ja-JP-MayuNeural
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   COEFONT_ENABLED=false
   CHROMA_DB_PATH=data/chroma_db
   ```

5. **永続ディスクの追加**
   - "Disks" タブで新規追加
   - Name: `futaba-persistent-storage`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1GB

6. **デプロイ**
   - "Create Web Service" をクリック
   - 自動的にビルドとデプロイが開始されます

### デプロイ後の確認

- デプロイURLからアプリケーションにアクセス
- ログで起動を確認
- `/health` エンドポイントでヘルスチェック

## 📁 プロジェクト構造

```
Futaba_ver1.0/
├── application.py          # メインアプリケーション
├── wsgi.py                 # WSGIエントリーポイント
├── requirements.txt        # Python依存関係
├── Procfile               # Renderプロセス定義
├── build.sh               # ビルドスクリプト
├── render.yaml            # Render設定ファイル
├── modules/               # アプリケーションモジュール
│   ├── rag_system.py      # RAGシステム
│   ├── speech_processor.py # 音声処理
│   └── openai_tts_client.py # OpenAI TTS
├── templates/             # HTMLテンプレート
├── static/                # 静的ファイル
│   ├── css/
│   ├── js/
│   ├── images/
│   └── unity/             # Unity WebGLビルド
├── data/                  # データベース
│   └── chroma_db/         # ChromaDBデータ
└── uploads/               # アップロードファイル
    ├── personality.txt
    ├── knowledge.txt
    └── responses.txt
```

## 🔐 セキュリティ

- `.env`ファイルは**絶対に**Gitにコミットしないでください
- APIキーは環境変数として管理
- `.gitignore`で機密情報を除外

## 📝 ライセンス

このプロジェクトはプライベートプロジェクトです。

## 👤 コンタクト

Email: suguru.fukushima@congen-ai.com

## 🙏 謝辞

- OpenAI for GPT API
- Microsoft Azure for Speech Service
- Unity Technologies for Live2D support
- Render.com for hosting

