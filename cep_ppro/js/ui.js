// Composition Guides — CEP パネル 共通 UI（Illustrator / Premiere Pro）
// ホスト非依存の UI 部品（スキーマ・DOM 生成・evalScript・ステータス表示）を
// window.CGUI に載せる。ホストごとの処理は各パネルの js/main.js が持つ。
// Premiere 版（cep_ppro/js/ui.js）は build.ps1 がこのファイルをコピーする。
//
// 注: 大きな CSInterface.js は使わず、CEP の低レベル API
//     window.__adobe_cep__ を直接利用する。

(function () {
  "use strict";

  // --- UI スキーマ ---
  // c: チェック / cs: チェック+セレクト / cn: チェック+数値群 / csn: チェック+セレクト+数値群
  var SCHEMA = [
    { title: "構図", controls: [
      { kind: "c", key: "show_thirds", label: "三分割" },
      { kind: "c", key: "show_golden", label: "黄金比" },
      { kind: "c", key: "show_diagonal", label: "対角線" },
      { kind: "c", key: "show_center", label: "中央十字" },
      { kind: "c", key: "show_golden_section", label: "黄金分割" },
      { kind: "cs", key: "show_triangle", label: "三角構図", sel: "triangle_orientation",
        options: [["TL_BR", "TL→BR"], ["TR_BL", "TR→BL"]] },
      { kind: "c", key: "show_spiral_tl", label: "黄金螺旋 左上 TL" },
      { kind: "c", key: "show_spiral_tr", label: "黄金螺旋 右上 TR" },
      { kind: "c", key: "show_spiral_bl", label: "黄金螺旋 左下 BL" },
      { kind: "c", key: "show_spiral_br", label: "黄金螺旋 右下 BR" }
    ]},
    { title: "絵画構図", controls: [
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

  function makeCheckbox(state, key, label) {
    var lab = el("label", "cb");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!state[key];
    cb.addEventListener("change", function () { state[key] = cb.checked; });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, label));
    return lab;
  }

  function makeSelect(state, key, options) {
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

  function makeNum(state, key, label, isInt) {
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

  function renderControl(state, c) {
    var row = el("div", "row");
    if (c.kind === "c") {
      row.appendChild(makeCheckbox(state, c.key, c.label));
    } else if (c.kind === "cs") {
      row.appendChild(makeCheckbox(state, c.key, c.label));
      row.appendChild(makeSelect(state, c.sel, c.options));
    } else if (c.kind === "cn") {
      row.appendChild(makeCheckbox(state, c.key, c.label));
      for (var i = 0; i < c.nums.length; i++) {
        row.appendChild(makeNum(state, c.nums[i][0], c.nums[i][1], c.nums[i][2]));
      }
    } else if (c.kind === "csn") {
      row.appendChild(makeCheckbox(state, c.key, c.label));
      row.appendChild(makeSelect(state, c.sel, c.options));
      for (var j = 0; j < c.nums.length; j++) {
        row.appendChild(makeNum(state, c.nums[j][0], c.nums[j][1], c.nums[j][2]));
      }
    } else if (c.kind === "n") {
      for (var m = 0; m < c.nums.length; m++) {
        row.appendChild(makeNum(state, c.nums[m][0], c.nums[m][1], c.nums[m][2]));
      }
    } else if (c.kind === "cc") {
      for (var n = 0; n < c.checks.length; n++) {
        row.appendChild(makeCheckbox(state, c.checks[n][0], c.checks[n][1]));
      }
    }
    return row;
  }

  // state にバインドした各セクションを hostEl へ追加する
  function render(state, hostEl) {
    for (var s = 0; s < SCHEMA.length; s++) {
      var sec = el("section", "panel");
      sec.appendChild(el("h2", null, SCHEMA[s].title));
      for (var c = 0; c < SCHEMA[s].controls.length; c++) {
        sec.appendChild(renderControl(state, SCHEMA[s].controls[c]));
      }
      hostEl.appendChild(sec);
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

  window.CGUI = {
    SCHEMA: SCHEMA,
    el: el,
    makeCheckbox: makeCheckbox,
    makeSelect: makeSelect,
    makeNum: makeNum,
    renderControl: renderControl,
    render: render,
    hasCep: hasCep,
    evalScript: evalScript,
    setStatus: setStatus
  };
})();
