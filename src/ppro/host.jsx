#target premierepro

// Composition Guides — Premiere Pro 版
// ppro/host.jsx — CEP パネルから呼ばれるホスト API（Premiere ExtendScript）
//
// パネル(JS)が canvas で描いた透過 PNG を受け取り、プロジェクトの
// "Composition Guides" ビンへ読み込んで、アクティブシーケンスの最上段
// ビデオトラックに全尺で配置する。再生成は changeMediaPath で差し替える。
// build.ps1 が cep_ppro/jsx/host.jsx へコピーする。
//
// 戻り値はすべて文字列（evalScript の結果）。例外は "ERR:<msg>" で返す。

var CGPHost = {};

CGPHost.BIN_NAME = "Composition Guides";
// "Composition Guides（書き出し前に無効化）"。ExtendScript がファイルの文字コードを
// 取り違えても名前が化けないよう、非 ASCII は \u エスケープで書く。
CGPHost.CLIP_NAME = "Composition Guides\uFF08\u66F8\u304D\u51FA\u3057\u524D\u306B\u7121\u52B9\u5316\uFF09";

// アクティブシーケンス（無ければ null）
CGPHost._seq = function () {
    return (app.project && app.project.activeSequence) ? app.project.activeSequence : null;
};

// "W,H,<sequenceID>" / "NO_SEQ"
CGPHost.seqInfo = function () {
    try {
        var seq = CGPHost._seq();
        if (!seq) { return "NO_SEQ"; }
        return seq.frameSizeHorizontal + "," + seq.frameSizeVertical + "," + seq.sequenceID;
    } catch (e) {
        return "ERR:" + e;
    }
};

// PNG の出力先フォルダ（fsName）。保存済みプロジェクトなら同階層、
// 未保存ならドキュメントフォルダの下に "Composition Guides" を作る。
CGPHost.outDir = function () {
    try {
        var base = Folder.myDocuments;
        var path = CGPHost._stripLong(app.project.path);
        if (path && path !== "" && new File(path).exists) {
            base = new File(path).parent;
        }
        var folder = new Folder(base.fullName + "/Composition Guides");
        if (!folder.exists) { folder.create(); }
        return folder.fsName;
    } catch (e) {
        return "ERR:" + e;
    }
};

// "Composition Guides" ビンを返す（無ければ作成）
CGPHost._findBin = function () {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
        var it = root.children[i];
        if (it && it.type === ProjectItemType.BIN && it.name === CGPHost.BIN_NAME) { return it; }
    }
    return null;
};

CGPHost._bin = function () {
    var bin = CGPHost._findBin();
    if (bin) { return bin; }
    bin = app.project.rootItem.createBin(CGPHost.BIN_NAME);
    // createBin の戻り値が無い環境に備えて再探索する
    if (!bin) { bin = CGPHost._findBin(); }
    return bin;
};

CGPHost._itemName = function (seqId) {
    return "CG_" + seqId + ".png";
};

// ビン内のシーケンス用 PNG アイテム（無ければ null）
CGPHost._findItem = function (bin, seqId) {
    if (!bin) { return null; }
    var name = CGPHost._itemName(seqId);
    for (var i = 0; i < bin.children.numItems; i++) {
        var it = bin.children[i];
        if (it && it.name === name) { return it; }
    }
    return null;
};

// シーケンスの全ビデオトラックから item を使っている trackItem を探す
// 戻り値: { track, clip } or null
CGPHost._findPlaced = function (seq, item) {
    if (!item) { return null; }
    var tracks = seq.videoTracks;
    for (var t = 0; t < tracks.numTracks; t++) {
        var track = tracks[t];
        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (clip.projectItem && clip.projectItem.nodeId === item.nodeId) {
                return { track: track, clip: clip };
            }
        }
    }
    return null;
};

// Windows の長パス接頭辞（\\?\）を除く。app.project.path 等に付くことがある。
// バックスラッシュのエスケープ事故を避けるため文字コードで判定する（92 = "\"）。
CGPHost._stripLong = function (p) {
    if (p && p.length > 4 && p.charCodeAt(0) === 92 && p.charCodeAt(1) === 92 &&
        p.charAt(2) === "?" && p.charCodeAt(3) === 92) {
        return p.substr(4);
    }
    return p;
};

// 区切り文字差・長パス接頭辞を吸収したパス比較
CGPHost._samePath = function (a, b) {
    if (!a || !b) { return false; }
    return new File(CGPHost._stripLong(a)).fsName === new File(CGPHost._stripLong(b)).fsName;
};

// シーケンスの尺（ticks 文字列）。seq.end は zeroPoint（開始 TC）を含むので差し引く
// （Adobe 公式サンプル PProPanel と同じ式）。空シーケンスは null。
CGPHost._durTicks = function (seq) {
    var d = Number(seq.end) - Number(seq.zeroPoint);
    return (d > 0) ? String(d) : null;
};

// ガイドクリップの終端をシーケンス尺に合わせる（TrackItem.end はシーケンス先頭からの相対）。
// ponytail: 尺は伸ばす方向にしか追従しない（ガイド自身が最長クリップだと縮まない）。要望が出たらガイドを除いた最終クリップ端で計算
CGPHost._fitEnd = function (clip, durTicks) {
    if (!durTicks) { return; }   // 空シーケンス: 静止画の既定尺のまま
    var t = new Time();
    t.ticks = durTicks;
    clip.end = t;
};

// PNG を読み込み（既存なら差し替え）、最上段の空ビデオトラックへ全尺配置する。
// "OK" / "NO_SEQ" / "NO_TRACK" / "ERR:<msg>"
CGPHost.place = function (pngPath, seqId) {
    try {
        var seq = CGPHost._seq();
        if (!seq) { return "NO_SEQ"; }
        var fsPath = new File(pngPath).fsName;

        var bin = CGPHost._bin();
        if (!bin) { return "ERR:bin"; }
        var item = CGPHost._findItem(bin, seqId);

        // 置き場所の判定はアイテムに触る前に行う。NO_TRACK のときは何も変更していない
        // ので、パネル側が書き出した PNG を消してよい（main.js の _UNREFERENCED を参照）。
        // ponytail: 空トラック追加は QE DOM（非公開 API）が要るので使わない。要望が出たら addTracks を追加
        var placed = CGPHost._findPlaced(seq, item);
        var track = seq.videoTracks[seq.videoTracks.numTracks - 1];
        if (!placed && track.clips.numItems > 0) { return "NO_TRACK"; }

        if (item) {
            // 再生成: メディアを差し替える。差し替わったことを確かめてから古い PNG を消す
            // （失敗したまま消すとガイドがメディアオフラインになる）
            var oldPath = CGPHost._stripLong(item.getMediaPath());
            item.changeMediaPath(fsPath, true);
            if (!CGPHost._samePath(item.getMediaPath(), fsPath)) { return "ERR:changeMediaPath"; }
            if (oldPath && !CGPHost._samePath(oldPath, fsPath)) {
                var oldFile = new File(oldPath);
                if (oldFile.exists) { oldFile.remove(); }
            }
        } else {
            // 読み込み前後のビン内容の差分で新規アイテムを特定する（パス表記の差に依存しない）。
            // キーに "n" を付けるのは Object.prototype のプロパティ名と衝突させないため
            var before = {};
            for (var b = 0; b < bin.children.numItems; b++) {
                if (bin.children[b]) { before["n" + bin.children[b].nodeId] = true; }
            }
            app.project.importFiles([fsPath], true, bin, false);
            for (var i = 0; i < bin.children.numItems; i++) {
                var it = bin.children[i];
                if (it && it.type !== ProjectItemType.BIN && !before["n" + it.nodeId]) {
                    item = it;
                    break;
                }
            }
            if (!item) { return "ERR:import"; }
            item.name = CGPHost._itemName(seqId);
        }

        // 既に配置済みなら差し替え済みなので、尺だけ合わせ直す
        if (placed) {
            CGPHost._fitEnd(placed.clip, CGPHost._durTicks(seq));
            return "OK";
        }

        // ponytail: アナモルフィック（PAR≠1）シーケンスは未考慮。PNG はフレームサイズ px で作るため PAR≠1 では横方向がずれる。要望が出たら pixelAspectRatio で補正
        // 尺は配置前に読む（配置後だと静止画の既定尺がシーケンス尺に混ざる）
        var dur = CGPHost._durTicks(seq);
        track.overwriteClip(item, 0);
        placed = CGPHost._findPlaced(seq, item);
        if (!placed) { return "ERR:overwriteClip"; }
        var clip = placed.clip;
        CGPHost._fitEnd(clip, dur);
        clip.name = CGPHost.CLIP_NAME;
        return "OK";
    } catch (e) {
        return "ERR:" + e;
    }
};

// 配置済みガイドの有効/無効を切り替える。"ON" / "OFF" / "NOT_PLACED" / "NO_SEQ"
CGPHost.toggle = function (seqId) {
    try {
        var seq = CGPHost._seq();
        if (!seq) { return "NO_SEQ"; }
        var placed = CGPHost._findPlaced(seq, CGPHost._findItem(CGPHost._findBin(), seqId));
        if (!placed) { return "NOT_PLACED"; }
        placed.clip.disabled = !placed.clip.disabled;
        return placed.clip.disabled ? "OFF" : "ON";
    } catch (e) {
        return "ERR:" + e;
    }
};

// 配置済みガイドをシーケンスから外す（projectItem と PNG は残す）。
// "OK" / "NOT_PLACED" / "NO_SEQ"
CGPHost.clear = function (seqId) {
    try {
        var seq = CGPHost._seq();
        if (!seq) { return "NO_SEQ"; }
        // 探すだけ。ビンが無ければ作らない（_findItem は null を許容する）
        var item = CGPHost._findItem(CGPHost._findBin(), seqId);
        var removed = 0;
        // 同じアイテムが複数配置されていることがあるので再探索しながら消す（上限は無限ループ防止）
        for (var n = 0; n < 100; n++) {
            var placed = CGPHost._findPlaced(seq, item);
            if (!placed) { break; }
            placed.clip.remove(false, true);
            removed++;
        }
        return (removed > 0) ? "OK" : "NOT_PLACED";
    } catch (e) {
        return "ERR:" + e;
    }
};
