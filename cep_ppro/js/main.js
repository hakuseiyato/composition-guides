// Composition Guides — Premiere Pro CEP パネル ロジック
// 状態(state)を保持し、HTML コントロールへバインドする。生成時はパネル内の
// canvas にエンジン（js/engine.js の CG.generate）でガイドを描いて透過 PNG を書き出し、
// ExtendScript(CGPHost) にシーケンスへの配置を依頼する。
// UI 部品は js/ui.js（CGUI）。

(function () {
  "use strict";

  var state = CG.defaults();

  // CGPHost.place がアイテムに触る前に返す結果（書き出した PNG は未参照）
  var _UNREFERENCED = { "NO_SEQ": true, "NO_TRACK": true, "ERR:bin": true, "ERR:changeMediaPath": true };

  // アクティブシーケンスの W,H,id を取得して cb(W, H, id) を呼ぶ。
  // 失敗時はステータスにエラーを出す（quiet なら何もしない）。
  function withSeq(cb, quiet) {
    CGUI.evalScript("CGPHost.seqInfo()", function (res) {
      function fail(msg) { if (!quiet) { CGUI.setStatus(msg, "err"); } }
      if (res === "NO_CEP") { fail("プレビュー表示中のため実行できません（Premiere Pro 外）"); return; }
      if (res === "NO_SEQ") { fail("アクティブなシーケンスがありません"); return; }
      if (!res || res.indexOf("ERR:") === 0) { fail("失敗: " + res); return; }
      var parts = res.split(",");
      var w = parseInt(parts[0], 10);
      var h = parseInt(parts[1], 10);
      var id = parts.slice(2).join(",");
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) { fail("シーケンスのフレームサイズが不正です: " + res); return; }
      document.getElementById("seqInfo").textContent = "アクティブシーケンス（" + w + "×" + h + "）";
      cb(w, h, id);
    });
  }

  function doGenerate() {
    CGUI.setStatus("生成中…");
    withSeq(function (w, h, id) {
      CGUI.evalScript("CGPHost.outDir()", function (dir) {
        if (!dir || dir.indexOf("ERR:") === 0) { CGUI.setStatus("失敗: " + dir, "err"); return; }

        var canvasEl = document.getElementById("cgCanvas");
        try {
          CG.generate({ width: w, height: h, canvas: canvasEl }, state);
        } catch (e) {
          CGUI.setStatus("描画に失敗しました: " + e, "err");
          return;
        }

        var b64 = canvasEl.toDataURL("image/png").split(",")[1];
        var name = "CG_" + id.replace(/[^A-Za-z0-9-]/g, "_") + "_" + Date.now() + ".png";
        var path = dir.replace(/[\\\/]$/, "") + "/" + name;
        var r = window.cep.fs.writeFile(path, b64, window.cep.encoding.Base64);
        if (r.err !== 0) { CGUI.setStatus("PNG の書き出しに失敗しました（err=" + r.err + "）", "err"); return; }

        CGUI.evalScript("CGPHost.place(" + JSON.stringify(path) + "," + JSON.stringify(id) + ")", function (res) {
          // プロジェクトがこの PNG を参照していないと確定している結果のときだけ消す
          // （ERR:import / ERR:overwriteClip / 例外は読み込み済みの可能性があるので残す）
          if (_UNREFERENCED[res]) { window.cep.fs.deleteFile(path); }
          if (res === "OK") {
            CGUI.setStatus("生成しました（" + w + "×" + h + "）。書き出し前に『表示切替』で無効化してください", "ok");
          } else if (res === "NO_TRACK") {
            CGUI.setStatus("最上段のビデオトラックが空いていません。空のビデオトラックを最上段に追加してください", "err");
          } else if (res === "NO_SEQ") {
            CGUI.setStatus("アクティブなシーケンスがありません", "err");
          } else {
            CGUI.setStatus("失敗: " + res, "err");
          }
        });
      });
    });
  }

  function doToggle() {
    withSeq(function (w, h, id) {
      CGUI.evalScript("CGPHost.toggle(" + JSON.stringify(id) + ")", function (res) {
        if (res === "ON") { CGUI.setStatus("ガイドを表示しました", "ok"); }
        else if (res === "OFF") { CGUI.setStatus("ガイドを無効化しました（書き出されません）", "ok"); }
        else if (res === "NOT_PLACED") { CGUI.setStatus("配置されたガイドがありません", "err"); }
        else { CGUI.setStatus("失敗: " + res, "err"); }
      });
    });
  }

  function doClear() {
    withSeq(function (w, h, id) {
      CGUI.evalScript("CGPHost.clear(" + JSON.stringify(id) + ")", function (res) {
        if (res === "OK") { CGUI.setStatus("ガイドを消去しました", "ok"); }
        else if (res === "NOT_PLACED") { CGUI.setStatus("配置されたガイドがありません", "err"); }
        else { CGUI.setStatus("失敗: " + res, "err"); }
      });
    });
  }

  // --- 初期化 ---
  document.addEventListener("DOMContentLoaded", function () {
    CGUI.render(state, document.getElementById("sections"));
    document.getElementById("btnGenerate").addEventListener("click", doGenerate);
    document.getElementById("btnToggle").addEventListener("click", doToggle);
    document.getElementById("btnClear").addEventListener("click", doClear);
    if (!CGUI.hasCep()) {
      CGUI.setStatus("プレビュー表示中（Premiere Pro 外のため生成は無効）");
    } else {
      withSeq(function () {}, true);   // シーケンス情報の表示だけ更新
    }
  });
})();
