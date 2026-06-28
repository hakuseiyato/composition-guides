// Composition Guides — CEP パネル ロジック
// 状態(state)を保持し、HTML コントロールへバインドして、生成/消去時に
// ExtendScript エンジン(CGHost)へ evalScript で渡す。
//
// 注: 大きな CSInterface.js は使わず、CEP の低レベル API
//     window.__adobe_cep__ を直接利用する。

(function () {
  "use strict";

  // --- 既定 state（src/state.jsx の CG.defaults と一致させること） ---
  var DEFAULTS = {
    artboard_index: -1,

    show_thirds: true,
    show_golden: false,
    show_diagonal: false,
    show_center: false,
    show_quad: false,
    show_triangle: false,
    triangle_orientation: "TL_BR",
    show_golden_section: false,

    show_division: false,
    division_axis: "H",
    show_symmetry: false,
    symmetry_axis: "V",

    show_spiral: false,
    spiral_orientation: "TL",
    show_horizontal_line: false,
    horizontal_pos: 0.5,
    show_vertical_line: false,
    vertical_pos: 0.5,
    show_slanted: false,
    slanted_angle_deg: 30.0,
    slanted_count: 4,
    slanted_spread: 0.9,
    show_pattern: false,
    pattern_cols: 6,
    pattern_rows: 6,
    show_bullseye: false,
    bullseye_rings: 2,

    show_safe_area: false,
    safe_action: 0.9,
    safe_title: 0.8,
    show_aspect: false,
    aspect_ratio: "9_16",
    aspect_custom_w: 2.39,
    aspect_custom_h: 1.0,

    show_perspective: false,
    perspective_mode: "2P",
    perspective_horizon_v: 0.5,
    perspective_vp1_u: 0.5,
    perspective_vp_spread: 0.9,
    perspective_vp3_dist: 1.5,
    perspective_lines: 12,
    perspective_show_vp_marker: true,
    perspective_show_horizon: true,

    show_frame: false
  };

  var state = {};
  for (var k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { state[k] = DEFAULTS[k]; } }

  // --- UI スキーマ ---
  // c: チェック / cs: チェック+セレクト / cn: チェック+数値群 / csn: チェック+セレクト+数値群
  var SCHEMA = [
    { title: "構図", controls: [
      { kind: "c", key: "show_thirds", label: "三分割" },
      { kind: "c", key: "show_golden", label: "黄金比" },
      { kind: "c", key: "show_diagonal", label: "対角線" },
      { kind: "c", key: "show_center", label: "中央十字" },
      { kind: "c", key: "show_quad", label: "4分割" },
      { kind: "c", key: "show_golden_section", label: "黄金分割" },
      { kind: "cs", key: "show_triangle", label: "三角構図", sel: "triangle_orientation",
        options: [["TL_BR", "TL→BR"], ["TR_BL", "TR→BL"]] },
      { kind: "cs", key: "show_spiral", label: "黄金螺旋", sel: "spiral_orientation",
        options: [["TL", "左上"], ["TR", "右上"], ["BL", "左下"], ["BR", "右下"]] }
    ]},
    { title: "絵画構図", controls: [
      { kind: "cs", key: "show_division", label: "二分割", sel: "division_axis",
        options: [["H", "横"], ["V", "縦"]] },
      { kind: "cs", key: "show_symmetry", label: "シンメトリー", sel: "symmetry_axis",
        options: [["H", "横"], ["V", "縦"], ["BOTH", "両方"]] },
      { kind: "cn", key: "show_horizontal_line", label: "水平線",
        nums: [["horizontal_pos", "高さ", false]] },
      { kind: "cn", key: "show_vertical_line", label: "垂直線",
        nums: [["vertical_pos", "位置", false]] },
      { kind: "cn", key: "show_slanted", label: "斜線",
        nums: [["slanted_angle_deg", "角度", false], ["slanted_count", "本数", true], ["slanted_spread", "拡がり", false]] },
      { kind: "cn", key: "show_pattern", label: "パターン",
        nums: [["pattern_cols", "列", true], ["pattern_rows", "行", true]] },
      { kind: "cn", key: "show_bullseye", label: "日の丸",
        nums: [["bullseye_rings", "同心円", true]] }
    ]},
    { title: "領域", controls: [
      { kind: "cn", key: "show_safe_area", label: "セーフエリア",
        nums: [["safe_action", "Action", false], ["safe_title", "Title", false]] },
      { kind: "csn", key: "show_aspect", label: "アスペクト", sel: "aspect_ratio",
        options: [["1_1", "1:1"], ["9_16", "9:16"], ["16_9", "16:9"], ["4_3", "4:3"], ["21_9", "21:9"], ["CUSTOM", "カスタム"]],
        nums: [["aspect_custom_w", "W", false], ["aspect_custom_h", "H", false]] }
    ]},
    { title: "パース線", controls: [
      { kind: "cs", key: "show_perspective", label: "パース線", sel: "perspective_mode",
        options: [["1P", "1点"], ["2P", "2点"], ["3P", "3点"]] },
      { kind: "n", nums: [["perspective_horizon_v", "水平線高さ", false], ["perspective_lines", "放射本数", true]] },
      { kind: "n", nums: [["perspective_vp1_u", "VP横(1P)", false], ["perspective_vp_spread", "拡がり(2P)", false], ["perspective_vp3_dist", "垂直VP(3P)", false]] },
      { kind: "cc", checks: [["perspective_show_vp_marker", "VPマーカー"], ["perspective_show_horizon", "水平線"]] }
    ]},
    { title: "枠", controls: [
      { kind: "c", key: "show_frame", label: "フレーム外周" }
    ]}
  ];

  // --- DOM 生成 ---
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function makeCheckbox(key, label) {
    var lab = el("label", "cb");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!state[key];
    cb.addEventListener("change", function () { state[key] = cb.checked; });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, label));
    return lab;
  }

  function makeSelect(key, options) {
    var sel = el("select");
    for (var i = 0; i < options.length; i++) {
      var o = el("option", null, options[i][1]);
      o.value = options[i][0];
      sel.appendChild(o);
    }
    sel.value = state[key];
    sel.addEventListener("change", function () { state[key] = sel.value; });
    return sel;
  }

  function makeNum(key, label, isInt) {
    var wrap = el("span", "sub");
    wrap.appendChild(el("span", null, label + " "));
    var inp = el("input");
    inp.type = "number";
    inp.step = isInt ? "1" : "0.01";
    inp.value = state[key];
    inp.addEventListener("change", function () {
      var v = parseFloat(inp.value);
      if (isNaN(v)) { inp.value = state[key]; return; }
      if (isInt) { v = Math.round(v); }
      state[key] = v;
      inp.value = v;
    });
    wrap.appendChild(inp);
    return wrap;
  }

  function renderControl(c) {
    var row = el("div", "row");
    if (c.kind === "c") {
      row.appendChild(makeCheckbox(c.key, c.label));
    } else if (c.kind === "cs") {
      row.appendChild(makeCheckbox(c.key, c.label));
      row.appendChild(makeSelect(c.sel, c.options));
    } else if (c.kind === "cn") {
      row.appendChild(makeCheckbox(c.key, c.label));
      for (var i = 0; i < c.nums.length; i++) {
        row.appendChild(makeNum(c.nums[i][0], c.nums[i][1], c.nums[i][2]));
      }
    } else if (c.kind === "csn") {
      row.appendChild(makeCheckbox(c.key, c.label));
      row.appendChild(makeSelect(c.sel, c.options));
      for (var j = 0; j < c.nums.length; j++) {
        row.appendChild(makeNum(c.nums[j][0], c.nums[j][1], c.nums[j][2]));
      }
    } else if (c.kind === "n") {
      for (var m = 0; m < c.nums.length; m++) {
        row.appendChild(makeNum(c.nums[m][0], c.nums[m][1], c.nums[m][2]));
      }
    } else if (c.kind === "cc") {
      for (var n = 0; n < c.checks.length; n++) {
        row.appendChild(makeCheckbox(c.checks[n][0], c.checks[n][1]));
      }
    }
    return row;
  }

  function renderSections() {
    var host = document.getElementById("sections");
    for (var s = 0; s < SCHEMA.length; s++) {
      var sec = el("section", "panel");
      sec.appendChild(el("h2", null, SCHEMA[s].title));
      for (var c = 0; c < SCHEMA[s].controls.length; c++) {
        sec.appendChild(renderControl(SCHEMA[s].controls[c]));
      }
      host.appendChild(sec);
    }
  }

  // --- ホスト呼び出し ---
  function hasCep() {
    return (typeof window.__adobe_cep__ !== "undefined");
  }

  function evalScript(script, cb) {
    if (!hasCep()) { if (cb) { cb("NO_CEP"); } return; }
    window.__adobe_cep__.evalScript(script, function (res) { if (cb) { cb(res); } });
  }

  function setStatus(msg, type) {
    var s = document.getElementById("status");
    s.textContent = msg;
    s.className = "status" + (type ? " " + type : "");
  }

  function refreshArtboards() {
    var sel = document.getElementById("artboard");
    evalScript("CGHost.artboards()", function (res) {
      sel.innerHTML = "";
      var opt0 = el("option", null, "アクティブ");
      opt0.value = "-1";
      sel.appendChild(opt0);
      if (res && res !== "NO_CEP") {
        var names = res.split("\n");
        for (var i = 0; i < names.length; i++) {
          if (names[i] === "") { continue; }
          var o = el("option", null, (i + 1) + ": " + names[i]);
          o.value = "" + i;
          sel.appendChild(o);
        }
      }
      // 現在の選択を反映
      sel.value = "" + state.artboard_index;
    });
    sel.onchange = function () { state.artboard_index = parseInt(sel.value, 10); };
  }

  function doGenerate() {
    var json = JSON.stringify(state);
    setStatus("生成中…");
    evalScript("CGHost.generate(" + JSON.stringify(json) + ")", function (res) {
      if (res && res.indexOf("OK") === 0) {
        setStatus("生成しました（アートボード " + (res.split(":")[1]) + "）", "ok");
      } else if (res === "NO_DOC") {
        setStatus("ドキュメントが開かれていません", "err");
      } else {
        setStatus("失敗: " + res, "err");
      }
    });
  }

  function doClear() {
    evalScript("CGHost.clear()", function (res) {
      if (res === "OK") { setStatus("ガイドを消去しました", "ok"); }
      else if (res === "NO_DOC") { setStatus("ドキュメントが開かれていません", "err"); }
      else { setStatus("失敗: " + res, "err"); }
    });
  }

  // --- 初期化 ---
  document.addEventListener("DOMContentLoaded", function () {
    renderSections();
    document.getElementById("btnGenerate").addEventListener("click", doGenerate);
    document.getElementById("btnClear").addEventListener("click", doClear);
    refreshArtboards();
    if (!hasCep()) {
      setStatus("プレビュー表示中（Illustrator 外のため生成は無効）");
    }
  });
})();
