// Composition Guides — After Effects 版
// ae/panel.jsx — ドック可能 ScriptUI パネル
//
// AE は ScriptUI パネルをネイティブにドックできる（CEP 不要）。
// `Scripts/ScriptUI Panels/` に置くと「ウィンドウ」メニューに出る。
// build() は Panel（ドック時）/ Window（単体実行時）の両対応。
// 生成・消去は CG.run.* を介してエントリ側で Undo グループに包む。

CG.ui = {};

CG.ui.build = function (thisObj, state) {
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "構図ガイド / Composition Guides", undefined, { resizeable: true });

    pal.orientation = "column";
    pal.alignChildren = ["fill", "top"];
    pal.spacing = 6;
    pal.margins = 8;

    // --- 共通ビルダ ---
    function checkRow(parent, key, label) {
        var cb = parent.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        return cb;
    }

    function numField(row, numKey, isInt, chars) {
        var et = row.add("edittext", undefined, "" + state[numKey]);
        et.characters = chars || 4;
        et.onChange = function () {
            var v = parseFloat(this.text);
            if (isNaN(v)) { this.text = "" + state[numKey]; return; }
            if (isInt) { v = Math.round(v); }
            state[numKey] = v;
            this.text = "" + v;
        };
        return et;
    }

    function numRow(parent, key, label, numKey, isInt) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        numField(row, numKey, isInt, 5);
        return row;
    }

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

    // --- 対象表示 ---
    var head = pal.add("group");
    head.orientation = "row";
    head.alignChildren = ["left", "center"];
    head.add("statictext", undefined, "対象: アクティブコンポ / Active Comp");

    // --- タブ ---
    var tabs = pal.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.preferredSize.width = 320;

    // ===== タブ: 構図 =====
    var t1 = tabs.add("tab", undefined, "構図");
    t1.orientation = "column";
    t1.alignChildren = ["fill", "top"];
    t1.margins = 8;
    checkRow(t1, "show_thirds", "三分割 / Rule of Thirds");
    checkRow(t1, "show_golden", "黄金比 / Golden Ratio");
    checkRow(t1, "show_diagonal", "対角線 / Diagonal");
    checkRow(t1, "show_center", "中央十字 / Center Cross");
    checkRow(t1, "show_quad", "4 分割 / Quad");
    checkRow(t1, "show_golden_section", "黄金分割 / Golden Section");

    // 三角構図（向き付き）
    cbDropRow(t1, "show_triangle", "三角構図 / Triangle",
        ["TL→BR", "TR→BL"],
        function () { return (state.triangle_orientation === "TL_BR") ? 0 : 1; },
        function (idx) { state.triangle_orientation = (idx === 0) ? "TL_BR" : "TR_BL"; });

    // 黄金螺旋（収束方向）
    cbDropRow(t1, "show_spiral", "黄金螺旋 / Spiral",
        ["左上 TL", "右上 TR", "左下 BL", "右下 BR"],
        function () {
            var o = state.spiral_orientation;
            return (o === "TL") ? 0 : (o === "TR") ? 1 : (o === "BL") ? 2 : 3;
        },
        function (idx) { state.spiral_orientation = ["TL", "TR", "BL", "BR"][idx]; });

    // ===== タブ: 絵画 =====
    var t2 = tabs.add("tab", undefined, "絵画");
    t2.orientation = "column";
    t2.alignChildren = ["fill", "top"];
    t2.margins = 8;

    cbDropRow(t2, "show_division", "二分割 / Division",
        ["横 / H", "縦 / V"],
        function () { return (state.division_axis === "H") ? 0 : 1; },
        function (idx) { state.division_axis = (idx === 0) ? "H" : "V"; });

    cbDropRow(t2, "show_symmetry", "シンメトリー / Symmetry",
        ["横 / H", "縦 / V", "両方 / Both"],
        function () { return (state.symmetry_axis === "H") ? 0 : (state.symmetry_axis === "V" ? 1 : 2); },
        function (idx) { state.symmetry_axis = (idx === 0) ? "H" : (idx === 1 ? "V" : "BOTH"); });

    numRow(t2, "show_horizontal_line", "水平線 / Horizontal（高さ 0..1）", "horizontal_pos", false);
    numRow(t2, "show_vertical_line", "垂直線 / Vertical（位置 0..1）", "vertical_pos", false);

    // 斜線（角度・本数・拡がり）
    var slRow = t2.add("group");
    slRow.orientation = "row";
    slRow.alignChildren = ["left", "center"];
    var slCb = slRow.add("checkbox", undefined, "斜線");
    slCb.value = state.show_slanted;
    slCb.onClick = function () { state.show_slanted = this.value; };
    slRow.add("statictext", undefined, "角度"); numField(slRow, "slanted_angle_deg", false, 4);
    slRow.add("statictext", undefined, "本数"); numField(slRow, "slanted_count", true, 3);
    slRow.add("statictext", undefined, "拡がり"); numField(slRow, "slanted_spread", false, 4);

    // パターン（列 x 行）
    var ptRow = t2.add("group");
    ptRow.orientation = "row";
    ptRow.alignChildren = ["left", "center"];
    var ptCb = ptRow.add("checkbox", undefined, "パターン");
    ptCb.value = state.show_pattern;
    ptCb.onClick = function () { state.show_pattern = this.value; };
    ptRow.add("statictext", undefined, "列"); numField(ptRow, "pattern_cols", true, 3);
    ptRow.add("statictext", undefined, "行"); numField(ptRow, "pattern_rows", true, 3);

    numRow(t2, "show_bullseye", "日の丸 / Bullseye（同心円数）", "bullseye_rings", true);

    // ===== タブ: 領域 =====
    var t3 = tabs.add("tab", undefined, "領域");
    t3.orientation = "column";
    t3.alignChildren = ["fill", "top"];
    t3.margins = 8;

    // セーフエリア（Action / Title）
    var saRow = t3.add("group");
    saRow.orientation = "row";
    saRow.alignChildren = ["left", "center"];
    var saCb = saRow.add("checkbox", undefined, "セーフエリア");
    saCb.value = state.show_safe_area;
    saCb.onClick = function () { state.show_safe_area = this.value; };
    saRow.add("statictext", undefined, "Action"); numField(saRow, "safe_action", false, 4);
    saRow.add("statictext", undefined, "Title"); numField(saRow, "safe_title", false, 4);

    // アスペクトマスク
    var asRow = t3.add("group");
    asRow.orientation = "row";
    asRow.alignChildren = ["left", "center"];
    var asCb = asRow.add("checkbox", undefined, "アスペクト");
    asCb.value = state.show_aspect;
    asCb.onClick = function () { state.show_aspect = this.value; };
    var asKeys = ["1_1", "9_16", "16_9", "4_3", "21_9", "CUSTOM"];
    var asItems = ["1:1", "9:16", "16:9", "4:3", "21:9", "カスタム"];
    var asDrop = asRow.add("dropdownlist", undefined, asItems);
    var asSel = 0;
    for (var ai = 0; ai < asKeys.length; ai++) { if (asKeys[ai] === state.aspect_ratio) { asSel = ai; } }
    asDrop.selection = asSel;
    asDrop.onChange = function () { state.aspect_ratio = asKeys[this.selection.index]; };
    asRow.add("statictext", undefined, "W"); numField(asRow, "aspect_custom_w", false, 4);
    asRow.add("statictext", undefined, "H"); numField(asRow, "aspect_custom_h", false, 4);

    // ===== タブ: パース =====
    var t4 = tabs.add("tab", undefined, "パース");
    t4.orientation = "column";
    t4.alignChildren = ["fill", "top"];
    t4.margins = 8;

    var peTop = t4.add("group");
    peTop.orientation = "row";
    peTop.alignChildren = ["left", "center"];
    var peCb = peTop.add("checkbox", undefined, "パース線を表示");
    peCb.value = state.show_perspective;
    peCb.onClick = function () { state.show_perspective = this.value; };
    peTop.add("statictext", undefined, "点数");
    var peMode = peTop.add("dropdownlist", undefined, ["1点 / 1P", "2点 / 2P", "3点 / 3P"]);
    peMode.selection = (state.perspective_mode === "1P") ? 0 : (state.perspective_mode === "2P") ? 1 : 2;
    peMode.onChange = function () { state.perspective_mode = ["1P", "2P", "3P"][this.selection.index]; };

    var peR1 = t4.add("group");
    peR1.orientation = "row";
    peR1.alignChildren = ["left", "center"];
    peR1.add("statictext", undefined, "水平線高さ"); numField(peR1, "perspective_horizon_v", false, 4);
    peR1.add("statictext", undefined, "放射本数"); numField(peR1, "perspective_lines", true, 3);

    var peR2 = t4.add("group");
    peR2.orientation = "row";
    peR2.alignChildren = ["left", "center"];
    peR2.add("statictext", undefined, "VP横(1P)"); numField(peR2, "perspective_vp1_u", false, 4);
    peR2.add("statictext", undefined, "拡がり(2P)"); numField(peR2, "perspective_vp_spread", false, 4);
    peR2.add("statictext", undefined, "垂直VP(3P)"); numField(peR2, "perspective_vp3_dist", false, 4);

    var peR3 = t4.add("group");
    peR3.orientation = "row";
    peR3.alignChildren = ["left", "center"];
    var peMk = peR3.add("checkbox", undefined, "VPマーカー");
    peMk.value = state.perspective_show_vp_marker;
    peMk.onClick = function () { state.perspective_show_vp_marker = this.value; };
    var peHz = peR3.add("checkbox", undefined, "水平線");
    peHz.value = state.perspective_show_horizon;
    peHz.onClick = function () { state.perspective_show_horizon = this.value; };

    // ===== タブ: 枠 =====
    var t5 = tabs.add("tab", undefined, "枠");
    t5.orientation = "column";
    t5.alignChildren = ["fill", "top"];
    t5.margins = 8;
    checkRow(t5, "show_frame", "フレーム外周 / Frame Border");

    tabs.selection = t1;

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
