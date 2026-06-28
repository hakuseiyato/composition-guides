// Composition Guides for Illustrator
// ui/panel.jsx — ScriptUI モーダルダイアログ
//
// CG.ui.show(doc, state) を呼ぶと設定ダイアログを表示し、
// 「生成 / 更新」or「全消去」or「閉じる」のアクションを処理する。
// ダイアログ内コードは Illustrator と同一エンジンなので DOM を直接呼べる
// （BridgeTalk 不要）。

CG.ui = {};

CG.ui.show = function (doc, state) {
    var win = new Window("dialog", "構図ガイド / Composition Guides");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 14;

    // チェックボックス生成ヘルパ
    function checkRow(parent, key, label) {
        var cb = parent.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        return cb;
    }

    // チェックボックス + 数値入力行
    function numRow(parent, key, label, numKey, isInt, width) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        var et = row.add("edittext", undefined, "" + state[numKey]);
        et.characters = width || 5;
        et.onChange = function () {
            var v = parseFloat(this.text);
            if (isNaN(v)) { this.text = "" + state[numKey]; return; }
            if (isInt) { v = Math.round(v); }
            state[numKey] = v;
            this.text = "" + v;
        };
        return row;
    }

    // チェックボックス + ドロップダウン行
    function cbDropRow(parent, key, label, items, getIndex, setByIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        var dd = row.add("dropdownlist", undefined, items);
        dd.selection = getIndex();
        dd.onChange = function () { setByIndex(this.selection.index); };
        return row;
    }

    // --- 基準アートボード ---
    var abPanel = win.add("panel", undefined, "基準アートボード / Artboard");
    abPanel.orientation = "row";
    abPanel.alignChildren = ["left", "center"];
    abPanel.margins = 10;
    abPanel.add("statictext", undefined, "対象:");
    var abItems = ["アクティブ / Active"];
    for (var i = 0; i < doc.artboards.length; i++) {
        abItems.push((i + 1) + ": " + doc.artboards[i].name);
    }
    var abDrop = abPanel.add("dropdownlist", undefined, abItems);
    abDrop.selection = (state.artboard_index < 0) ? 0 : (state.artboard_index + 1);
    abDrop.onChange = function () {
        state.artboard_index = (this.selection.index === 0) ? -1 : (this.selection.index - 1);
    };

    // --- 構図ガイド ---
    var gp = win.add("panel", undefined, "構図ガイド / Composition");
    gp.orientation = "column";
    gp.alignChildren = ["fill", "top"];
    gp.margins = 10;
    checkRow(gp, "show_thirds", "三分割 / Rule of Thirds");
    checkRow(gp, "show_golden", "黄金比 / Golden Ratio");
    checkRow(gp, "show_diagonal", "対角線 / Diagonal");
    checkRow(gp, "show_center", "中央十字 / Center Cross");
    checkRow(gp, "show_quad", "4 分割 / Quad");
    checkRow(gp, "show_golden_section", "黄金分割 / Golden Section");

    // 三角構図（向き付き）
    var triRow = gp.add("group");
    triRow.orientation = "row";
    triRow.alignChildren = ["left", "center"];
    var triCb = triRow.add("checkbox", undefined, "三角構図 / Triangle");
    triCb.value = state.show_triangle;
    triCb.onClick = function () { state.show_triangle = this.value; };
    var triDrop = triRow.add("dropdownlist", undefined, ["TL→BR", "TR→BL"]);
    triDrop.selection = (state.triangle_orientation === "TL_BR") ? 0 : 1;
    triDrop.onChange = function () {
        state.triangle_orientation = (this.selection.index === 0) ? "TL_BR" : "TR_BL";
    };

    // 黄金螺旋（収束方向）
    cbDropRow(gp, "show_spiral", "黄金螺旋 / Spiral",
        ["左上 TL", "右上 TR", "左下 BL", "右下 BR"],
        function () {
            var o = state.spiral_orientation;
            return (o === "TL") ? 0 : (o === "TR") ? 1 : (o === "BL") ? 2 : 3;
        },
        function (idx) {
            state.spiral_orientation = ["TL", "TR", "BL", "BR"][idx];
        });

    // --- 絵画構図 ---
    var pp = win.add("panel", undefined, "絵画構図 / Painting");
    pp.orientation = "column";
    pp.alignChildren = ["fill", "top"];
    pp.margins = 10;

    // 二分割（軸付き）
    var divRow = pp.add("group");
    divRow.orientation = "row";
    divRow.alignChildren = ["left", "center"];
    var divCb = divRow.add("checkbox", undefined, "二分割 / Division");
    divCb.value = state.show_division;
    divCb.onClick = function () { state.show_division = this.value; };
    var divDrop = divRow.add("dropdownlist", undefined, ["横 / H", "縦 / V"]);
    divDrop.selection = (state.division_axis === "H") ? 0 : 1;
    divDrop.onChange = function () {
        state.division_axis = (this.selection.index === 0) ? "H" : "V";
    };

    // シンメトリー（軸付き）
    var symRow = pp.add("group");
    symRow.orientation = "row";
    symRow.alignChildren = ["left", "center"];
    var symCb = symRow.add("checkbox", undefined, "シンメトリー / Symmetry");
    symCb.value = state.show_symmetry;
    symCb.onClick = function () { state.show_symmetry = this.value; };
    var symDrop = symRow.add("dropdownlist", undefined, ["横 / H", "縦 / V", "両方 / Both"]);
    symDrop.selection = (state.symmetry_axis === "H") ? 0 : (state.symmetry_axis === "V" ? 1 : 2);
    symDrop.onChange = function () {
        var idx = this.selection.index;
        state.symmetry_axis = (idx === 0) ? "H" : (idx === 1 ? "V" : "BOTH");
    };

    // 水平線 / 垂直線（位置）
    numRow(pp, "show_horizontal_line", "水平線 / Horizontal（高さ 0..1）", "horizontal_pos", false);
    numRow(pp, "show_vertical_line", "垂直線 / Vertical（位置 0..1）", "vertical_pos", false);

    // 斜線（角度・本数・拡がり）
    var slRow = pp.add("group");
    slRow.orientation = "row";
    slRow.alignChildren = ["left", "center"];
    var slCb = slRow.add("checkbox", undefined, "斜線 / Slanted");
    slCb.value = state.show_slanted;
    slCb.onClick = function () { state.show_slanted = this.value; };
    slRow.add("statictext", undefined, "角度");
    var slAng = slRow.add("edittext", undefined, "" + state.slanted_angle_deg); slAng.characters = 4;
    slAng.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.slanted_angle_deg = v; } this.text = "" + state.slanted_angle_deg; };
    slRow.add("statictext", undefined, "本数");
    var slCnt = slRow.add("edittext", undefined, "" + state.slanted_count); slCnt.characters = 3;
    slCnt.onChange = function () { var v = parseInt(this.text, 10); if (!isNaN(v)) { state.slanted_count = v; } this.text = "" + state.slanted_count; };
    slRow.add("statictext", undefined, "拡がり");
    var slSpr = slRow.add("edittext", undefined, "" + state.slanted_spread); slSpr.characters = 4;
    slSpr.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.slanted_spread = v; } this.text = "" + state.slanted_spread; };

    // パターン（列 x 行）
    var ptRow = pp.add("group");
    ptRow.orientation = "row";
    ptRow.alignChildren = ["left", "center"];
    var ptCb = ptRow.add("checkbox", undefined, "パターン / Pattern");
    ptCb.value = state.show_pattern;
    ptCb.onClick = function () { state.show_pattern = this.value; };
    ptRow.add("statictext", undefined, "列");
    var ptC = ptRow.add("edittext", undefined, "" + state.pattern_cols); ptC.characters = 3;
    ptC.onChange = function () { var v = parseInt(this.text, 10); if (!isNaN(v)) { state.pattern_cols = v; } this.text = "" + state.pattern_cols; };
    ptRow.add("statictext", undefined, "行");
    var ptR = ptRow.add("edittext", undefined, "" + state.pattern_rows); ptR.characters = 3;
    ptR.onChange = function () { var v = parseInt(this.text, 10); if (!isNaN(v)) { state.pattern_rows = v; } this.text = "" + state.pattern_rows; };

    // 日の丸（同心円数）
    numRow(pp, "show_bullseye", "日の丸 / Bullseye（同心円数）", "bullseye_rings", true);

    // --- 領域 / Area ---
    var ap = win.add("panel", undefined, "領域 / Area");
    ap.orientation = "column";
    ap.alignChildren = ["fill", "top"];
    ap.margins = 10;

    // セーフエリア（Action / Title）
    var saRow = ap.add("group");
    saRow.orientation = "row";
    saRow.alignChildren = ["left", "center"];
    var saCb = saRow.add("checkbox", undefined, "セーフエリア / Safe Area");
    saCb.value = state.show_safe_area;
    saCb.onClick = function () { state.show_safe_area = this.value; };
    saRow.add("statictext", undefined, "Action");
    var saA = saRow.add("edittext", undefined, "" + state.safe_action); saA.characters = 4;
    saA.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.safe_action = v; } this.text = "" + state.safe_action; };
    saRow.add("statictext", undefined, "Title");
    var saT = saRow.add("edittext", undefined, "" + state.safe_title); saT.characters = 4;
    saT.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.safe_title = v; } this.text = "" + state.safe_title; };

    // アスペクトマスク（比率 + カスタム W/H）
    var asRow = ap.add("group");
    asRow.orientation = "row";
    asRow.alignChildren = ["left", "center"];
    var asCb = asRow.add("checkbox", undefined, "アスペクト / Aspect");
    asCb.value = state.show_aspect;
    asCb.onClick = function () { state.show_aspect = this.value; };
    var asKeys = ["1_1", "9_16", "16_9", "4_3", "21_9", "CUSTOM"];
    var asItems = ["1:1", "9:16", "16:9", "4:3", "21:9", "カスタム"];
    var asDrop = asRow.add("dropdownlist", undefined, asItems);
    var asSel = 0;
    for (var ai = 0; ai < asKeys.length; ai++) { if (asKeys[ai] === state.aspect_ratio) { asSel = ai; } }
    asDrop.selection = asSel;
    asDrop.onChange = function () { state.aspect_ratio = asKeys[this.selection.index]; };
    asRow.add("statictext", undefined, "W");
    var asW = asRow.add("edittext", undefined, "" + state.aspect_custom_w); asW.characters = 4;
    asW.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.aspect_custom_w = v; } this.text = "" + state.aspect_custom_w; };
    asRow.add("statictext", undefined, "H");
    var asH = asRow.add("edittext", undefined, "" + state.aspect_custom_h); asH.characters = 4;
    asH.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.aspect_custom_h = v; } this.text = "" + state.aspect_custom_h; };

    // --- パース線 / Perspective ---
    var pe = win.add("panel", undefined, "パース線 / Perspective");
    pe.orientation = "column";
    pe.alignChildren = ["fill", "top"];
    pe.margins = 10;

    // ON + モード
    var peTop = pe.add("group");
    peTop.orientation = "row";
    peTop.alignChildren = ["left", "center"];
    var peCb = peTop.add("checkbox", undefined, "パース線を表示");
    peCb.value = state.show_perspective;
    peCb.onClick = function () { state.show_perspective = this.value; };
    peTop.add("statictext", undefined, "点数");
    var peMode = peTop.add("dropdownlist", undefined, ["1点 / 1P", "2点 / 2P", "3点 / 3P"]);
    peMode.selection = (state.perspective_mode === "1P") ? 0 : (state.perspective_mode === "2P") ? 1 : 2;
    peMode.onChange = function () { state.perspective_mode = ["1P", "2P", "3P"][this.selection.index]; };

    // 数値: 水平線高さ / 放射本数
    var peR1 = pe.add("group");
    peR1.orientation = "row";
    peR1.alignChildren = ["left", "center"];
    peR1.add("statictext", undefined, "水平線高さ");
    var peHV = peR1.add("edittext", undefined, "" + state.perspective_horizon_v); peHV.characters = 4;
    peHV.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.perspective_horizon_v = v; } this.text = "" + state.perspective_horizon_v; };
    peR1.add("statictext", undefined, "放射本数");
    var peLN = peR1.add("edittext", undefined, "" + state.perspective_lines); peLN.characters = 3;
    peLN.onChange = function () { var v = parseInt(this.text, 10); if (!isNaN(v)) { state.perspective_lines = v; } this.text = "" + state.perspective_lines; };

    // 数値: 1P横位置 / 2P拡がり / 3P距離
    var peR2 = pe.add("group");
    peR2.orientation = "row";
    peR2.alignChildren = ["left", "center"];
    peR2.add("statictext", undefined, "VP横(1P)");
    var peV1 = peR2.add("edittext", undefined, "" + state.perspective_vp1_u); peV1.characters = 4;
    peV1.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.perspective_vp1_u = v; } this.text = "" + state.perspective_vp1_u; };
    peR2.add("statictext", undefined, "拡がり(2P)");
    var peSp = peR2.add("edittext", undefined, "" + state.perspective_vp_spread); peSp.characters = 4;
    peSp.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.perspective_vp_spread = v; } this.text = "" + state.perspective_vp_spread; };
    peR2.add("statictext", undefined, "垂直VP(3P)");
    var peV3 = peR2.add("edittext", undefined, "" + state.perspective_vp3_dist); peV3.characters = 4;
    peV3.onChange = function () { var v = parseFloat(this.text); if (!isNaN(v)) { state.perspective_vp3_dist = v; } this.text = "" + state.perspective_vp3_dist; };

    // チェック: VPマーカー / 水平線
    var peR3 = pe.add("group");
    peR3.orientation = "row";
    peR3.alignChildren = ["left", "center"];
    var peMk = peR3.add("checkbox", undefined, "VPマーカー");
    peMk.value = state.perspective_show_vp_marker;
    peMk.onClick = function () { state.perspective_show_vp_marker = this.value; };
    var peHz = peR3.add("checkbox", undefined, "水平線");
    peHz.value = state.perspective_show_horizon;
    peHz.onClick = function () { state.perspective_show_horizon = this.value; };

    // --- 枠 ---
    var fp = win.add("panel", undefined, "枠 / Frame");
    fp.orientation = "column";
    fp.alignChildren = ["fill", "top"];
    fp.margins = 10;
    checkRow(fp, "show_frame", "フレーム外周 / Frame Border");

    // --- ボタン ---
    var btns = win.add("group");
    btns.orientation = "row";
    btns.alignment = ["fill", "bottom"];
    var clearBtn = btns.add("button", undefined, "全消去 / Clear");
    var spacer = btns.add("statictext", undefined, "");
    spacer.alignment = ["fill", "center"];
    var cancelBtn = btns.add("button", undefined, "閉じる / Close", { name: "cancel" });
    var genBtn = btns.add("button", undefined, "生成 / 更新", { name: "ok" });

    var result = { action: "close", state: state };

    clearBtn.onClick = function () {
        result.action = "clear";
        win.close(1);
    };
    genBtn.onClick = function () {
        result.action = "generate";
        win.close(1);
    };
    cancelBtn.onClick = function () {
        result.action = "close";
        win.close(0);
    };

    win.show();
    return result;
};
