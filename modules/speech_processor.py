# speech_processor.py - 音声認識処理モジュール（Python 3.13対応版）
import os
import base64
import tempfile
import subprocess
from typing import Optional
from openai import OpenAI

# FFmpegのパスを確認
def find_ffmpeg():
    try:
        # ffmpegコマンドの存在を確認
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        print("[WARNING] FFmpegが見つかりません。PATH環境変数にFFmpegのbinディレクトリが含まれているか確認してください。")
        return False

FFMPEG_AVAILABLE = find_ffmpeg()

class SpeechProcessor:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            print("[WARNING] OPENAI_API_KEY が未設定です。音声認識は利用できません。")
        self.client = OpenAI(api_key=api_key) if api_key else OpenAI()
        self.supported_formats = ['webm', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'ogg']
        self.ffmpeg_available = FFMPEG_AVAILABLE
        print(f"[INFO] SpeechProcessor初期化完了 (FFmpeg利用可能: {self.ffmpeg_available})")
    
    def _extract_transcript_text(self, raw):
        """Whisper API の戻り値（str またはオブジェクト）からテキストを取得"""
        if raw is None:
            return ""
        if isinstance(raw, str):
            return raw.strip()
        return (getattr(raw, "text", None) or str(raw)).strip()

    def _normalize_language(self, language) -> Optional[str]:
        """Whisper API 用 ISO-639-1（無効なら None＝自動判定）"""
        if not language:
            return None
        if not isinstance(language, str):
            language = str(language)
        code = language.strip().lower()[:2]
        if len(code) == 2 and code.isalpha():
            return code
        return None

    def _call_whisper(self, path_for_whisper: str, lang_hint: Optional[str]) -> object:
        """Whisper API を呼ぶ（失敗時は language なしで再試行）"""
        prompt = (
            "ミニ四駆、B-MAX GP、ストッククラス、タミヤ、レギュレーション、車検、"
            "モーター、トルクチューン、ローラー、ギヤ、ブレーキ、マスダンパー"
        )
        fname = os.path.basename(path_for_whisper) or "recording.webm"

        def _create(file_obj, use_lang: bool):
            kw = {"model": "whisper-1", "file": (fname, file_obj), "prompt": prompt}
            if use_lang and lang_hint:
                kw["language"] = lang_hint
            return self.client.audio.transcriptions.create(**kw)

        try:
            with open(path_for_whisper, "rb") as f:
                return _create(f, True)
        except Exception as first_err:
            print(f"[WARNING] Whisper 1回目失敗 ({first_err}) — 再試行")
            try:
                with open(path_for_whisper, "rb") as f2:
                    return _create(f2, False)
            except Exception as e2:
                print(f"[WARNING] (fname, file) 形式で失敗 ({e2}) — 生ファイルで再試行")
                with open(path_for_whisper, "rb") as f3:
                    kw = {"model": "whisper-1", "file": f3, "prompt": prompt}
                    return self.client.audio.transcriptions.create(**kw)

    def transcribe_audio(self, audio_base64, language='ja'):
        """Base64エンコードされた音声データをテキストに変換"""
        if not os.getenv("OPENAI_API_KEY", "").strip():
            print("[ERROR] OPENAI_API_KEY 未設定のため音声認識できません")
            return None
        try:
            lang_hint = self._normalize_language(language)
            print(f"[INFO] 音声認識開始 (言語ヒント: {lang_hint or 'auto'})")
            
            # Base64データの検証
            if not audio_base64:
                print("[ERROR] 音声データが空です")
                return None
            
            # データURLスキームの処理
            if audio_base64.startswith('data:'):
                # data:audio/webm;base64,xxxxx の形式から実際のデータを抽出
                try:
                    header, data = audio_base64.split(',', 1)
                    audio_base64 = data
                    print(f"[INFO] データURLヘッダー: {header}")
                except Exception as e:
                    print(f"[ERROR] データURL解析エラー: {e}")
                    return None
            
            # Base64デコード
            try:
                audio_data = base64.b64decode(audio_base64)
                print(f"[OK] Base64デコード成功: [audio_data {len(audio_data)} bytes]")
            except Exception as e:
                print(f"[ERROR] Base64デコードエラー: {e}")
                return None
            
            # 一時ファイルを作成して音声データを保存
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_webm:
                temp_webm.write(audio_data)
                temp_webm_path = temp_webm.name
                print(f"[INFO] 一時ファイル作成: {temp_webm_path}")
            
            temp_wav_path = None
            path_for_whisper = temp_webm_path
            try:
                if self.ffmpeg_available:
                    try:
                        fd, temp_wav_path = tempfile.mkstemp(suffix='.wav')
                        os.close(fd)
                        print("[INFO] FFmpegでWAVに変換中...")
                        subprocess.run([
                            'ffmpeg',
                            '-i', temp_webm_path,
                            '-ar', '16000',
                            '-ac', '1',
                            '-y',
                            temp_wav_path
                        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        print(f"[OK] WAV変換成功: {temp_wav_path}")
                        path_for_whisper = temp_wav_path
                    except (subprocess.SubprocessError, OSError) as e:
                        print(f"[WARNING] FFmpeg変換に失敗 — WebMを直接送信します: {e}")
                        path_for_whisper = temp_webm_path
                else:
                    print("[INFO] FFmpegなし — WebMを Whisper API に直接送信します")

                print("[INFO] Whisper APIに送信中...")
                transcript = self._call_whisper(path_for_whisper, lang_hint)

                text = self._extract_transcript_text(transcript)
                print(f"[OK] 音声認識成功: '{text}'")
                if not text:
                    print("[WARNING] 音声認識結果が空です")
                    return None
                return text

            except Exception as e:
                print(f"[ERROR] 音声処理エラー: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                if hasattr(e, 'response'):
                    print(f"API応答: {e.response}")
                return None

            finally:
                try:
                    if os.path.exists(temp_webm_path):
                        os.unlink(temp_webm_path)
                        print(f"[INFO] 一時ファイル削除: {temp_webm_path}")
                    if temp_wav_path and os.path.exists(temp_wav_path):
                        os.unlink(temp_wav_path)
                        print(f"[INFO] 一時ファイル削除: {temp_wav_path}")
                except Exception as e:
                    print(f"[WARNING] 一時ファイル削除エラー: {e}")
                    
        except Exception as e:
            print(f"[ERROR] 音声認識エラー: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def validate_audio_data(self, audio_base64):
        """音声データの妥当性を検証"""
        # FFmpegが利用できない場合
        if not self.ffmpeg_available:
            return False
            
        try:
            # データURLスキームの確認
            if audio_base64.startswith('data:'):
                header, data = audio_base64.split(',', 1)
                # サポートされている形式かチェック
                if 'audio/' in header:
                    return True
                else:
                    print(f"[ERROR] サポートされていない形式: {header}")
                    return False
            
            # Base64データの基本的な検証
            try:
                decoded = base64.b64decode(audio_base64)
                if len(decoded) < 100:  # 最小サイズチェック
                    print(f"[ERROR] 音声データが小さすぎます: {len(decoded)} バイト")
                    return False
                return True
            except:
                return False
                
        except Exception as e:
            print(f"[ERROR] 音声データ検証エラー: {e}")
            return False
    
    def get_audio_duration(self, audio_base64):
        """音声の長さを取得"""
        # FFmpegが利用できない場合
        if not self.ffmpeg_available:
            return 0
            
        try:
            if audio_base64.startswith('data:'):
                _, data = audio_base64.split(',', 1)
                audio_base64 = data
            
            audio_data = base64.b64decode(audio_base64)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            try:
                # FFmpegを使って長さを取得
                result = subprocess.run([
                    'ffprobe', 
                    '-v', 'error', 
                    '-show_entries', 'format=duration', 
                    '-of', 'default=noprint_wrappers=1:nokey=1', 
                    temp_path
                ], capture_output=True, text=True, check=True)
                
                duration = float(result.stdout.strip())
                return duration
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            print(f"[ERROR] 音声長さ取得エラー: {e}")
            return 0
