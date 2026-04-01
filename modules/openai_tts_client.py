# openai_tts_client.py
import os
import base64
import re
from openai import OpenAI

class OpenAITTSClient:
    def __init__(self):
        self.client = OpenAI()
        
        # かわいい女性の声を固定で使用
        self.voice = "nova"  # 明るく元気な女性の声
        self.speed = 1.3   # 速めで快活な印象（1.15→1.3に変更）
    
    def normalize_text_for_speech(self, text):
        """音声生成用テキスト正規化
        
        句読点後の英語ノイズや制御文字、タグを削除
        
        Args:
            text: 元のテキスト
        
        Returns:
            str: 正規化されたテキスト
        """
        if not text:
            return ""
        
        normalized_text = text
        
        # 1. [EMOTION:xxx]などのタグを完全に削除
        normalized_text = re.sub(r'\[.*?\]', '', normalized_text)
        
        # 2. 制御文字を削除
        normalized_text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', normalized_text)
        
        # 3. 句読点の前後の空白を削除
        normalized_text = re.sub(r'\s*([、。！？])\s*', r'\1', normalized_text)
        
        # 4. 句読点の直後に英単語がある場合は削除（ノイズ対策）★重要★
        # 例: "です。not existent" → "です。"
        # 複数の英単語にも対応
        normalized_text = re.sub(r'([、。])\s*[a-zA-Z\s]+(?=[、。]|\s*$)', r'\1', normalized_text)
        
        # 5. 記号の正規化
        normalized_text = normalized_text.replace('...', '。')
        normalized_text = normalized_text.replace('…', '。')
        
        # 6. 連続する句読点を整理
        normalized_text = re.sub(r'[、。]{2,}', '。', normalized_text)
        
        # 7. 連続する空白を単一スペースに
        normalized_text = re.sub(r'\s+', ' ', normalized_text)
        
        # 8. 前後の空白を削除
        normalized_text = normalized_text.strip()
        
        return normalized_text
    
    def generate_audio(self, text, voice=None, emotion_params=None):
        """テキストから音声を生成"""
        try:
            # テキストを正規化（英語ノイズ除去）
            normalized_text = self.normalize_text_for_speech(text)
            
            # デバッグ用：正規化前後のテキストを表示
            if text != normalized_text:
                print(f"📝 [OpenAI TTS] テキスト正規化:")
                print(f"   元: {text[:80]}{'...' if len(text) > 80 else ''}")
                print(f"   後: {normalized_text[:80]}{'...' if len(normalized_text) > 80 else ''}")
            
            # 常に同じ声を使用（感情による変化なし）
            response = self.client.audio.speech.create(
                model="tts-1-hd",  # 高品質モデル
                voice=self.voice,
                input=normalized_text,  # 正規化されたテキストを使用
                speed=self.speed
            )
            
            # 音声データをBase64エンコード
            audio_data = base64.b64encode(response.content).decode('utf-8')
            return f"data:audio/mp3;base64,{audio_data}"
            
        except Exception as e:
            print(f"音声生成中にエラーが発生しました: {e}")
            return None