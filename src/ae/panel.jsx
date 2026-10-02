// Composition Guides — After Effects 版
// ae/panel.jsx — ドック可能 ScriptUI パネル
//
// AE は ScriptUI パネルをネイティブにドックできる（CEP 不要）。
// `Scripts/ScriptUI Panels/` に置くと「ウィンドウ」メニューに出る。
// build() は Panel（ドック時）/ Window（単体実行時）の両対応。
// 生成・消去は CG.run.* を介してエントリ側で Undo グループに包む。
// チェック/数値/ドロップダウンの変更は即 CG.run.generate(state) で反映する
// （ドック高さ不足でボタンに届かなくても操作できるようにするため）。

CG.ui = {};

CG.ui.build = function (thisObj, state) {
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "構図ガイド / Composition Guides", undefined, { resizeable: true });

    pal.orientation = "column";
    pal.alignChildren = ["fill", "top"];
    pal.spacing = 6;
    pal.margins = 8;

    function regenerate() { CG.run.generate(state); }

    // --- 共通ビルダ（変更のたびに自動生成・更新） ---
    function checkRow(parent, key, label) {
        var cb = parent.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        return cb;
    }

    function numField(row, numKey, isInt, chars, wheelStep) {
        var et = row.add("edittext", undefined, "" + state[numKey]);
        et.characters = chars || 4;
        et.onChange = function () {
            var v = parseFloat(this.text);
            if (isNaN(v)) { this.text = "" + state[numKey]; return; }
            if (isInt) { v = Math.round(v); }
            state[numKey] = v;
            this.text = "" + v;
            regenerate();
        };
        if (wheelStep) {
            try {
                et.addEventListener("mousewheel", function (ev) {
                    var delta = (ev.wheelDelta > 0) ? 1 : -1;
                    var v = Math.max(0, Math.min(1, state[numKey] + delta * wheelStep));
                    state[numKey] = v;
                    this.text = "" + v;
                    regenerate();
                    if (ev.preventDefault) { ev.preventDefault(); }
                });
            } catch (e) { /* mousewheel 未対応ホストでは無視 */ }
        }
        return et;
    }

    function numRow(parent, key, label, numKey, isInt, wheelStep) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        numField(row, numKey, isInt, 5, wheelStep);
        return row;
    }

    function cbDropRow(parent, key, label, items, getIndex, setByIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        var dd = row.add("dropdownlist", undefined, items);
        dd.selection = getIndex();
        dd.onChange = function () { setByIndex(this.selection.index); regenerate(); };
        return row;
    }

    // --- 対象表示 ---
    var head = pal.add("group");
    head.orientation = "row";
    head.alignChildren = ["left", "center"];
    head.add("statictext", undefined, "対象: アクティブコンポ / Active Comp");

    // --- タブ ---
    var tabs = pal.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.preferredSize.width = 320;

    // ===== タブ1: 構図 / Composition =====
    var tabA = tabs.add("tab", undefined, "構図 / Composition");
    tabA.orientation = "column";
    tabA.alignChildren = ["fill", "top"];
    tabA.margins = 8;

    checkRow(tabA, "show_thirds", "三分割 / Rule of Thirds");
    checkRow(tabA, "show_golden", "黄金比 / Golden Ratio");
    checkRow(tabA, "show_diagonal", "対角線 / Diagonal");
    checkRow(tabA, "show_center", "中央十字 / Center Cross");
    checkRow(tabA, "show_golden_section", "黄金分割 / Golden Section");

    // 三角構図（向き付き）
    cbDropRow(tabA, "show_triangle", "三角構図 / Triangle",
        ["TL→BR", "TR→BL"],
        function () { return (state.triangle_orientation === "TL_BR") ? 0 : 1; },
        function (idx) { state.triangle_orientation = (idx === 0) ? "TL_BR" : "TR_BL"; });

    // 黄金螺旋（4方向独立・2×2グリッド）
    var spiralRow1 = tabA.add("group");
    spiralRow1.orientation = "row";
    spiralRow1.alignChildren = ["left", "center"];
    checkRow(spiralRow1, "show_spiral_tl", "螺旋 左上 TL");
    checkRow(spiralRow1, "show_spiral_tr", "螺旋 右上 TR");
    var spiralRow2 = tabA.add("group");
    spiralRow2.orientation = "row";
    spiralRow2.alignChildren = ["left", "center"];
    checkRow(spiralRow2, "show_spiral_bl", "螺旋 左下 BL");
    checkRow(spiralRow2, "show_spiral_br", "螺旋 右下 BR");

    // ===== タブ2: 絵画 / Painting =====
    var tabB = tabs.add("tab", undefined, "絵画 / Painting");
    tabB.orientation = "column";
    tabB.alignChildren = ["fill", "top"];
    tabB.margins = 8;

    numRow(tabB, "show_horizontal_line", "水平線 / Horizontal（高さ 0..1）", "horizontal_pos", false, 0.01);
    numRow(tabB, "show_vertical_line", "垂直線 / Vertical（位置 0..1）", "vertical_pos", false, 0.01);

    // 斜線（角度・本数・拡がり）
    var slRow = tabB.add("group");
    slRow.orientation = "row";
    slRow.alignChildren = ["left", "center"];
    var slCb = slRow.add("checkbox", undefined, "斜線");
    slCb.value = state.show_slanted;
    slCb.onClick = function () { state.show_slanted = this.value; regenerate(); };
    slRow.add("statictext", undefined, "角度"); numField(slRow, "slanted_angle_deg", false, 4);
    slRow.add("statictext", undefined, "本数"); numField(slRow, "slanted_count", true, 3);
    slRow.add("statictext", undefined, "拡がり"); numField(slRow, "slanted_spread", false, 4);

    // パターン（列 x 行）
    var ptRow = tabB.add("group");
    ptRow.orientation = "row";
    ptRow.alignChildren = ["left", "center"];
    var ptCb = ptRow.add("checkbox", undefined, "パターン");
    ptCb.value = state.show_pattern;
    ptCb.onClick = function () { state.show_pattern = this.value; regenerate(); };
    ptRow.add("statictext", undefined, "列"); numField(ptRow, "pattern_cols", true, 3);
    ptRow.add("statictext", undefined, "行"); numField(ptRow, "pattern_rows", true, 3);

    numRow(tabB, "show_bullseye", "日の丸 / Bullseye（同心円数）", "bullseye_rings", true);

    // ===== タブ3: 領域・枠 / Area & Frame =====
    var tabC = tabs.add("tab", undefined, "領域・枠 / Area & Frame");
    tabC.orientation = "column";
    tabC.alignChildren = ["fill", "top"];
    tabC.margins = 8;

    // セーフエリア（Action / Title）
    var saRow = tabC.add("group");
    saRow.orientation = "row";
    saRow.alignChildren = ["left", "center"];
    var saCb = saRow.add("checkbox", undefined, "セーフエリア");
    saCb.value = state.show_safe_area;
    saCb.onClick = function () { state.show_safe_area = this.value; regenerate(); };
    saRow.add("statictext", undefined, "Action"); numField(saRow, "safe_action", false, 4);
    saRow.add("statictext", undefined, "Title"); numField(saRow, "safe_title", false, 4);

    // アスペクトマスク
    var asRow = tabC.add("group");
    asRow.orientation = "row";
    asRow.alignChildren = ["left", "center"];
    var asCb = asRow.add("checkbox", undefined, "アスペクト");
    asCb.value = state.show_aspect;
    asCb.onClick = function () { state.show_aspect = this.value; regenerate(); };
    var asKeys = ["1_1", "9_16", "16_9", "4_3", "21_9", "CUSTOM"];
    var asItems = ["1:1", "9:16", "16:9", "4:3", "21:9", "カスタム"];
    var asDrop = asRow.add("dropdownlist", undefined, asItems);
    var asSel = 0;
    for (var ai = 0; ai < asKeys.length; ai++) { if (asKeys[ai] === state.aspect_ratio) { asSel = ai; } }
    asDrop.selection = asSel;
    asDrop.onChange = function () { state.aspect_ratio = asKeys[this.selection.index]; regenerate(); };
    asRow.add("statictext", undefined, "W"); numField(asRow, "aspect_custom_w", false, 4);
    asRow.add("statictext", undefined, "H"); numField(asRow, "aspect_custom_h", false, 4);

    checkRow(tabC, "show_frame", "フレーム外周 / Frame Border");

    // ===== タブ4: パース / Perspective =====
    var tabD = tabs.add("tab", undefined, "パース / Perspective");
    tabD.orientation = "column";
    tabD.alignChildren = ["fill", "top"];
    tabD.margins = 8;

    var peTop = tabD.add("group");
    peTop.orientation = "row";
    peTop.alignChildren = ["left", "center"];
    var peCb = peTop.add("checkbox", undefined, "パース線を表示");
    peCb.value = state.show_perspective;
    peCb.onClick = function () { state.show_perspective = this.value; regenerate(); };
    peTop.add("statictext", undefined, "点数");
    var peMode = peTop.add("dropdownlist", undefined, ["1点 / 1P", "2点 / 2P", "3点 / 3P"]);
    peMode.selection = (state.perspective_mode === "1P") ? 0 : (state.perspective_mode === "2P") ? 1 : 2;
    peMode.onChange = function () { state.perspective_mode = ["1P", "2P", "3P"][this.selection.index]; regenerate(); };

    var peR1 = tabD.add("group");
    peR1.orientation = "row";
    peR1.alignChildren = ["left", "center"];
    peR1.add("statictext", undefined, "水平線高さ"); numField(peR1, "perspective_horizon_v", false, 4);
    peR1.add("statictext", undefined, "放射本数"); numField(peR1, "perspective_lines", true, 3);

    var peR2 = tabD.add("group");
    peR2.orientation = "row";
    peR2.alignChildren = ["left", "center"];
    peR2.add("statictext", undefined, "VP横(1P)"); numField(peR2, "perspective_vp1_u", false, 4);
    peR2.add("statictext", undefined, "拡がり(2P)"); numField(peR2, "perspective_vp_spread", false, 4);
    peR2.add("statictext", undefined, "垂直VP(3P)"); numField(peR2, "perspective_vp3_dist", false, 4);

    var peR3 = tabD.add("group");
    peR3.orientation = "row";
    peR3.alignChildren = ["left", "center"];
    var peMk = peR3.add("checkbox", undefined, "VPマーカー");
    peMk.value = state.perspective_show_vp_marker;
    peMk.onClick = function () { state.perspective_show_vp_marker = this.value; regenerate(); };
    var peHz = peR3.add("checkbox", undefined, "水平線");
    peHz.value = state.perspective_show_horizon;
    peHz.onClick = function () { state.perspective_show_horizon = this.value; regenerate(); };

    var peR4 = tabD.add("group");
    peR4.orientation = "row";
    peR4.alignChildren = ["left", "center"];
    var peLive = peR4.add("checkbox", undefined, "VP をヌルで調整（ライブ）");
    peLive.value = state.perspective_live_vp;
    peLive.onClick = function () { state.perspective_live_vp = this.value; regenerate(); };
    var peReset = peR4.add("button", undefined, "VP をリセット");
    peReset.onClick = function () { CG.run.resetVP(state); };

    // ===== タブ5: 人物 / Figure =====
    var tabE = tabs.add("tab", undefined, "人物 / Figure");
    tabE.orientation = "column";
    tabE.alignChildren = ["fill", "top"];
    tabE.margins = 8;

    var figureHelp = tabE.add("statictext", undefined,
        "① イラストを写真の 1 箇所で目で合わせる\n"
        + "② 「基準にする」でその位置とサイズを記録\n"
        + "③ 「スケール連動」で以後は上下移動だけでサイズが追従",
        { multiline: true });
    figureHelp.alignment = ["fill", "top"];

    var figSetRef = tabE.add("button", undefined, "選択レイヤーを基準にする");
    figSetRef.alignment = ["fill", "top"];
    figSetRef.onClick = function () { CG.run.figureSetRef(state); };

    var figLink = tabE.add("button", undefined, "選択レイヤーをスケール連動");
    figLink.alignment = ["fill", "top"];
    figLink.onClick = function () { CG.run.figureLink(state); };

    var figUnlink = tabE.add("button", undefined, "連動を解除");
    figUnlink.alignment = ["fill", "top"];
    figUnlink.onClick = function () { CG.run.figureUnlink(); };

    var figAnchor = tabE.add("button", undefined, "アンカーを下端中央へ");
    figAnchor.alignment = ["fill", "top"];
    figAnchor.onClick = function () { CG.run.figureAnchorBottom(); };

    tabs.selection = tabA;

    // --- ボタン ---
    var btns = pal.add("group");
    btns.orientation = "row";
    btns.alignment = ["fill", "bottom"];
    var clearBtn = btns.add("button", undefined, "全消去 / Clear");
    var spacer = btns.add("statictext", undefined, "");
    spacer.alignment = ["fill", "center"];
    var genBtn = btns.add("button", undefined, "生成 / 更新");

    genBtn.onClick = function () { CG.run.generate(state); };
    clearBtn.onClick = function () { CG.run.clear(); };

    pal.layout.layout(true);
    pal.layout.resize();
    pal.onResizing = pal.onResize = function () { this.layout.resize(); };

    return pal;
};
