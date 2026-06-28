// Composition Guides for Illustrator
// host.jsx — CEP パネルから呼ばれるホスト API
//
// CEP パネル(JS)は __adobe_cep__.evalScript で CGHost.* を呼ぶ。
// ExtendScript には JSON が無いため、状態は eval('('+str+')') でパースする
// （ローカルの信頼できるデータのみを扱う）。

var CGHost = {};

CGHost._doc = function () {
    return (app.documents.length > 0) ? app.activeDocument : null;
};

// state(JSON文字列) を受け取りガイド生成。戻り値は "OK:<index>" / "NO_DOC" / "ERR:<msg>"
CGHost.generate = function (jsonStr) {
    var doc = CGHost._doc();
    if (!doc) { return "NO_DOC"; }
    var state;
    try {
        state = eval("(" + jsonStr + ")");
    } catch (e) {
        return "ERR:state parse: " + e;
    }
    try {
        var idx = CG.generate(doc, state);
        return "OK:" + idx;
    } catch (e2) {
        return "ERR:" + e2;
    }
};

// 専用レイヤーを全消去。"OK" / "NO_DOC"
CGHost.clear = function () {
    var doc = CGHost._doc();
    if (!doc) { return "NO_DOC"; }
    CG.layer.clear(doc);
    app.redraw();
    return "OK";
};

// アートボード名一覧（改行区切り）。ドキュメントが無ければ空文字
CGHost.artboards = function () {
    var doc = CGHost._doc();
    if (!doc) { return ""; }
    var names = [];
    for (var i = 0; i < doc.artboards.length; i++) {
        names.push(doc.artboards[i].name);
    }
    return names.join("\n");
};
