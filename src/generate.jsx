// Composition Guides for Illustrator
// generate.jsx — メインディスパッチャ（Blender core.py 相当）
//
// state に基づき、専用レイヤーを作り直して有効なガイドを描画する。

// 1 フレーム分のガイドを描く。frame / layer / state を受け取る。
CG._drawFrame = function (frame, layer, state) {
    var ctx = { frame: frame, layer: layer, state: state };

    // 構図ガイド
    if (state.show_thirds)         { CG.guides.thirds(ctx); }
    if (state.show_golden)         { CG.guides.golden(ctx); }
    if (state.show_diagonal)       { CG.guides.diagonal(ctx); }
    if (state.show_center)         { CG.guides.center(ctx); }
    if (state.show_triangle)       { CG.guides.triangle(ctx); }
    if (state.show_golden_section) { CG.guides.golden_section(ctx); }

    // 絵画構図

    // Phase 2: パラメトリック
    if (state.show_spiral_tl || state.show_spiral_tr || state.show_spiral_bl || state.show_spiral_br) { CG.guides.spiral(ctx); }
    if (state.show_horizontal_line) { CG.guides.horizontal_line(ctx); }
    if (state.show_vertical_line)   { CG.guides.vertical_line(ctx); }
    if (state.show_slanted)         { CG.guides.slanted(ctx); }
    if (state.show_pattern)         { CG.guides.pattern(ctx); }
    if (state.show_bullseye)        { CG.guides.bullseye(ctx); }

    // Phase 2: 領域
    if (state.show_safe_area)       { CG.guides.safe_area(ctx); }
    if (state.show_aspect)          { CG.guides.aspect_mask(ctx); }

    // Phase 3: パース線
    if (state.show_perspective)     { CG.guides.perspective(ctx); }
    else if (CG.layer.pruneVP)      { CG.layer.pruneVP(frame, []); }   // AE: パース OFF なら VP ヌルも掃除

    // 枠
    if (state.show_frame)          { CG.guides.frame_border(ctx); }
};

// doc: IL=Document / AE=CompItem。基準フレーム取得とレイヤー生成はバックエンドが担う。
// 戻り値: 単一フレームならその index、複数フレーム（全アートボード）なら -2。
CG.generate = function (doc, state) {
    var frames = CG.frame.list(doc, state);
    var layer = CG.layer.recreate(doc);
    if (CG.dedup) { CG.dedup.reset(); }          // AE では未ロード = no-op
    for (var i = 0; i < frames.length; i++) {
        CG._drawFrame(frames[i], layer, state);
    }
    CG.layer.finalize(layer);
    CG.host.redraw();
    // -2 = 「全アートボードモードで生成した」。frames.length で判定すると
    // アートボードが 1 枚の文書で「すべて」を選んだときに UI の文言がずれる
    return (state.artboard_index === -2) ? -2 : frames[0].index;
};
