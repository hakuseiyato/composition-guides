// Composition Guides for Illustrator
// generate.jsx — メインディスパッチャ（Blender core.py 相当）
//
// state に基づき、専用レイヤーを作り直して有効なガイドを描画する。

// doc: IL=Document / AE=CompItem。基準フレーム取得とレイヤー生成はバックエンドが担う。
CG.generate = function (doc, state) {
    var frame = CG.frame.fromBase(doc, state);
    var layer = CG.layer.recreate(doc);
    var ctx = { frame: frame, layer: layer, state: state };

    // 構図ガイド
    if (state.show_thirds)         { CG.guides.thirds(ctx); }
    if (state.show_golden)         { CG.guides.golden(ctx); }
    if (state.show_diagonal)       { CG.guides.diagonal(ctx); }
    if (state.show_center)         { CG.guides.center(ctx); }
    if (state.show_quad)           { CG.guides.quad(ctx); }
    if (state.show_triangle)       { CG.guides.triangle(ctx); }
    if (state.show_golden_section) { CG.guides.golden_section(ctx); }

    // 絵画構図
    if (state.show_division)       { CG.guides.division(ctx); }
    if (state.show_symmetry)       { CG.guides.symmetry(ctx); }

    // Phase 2: パラメトリック
    if (state.show_spiral)          { CG.guides.spiral(ctx); }
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

    // 枠
    if (state.show_frame)          { CG.guides.frame_border(ctx); }

    CG.layer.finalize(layer);
    CG.host.redraw();
    return frame.index;
};
