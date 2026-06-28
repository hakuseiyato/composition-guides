// Composition Guides for Illustrator
// state.jsx — 設定 state と既定値（Blender props.py 相当）
//
// ExtendScript (ES3) 互換。CG 名前空間に載せる。

// 黄金比定数 / Golden ratio constants
CG.PHI = (1.0 + Math.sqrt(5.0)) / 2.0;       // ≈ 1.6180339887
CG.PHI_SHORT = 1.0 / (1.0 + CG.PHI);          // ≈ 0.3819660113 (短辺比)
CG.PHI_LONG = CG.PHI / (1.0 + CG.PHI);        // ≈ 0.6180339887 (長辺比)

// 既定設定を返す / Return default settings object
CG.defaults = function () {
    return {
        // 基準アートボード index（-1 = アクティブ）
        artboard_index: -1,

        // ----- 構図ガイド / Composition guides -----
        show_thirds: true,
        show_golden: false,
        show_diagonal: false,
        show_center: false,
        show_quad: false,
        show_triangle: false,
        triangle_orientation: "TL_BR",   // 'TL_BR' / 'TR_BL'
        show_golden_section: false,

        // ----- 絵画構図 / Painting -----
        show_division: false,
        division_axis: "H",              // 'H' / 'V'
        show_symmetry: false,
        symmetry_axis: "V",              // 'H' / 'V' / 'BOTH'

        // ----- Phase 2: パラメトリック / Parametric -----
        show_spiral: false,
        spiral_orientation: "TL",        // 'TL' / 'TR' / 'BL' / 'BR'

        show_horizontal_line: false,
        horizontal_pos: 0.5,             // 0=下端, 1=上端

        show_vertical_line: false,
        vertical_pos: 0.5,               // 0=左端, 1=右端

        show_slanted: false,
        slanted_angle_deg: 30.0,         // 度（UV 空間, 0=水平, 90=垂直）
        slanted_count: 4,
        slanted_spread: 0.9,             // 法線方向の総拡がり (UV)

        show_pattern: false,
        pattern_cols: 6,
        pattern_rows: 6,

        show_bullseye: false,
        bullseye_rings: 2,               // 同心円の数（0 で十字のみ）

        // ----- Phase 2: 領域 / Area -----
        show_safe_area: false,
        safe_action: 0.9,                // アクション安全域（短辺比）
        safe_title: 0.8,                 // タイトル安全域

        show_aspect: false,
        aspect_ratio: "9_16",            // '1_1' '9_16' '16_9' '4_3' '21_9' 'CUSTOM'
        aspect_custom_w: 2.39,
        aspect_custom_h: 1.0,

        // ----- Phase 3: パース線 / Perspective -----
        show_perspective: false,
        perspective_mode: "2P",          // '1P' / '2P' / '3P'
        perspective_horizon_v: 0.5,      // 水平線の高さ (0..1)
        perspective_vp1_u: 0.5,          // 1P の VP の横位置 (0..1)
        perspective_vp_spread: 0.9,      // 2P/3P 左右VPの中心からの半幅比（>0.5 で画面外）
        perspective_vp3_dist: 1.5,       // 3P 垂直VPの horizon からの距離 (UV-v, 符号付き)
        perspective_lines: 12,           // 各 VP からの放射本数
        perspective_show_vp_marker: true,
        perspective_show_horizon: true,

        // ----- 枠 / Frame -----
        show_frame: false
    };
};
