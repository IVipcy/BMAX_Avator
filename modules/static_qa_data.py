"""
static_qa_data.py

Mr.永見（ミニ四駆大会・主催運営）向けの静的Q&Aとサジェスチョン。

要求:
- 段階的Phase（密度メーター前提）を廃止し、主要カテゴリを常に提示する
- 回答後は「解決できましたか？（はい/いいえ）」導線を出す
- application.py / rag_system.py から参照される互換関数を提供する
"""

from __future__ import annotations

from typing import Dict, List, Optional
import re

# ==========================================================
# サジェスチョン（主要カテゴリ）
# ==========================================================

MAIN_SECTIONS_JA: List[str] = [
    "モーターのルール",
    "大会特別ルール（企業対抗）",
    "電池の向き・搭載ルール",
    "ボディ（素材／固定／加工）",
    "改造の可否（シャーシ／穴加工／プレート類）",
    "ローラーのルール",
    "ギヤ・駆動のルール",
    "車検（チェックボックス／ゲージ）",
    "失格・注意事項",
]

RESOLUTION_CHOICES_JA: List[str] = [
    "はい（解決した）",
    "いいえ（追加で聞きたい）",
]

# ==========================================================
# 静的Q&A（規則で断言できる頻出だけを固定回答）
# - それ以外はRAG（uploads/knowledge.txt）で拾う
# ==========================================================

STATIC_QA_JA: Dict[str, str] = {
    # モーター
    "使っていいモーター": "結論、タミヤレギュで許可される全てのモーターが使用OKです（主催者が制限する場合あり）。ただし企業対抗選手権は特別ルールで「当日会場購入のトルクチューンモーター」を使用します。[EMOTION:neutral]",
    "モーターを分解": "結論、NGです。モーターを分解して得た部品の使用は認められません。[EMOTION:neutral]",
    "トルクチューン": "結論、企業対抗選手権では必須です。大会特別ルールにより、モーターは「当日会場購入のトルクチューンモーター」を使用してください。[EMOTION:neutral]",
    "企業対抗選手権": "結論、特別ルールがあります。モーターは「当日会場購入のトルクチューンモーター」を使用してください。[EMOTION:neutral]",
    # 電池
    "電池の向き": "結論、シャーシ指定方向以外はNGです。シャーシ逆転使用は禁止です。[EMOTION:neutral]",
    # ボディ
    "ボディキャッチ": "結論、必須です。フロント／リヤともタミヤ製ボディキャッチパーツで固定してください。[EMOTION:neutral]",
    "走行中のボディ脱落": "結論、失格です。走行中にボディが脱落した場合は失格となります。[EMOTION:neutral]",
    # シャーシ加工
    "シャーシの肉抜き": "結論、NGです。シャーシの肉抜き／切断／自作シャーシは認められません。[EMOTION:neutral]",
    "新規ビス穴": "結論、NGです。新規ビス穴の追加は認められません。[EMOTION:neutral]",
    "皿ビス加工": "結論、条件付きでOKです。シャーシやプレート類の既存穴の皿ビス加工は認められます（規則の範囲で）。[EMOTION:neutral]",
    # ローラー
    "ローラー加工": "結論、NGです。ローラーの加工（外周サイズ変更・切削・穴あけ・ベアリング穴拡張等）は認められません。[EMOTION:neutral]",
    "ベアリング交換": "結論、NGです。ローラーの標準装備品と異なるベアリングへの交換は認められません。[EMOTION:neutral]",
    # ギヤ
    "ギヤ加工": "結論、NGです。ギヤの加工は認められません。[EMOTION:neutral]",
    "ギヤ固定": "結論、OKです。接着剤等によるシャフトへのギヤ固定は認められます。[EMOTION:neutral]",
    # マスダンパー
    "マスダンパー形状加工": "結論、NGです。マスダンパーの形状加工は認められません。[EMOTION:neutral]",
    # 解決確認
    "はい（解決した）": "了解です。次はどの項目を確認しますか？[EMOTION:happy]",
    "いいえ（追加で聞きたい）": "了解です。どのパーツ名（商品名でもOK）と、どんな加工内容か教えてください（穴追加/拡張/貫通/皿ビス/切断/肉抜きなど）。[EMOTION:neutraltalking]",
}


def _normalize(text: str) -> str:
    if not text:
        return ""
    return (
        text.lower()
        .replace("　", " ")
        .replace("？", "?")
        .replace("！", "!")
        .strip()
    )


def _contains_any(haystack: str, needles: List[str]) -> bool:
    for n in needles:
        if n and n in haystack:
            return True
    return False


# ==========================================================
# application.py 互換: Phase関連（実質は常に主要カテゴリ）
# ==========================================================

def get_current_phase(selected_count: int) -> str:
    # Phaseは維持するが、実際は単一フェーズ扱い
    return "phase1_overview"


def get_suggestions_for_phase(
    phase: str,
    selected_suggestions: Optional[List[str]] = None,
    user_type: str = "default",
    language: str = "ja",
) -> List[str]:
    selected = selected_suggestions or []
    selected_norm = {_normalize(s) for s in selected}

    if language != "ja":
        # 現状は日本語運用前提（必要なら後で英語化）
        return []

    # 常に主要カテゴリを返す（選択済みは除外）
    main = [s for s in MAIN_SECTIONS_JA if _normalize(s) not in selected_norm]
    if not main:
        main = MAIN_SECTIONS_JA[:]

    # UIで「ボタン」扱いにしたい選択肢も同時に提示できるよう、末尾に付ける
    # （クライアントが単なるsuggestion chipとして描画していても動く）
    return main[:8]


# ==========================================================
# application.py 互換: 回答取得（旧I/F）
# ==========================================================

def get_response_for_user(
    message: Optional[str] = None,
    user_type: str = "default",
    current_phase: str = "phase1_overview",
    language: str = "ja",
    query: Optional[str] = None,
    phase: Optional[str] = None,
):
    if query is not None:
        message = query
    if phase is not None:
        current_phase = phase
    if not message:
        return None

    if language != "ja":
        return None

    msg_norm = _normalize(message)

    # 解決ボタン文言は完全一致で拾う
    for k, v in STATIC_QA_JA.items():
        if _normalize(k) == msg_norm:
            return v

    # 部分一致（短いキーは誤爆しやすいので、キーワード系だけ）
    keyword_map = {
        "モーター": ["モーター", "motor"],
        "電池": ["電池", "バッテリー", "battery"],
        "ボディ": ["ボディ", "ボデー", "body", "ボディキャッチ"],
        "ローラー": ["ローラー", "roller", "プラリング", "ベアリング"],
        "ギヤ": ["ギヤ", "ギア", "gear", "ピニオン"],
        "改造": ["改造", "加工", "肉抜き", "切断", "穴", "皿ビス", "貫通"],
        "車検": ["車検", "検査", "チェックボックス", "ゲージ"],
        "失格": ["失格", "脱落", "危険", "グリス"],
    }
    for category, kws in keyword_map.items():
        if _contains_any(msg_norm, [k.lower() for k in kws]):
            # ここでは静的に「カテゴリ選択を促す」だけにして、詳細はRAGへ回す
            return f"了解です。{category}のどの点が知りたいですか？（具体例: 条件/禁止事項/例外）[EMOTION:neutraltalking]"

    # それ以外は静的回答なし（RAGへ）
    return None


# ==========================================================
# rag_system.py 互換: 静的Q&A（新I/F）
# ==========================================================

def get_static_response_multilang(query: str, language: str = "ja"):
    return get_response_for_user(query, language=language)


def get_staged_response_multilang(query: str, language: str = "ja", stage: Optional[str] = None):
    # 段階別は廃止（互換のため同じ挙動）
    return get_response_for_user(query, language=language)


def get_current_stage(selected_count: int) -> str:
    return "stage1_main"


def get_staged_suggestions_multilang(stage: str, language: str = "ja", selected_suggestions: Optional[List[str]] = None):
    # 段階別は廃止（互換のため主要カテゴリ）
    return get_suggestions_for_phase("phase1_overview", selected_suggestions or [], "default", language)


# ==========================================================
# 既存I/F互換: get_suggestions_for_stage
# ==========================================================

def get_suggestions_for_stage(stage: str, selected_suggestions=None, language: str = "ja"):
    return get_staged_suggestions_multilang(stage, language, selected_suggestions or [])


# ==========================================================
# メディア（今は未使用。後方互換のため残す）
# ==========================================================

qa_media_data: Dict[str, Dict] = {}


def get_qa_media(question: str):
    # 互換: 現状はメディアなし
    return None
