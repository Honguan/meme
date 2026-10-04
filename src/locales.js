// Source-language keys keep domain values and imported card data independent of UI language.
const rows = `
收藏卡牌|Favorite card|カードをお気に入りに追加|Añadir carta a favoritos
取消收藏|Remove favorite|お気に入りから削除|Quitar de favoritos
只看收藏|Favorites only|お気に入りのみ|Solo favoritos
收藏格式無效|Invalid favorites|お気に入りの形式が無効です|Favoritos no válidos
匯入後取代目前卡組、已保存卡組、自訂卡庫與收藏。|Import replaces the current deck, saved decks, custom library and favorites.|インポートすると現在のデッキ、保存済みデッキ、カスタムカードとお気に入りが置き換わります。|La importación sustituye el mazo actual, los mazos guardados, las cartas personalizadas y los favoritos.
也會從目前及所有已保存卡組移除這張卡，並取消收藏。|This card will also be removed from the current deck, all saved decks and favorites.|現在のデッキ、すべての保存済みデッキとお気に入りからもこのカードを削除します。|Esta carta también se eliminará del mazo actual, de todos los guardados y de los favoritos.
存檔無法讀取|Save could not be read|セーブを読み込めません|No se puede leer la partida guardada
原始存檔恢復|Recover original save|元のセーブを復旧|Recuperar guardado original
下載原始存檔|Download original save|元のセーブをダウンロード|Descargar guardado original
覆寫為預設卡組|Overwrite with default deck|初期デッキで上書き|Sobrescribir con el mazo inicial
原始存檔已保留。覆寫後無法還原，請先下載原始存檔。|The original save is preserved. Download it before overwriting; overwriting cannot be undone.|元のセーブは保持されています。上書きは元に戻せないため、先にダウンロードしてください。|El guardado original se conserva. Descárgalo antes de sobrescribirlo; la sobrescritura no se puede deshacer.
已保存卡組|Saved decks|保存済みデッキ|Mazos guardados
選擇卡組|Select a deck|デッキを選択|Seleccionar mazo
卡組名稱|Deck name|デッキ名|Nombre del mazo
保存卡組|Save deck|デッキを保存|Guardar mazo
還原已保存卡組|Restore saved deck|保存済みデッキを復元|Restaurar mazo guardado
還原已保存卡組？|Restore this saved deck?|保存済みデッキを復元しますか？|¿Restaurar este mazo guardado?
目前卡組與名稱修改將被已保存版本取代。|Current deck and name edits will be replaced by the saved version.|現在のデッキと名前の変更は保存済みの内容に置き換わります。|Los cambios actuales del mazo y su nombre se sustituirán por la versión guardada.
確認還原|Confirm restore|復元を確認|Confirmar restauración
卡組已還原|Deck restored|デッキを復元しました|Mazo restaurado
刪除已保存卡組|Delete saved deck|保存済みデッキを削除|Eliminar mazo guardado
刪除已保存卡組？|Delete this saved deck?|保存済みデッキを削除しますか？|¿Eliminar este mazo guardado?
覆寫已保存卡組？|Overwrite this saved deck?|保存済みデッキを上書きしますか？|¿Sobrescribir este mazo guardado?
確認覆寫|Confirm overwrite|上書きを確認|Confirmar sobrescritura
卡組已保存|Deck saved|デッキを保存しました|Mazo guardado
卡組草稿已保存|Deck draft saved|デッキの下書きを保存しました|Borrador del mazo guardado
重新命名卡組|Rename deck|デッキ名を変更|Renombrar mazo
已有同名卡組|A deck with this name already exists.|同じ名前のデッキが存在します。|Ya existe un mazo con este nombre.
卡組已重新命名|Deck renamed|デッキ名を変更しました|Mazo renombrado
最多保存 20 組卡組|You can save up to 20 decks.|保存できるデッキは20組までです。|Puedes guardar hasta 20 mazos.
最多保存 1000 張自訂卡牌|You can save up to 1000 custom cards.|保存できるカスタムカードは1000枚までです。|Puedes guardar hasta 1000 cartas personalizadas.
卡組名稱需為 1 至 48 字|Deck name must contain 1 to 48 characters.|デッキ名は1～48文字にしてください。|El nombre debe tener entre 1 y 48 caracteres.
已保存卡組格式無效或超過 20 組|Saved decks are invalid or exceed 20 decks.|保存済みデッキが無効か20組を超えています。|Los mazos guardados no son válidos o superan 20.
已保存卡組 ID 無效|Invalid saved deck ID|保存済みデッキのIDが無効です|ID de mazo guardado no válido
已保存卡組 ID 重複|Duplicate saved deck ID|保存済みデッキのIDが重複しています|ID de mazo guardado duplicado
也會從目前及所有已保存卡組移除這張卡。|This card will also be removed from the current deck and all saved decks.|現在のデッキとすべての保存済みデッキからもこのカードを削除します。|Esta carta también se eliminará del mazo actual y de todos los guardados.
組已保存卡組。匯入後取代目前卡組、已保存卡組與自訂卡庫。|saved decks. Import replaces the current deck, saved decks and custom library.|組の保存済みデッキ。現在のデッキ、保存済みデッキとカスタム図鑑を置き換えます。|mazos guardados. La importación reemplaza el mazo actual, los guardados y la biblioteca personalizada.
線上匹配|Online matchmaking|オンラインマッチ|Emparejamiento en línea
匹配對戰|Find opponent|対戦相手を探す|Buscar rival
開始匹配|Find a match|マッチング開始|Buscar partida
取消匹配|Cancel search|検索を中止|Cancelar búsqueda
尋找對手中|Searching for an opponent|対戦相手を検索中|Buscando rival
正在連線|Connecting|接続中|Conectando
連線中斷，正在重試|Connection lost. Reconnecting.|接続が切れました。再接続中。|Conexión perdida. Reconectando.
輪到你部署|Your turn|あなたの配置ターン|Tu turno
等待對手部署|Opponent's turn|相手の配置ターン|Turno del rival
對手暫時離線|Opponent disconnected|相手が一時切断|Rival desconectado
離開對局|Leave match|対戦を退出|Salir de la partida
離開對局？|Leave this match?|対戦を退出しますか？|¿Salir de la partida?
離開會判負。|Leaving counts as a loss.|退出すると敗北になります。|Salir cuenta como derrota.
確認離開|Leave|退出する|Salir
返回對戰|Back to duels|対戦に戻る|Volver a duelos
對手獲勝|Opponent wins|相手の勝利|El rival gana
對手已離開|A player left the match.|プレイヤーが退出しました。|Un jugador abandonó la partida.
對局|Match|対戦|Partida
自由卡組 · 20 LP · 每次部署 90 秒|Open decks · 20 LP · 90 seconds per turn|自由デッキ · 20 LP · 配置は各90秒|Mazos libres · 20 LP · 90 segundos por turno
自訂卡可參戰；場地採先進入佇列的玩家設定。|Custom cards allowed. The first queued player chooses the field.|カスタムカード使用可。先に待機したプレイヤーのフィールド設定を使用。|Se permiten cartas personalizadas. El primer jugador elige el campo.
匹配服務暫時無法連線|Matchmaking is temporarily unavailable.|マッチングに接続できません。|Emparejamiento no disponible temporalmente.
無法儲存對局連線|Unable to save the match session.|対戦セッションを保存できません。|No se puede guardar la sesión.
連線憑證無效|Invalid match credential.|対戦の接続情報が無効です。|Credencial de partida no válida.
對局已更新，請重試|Match updated. Try again.|対戦が更新されました。再試行してください。|Partida actualizada. Inténtalo de nuevo.
調整站位|Reposition|配置変更|Cambiar posición
台詞或備註|Quote or note|セリフやメモ|Frase o nota
對戰|Duel|対戦|Duelo
角色區|Unit zone|ユニットゾーン|Zona de unidades
魔法區|Spell zone|魔法ゾーン|Zona de hechizos
場地區|Field zone|フィールドゾーン|Zona de campo
牌庫|Deck|デッキ|Mazo
墓地|Discard|墓地|Descarte
尚無棄牌|No discarded cards|墓地にカードはありません|No hay cartas descartadas
卡牌詳情|Card details|カード詳細|Detalles de la carta
取消選擇|Clear selection|選択解除|Cancelar selección
已取消|Cancelled|キャンセル済み|Cancelado
位置無效|Invalid position|無効な位置|Posición no válida
這個位置已有角色|This position is occupied.|この位置にはユニットがいます。|Esta posición está ocupada.
角色要放在自己的角色區|Use your own unit zone.|自分のユニットゾーンに置いてください。|Usa tu zona de unidades.
陷阱要放在空的陷阱區|Use an empty trap zone.|空いている罠ゾーンに置いてください。|Usa una zona de trampas vacía.
場地卡要放在場地區|Use the field zone.|フィールドゾーンに置いてください。|Usa la zona de campo.
這張卡不能指定這個目標|This card cannot target that unit.|このユニットは対象にできません。|Esta carta no puede elegir esa unidad.
裝備要交給自己的角色|Choose one of your units.|自分のユニットを選んでください。|Elige una de tus unidades.
這裡不能發動這張卡|This card cannot be played here.|ここではこのカードを使えません。|Esta carta no se puede jugar aquí.
只能調整自己的角色位置|Only your units can be repositioned.|移動できるのは自分のユニットだけです。|Solo puedes mover tus unidades.
放開出牌|Ready to play|プレイ可能|Lista para jugar
同陣營角色湊滿 2 名或 3 名就有加成，重複卡也算。角色離場後重新計算，已拿到的能量、手牌與護盾不會收回。|Two or three units of one faction unlock set bonuses. Copies count too. Bonuses are recalculated when a unit leaves; energy, cards and shields already gained remain.|同陣営のユニットが2体・3体揃うとセット効果が発動。同じカードも数えます。退場時に再計算しますが、獲得したエネルギー・手札・シールドは残ります。|Dos o tres unidades de la misma facción activan bonificaciones. Las copias cuentan. Al salir una unidad se recalculan, pero conservas la energía, las cartas y los escudos obtenidos.
所有角色碰撞速度提升 35%。|All units gain 35% collision speed.|全ユニットの衝突速度が 35% 上昇。|Todas las unidades ganan un 35% de velocidad de choque.
笑著，撐過這一回合。|Smile through this round.|笑顔で、このラウンドを乗り切ろう。|Sonríe y aguanta esta ronda.
有些人，只想看場地燃燒。|Some just want to watch the arena burn.|ただフィールドが燃えるのを見たい者もいる。|Algunos solo quieren ver arder la arena.
這個不要。這個可以。|Not this. Yes, this.|これはダメ。こっちはいい。|Este no. Este sí.
你說你的，我打我的。|You talk. I'll keep fighting.|そっちは話してて。こっちは戦う。|Tú habla. Yo sigo luchando.
你的下一步，我已經做完了。|I've already made your next move.|君の次の一手なら、もう終えた。|Tu próximo movimiento ya lo he hecho.
你 的 傷 害 也 就 這 樣。|Is that all the damage you've got?|そ の ダ メ ー ジ、そ れ だ け？|¿Eso es todo el daño que tienes?
看不到我，看不到我。|You can't see me. You can't see me.|見えてない、見えてない。|No me ves. No me ves.
再打一次，就一次。|One more hit. Just one.|もう一発。あと一発だけ。|Un golpe más. Solo uno.
這一杯，敬你的連攜。|A toast to your combo.|この一杯を、君の連携に。|Brindo por tu combo.
規則之外，還有更多可能。|There is more beyond the rules.|ルールの外にも、可能性はある。|Más allá de las reglas hay más posibilidades.
回去，現在。|Go back. Now.|戻れ。今すぐ。|Vuelve. Ahora.
裂了？貼起來就好了。|Broken? Tape it back together.|壊れた？貼り直せばいい。|¿Roto? Pégalo y listo.
我拿能量，你拿勝利。|I get energy. You get the win.|エネルギーは私に。勝利は君に。|Yo gano energía. Tú ganas la partida.
兩個梗，一個夢。|Two memes. One dream.|二つのミーム、一つの夢。|Dos memes. Un sueño.
你的攻擊，我收到了。|Your attack has been received.|君の攻撃、受け取った。|He recibido tu ataque.
竟然真的打過來了。|You actually attacked.|本当に攻撃してきた。|De verdad has atacado.
這回合，誰都別想帶走我。|Nobody takes me down this round.|このラウンド、誰にも倒させない。|Nadie me derriba esta ronda.
優雅，而且有點痛。|Elegant. And a little painful.|優雅で、ちょっと痛い。|Elegante. Y un poco doloroso.
改變主意？先打穿這面盾。|Change my mind? Break this shield first.|考えを変えろ？まずはこの盾を破れ。|¿Cambiar de opinión? Primero rompe este escudo.
一切都很好。真的。|Everything is fine. Really.|すべて順調。本当に。|Todo está bien. De verdad.
兩名同陣營角色，融合升級。|Fuse two units of the same faction into an upgrade.|同陣営の二体を融合して強化。|Fusiona dos unidades de la misma facción para mejorarlas.
迷因亂鬥|Meme Clash|ミームクラッシュ|Duelo de memes
語言與色系|Language & appearance|言語と配色|Idioma y apariencia
介面語言|Interface language|表示言語|Idioma de la interfaz
色系設定|Appearance|配色設定|Apariencia
配色|Palette|配色|Paleta
萊姆電光|Electric lime|エレクトリックライム|Lima eléctrica
珊瑚熱浪|Coral wave|コーラルウェーブ|Ola coral
冰河藍綠|Glacier teal|グレイシャーティール|Turquesa glaciar
色系已套用，但瀏覽器無法儲存設定|Palette applied, but preferences could not be saved.|配色を適用しましたが、設定を保存できません。|Paleta aplicada, pero no se pudo guardar.
語言已套用，但瀏覽器無法儲存設定|Language applied, but preferences could not be saved.|言語を適用しましたが、設定を保存できません。|Idioma aplicado, pero no se pudo guardar.
主要導覽|Main navigation|メインナビゲーション|Navegación principal
對決|Duel|対戦|Duelo
卡牌圖鑑|Card library|カード図鑑|Biblioteca
卡組工坊|Deck workshop|デッキ工房|Taller de mazos
首頁|Home|ホーム|Inicio
開源程式碼|Source code|ソースコード|Código fuente
開啟音效|Enable sound|サウンドを有効にする|Activar sonido
關閉音效|Mute sound|サウンドを消音|Silenciar
讓迷因，正面對決|Let the memes clash|ミームで正面対決|Que choquen los memes
新對決|New duel|新しい対戦|Nuevo duelo
人機對決|Against AI|AI 対戦|Contra la IA
同機雙人|Local two-player|同じ端末で二人対戦|Dos jugadores locales
生命決勝|Life duel|ライフ対戦|Duelo de vida
五次擊倒|Five knockouts|5 回ノックアウト|Cinco derrotas
自由沙盒|Sandbox|サンドボックス|Modo libre
無限能量|Unlimited energy|エネルギー無制限|Energía ilimitada
玩家 01|Player 01|プレイヤー 01|Jugador 01
玩家 02|Player 02|プレイヤー 02|Jugador 02
網路混沌 AI|Chaos AI|カオス AI|IA del caos
迷因角色 2D 物理碰撞戰場|2D meme collision arena|2D ミーム衝突アリーナ|Arena de colisiones 2D
迷因對決：|Meme duel:|ミーム対戦：|Duelo de memes:
卡牌效果演示|Card effect preview|カード効果プレビュー|Demostración de efectos
部署階段|Deployment|配置フェーズ|Despliegue
碰撞對決中|Clash in progress|衝突対戦中|Duelo en curso
對決結束|Duel finished|対戦終了|Duelo terminado
更換場地|Change arena|フィールド変更|Cambiar arena
角色席位|Unit slot|ユニット枠|Espacio de unidad
對戰區|Battle arena|対戦エリア|Zona de combate
戰局|Battle status|戦況|Estado del combate
可用能量|Available energy|使用可能エネルギー|Energía disponible
連攜套裝|Synergy sets|連携セット|Conjuntos de sinergia
套裝效果|Set bonuses|セット効果|Bonificaciones de conjunto
陷阱區|Trap zone|トラップゾーン|Zona de trampas
已設置|Armed|セット済み|Preparada
空席|Empty|空き|Vacío
對決紀錄|Battle log|対戦ログ|Registro de combate
次碰撞|collisions|回衝突|colisiones
你的|Your|あなたの|Tu
的|’s|の|de
手牌|Hand|手札|Mano
等待玩家 02 接手|Waiting for Player 02|プレイヤー 02 を待っています|Esperando al jugador 02
手牌已用盡，下回合繼續抽牌。|No cards left in hand. Draw again next round.|手札がありません。次のラウンドでドローします。|Sin cartas en la mano. Roba en la próxima ronda.
迷因正在碰撞|Memes are clashing|ミーム衝突中|Los memes están chocando
再來一局？|Play again?|もう一度対戦？|¿Otra partida?
你的回合|Your turn|あなたのターン|Tu turno
完成部署|Finish deployment|配置を完了|Terminar despliegue
開始碰撞|Start clash|衝突開始|Iniciar choque
自由開打。認真亂鬥。|Play freely. Clash boldly.|自由に遊び、本気で乱闘。|Juega libre. Lucha a lo grande.
整個網路，都是你的牌庫|The internet is your card library|ネット全体があなたのカード図鑑|Internet es tu biblioteca de cartas
更新網路卡庫|Refresh web catalog|ネット図鑑を更新|Actualizar catálogo web
搜尋迷因、陣營或效果|Search memes, factions or effects|ミーム・陣営・効果を検索|Buscar memes, facciones o efectos
搜尋卡牌|Search cards|カードを検索|Buscar cartas
卡牌類型|Card type|カード種別|Tipo de carta
卡牌來源|Card source|カードの出典|Origen de la carta
全部|All|すべて|Todas
所有來源|All sources|すべての出典|Todos los orígenes
卡牌排序|Card order|カードの並び順|Orden de cartas
原始順序|Original order|元の順序|Orden original
名稱順序|Name order|名前順|Por nombre
能量低至高|Energy: low to high|エネルギー：低い順|Energía: menor a mayor
攻擊力高至低|Attack: high to low|攻撃力：高い順|Ataque: mayor a menor
生命值高至低|HP: high to low|HP：高い順|Vida: mayor a menor
精選|Curated|厳選|Selección
網路|Web|ネット|Web
全球|Global|世界|Global
自訂|Custom|カスタム|Personalizada
全球模板|global templates|世界のテンプレート|plantillas globales
種來源語言|source languages|言語の出典|idiomas de origen
個來源地區|source regions|地域の出典|regiones de origen
來源語言|Source language|出典の言語|Idioma de origen
來源地區|Source region|出典の地域|Región de origen
所有語言|All languages|すべての言語|Todos los idiomas
所有地區|All regions|すべての地域|Todas las regiones
未標註|Unspecified|未記載|Sin especificar
梗意能力|Meme ability|ミーム能力|Habilidad del meme
所有能力|All abilities|すべての能力|Todas las habilidades
張卡牌|cards|枚のカード|cartas
沒有符合條件的卡牌。|No matching cards.|一致するカードがありません。|No hay cartas que coincidan.
載入更多|Load more|さらに表示|Cargar más
我的卡組|My deck|マイデッキ|Mi mazo
移除一張|Remove one copy|1 枚外す|Quitar una copia
尚未加入卡牌|No cards added yet|カードはまだありません|Aún no hay cartas
使用卡組對決|Duel with this deck|このデッキで対戦|Jugar con este mazo
匯出|Export|エクスポート|Exportar
匯入|Import|インポート|Importar
匯出卡牌|Export card|カードをエクスポート|Exportar carta
匯出卡包|Export card pack|カードパックをエクスポート|Exportar paquete de cartas
匯入卡包|Import card pack|カードパックをインポート|Importar paquete de cartas
卡包已匯入|Card pack imported|カードパックをインポートしました|Paquete de cartas importado
不支援的卡包格式|Unsupported card pack format|未対応のカードパック形式|Formato de paquete de cartas no compatible
新增卡牌副本；保留目前卡庫、卡組、收藏與戰績。|Add card copies; keep the current library, decks, favorites and stats.|カードのコピーを追加し、現在のカード図鑑・デッキ・お気に入り・戦績を保持します。|Añade copias de las cartas y conserva la biblioteca, los mazos, los favoritos y las estadísticas.
時機|Trigger|タイミング|Activación
效果|Effect|効果|Efecto
對象|Target|対象|Objetivo
數值|Amount|数値|Cantidad
移除此效果|Remove this effect|この効果を削除|Quitar este efecto
上移效果|Move effect up|効果を上へ移動|Subir efecto
下移效果|Move effect down|効果を下へ移動|Bajar efecto
你的梗，你來定義|Your meme. Your rules.|自分のミーム、自分のルール|Tu meme. Tus reglas.
張自訂卡牌|custom cards|枚のカスタムカード|cartas personalizadas
卡組流派|Deck styles|デッキタイプ|Estilos de mazo
全球隨機套裝|Random global set|世界のランダムセット|Conjunto global aleatorio
每日挑戰|Daily challenge|デイリーチャレンジ|Desafío diario
創作卡牌|Create a card|カード作成|Crear una carta
卡牌名稱|Card name|カード名|Nombre de la carta
给你的傳說一個名字|Name your legend|伝説に名前を付ける|Pon nombre a tu leyenda
給你的傳說一個名字|Name your legend|伝説に名前を付ける|Pon nombre a tu leyenda
類型|Type|種別|Tipo
陣營|Faction|陣営|Facción
能量消耗|Energy cost|エネルギー消費|Coste de energía
碰撞速度|Collision speed|衝突速度|Velocidad de choque
攻擊力|Attack|攻撃力|Ataque
生命值|Health|HP|Vida
圖片網址|Image URL|画像 URL|URL de imagen
卡牌宣言|Flavor text|フレーバーテキスト|Texto de ambientación
這個梗的靈魂台詞|The line that defines this meme|このミームを表すひと言|La frase que define este meme
場地規則|Arena rules|フィールドルール|Reglas de la arena
效果連鎖|Effect chain|効果チェーン|Cadena de efectos
新增效果|Add effect|効果を追加|Añadir efecto
鑄造卡牌|Create card|カードを作成|Crear carta
編輯卡牌|Edit card|カードを編集|Editar carta
取消編輯|Cancel editing|編集をキャンセル|Cancelar edición
清除草稿|Clear draft|下書きを削除|Borrar borrador
清除這份草稿？|Clear this draft?|この下書きを削除しますか？|¿Borrar este borrador?
取代目前草稿？|Replace the current draft?|現在の下書きを置き換えますか？|¿Reemplazar el borrador actual?
無法暫存草稿，請重試|Unable to store draft; please retry|下書きを保存できません。もう一度お試しください|No se pudo guardar el borrador; vuelve a intentarlo
此操作無法還原。|This cannot be undone.|この操作は取り消せません。|Esta acción no se puede deshacer.
儲存修改|Save changes|変更を保存|Guardar cambios
卡牌已保存|Card saved|カードを保存しました|Carta guardada
無法暫存草稿，重新整理可能遺失|Unable to store draft; reloading may lose it|下書きを保存できません。再読み込みすると失われる可能性があります|No se pudo guardar el borrador; puede perderse al recargar
無法清除暫存草稿，重新整理可能再次出現|Unable to clear draft; reloading may restore it|下書きを削除できません。再読み込みすると再表示される可能性があります|No se pudo borrar el borrador; puede reaparecer al recargar
卡牌已保存，但無法清除暫存草稿|Card saved, but stored draft could not be cleared|カードは保存されましたが、下書きを削除できませんでした|Carta guardada, pero no se pudo borrar el borrador
無法讀取暫存草稿，原始資料已保留|Unable to read draft; original data preserved|下書きを読み込めません。元のデータは保持されています|No se pudo leer el borrador; datos originales conservados
原卡牌已變更，草稿改為製作新卡|Source card changed; draft is now a new card|元のカードが変更されたため、下書きを新規カードに切り替えました|La carta original cambió; el borrador será una carta nueva
已恢復卡牌草稿|Card draft restored|カードの下書きを復元しました|Borrador de carta restaurado
關閉|Close|閉じる|Cerrar
能量|Energy|エネルギー|Energía
播放效果演示|Play effect preview|効果をプレビュー|Ver demostración
優先目標|Preferred target|優先対象|Objetivo preferido
自動選擇|Automatic|自動選択|Automático
友軍|Ally|味方|Aliado
敵軍|Enemy|敵|Enemigo
召喚角色|Summon unit|ユニット召喚|Invocar unidad
設置陷阱|Set trap|罠をセット|Preparar trampa
融合召喚|Fusion summon|融合召喚|Invocar fusión
發動卡牌|Play card|カード発動|Jugar carta
加入卡組|Add to deck|デッキに追加|Añadir al mazo
以此為範本|Use as template|テンプレートにする|Usar como plantilla
刪除自訂卡|Delete custom card|カスタムカードを削除|Eliminar carta personalizada
梗意設計|Meme design|ミームの設計|Diseño del meme
待設定|Unassigned|未設定|Sin asignar
原始名稱|Original title|原題|Título original
依據|Based on|根拠|Basado en
來源標籤|Source label|出典のラベル|Etiqueta de origen
名稱|Name|名前|Nombre
來源|Source|出典|Origen
玩家自訂作品|Player-created card|プレイヤー作成カード|Carta creada por un jugador
選擇你的戰場|Choose your arena|フィールドを選ぶ|Elige tu arena
建立新對決|Create a new duel|新しい対戦を作成|Crear un nuevo duelo
對手|Opponent|対戦相手|Oponente
勝利目標|Win condition|勝利条件|Condición de victoria
率先擊倒 5 名角色|First to 5 knockouts|先に 5 回ノックアウト|Primero en derrotar 5 unidades
場地|Arena|フィールド|Arena
開始新對決|Start new duel|新しい対戦を開始|Iniciar nuevo duelo
換你出牌了|Your turn to deploy|あなたの配置ターン|Tu turno para desplegar
我準備好了|I am ready|準備完了|Estoy listo
勢均力敵|A draw|引き分け|Empate
這局，你贏了！|You won this duel!|この対戦はあなたの勝利！|¡Ganaste el duelo!
這次，網路贏了|The internet wins this time|今回はネットの勝利|Esta vez gana Internet
玩家 02 獲勝|Player 02 wins|プレイヤー 02 の勝利|Gana el jugador 02
回合|rounds|ラウンド|rondas
擊倒|knockouts|ノックアウト|derrotas
再來一局|Play again|もう一度対戦|Jugar otra vez
同一張卡最多放入 2 張|Maximum 2 copies per card|同じカードは最大 2 枚です|Máximo 2 copias de cada carta
卡組已滿：最多 30 張|Deck full: maximum 30 cards|デッキが満杯です。最大 30 枚|Mazo lleno: máximo 30 cartas
已加入卡組，下場對決生效|Added to deck for the next duel|追加しました。次の対戦から有効です|Añadida al mazo para el próximo duelo
網路卡庫暫時無法連線|Web catalog is temporarily unavailable|ネット図鑑に接続できません|El catálogo web no está disponible
卡庫資料格式無效|Invalid catalog format|図鑑データ形式が無効です|Formato de catálogo no válido
保留既有卡庫|Existing catalog preserved|既存の図鑑を保持します|Se conserva el catálogo existente
已更新|Updated|更新済み|Actualizadas
個模板，新增|templates; added|件のテンプレート、追加|plantillas; añadidas
匯入檔案不得超過 2 MB|Import file must not exceed 2 MB|インポートは 2 MB 以下にしてください|El archivo no debe superar 2 MB
匯入卡組|Import deck|デッキをインポート|Importar mazo
張卡組卡牌、|deck cards,|枚のデッキカード、|cartas de mazo,
張自訂卡牌。匯入後取代目前卡組與自訂卡庫。|custom cards. Import replaces the current deck and custom library.|枚のカスタムカード。現在のデッキとカスタム図鑑を置き換えます。|cartas personalizadas. La importación reemplaza el mazo y la biblioteca personalizada.
取消|Cancel|キャンセル|Cancelar
確認匯入|Confirm import|インポートを確定|Confirmar importación
卡組已匯入|Deck imported|デッキをインポートしました|Mazo importado
匯入失敗|Import failed|インポート失敗|Error al importar
已套用預設卡組|Preset deck applied|プリセットを適用しました|Mazo predefinido aplicado
刪除這張自訂卡？|Delete this custom card?|このカスタムカードを削除しますか？|¿Eliminar esta carta personalizada?
也會從卡組移除這張卡。|It will also be removed from your deck.|デッキからも削除されます。|También se quitará del mazo.
刪除|Delete|削除|Eliminar
取代目前卡組|Replace current deck|現在のデッキを置き換え|Reemplazar el mazo actual
張全球角色 + 8 張支援卡|global units + 8 support cards|体の世界ユニット + サポート 8 枚|unidades globales + 8 cartas de apoyo
已套用全球隨機套裝|Random global set applied|世界のランダムセットを適用しました|Conjunto global aleatorio aplicado
日期種子 · 固定雙方卡組與場地 · 20 LP|date seed · Fixed decks and arena · 20 LP|日付シード・固定デッキとフィールド・20 LP|semilla de fecha · Mazos y arena fijos · 20 LP
開始新對局；已儲存卡組不變。|Starts a new duel; your saved deck is unchanged.|新しい対戦を開始します。保存済みデッキは変わりません。|Inicia un nuevo duelo; tu mazo guardado no cambia.
開始每日挑戰|Start daily challenge|デイリーチャレンジ開始|Iniciar desafío diario
最多 4 組效果|Maximum 4 effects|効果は最大 4 個です|Máximo 4 efectos
效果演示|Effect preview|効果プレビュー|Demostración de efectos
登場效果|On-play effect|登場効果|Efecto al jugar
碰撞效果|Collision effect|衝突効果|Efecto de choque
每輪效果|Round-start effect|ラウンド開始効果|Efecto de inicio de ronda
離場效果|On-defeat effect|退場効果|Efecto al ser derrotado
演示完成|Preview finished|プレビュー完了|Demostración terminada
演示友軍|Demo ally|デモ味方|Aliado de ejemplo
演示敵軍 2|Demo enemy 2|デモ敵 2|Enemigo de ejemplo 2
演示敵軍|Demo enemy|デモ敵|Enemigo de ejemplo
角色|Unit|ユニット|Unidad
魔法|Spell|魔法|Hechizo
陷阱|Trap|罠|Trampa
裝備|Equipment|装備|Equipo
融合|Fusion|融合|Fusión
混沌|Chaos|カオス|Caos
療癒|Comfort|癒し|Consuelo
腦洞|Big brain|頭脳|Ingenio
財富|Stonks|財運|Riqueza
暴擊|Bonk|強打|Golpe
錯亂|Glitch|バグ|Fallo
一切都很好|This Is Fine|すべて順調|Todo está bien
笑著撐下去|Keep smiling|笑って耐える|Sigue sonriendo
宇宙大腦|Galaxy brain|宇宙の頭脳|Cerebro galáctico
一起上月球|To the moon together|みんなで月へ|Juntos a la luna
全員 BONK|Everyone BONK|みんなで BONK|Todos BONK
現實出錯了|Reality error|現実のエラー|Error de realidad
碰撞傷害 +1|Collision damage +1|衝突ダメージ +1|Daño de choque +1
碰撞傷害再 +2|Additional collision damage +2|衝突ダメージをさらに +2|Daño de choque adicional +2
全隊碰撞傷害 +1|Team collision damage +1|全員の衝突ダメージ +1|Daño de choque del equipo +1
每輪全隊回復 2|Team heals 2 each round|毎ラウンド全員を 2 回復|El equipo recupera 2 por ronda
每輪全隊再回復 3|Team heals 3 more each round|毎ラウンド全員をさらに 3 回復|El equipo recupera 3 más por ronda
每輪多抽 1 張|Draw 1 extra card each round|毎ラウンド追加で 1 枚ドロー|Roba 1 carta extra por ronda
每輪再多抽 1 張（手牌上限 9）|Draw 1 more each round (hand limit 9)|毎ラウンドさらに 1 枚ドロー（手札上限 9 枚）|Roba 1 más por ronda (límite de mano: 9)
每輪能量 +1|Energy +1 each round|毎ラウンドエネルギー +1|Energía +1 por ronda
每輪能量再 +1|Additional energy +1 each round|毎ラウンドエネルギーをさらに +1|Energía adicional +1 por ronda
每名角色每輪首次碰撞，對碰撞目標額外造成 3 傷害|Each unit deals 3 extra damage on its first collision each round|各ユニットは毎ラウンド初衝突時、相手に追加 3 ダメージ|Cada unidad causa 3 de daño extra en su primer choque de cada ronda
每輪護盾 +2|Shield +2 each round|毎ラウンドシールド +2|Escudo +2 por ronda
每輪全隊護盾再 +3|Team gains 3 more shield each round|毎ラウンド全員のシールドをさらに +3|El equipo gana 3 más de escudo por ronda
同一方存活的同陣營角色各計 1 件；3 件效果與 2 件效果疊加。|Each living allied unit of the same faction counts as one piece. The 3-piece bonus stacks with the 2-piece bonus.|同陣営の生存味方 1 体を 1 点と数えます。3 点効果は 2 点効果に加算されます。|Cada aliado vivo de la misma facción cuenta como una pieza. La bonificación de 3 se suma a la de 2.
同一方存活的同陣營角色各計 1 件；重複卡也計入。3 件效果與 2 件效果疊加，離場即失去門檻加成；已獲得的資源保留。|Living allies of the same faction count as pieces, including duplicates. The 3-piece bonus stacks with the 2-piece bonus. Leaving play removes future bonuses below the threshold; resources already gained remain.|同陣営の生存味方を数え、重複も含みます。3 点効果は 2 点効果に加算。退場で条件を失うと以降の追加効果は停止しますが、獲得済み資源は残ります。|Cuentan los aliados vivos de la misma facción, incluidas las copias. La bonificación de 3 se suma a la de 2. Al perder el requisito cesan futuras bonificaciones, pero se conservan los recursos obtenidos.
融合後改用素材陣營的套裝；兩份素材合為 1 件。|Fusion inherits the materials' faction. Two materials become one set piece.|融合後は素材の陣営を継承し、2 体の素材が 1 点になります。|La fusión hereda la facción de los materiales. Dos materiales pasan a ser una pieza.
消耗兩名同陣營角色；繼承素材陣營及一半總攻擊。|Consumes two units of the same faction; inherits their faction and half their combined attack.|同陣営の 2 体を消費し、陣営と合計攻撃力の半分を継承。|Consume dos unidades de la misma facción y hereda su facción y la mitad de su ataque total.
件追加：|piece bonus:|点追加：|piezas, extra:
件：|pieces:|点：|piezas:
件|pieces|点|piezas
網路競技場|Internet arena|ネットアリーナ|Arena de Internet
標準碰撞規則。|Standard collision rules.|標準の衝突ルール。|Reglas de choque estándar.
每輪開始：非混沌角色受到 1 點傷害。|Round start: non-Chaos units take 1 damage.|ラウンド開始時、カオス以外は 1 ダメージ。|Al iniciar la ronda, las unidades que no son Caos reciben 1 de daño.
所有角色碰撞速度提升 35|All units gain 35|全ユニットの衝突速度を 35|Todas las unidades ganan 35
無限後室|The Backrooms|バックルーム|Los Backrooms
每輪開始：全體角色護盾 +1。|Round start: all units gain 1 shield.|ラウンド開始時、全ユニットのシールド +1。|Al iniciar la ronda, todas las unidades ganan 1 de escudo.
療癒大草原|Touch grass|癒しの草原|Toca el césped
每輪開始：全體角色回復 2 點生命。|Round start: all units heal 2 HP.|ラウンド開始時、全ユニットの HP を 2 回復。|Al iniciar la ronda, todas las unidades recuperan 2 de vida.
造成傷害|Deal damage|ダメージ|Causar daño
回復生命|Restore HP|HP 回復|Recuperar vida
獲得護盾|Gain shield|シールド獲得|Ganar escudo
增加攻擊|Increase attack|攻撃力上昇|Aumentar ataque
抽牌|Draw cards|ドロー|Robar cartas
獲得能量|Gain energy|エネルギー獲得|Ganar energía
一名友軍|One ally|味方 1 体|Un aliado
全體友軍|All allies|味方全員|Todos los aliados
一名敵軍|One enemy|敵 1 体|Un enemigo
全體敵軍|All enemies|敵全員|Todos los enemigos
自己|Self|自身|Sí mismo
打出時|On play|登場時|Al jugar
首次碰撞時|First collision|初衝突時|Primer choque
每輪開始時|Round start|ラウンド開始時|Inicio de ronda
被擊倒時|On defeat|撃破時|Al ser derrotado
網路原住民|Internet natives|ネットの住人|Nativos de Internet
混沌燃燒流|Burning chaos|燃えるカオス|Caos ardiente
不死療癒流|Endless comfort|不死の癒し|Consuelo eterno
卡組至少 10 張，且需包含角色卡|Deck needs at least 10 cards and one unit.|デッキは 10 枚以上でユニットが必要です。|El mazo necesita al menos 10 cartas y una unidad.
對手卡組無效|Invalid opponent deck|相手のデッキが無効です|Mazo del oponente no válido
全球卡庫尚未備妥|Global catalog is not ready|世界の図鑑は準備中です|El catálogo global aún no está listo
挑戰日期無效|Invalid challenge date|チャレンジの日付が無効です|Fecha del desafío no válida
現在不是你的部署階段|It is not your deployment phase|あなたの配置フェーズではありません|No es tu fase de despliegue
找不到卡牌|Card not found|カードが見つかりません|Carta no encontrada
能量不足|Not enough energy|エネルギー不足|Energía insuficiente
場上最多 3 名角色|Maximum 3 units on your side|場に出せるユニットは最大 3 体|Máximo 3 unidades en tu lado
需要兩名同陣營角色作為融合素材|Fusion requires two units of the same faction|融合には同陣営の 2 体が必要です|La fusión requiere dos unidades de la misma facción
最多設置 2 張陷阱|Maximum 2 traps|罠は最大 2 枚|Máximo 2 trampas
先召喚一名角色|Summon a unit first|先にユニットを召喚してください|Invoca primero una unidad
目標已離場|Target has left play|対象は退場済みです|El objetivo ya no está en juego
不支援的卡組格式|Unsupported deck format|未対応のデッキ形式|Formato de mazo no compatible
自訂卡牌 ID 無效|Invalid custom card ID|カスタムカード ID が無効です|ID de carta personalizada no válido
自訂卡牌 ID 重複|Duplicate custom card ID|カスタムカード ID が重複しています|ID de carta personalizada duplicado
卡組包含無效卡牌或超過 30 張|Deck contains invalid cards or exceeds 30 cards|無効なカードがあるか、30 枚を超えています|El mazo contiene cartas no válidas o supera las 30 cartas
存檔無法讀取，已載入預設卡組。原始存檔尚未覆寫。|Save could not be read. Default deck loaded; original save has not been overwritten.|セーブを読み込めず、標準デッキを読み込みました。元のセーブは上書きしていません。|No se pudo leer la partida. Se cargó el mazo predeterminado sin sobrescribir el guardado original.
瀏覽器儲存空間不足，請匯出卡組備份|Browser storage unavailable. Export your deck as a backup.|ブラウザーに保存できません。デッキをエクスポートして保管してください。|No hay almacenamiento disponible. Exporta el mazo como copia de seguridad.
存檔已在其他分頁更新，請先匯出備份並重新載入|Save changed in another tab. Export a backup before reloading.|別のタブでセーブが更新されました。再読み込み前にバックアップをエクスポートしてください。|El guardado cambió en otra pestaña. Exporta una copia de seguridad antes de recargar.
卡牌類型或陣營無效|Invalid card type or faction|カード種別または陣営が無効です|Tipo de carta o facción no válido
名稱需為 1 至 72 字|Name must contain 1–72 characters|名前は 1～72 文字です|El nombre debe tener entre 1 y 72 caracteres
圖片必須是 HTTPS 網址|Image must use an HTTPS URL|画像は HTTPS URL にしてください|La imagen debe usar una URL HTTPS
每張卡最多 4 組效果|Maximum 4 effects per card|カードの効果は最大 4 個|Máximo 4 efectos por carta
效果格式無效|Invalid effect format|効果形式が無効です|Formato de efecto no válido
此卡牌的觸發時機無效|Invalid trigger for this card type|このカード種別では無効な発動タイミングです|Activación no válida para este tipo de carta
請選擇場地規則|Choose an arena rule|フィールドルールを選んでください|Elige una regla de arena
護盾|Shield|シールド|Escudo
查看|View|表示|Ver
卡組|Deck|デッキ|Mazo
第 {round} 回合：部署開始|Round {round}: deployment|ラウンド {round}：配置開始|Ronda {round}: despliegue
{name} 被擊倒|{name} was knocked out|{name} が撃破された|{name} ha sido derrotado
{player} 打出 {card}|{player} played {card}|{player} が {card} を使用|{player} jugó {card}
{player} 設置陷阱|{player} set a trap|{player} が罠をセット|{player} preparó una trampa
{player} 防線失守，生命 -{amount}|{player}'s defenses fell, LP -{amount}|{player} の防衛が崩壊、LP -{amount}|Cayó la defensa de {player}, vida -{amount}
陷阱連鎖：{card}|Trap chain: {card}|罠チェーン：{card}|Cadena de trampas: {card}
已鑄造「{card}」|Created “{card}”|「{card}」を作成しました|Se creó «{card}»
移除 {card}|Remove {card}|{card} を外す|Quitar {card}
{tag}連攜啟動：{bonus}|{tag} synergy active: {bonus}|{tag} 連携発動：{bonus}|Sinergia {tag} activa: {bonus}
{set} 3 件套啟動：{bonus}|{set} 3-piece set active: {bonus}|{set} 3 点セット発動：{bonus}|Conjunto {set} de 3 piezas activo: {bonus}
全員 BONK：{name} 追加 3 傷害|Everyone BONK: {name} deals 3 extra damage|みんなで BONK：{name} が追加 3 ダメージ|Todos BONK: {name} causa 3 de daño extra
{trigger}：{target}{action} {amount}|{trigger}: {target} · {action} {amount}|{trigger}：{target}・{action} {amount}|{trigger}: {target} · {action} {amount}
{field} 需為 {min} 至 {max} 的整數|{field} must be an integer from {min} to {max}|{field} は {min}～{max} の整数で指定してください|{field} debe ser un entero entre {min} y {max}
`;

const semanticRows = `
火上加油|Fuel the fire|火に油|Avivar el fuego
財富密碼|Money moves|財運の鍵|Clave de riqueza
節奏上頭|Catch the rhythm|リズムに乗る|Sigue el ritmo
先吃再說|Snack first|まず食べよう|Primero come
待機充電|Rest and recharge|休んで充電|Descansa y recarga
正面硬碰|Head-on impact|正面衝突|Impacto frontal
溫柔接住|Gentle support|優しい支え|Apoyo amable
一起扛住|Stand together|一緒に耐える|Resistir juntos
大腦運轉|Brain at work|頭脳フル回転|Cerebro en marcha
求生反應|Survival reflex|生存本能|Reflejo de supervivencia
眼淚接力|Tears of support|涙のバトン|Relevo de lágrimas
怒氣爆發|Rage burst|怒り爆発|Estallido de ira
嘴上不饒人|Savage remarks|容赦ないツッコミ|Comentarios mordaces
氣勢拉滿|Maximum confidence|自信全開|Confianza máxima
理解不能|Does not compute|理解不能|No lo entiendo
不為所動|Unbothered|動じない|Imperturbable
突然懂了|Now I get it|ひらめいた|Ahora lo entiendo
荒謬擴散|Absurdity spreads|不条理の拡散|Se extiende lo absurdo
嚇到防禦|Startled defense|驚きの防御|Defensa por sorpresa
笑到回血|Laugh to recover|笑って回復|Reír para sanar
失控與燃燒的場面化為離場時波及全場的火焰。|Chaos and burning scenes become flames that hit every enemy on defeat.|暴走や炎上の場面を、退場時に敵全員へ広がる炎として表現。|El caos y el fuego se convierten en llamas que alcanzan a todos los enemigos al ser derrotado.
交易、金錢與成功的梗轉成額外能量，投資下一張卡。|Trading, money and success become extra energy to invest in the next card.|取引・お金・成功のネタを、次のカードへ投資するエネルギーに変換。|El comercio, el dinero y el éxito se convierten en energía para invertir en la próxima carta.
舞步與音樂帶動全隊節奏，每輪為隊友回復生命。|Dance and music energize the team, healing allies each round.|ダンスと音楽で仲間を盛り上げ、毎ラウンド味方を回復。|El baile y la música animan al equipo y curan a los aliados cada ronda.
吃喝與補充體力的情境化為每輪自我回復。|Eating and drinking become self-healing each round.|飲食で元気を補う場面を、毎ラウンドの自己回復で表現。|Comer y beber se convierten en recuperación propia cada ronda.
睡眠、疲憊與下線的梗以護盾爭取喘息空間。|Sleep, exhaustion and logging off become shields that buy time to recover.|睡眠・疲労・ログオフのネタを、休息の時間を稼ぐシールドに。|El sueño, el cansancio y la desconexión se convierten en escudos para recuperar el aliento.
敲打、打鬥與對抗的動作化為首次碰撞的追加傷害。|Strikes, fights and confrontation add damage to the first collision.|殴打・戦闘・対立を、初衝突の追加ダメージで表現。|Los golpes, las peleas y la confrontación añaden daño al primer choque.
安慰、關愛與療癒的情境轉成全隊回復。|Comfort, care and kindness become team-wide healing.|慰め・思いやり・癒しを、味方全員の回復に変換。|El consuelo, el cariño y la amabilidad se convierten en curación para todo el equipo.
團結、合作與支持讓全隊在登場時取得護盾。|Unity, cooperation and support grant the team shields on play.|団結・協力・支援で、登場時に味方全員へシールドを付与。|La unión, la cooperación y el apoyo dan escudos al equipo al entrar en juego.
思考、解釋與解題的梗化為每輪多一個手牌選項。|Thinking, explaining and problem-solving add a card option each round.|思考・説明・問題解決を、毎ラウンド増える手札の選択肢に。|Pensar, explicar y resolver problemas añaden una opción de carta cada ronda.
害怕、逃跑與緊張帶來保命護盾。|Fear, escape and anxiety become protective shields.|恐怖・逃走・緊張を、生き延びるためのシールドに変換。|El miedo, la huida y la ansiedad se convierten en escudos protectores.
哭泣、失落與告別化為離場後留給隊友的回復。|Tears, loss and farewells leave healing for allies after defeat.|涙・喪失・別れを、退場後に仲間へ残す回復で表現。|Las lágrimas, la pérdida y las despedidas dejan curación a los aliados tras la derrota.
憤怒、抓狂與吼叫在首次碰撞時爆發。|Anger, frustration and shouting burst out on the first collision.|怒り・苛立ち・叫びが、最初の衝突で爆発。|La ira, la frustración y los gritos estallan en el primer choque.
嘲諷、吐槽與諷刺化為直指對手的碰撞傷害。|Mockery, roasts and sarcasm become collision damage aimed at the opponent.|嘲笑・ツッコミ・皮肉を、相手へ向けた衝突ダメージに。|La burla, las críticas y el sarcasmo se convierten en daño de choque contra el rival.
自信、決心與勝利姿態讓攻擊力隨回合成長。|Confidence, determination and victory poses grow attack each round.|自信・決意・勝利のポーズで、ラウンドごとに攻撃力が成長。|La confianza, la determinación y las poses victoriosas aumentan el ataque cada ronda.
混亂、錯誤與不可理解的反應，在碰撞時化為防護。|Confusion, errors and baffled reactions become protection on collision.|混乱・エラー・理解できない反応を、衝突時の防御に変換。|La confusión, los errores y las reacciones desconcertadas se convierten en protección al chocar.
淡定、冷漠與無奈的反應讓每輪防線更穩固。|Calm, indifference and resignation reinforce defenses each round.|冷静・無関心・諦めの反応が、毎ラウンド防御を強化。|La calma, la indiferencia y la resignación refuerzan la defensa cada ronda.
醒悟、發現與恍然大悟轉成登場時的額外手牌。|Realization, discovery and insight become an extra card on play.|気づき・発見・ひらめきを、登場時の追加ドローに変換。|La comprensión, el descubrimiento y la revelación se convierten en una carta extra al jugar.
荒誕與失控的笑點在首次碰撞時波及敵方全隊。|Absurd, chaotic humor hits the entire enemy team on the first collision.|不条理で暴走する笑いが、初衝突で敵全員に広がる。|El humor absurdo y caótico alcanza a todo el equipo enemigo en el primer choque.
驚訝與震驚的反應，在首次碰撞時啟動應急護盾。|Surprise and shock trigger emergency shields on the first collision.|驚きや衝撃への反応が、初衝突で緊急シールドを起動。|La sorpresa y la conmoción activan escudos de emergencia en el primer choque.
歡笑、喜悅與慶祝化為每輪自我回復。|Laughter, joy and celebration become self-healing each round.|笑い・喜び・祝福を、毎ラウンドの自己回復に変換。|La risa, la alegría y la celebración se convierten en recuperación propia cada ronda.
尚無足夠梗意資料；保留基本角色數值，不自動編造特殊效果。|Not enough meaning data yet. Basic unit stats remain, with no invented special effect.|意味の情報が不足しています。基本能力のみを保持し、特殊効果は作りません。|Aún no hay suficientes datos sobre su significado. Se mantienen las estadísticas básicas sin inventar efectos especiales.
`;

export const MESSAGES = Object.fromEntries((rows+semanticRows).trim().split('\n').filter(Boolean).map(line=>{
  const [key,en,ja,es,...extra]=line.split('|');
  if (!key || !en || !ja || !es || extra.length) throw new Error(`Invalid locale row: ${key}`);
  return [key,{en,ja,es}];
}));
