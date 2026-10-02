// Composition Guides — After Effects 版
// ae/figure.jsx — 写真に合わせた人物サイズ合わせ
//
// 地面に立つ物体の画面上の高さは水平線からの垂直距離に正比例する、という幾何ルールを扱う。

CG.ae = CG.ae || {};
CG.ae.figure = {};

CG.ae.figure.REF_NAME = "CG Figure Ref";
CG.ae.figure.EFF_REF_SCALE = "基準スケール";
CG.ae.figure.EFF_RATIO = "身長比";

// 名前でレイヤーを引く（無ければ null）。comp.layer(name) は該当なしで例外を投げるため、
// ae/vpexpr.jsx と同じく名前を走査する。
CG.ae.figure.findLayer = function (comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) { return comp.layer(i); }
    }
    return null;
};

CG.ae.figure.hasLayer = function (comp, name) {
    return CG.ae.figure.findLayer(comp, name) !== null;
};

CG.ae.figure.ensureSlider = function (lyr, effName, defVal) {
    var effects = lyr.property("ADBE Effect Parade");
    var i;
    var eff;
    for (i = 1; i <= effects.numProperties; i++) {
        eff = effects.property(i);
        if (eff.name === effName) {
            return eff;
        }
    }
    eff = effects.addProperty("ADBE Slider Control");
    eff.name = effName;
    // UI 言語で変わる「スライダー」や "Slider" ではなく、値は eff.property(1) で参照する。
    eff.property(1).setValue(defVal);
    return eff;
};

CG.ae.figure.ensureRef = function (comp) {
    var lyr = CG.ae.figure.findLayer(comp, CG.ae.figure.REF_NAME);
    var tr;
    if (!lyr) {
        lyr = comp.layers.addNull();
        lyr.name = CG.ae.figure.REF_NAME;
        tr = lyr.property("ADBE Transform Group");
        tr.property("ADBE Anchor Point").setValue([lyr.width / 2, lyr.height / 2]);
        tr.property("ADBE Scale").setValue([25, 25]);
        // VP ヌルのラベル 9 と区別する。
        lyr.label = 11;
    }
    CG.ae.figure.ensureSlider(lyr, CG.ae.figure.EFF_REF_SCALE, 100);
    return lyr;
};

CG.ae.figure.setRef = function (comp, srcLayer) {
    var ref = CG.ae.figure.ensureRef(comp);
    var refTr = ref.property("ADBE Transform Group");
    var srcTr = srcLayer.property("ADBE Transform Group");
    var eff = CG.ae.figure.ensureSlider(ref, CG.ae.figure.EFF_REF_SCALE, 100);
    // value は式が付いていても評価後の実効値を返す。
    // Ref ヌルは 2D なので、3D レイヤーを基準にしても落ちないよう xy だけ取る。
    var sp = srcTr.property("ADBE Position").value;
    refTr.property("ADBE Position").setValue([sp[0], sp[1]]);
    eff.property(1).setValue(srcTr.property("ADBE Scale").value[0]);
    return ref;
};

// 自分のレイヤーに toComp() を呼ぶと Scale 式が自分の transform を参照して循環参照になるため、position を直接使う。親子付けなし・2D レイヤー前提。
// 全体を try/catch で包むので、「全消去」で VP ヌルや Ref が消えてもイラストのスケールは壊れず直前値のままになる。
// スライダー値は UI 言語に依存しない effect("名前")(1) のインデックス形式で参照する。
CG.ae.figure.scaleExpr = function (mode) {
    if (mode === "1P") {
        return "try {\n" +
            "    var A = thisComp.layer(\"" + CG.ae.vp.NAMES.P1 + "\");\n" +
            "    var hz = A.toComp(A.anchorPoint)[1];\n" +
            "    var R = thisComp.layer(\"" + CG.ae.figure.REF_NAME + "\");\n" +
            "    var r = R.position;\n" +
            "    var s0 = R.effect(\"" + CG.ae.figure.EFF_REF_SCALE + "\")(1);\n" +
            "    var ratio = effect(\"" + CG.ae.figure.EFF_RATIO + "\")(1);\n" +
            "    var d0 = r[1] - hz;\n" +
            "    var d = position[1] - hz;\n" +
            "    var k = (Math.abs(d0) < 1e-6) ? value[0] : s0 * (d / d0) * ratio;\n" +
            "    [k, k];\n" +
            "} catch (e) { value; }";
    }
    return "try {\n" +
        "    var A = thisComp.layer(\"" + CG.ae.vp.NAMES.L + "\"), B = thisComp.layer(\"" + CG.ae.vp.NAMES.R + "\");\n" +
        "    var a = A.toComp(A.anchorPoint), b = B.toComp(B.anchorPoint);\n" +
        "    var R = thisComp.layer(\"" + CG.ae.figure.REF_NAME + "\");\n" +
        "    var r = R.position;\n" +
        "    var s0 = R.effect(\"" + CG.ae.figure.EFF_REF_SCALE + "\")(1);\n" +
        "    var ratio = effect(\"" + CG.ae.figure.EFF_RATIO + "\")(1);\n" +
        "    var dxAB = b[0] - a[0];\n" +
        "    var m = (Math.abs(dxAB) < 1e-6) ? 0 : (b[1] - a[1]) / dxAB;\n" +
        "    var d0 = r[1] - (a[1] + m * (r[0] - a[0]));\n" +
        "    var d = position[1] - (a[1] + m * (position[0] - a[0]));\n" +
        "    var k = (Math.abs(d0) < 1e-6) ? value[0] : s0 * (d / d0) * ratio;\n" +
        "    [k, k];\n" +
        "} catch (e) { value; }";
};

CG.ae.figure.link = function (comp, layers, mode) {
    var count = 0;
    var i;
    var lyr;
    for (i = 0; i < layers.length; i++) {
        lyr = layers[i];
        // 誤選択防止のため、基準ヌルと VP ヌルをスキップする。
        if (lyr.name === CG.ae.figure.REF_NAME || lyr.name.indexOf(CG.ae.vp.PREFIX) === 0) {
            continue;
        }
        CG.ae.figure.ensureSlider(lyr, CG.ae.figure.EFF_RATIO, 1.0);
        lyr.property("ADBE Transform Group").property("ADBE Scale").expression = CG.ae.figure.scaleExpr(mode);
        count++;
    }
    return count;
};

CG.ae.figure.unlink = function (comp, layers) {
    var count = 0;
    var i;
    var sc;
    var v;
    for (i = 0; i < layers.length; i++) {
        sc = layers[i].property("ADBE Transform Group").property("ADBE Scale");
        if (sc.expression !== "") {
            // 式適用前の value に戻らないよう、解除前の実効値を保持する。
            v = sc.value;
            sc.expression = "";
            sc.setValue(v);
            count++;
        }
    }
    return count;
};

CG.ae.figure.anchorToBottom = function (comp, layers) {
    var count = 0;
    var i;
    var lyr;
    var tr;
    var anchorProp;
    var scaleProp;
    var posProp;
    var a0;
    var a1;
    var sc;
    var p0;
    var p1;
    for (i = 0; i < layers.length; i++) {
        lyr = layers[i];
        tr = lyr.property("ADBE Transform Group");
        anchorProp = tr.property("ADBE Anchor Point");
        scaleProp = tr.property("ADBE Scale");
        posProp = tr.property("ADBE Position");
        a0 = anchorProp.value;
        a1 = [lyr.width / 2, lyr.height];
        sc = scaleProp.value;
        p0 = posProp.value;
        p1 = [p0[0] + (a1[0] - a0[0]) * sc[0] / 100, p0[1] + (a1[1] - a0[1]) * sc[1] / 100];
        // 3D レイヤーは xyz 3 成分なので、z を保ったまま返す（成分数が違うと setValue が失敗する）
        if (a0.length > 2) { a1.push(a0[2]); p1.push(p0[2]); }
        // 回転なし前提。Scale に式がある場合も壊さないよう Scale 自体には触らない。
        anchorProp.setValue(a1);
        posProp.setValue(p1);
        count++;
    }
    return count;
};
