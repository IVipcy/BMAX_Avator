"""
static_qa_data.py

Mr.永見（ミニ四駆大会・主催運営）向けの静的Q&Aとサジェスチョン。

分岐はリポジトリ直下の「QA」（Basic-MAX GP 統合レギュレーション QA完全版）の見出し・Qに準拠。
"""

from __future__ import annotations

from typing import Dict, List, Optional

# ==========================================================
# サジェスチョン（主要カテゴリ）— QA の【１】～【９】相当を整理
# ==========================================================

MAIN_SECTIONS_JA: List[str] = [
    "競技車の種類・寸法（タミヤレギュ）",
    "ボディの仕様（B-MAX GP）",
    "モーター・大会特別ルール",
    "電池",
    "改造（シャーシ／ビス穴）",
    "改造（追加パーツ・プレート）",
    "改造（ローラー）",
    "改造（ホイール・タイヤ）",
    "改造（ギヤ・電池受・安全）",
    "競技コース",
    "公認コースでの競技",
    "車体検査（車検）",
    "失格・注意事項",
    "運営・申込・出場制限・免責",
]

# メイン一覧・サブ一覧の最大表示数（ナビ2件を除く）
_MAX_MAIN_SUGGESTIONS = 16
_MAX_SUB_SUGGESTIONS = 12

RESOLUTION_CHOICES_JA: List[str] = [
    "はい（解決した）",
    "いいえ（追加で聞きたい）",
]

BACK_TO_MAIN_JA = "戻る（主要項目へ）"
FREE_INPUT_HINT_JA = "自由入力で具体条件を書く"

# ==========================================================
# サブサジェスチョン（QA の各 Q を短縮ラベル化）
# ==========================================================

SUB_SECTIONS_JA: Dict[str, List[str]] = {
    "競技車の種類・寸法（タミヤレギュ）": [
        "認められるシリーズ",
        "競技・クラスで車種は変わる",
        "自作シャーシ",
        "最大幅・高さ・全長・地上高・重量",
        "タイヤ寸法",
        "ローラー個数（2026特別ルール）",
        "マスダンパー取り付け位置",
        "部品取り付け位置制限",
        "四輪駆動は必須",
    ],
    "ボディの仕様（B-MAX GP）": [
        "ボディの分割無塗装／無ステッカー状態（禁止）",
        "プラスチック・クリヤーボディ",
        "ポリカ・PET（切取線）",
        "ボディキャッチ固定",
        "ボディとシャーシの組合わせ",
        "ウイング・ドライバー人形（未装着が規定）",
        "塗装・ステッカー",
        "ボディパーツの組合せ・接着",
        "肉抜き・メッシュ",
        "肉抜き破損の補修・破損ボディ走行（禁止）",
        "干渉部カット（3mm・主催判断）",
        "アニマル・キャノピー",
        "走行中のボディ脱落",
    ],
    "モーター・大会特別ルール": [
        "【大会特別】当日会場購入トルクチューン",
        "使っていいモーター（通常レギュ）",
        "主催者によるモーター制限",
        "速度制限クラスでのモーター",
        "モーターを分解・改造",
        "企業対抗選手権",
        "トルクチューン",
        "慣らし運転（ならし）",
    ],
    "電池": [
        "使える電池の種類（タミヤ単3・市販状態）",
        "電池ラベル破れ",
        "ラジ四駆・TR-1のアルカリ限定",
        "大会ごとの電池ルール",
        "電池の向き・シャーシ逆転禁止",
    ],
    "改造（シャーシ／ビス穴）": [
        "シャーシの肉抜き・切断",
        "シャーシへのステッカー",
        "標準ビス穴2mm拡張",
        "未貫通ビス穴の貫通加工",
        "皿ビス加工",
        "新規ビス穴の追加",
    ],
    "改造（追加パーツ・プレート）": [
        "追加パーツの種類（タミヤ製のみ）",
        "マスダンパー着色",
        "マルチテープで複数マスダン接合",
        "マスダンパー形状加工",
        "マスダンパー穴拡張",
        "スイング系制振ギミック（提灯等）禁止",
        "スライドダンパー・ボールリンクマスダン",
        "プレート吊り下げ",
        "プレート接着・瞬着強化",
        "プレートのぐらつき取り付け",
        "プレートエッジのテーパー",
        "ランナー・端材利用",
        "HGセッティングボード等の取り付け",
    ],
    "改造（ローラー）": [
        "ローラー個数・サイズ（タミヤレギュ）",
        "ローラー着色",
        "ベアリング交換",
        "プラリング付け替え・異径組合せ",
        "ローラー加工",
        "エッジが鋭いローラー",
    ],
    "改造（ホイール・タイヤ）": [
        "ホイールシャフト貫通（保護必須）",
        "タイヤとホイールの接着",
        "タイヤ加工",
    ],
    "改造（ギヤ・電池受・安全）": [
        "駆動ギヤの組合せ",
        "ギヤ加工",
        "ギヤのシャフト接着固定",
        "電池受金具の改造",
        "タミヤ製以外のブレーキ",
        "ブレーキスポンジ切断・過熱加工",
        "マルチテープ・ゴムパイプ切断",
        "コース汚し・怪我のおそれのある改造",
        "ビス・シャフト飛び出しの保護",
        "ミニ四駆キャッチャー加工パーツ",
        "異なるシャーシとAパーツの組合せ",
        "その他改造の判断",
    ],
    "競技コース": [
        "コース規格の準拠先",
        "B-MAX GP推奨3レーン構成",
    ],
    "公認コースでの競技": [
        "公認コース競技の規定",
    ],
    "車体検査（車検）": [
        "車検の基準",
        "チェックボックス・クリアランスゲージ",
        "充電器・ならし器等の持ち込み禁止",
    ],
    "失格・注意事項": [
        "失格の基準",
        "車検不合格のマシン",
        "走行中のボディ脱落",
        "失格の詳細確認先",
    ],
    "運営・申込・出場制限・免責": [
        "レース運営ルールの準拠",
        "公認イベントでの規約同意",
        "大会ごとのルール差異",
        "スタッフ指示への不従",
        "出場制限の準拠",
        "子どものスイッチ操作・スタート",
        "マシンは参加者本人が組立",
        "参加申し込みの窓口",
        "免責・責任の所在",
    ],
}

# ==========================================================
# 静的Q&A（QA ファイルの判定文を要約）
# ==========================================================

STATIC_QA_JA: Dict[str, str] = {
    # --- 競技車の種類・寸法 ---
    "認められるシリーズ": "結論、レーザーミニ四駆、ミニ四駆REV、PRO、レーサー、スーパー、フルカウル、エアロ、マイティ、ラジ四駆、トラッキンミニ四駆シリーズ等が対象です（タミヤレギュ）。詳細は最新のタミヤ公認競技会規則を確認してください。[EMOTION:neutral]",
    "競技・クラスで車種は変わる": "結論、はい。競技やクラスによって参加可能な車種・シリーズが限定される場合があります（タミヤレギュ）。[EMOTION:neutral]",
    "自作シャーシ": "結論、NGです。自作シャーシの使用は認められません（B-MAX GPレギュ）。[EMOTION:neutral]",
    "最大幅・高さ・全長・地上高・重量": "結論、タミヤレギュに従います。例：最大幅105mm以下（付属品含む全幅）、全高70mm以下、全長165mm以下、最低地上高1mm以上、全装備90g以上等。数値は公式のタミヤレギュで確認してください。[EMOTION:neutral]",
    "タイヤ寸法": "結論、タミヤレギュで前後輪とも直径22〜35mm・幅8〜26mm等の制限があります。タイヤは必ず取り付けること（QA・タミヤレギュ）。[EMOTION:neutral]",
    "ローラー個数（2026特別ルール）": "結論、タミヤレギュに準拠します。QAでは2026年も個数制限なしの特別ルールが言及されています。最新はタミヤ側の公表を確認してください。[EMOTION:neutral]",
    "マスダンパー取り付け位置": "結論、タミヤレギュでウエイト位置等が定められています。QAでは2026年特別ルールにより制限なしとする記載もあります。最新を確認してください。[EMOTION:neutral]",
    "部品取り付け位置制限": "結論、タイヤ外縁より外側の前後輪周辺などに制限があります。ボディのみ装着の部品等は例外あり（タミヤレギュ・QA参照）。[EMOTION:neutral]",
    "四輪駆動は必須": "結論、競技車は四輪駆動であることが規定されています（タミヤレギュ）。[EMOTION:neutral]",
    # --- ボディ ---
    "ボディの分割無塗装／無ステッカー状態（禁止）": "結論、NGです。ボディの分割使用、無塗装・無ステッカー状態での使用は認められません（B-MAX GPレギュ ver4.0s・QA）。公式: https://basic-max.com/2025/12/17/bmaxgp-regu-v4s/ [EMOTION:neutral]",
    "プラスチック・クリヤーボディ": "結論、OKです。プラスティック製ボディ（クリヤーボディ含む）は使用可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ポリカ・PET（切取線）": "結論、OK（条件あり）です。説明図に指定された切取線に従って切断すること（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ボディキャッチ固定": "結論、フロント・リヤともタミヤ製ボディキャッチパーツで固定が必要です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ボディとシャーシの組合わせ": "結論、OKです。ボディとシャーシの組み合わせは自由です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ウイング・ドライバー人形（未装着が規定）": "結論、ウイングは未装着、ドライバー人形も未装着が規定です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "塗装・ステッカー": "結論、OKです。ボディの塗装・ステッカー貼付けは可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ボディパーツの組合せ・接着": "結論、OKです。異なる種類のボディとボディパーツの組合せ・接着は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "肉抜き・メッシュ": "結論、OK（条件あり）です。原型が分かる範囲の肉抜き、メッシュ貼付けは可。過度な肉抜きは禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "肉抜き破損の補修・破損ボディ走行（禁止）": "結論、NGです。接着剤等による補修や、破損ボディでの走行は禁止（怪我防止のため）（B-MAX GPレギュ）。[EMOTION:neutral]",
    "干渉部カット（3mm・主催判断）": "結論、OK（条件あり）です。干渉部分から3mm以内等の条件で、都度主催・運営が判断します（B-MAX GPレギュ）。[EMOTION:neutral]",
    "アニマル・キャノピー": "結論、アニマル用のキャノピー切り抜き・取り外しや見た目のカスタマイズは可。走行中のアニマル脱落は失格になりません（B-MAX GPレギュ）。[EMOTION:neutral]",
    "走行中のボディ脱落": "結論、レース走行中のボディ脱落は失格です（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- モーター ---
    "【大会特別】当日会場購入トルクチューン": "結論、大会特別ルールでは当日会場で購入したトルクチューンモーターを使用すること。通常のモーター規定より優先されます（QA・運用）。[EMOTION:neutral]",
    "使っていいモーター（通常レギュ）": "結論、シャーシ別にタミヤレギュで定められたモーターが使えます（ノーマル、PRO専用、トルクチューン2等）。大会特別ルールがある場合はそちら優先（QA）。[EMOTION:neutral]",
    "主催者によるモーター制限": "結論、要確認です。主催者によりモーターが制限される場合があります（B-MAX GPレギュ）。各大会で確認してください。[EMOTION:neutral]",
    "速度制限クラスでのモーター": "結論、速度制限のある競技・クラスでは、規定モーターでも制限速度を超える場合は使用できません（タミヤレギュ）。[EMOTION:neutral]",
    "モーターを分解・改造": "結論、NGです。モーターの分解・不正改造は禁止。分解した部品の使用も不可です（タミヤレギュ・B-MAX GPレギュ）。[EMOTION:neutral]",
    "企業対抗選手権": "結論、特別ルールがあります。モーターは「当日会場購入のトルクチューンモーター」を使用してください。[EMOTION:neutral]",
    "トルクチューン": "結論、企業対抗では必須です。大会特別ルールに従ってください。[EMOTION:neutral]",
    "慣らし運転（ならし）": "結論、車検・会場ルールに従ってください。モーターならし器等の持ち込みはタミヤレギュで禁止されている場合があります（QA・車検項）。[EMOTION:neutral]",
    # --- 電池 ---
    "使える電池の種類（タミヤ単3・市販状態）": "結論、タミヤ製単3形電池2本を市販状態で使用。タミヤ以外の電池は不可（タミヤレギュ）。現行品例はQA参照。[EMOTION:neutral]",
    "電池ラベル破れ": "結論、NGです。ラベルが破れている電池は使用できません（安全のため）（タミヤレギュ）。[EMOTION:neutral]",
    "ラジ四駆・TR-1のアルカリ限定": "結論、ラジ四駆シリーズおよびTR-1シャーシはタミヤのアルカリ電池のみ使用できます（タミヤレギュ）。[EMOTION:neutral]",
    "大会ごとの電池ルール": "結論、要確認です。大会によって使用電池が限定されたり例外がある場合があります（タミヤレギュ）。[EMOTION:neutral]",
    "電池の向き・シャーシ逆転禁止": "結論、NGです。各種シャーシの指定方向以外への設置は禁止。シャーシの逆転使用も禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- 改造 シャーシ ---
    "シャーシの肉抜き・切断": "結論、NGです。シャーシの肉抜き・切断は認められません（B-MAX GPレギュ）。[EMOTION:neutral]",
    "シャーシへのステッカー": "結論、OKです。ステッカー貼付けは可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "標準ビス穴2mm拡張": "結論、OKです。標準ビス穴の2mm拡張は認められます（B-MAX GPレギュ）。[EMOTION:neutral]",
    "未貫通ビス穴の貫通加工": "結論、OKです。貫通されていない標準ビス穴の貫通加工は認められます（B-MAX GPレギュ）。[EMOTION:neutral]",
    "皿ビス加工": "結論、OKです。全てのビス穴に対して皿ビス加工が可能です（FRP/カーボンの既存穴も可）（B-MAX GPレギュ）。[EMOTION:neutral]",
    "新規ビス穴の追加": "結論、NGです。新規ビス穴の追加は認められません（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- 追加パーツ ---
    "追加パーツの種類（タミヤ製のみ）": "結論、追加部品はタミヤ製のミニ四駆・ラジ四駆・ダンガン用パーツのみ使用可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "マスダンパー着色": "結論、OKです。マスダンパーへの着色は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "マルチテープで複数マスダン接合": "結論、OK（条件あり）です。同一ビス上に配置された複数マスダンパーのマルチテープ接合は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "マスダンパー形状加工": "結論、NGです。マスダンパーの形状加工は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "マスダンパー穴拡張": "結論、原則NGです。長期使用による削れで穴の最大距離が3mm未満なら加工とみなさない等の例外があります（B-MAX GPレギュ・QA）。[EMOTION:neutral]",
    "スイング系制振ギミック（提灯等）禁止": "結論、NGです。提灯・ヒクオ・ノリオ・東北ダンパー等のスイング系制振ギミックは禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "スライドダンパー・ボールリンクマスダン": "結論、OKです。タミヤ製GUPのスライドダンパー・ボールリンクマスダンパーは使用可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "プレート吊り下げ": "結論、OKです。プレート下方への吊り下げ配置は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "プレート接着・瞬着強化": "結論、OKです。複数プレートの接着・瞬間接着剤の浸透強化は認められます（B-MAX GPレギュ）。[EMOTION:neutral]",
    "プレートのぐらつき取り付け": "結論、NGです。ぐらつき取り付けは禁止。GUPスライドダンパーによるスライド稼働は可（B-MAX GPレギュ）。[EMOTION:neutral]",
    "プレートエッジのテーパー": "結論、NGです。各プレート類のエッジのテーパー加工は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ランナー・端材利用": "結論、NGです。パーツ切り離し後のランナー、ポリカボディ端材等の利用は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "HGセッティングボード等の取り付け": "結論、NGです。HGアルミセッティングボード・セッティングゲージ・ピニオンプーラーの競技車への取り付け改造は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- ローラー ---
    "ローラー個数・サイズ（タミヤレギュ）": "結論、タミヤレギュに準拠します。個数は2026年特別ルールの記載あり（QA）。最新を確認してください。[EMOTION:neutral]",
    "ローラー着色": "結論、OKです。ローラーへの着色は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ベアリング交換": "結論、NGです。標準装備品と異なるベアリングへの交換は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "プラリング付け替え・異径組合せ": "結論、NGです。定められた組合せ以外の使用は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ローラー加工": "結論、NGです。外周変更・切削・穴あけ・ベアリング穴拡張等は禁止。長期使用で直径変化が1mm以上も加工とみなす場合があります（B-MAX GPレギュ）。[EMOTION:neutral]",
    "エッジが鋭いローラー": "結論、NGです。過度にエッジが鋭くなったローラーの使用は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- ホイール・タイヤ ---
    "ホイールシャフト貫通（保護必須）": "結論、OK（保護必須）です。飛び出たシャフトはマルチテープ・ゴムパイプ等で保護してください（B-MAX GPレギュ）。[EMOTION:neutral]",
    "タイヤとホイールの接着": "結論、OKです。両面テープ・接着剤等による接着は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "タイヤ加工": "結論、NGです。タイヤの加工は禁止。長期使用で直径変化が1mm以上も加工とみなす場合があります（B-MAX GPレギュ）。[EMOTION:neutral]",
    # --- ギヤ・安全 ---
    "駆動ギヤの組合せ": "結論、定められた組合せで使用が必要です。モーター用ピニオンもシャーシにより定められています（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ギヤ加工": "結論、NGです。ギヤの加工は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ギヤのシャフト接着固定": "結論、OKです。接着剤等によるシャフトへのギヤ固定は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "電池受金具の改造": "結論、NGです。ハンダ付けや金具二枚重ね等は禁止。キット付属またはGUPを説明書通りに使用（B-MAX GPレギュ）。[EMOTION:neutral]",
    "タミヤ製以外のブレーキ": "結論、NGです。タミヤ製GUP以外のブレーキは禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ブレーキスポンジ切断・過熱加工": "結論、タミヤ製GUPブレーキスポンジの切断利用は可。過熱による加工は禁止（B-MAX GPレギュ）。[EMOTION:neutral]",
    "マルチテープ・ゴムパイプ切断": "結論、OKです。タミヤ製GUPのマルチテープ・ゴムパイプの切断利用は可能です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "コース汚し・怪我のおそれのある改造": "結論、NGです。コースや手を傷つける形状、グリス飛散でコースを汚すおそれのある改造は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ビス・シャフト飛び出しの保護": "結論、飛び出しはゴム管やポール等で保護すること。未保護は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "ミニ四駆キャッチャー加工パーツ": "結論、NGです。ミニ四駆キャッチャーを加工したパーツの使用は禁止です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "異なるシャーシとAパーツの組合せ": "結論、OKです。異なるシャーシとAパーツの組合せでの使用は認められます（B-MAX GPレギュ）。[EMOTION:neutral]",
    "その他改造の判断": "結論、要確認です。ここに含まれない改造は主催者の判断により参加が決まります（タミヤレギュ）。[EMOTION:neutral]",
    # --- コース ---
    "コース規格の準拠先": "結論、タミヤレギュに準拠します（QA）。[EMOTION:neutral]",
    "B-MAX GP推奨3レーン構成": "結論、ジャパンカップジュニアサーキット（69506）・ジュニアスロープ（69570）・バンクアプローチ20（69571）を組み合わせた3レーンが推奨です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "公認コース競技の規定": "結論、タミヤレギュに準拠します。B-MAX GP独自の追加規定はありません（QA）。[EMOTION:neutral]",
    # --- 車検 ---
    "車検の基準": "結論、タミヤレギュに準拠し、さらにB-MAX GP競技会規則【１】競技車の規定に準拠する必要があります（QA）。[EMOTION:neutral]",
    "チェックボックス・クリアランスゲージ": "結論、ミニ四駆チェックボックス（95280/95548）とクリアランスゲージ（95613）を用いた車検が推奨されています（B-MAX GPレギュ）。[EMOTION:neutral]",
    "充電器・ならし器等の持ち込み禁止": "結論、NGです。充電器・モーターならし器・モーターチェッカー・バッテリーウォーマー等、引火性スプレー等の持ち込みは禁止です（タミヤレギュ）。[EMOTION:neutral]",
    # --- 失格 ---
    "失格の基準": "結論、タミヤレギュに準拠します。詳細は各レース運営に委ねられます（QA）。[EMOTION:neutral]",
    "車検不合格のマシン": "結論、車検に合格しないマシンは参加できません（タミヤレギュ）。[EMOTION:neutral]",
    "失格の詳細確認先": "結論、要確認です。詳細はレースイベント運営店舗・団体に委ねられます（QA）。[EMOTION:neutral]",
    # --- 運営等 ---
    "レース運営ルールの準拠": "結論、タミヤレギュに準拠します。詳細は各運営店舗・団体に委ねられます（QA）。[EMOTION:neutral]",
    "公認イベントでの規約同意": "結論、B-MAX GP実行委員会公認レースイベントでは「B-MAX GP競技会規則【０】公認競技会規約」への同意が必要です（B-MAX GPレギュ）。[EMOTION:neutral]",
    "大会ごとのルール差異": "結論、要確認です。開催店舗によって微細な差異が生じる場合があります（QA）。[EMOTION:neutral]",
    "スタッフ指示への不従": "結論、NGです。スタッフの指示に従えない場合は退場となる場合があります（タミヤレギュ）。[EMOTION:neutral]",
    "出場制限の準拠": "結論、タミヤレギュに準拠します。詳細は各運営に委ねられます（QA）。[EMOTION:neutral]",
    "子どものスイッチ操作・スタート": "結論、NGです。一人でスイッチのON/OFF・スタートができないお子様の出場はご遠慮ください（タミヤレギュ）。[EMOTION:neutral]",
    "マシンは参加者本人が組立": "結論、競技車は参加者本人が組み立てる必要があります。子どものマシンを大人が組み立て・改造することは禁止です（タミヤレギュ）。[EMOTION:neutral]",
    "参加申し込みの窓口": "結論、要確認です。レースイベントを運営する店舗・団体に委ねられます（QA）。[EMOTION:neutral]",
    "免責・責任の所在": "結論、タミヤレギュの免責に準拠し「主催者」を開催店舗・団体に読み替えます。事故・盗難・怪我等の責任、レギュ抵触の責任は選手側にあります（QA・タミヤレギュ）。[EMOTION:neutral]",
    # --- 解決確認 ---
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


def dedupe_preserve_order(items: List[str]) -> List[str]:
    """重複を除きつつ、先に出た順序を維持する（サジェスチョン階層の判定に必須）。"""
    seen = set()
    out: List[str] = []
    for x in items:
        if not x:
            continue
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _try_keyword_static_response(msg_norm: str) -> Optional[str]:
    """自由入力で頻出する定型を静的に確定。"""
    if not msg_norm:
        return None
    if "分割" in msg_norm and ("無塗装" in msg_norm or "無ステッカー" in msg_norm):
        return STATIC_QA_JA.get("ボディの分割無塗装／無ステッカー状態（禁止）")
    if "分割無塗装" in msg_norm or "分割／無ステッカー" in msg_norm:
        return STATIC_QA_JA.get("ボディの分割無塗装／無ステッカー状態（禁止）")
    return None


def get_navigation_action(message: Optional[str]) -> Optional[str]:
    """サジェスチョンのナビ操作。戻る／自由入力ヒント。"""
    if not message:
        return None
    m = _normalize(message)
    if m == _normalize(BACK_TO_MAIN_JA):
        return "back"
    if m == _normalize(FREE_INPUT_HINT_JA):
        return "free_hint"
    return None


def get_current_phase(selected_count: int) -> str:
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
        return []

    last_selected = None
    for s in reversed(selected):
        if s and _normalize(s) in {_normalize(m) for m in MAIN_SECTIONS_JA}:
            last_selected = s
            break

    if last_selected and last_selected in SUB_SECTIONS_JA:
        subs = [s for s in SUB_SECTIONS_JA[last_selected] if _normalize(s) not in selected_norm]
        if not subs:
            subs = SUB_SECTIONS_JA[last_selected][:]
        return subs[:_MAX_SUB_SUGGESTIONS] + [FREE_INPUT_HINT_JA, BACK_TO_MAIN_JA]

    main = [s for s in MAIN_SECTIONS_JA if _normalize(s) not in selected_norm]
    if not main:
        main = MAIN_SECTIONS_JA[:]
    return main[:_MAX_MAIN_SUGGESTIONS]


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

    for k, v in STATIC_QA_JA.items():
        if _normalize(k) == msg_norm:
            return v

    if msg_norm == _normalize(BACK_TO_MAIN_JA):
        return "承知しました。次に確認する項目を選んでください。[EMOTION:neutral]"

    if msg_norm == _normalize(FREE_INPUT_HINT_JA):
        return "承知しました。パーツ名（商品名でも可）と、加工内容を具体的に入力してください。[EMOTION:neutraltalking]"

    for m in MAIN_SECTIONS_JA:
        if _normalize(m) == msg_norm:
            return "承知しました。下の候補から選択してください。該当がなければ、自由入力で具体条件を入力してください。[EMOTION:neutral]"

    hit = _try_keyword_static_response(msg_norm)
    if hit:
        return hit

    return None


def get_static_response_multilang(query: str, language: str = "ja"):
    return get_response_for_user(query, language=language)


def get_staged_response_multilang(query: str, language: str = "ja", stage: Optional[str] = None):
    return get_response_for_user(query, language=language)


def get_current_stage(selected_count: int) -> str:
    return "stage1_main"


def get_staged_suggestions_multilang(stage: str, language: str = "ja", selected_suggestions: Optional[List[str]] = None):
    return get_suggestions_for_phase("phase1_overview", selected_suggestions or [], "default", language)


def get_suggestions_for_stage(stage: str, selected_suggestions=None, language: str = "ja"):
    return get_staged_suggestions_multilang(stage, language, selected_suggestions or [])


qa_media_data: Dict[str, Dict] = {}


def get_qa_media(question: str):
    return None
