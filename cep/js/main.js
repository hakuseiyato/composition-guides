// Composition Guides — CEP パネル ロジック
// 状態(state)を保持し、HTML コントロールへバインドして、生成/消去時に
// ExtendScript エンジン(CGHost)へ evalScript で渡す。
// UI 部品は js/ui.js（CGUI）。
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
    show_triangle: false,
    triangle_orientation: "TL_BR",
    show_golden_section: false,


    show_spiral_tl: false,
    show_spiral_tr: false,
    show_spiral_bl: false,
    show_spiral_br: false,
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

  function refreshArtboards() {
    var sel = document.getElementById("artboard");
    CGUI.evalScript("CGHost.artboards()", function (res) {
      sel.innerHTML = "";
      var opt0 = CGUI.el("option", null, "アクティブ");
      opt0.value = "-1";
      sel.appendChild(opt0);
      // 全アートボード一括生成
      var optAll = CGUI.el("option", null, "すべて");
      optAll.value = "-2";
      sel.appendChild(optAll);
      if (res && res !== "NO_CEP") {
        var names = res.split("\n");
        for (var i = 0; i < names.length; i++) {
          if (names[i] === "") { continue; }
          var o = CGUI.el("option", null, (i + 1) + ": " + names[i]);
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
    CGUI.setStatus("生成中…");
    CGUI.evalScript("CGHost.generate(" + JSON.stringify(json) + ")", function (res) {
      if (res && res.indexOf("OK") === 0) {
        var idx = res.split(":")[1];
        if (idx === "-2") {
          CGUI.setStatus("全アートボードに生成しました", "ok");
        } else {
          CGUI.setStatus("生成しました（アートボード " + idx + "）", "ok");
        }
      } else if (res === "NO_DOC") {
        CGUI.setStatus("ドキュメントが開かれていません", "err");
      } else {
        CGUI.setStatus("失敗: " + res, "err");
      }
    });
  }

  function doClear() {
    CGUI.evalScript("CGHost.clear()", function (res) {
      if (res === "OK") { CGUI.setStatus("ガイドを消去しました", "ok"); }
      else if (res === "NO_DOC") { CGUI.setStatus("ドキュメントが開かれていません", "err"); }
      else { CGUI.setStatus("失敗: " + res, "err"); }
    });
  }

  // --- 初期化 ---
  document.addEventListener("DOMContentLoaded", function () {
    CGUI.render(state, document.getElementById("sections"));
    document.getElementById("btnGenerate").addEventListener("click", doGenerate);
    document.getElementById("btnClear").addEventListener("click", doClear);
    refreshArtboards();
    if (!CGUI.hasCep()) {
      CGUI.setStatus("プレビュー表示中（Illustrator 外のため生成は無効）");
    }
  });
})();
