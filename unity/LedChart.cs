using System.Collections.Generic;
using UnityEngine;

namespace Yato.CompositionGuides
{
    [System.Serializable]
    public class LedPanel
    {
        [Tooltip("パネル名")]
        public string name = "P1";
        [Tooltip("パネルの色")]
        public Color color = Color.red;
        [Tooltip("チャート左端からの X 座標（px）")]
        public float x = 0f;
        [Tooltip("チャート上端からの Y 座標（px）")]
        public float y = 0f;
        [Tooltip("パネルの幅（px）")]
        public float w = 1000f;
        [Tooltip("パネルの高さ（px）")]
        public float h = 600f;
        [Tooltip("横方向のモジュール数（小数可）")]
        public float cols = 10f;
        [Tooltip("縦方向のモジュール数（小数可）")]
        public float rows = 5f;
        [Tooltip("パネルの実寸幅（mm、ラベル表示用）")]
        public float physW = 9000f;
        [Tooltip("パネルの実寸高さ（mm、ラベル表示用）")]
        public float physH = 3000f;
    }

    [ExecuteAlways]
    [RequireComponent(typeof(Camera))]
    [DisallowMultipleComponent]
    [AddComponentMenu("Yato/LED Chart")]
    public class LedChart : MonoBehaviour
    {
        [Header("チャート全体 / Chart")]
        [Tooltip("チャートの幅（px）")]
        public int chartWidth = 3840;
        [Tooltip("チャートの高さ（px）")]
        public int chartHeight = 2160;
        [Tooltip("チャート全体をカメラ表示領域に収める")]
        public bool fitToScreen = true;
        [Tooltip("チャート背景を描画する")]
        public bool drawBackground = true;
        [Tooltip("背景をチャート矩形ではなくカメラ表示領域全体に広げる（レターボックス部も塗り、カメラ映像を完全に隠す）")]
        public bool fillViewBackground = false;
        [Tooltip("チャート背景の色")]
        public Color bgColor = Color.black;
        [Tooltip("線と文字の色")]
        public Color lineColor = Color.white;
        [Range(0f, 1f)]
        [Tooltip("線の不透明度")]
        public float lineOpacity = 0.55f;

        [Header("表示要素 / Elements")]
        [Tooltip("パネルを市松模様で塗る")]
        public bool showChecker = true;
        [Tooltip("モジュール境界線を表示する")]
        public bool showModGrid = true;
        [Tooltip("パネルの対角線を表示する")]
        public bool showDiag = true;
        [Tooltip("パネル中央の円を表示する")]
        public bool showCircle = true;
        [Tooltip("パネルの仕様ラベルを表示する")]
        public bool showLabel = true;
        [Tooltip("パネル外枠を表示する")]
        public bool showPanelBorder = true;

        [Header("中央テキスト / Center Text")]
        [Tooltip("チャート中央に表示するタイトル")]
        public string centerText = "Center Video Wall";
        [Tooltip("チャート解像度を自動表示する")]
        public bool autoRes = true;
        [Tooltip("自動表示を無効にしたときの解像度テキスト")]
        public string resText = "";

        [Header("パネル / Panels")]
        [Tooltip("LED パネルの一覧")]
        public List<LedPanel> panels = new List<LedPanel>();

        [Header("ゲーム内パネル / In-Game Panel")]
        [Tooltip("Game ビュー内に ON/OFF トグルパネルを表示する")]
        public bool showPanel = true;
        [Tooltip("トグルパネルを表示する画面の隅")]
        public CompositionGuides.PanelCorner panelCorner = CompositionGuides.PanelCorner.TopLeft;
        [Tooltip("LED チャート全体を表示する")]
        public bool chartVisible = true;

        private Material _material;
        private float _scale, _offsetX, _offsetY;
        private Rect _viewRect;
        private readonly List<Vector2> _quads = new List<Vector2>();
        private readonly List<Color> _quadColors = new List<Color>();
        private readonly List<Vector2> _lines = new List<Vector2>();
        private readonly List<Color> _lineColors = new List<Color>();
        private const float PANEL_SCALE = 1.4f;
        private const float TEXT_BASE_SIZE = 32f;

        private void OnEnable()
        {
            UnityEngine.Rendering.RenderPipelineManager.endCameraRendering -= OnEndCameraRendering;
            Camera.onPostRender -= OnCameraPostRender;

            if (UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline != null)
            {
                UnityEngine.Rendering.RenderPipelineManager.endCameraRendering += OnEndCameraRendering;
            }
            else
            {
                Camera.onPostRender += OnCameraPostRender;
            }
        }

        private void OnDisable()
        {
            UnityEngine.Rendering.RenderPipelineManager.endCameraRendering -= OnEndCameraRendering;
            Camera.onPostRender -= OnCameraPostRender;
            DestroyMaterial();
        }

        private void OnEndCameraRendering(UnityEngine.Rendering.ScriptableRenderContext context, Camera cam)
        {
            if (cam != GetComponent<Camera>()) { return; }
            DrawChart(cam);
        }

        private void OnCameraPostRender(Camera cam)
        {
            if (cam != GetComponent<Camera>()) { return; }
            DrawChart(cam);
        }

        private void OnDestroy()
        {
            DestroyMaterial();
        }

        private void DestroyMaterial()
        {
            if (_material != null)
            {
                DestroyImmediate(_material);
                _material = null;
            }
        }

        private void EnsureMaterial()
        {
            if (_material != null) { return; }
            var shader = Shader.Find("Hidden/Internal-Colored");
            if (shader == null) { return; }
            _material = new Material(shader);
            _material.hideFlags = HideFlags.HideAndDontSave;
            _material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            _material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            _material.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
            _material.SetInt("_ZWrite", 0);
            _material.SetInt("_ZTest", (int)UnityEngine.Rendering.CompareFunction.Always);
        }

        private bool UpdateTransform(Camera cam)
        {
            if (cam == null || chartWidth <= 0 || chartHeight <= 0) { return false; }
            var pr = cam.pixelRect;
            if (pr.width <= 0f || pr.height <= 0f) { return false; }
            _scale = fitToScreen ? Mathf.Min(pr.width / chartWidth, pr.height / chartHeight) : 1f;
            _offsetX = pr.xMin + (pr.width - chartWidth * _scale) * 0.5f;
            _offsetY = pr.yMin + (pr.height - chartHeight * _scale) * 0.5f;
            _viewRect = pr;
            return true;
        }

        private Vector2 Pt(double cx, double cy)
        {
            return new Vector2(_offsetX + (float)cx * _scale,
                               _offsetY + (chartHeight - (float)cy) * _scale);
        }

        private Vector2 GuiPt(double cx, double cy)
        {
            Vector2 point = Pt(cx, cy);
            return new Vector2(point.x, Screen.height - point.y);
        }

        private void DrawChart(Camera cam)
        {
            if (!chartVisible || !UpdateTransform(cam)) { return; }

            BuildBuffers();
            if (_quads.Count < 4 && _lines.Count < 2) { return; }

            EnsureMaterial();
            if (_material == null) { return; }

            var prevActive = RenderTexture.active;
            RenderTexture.active = cam.targetTexture;
            GL.PushMatrix();
            // Pt() returns screen-space pixels (pixelRect origin included), so the matrix must
            // span the camera rect in screen space too. Using 0..pixelWidth would offset twice
            // when the camera does not cover the whole screen.
            var pr = cam.pixelRect;
            GL.LoadPixelMatrix(pr.xMin, pr.xMax, pr.yMin, pr.yMax);
            _material.SetPass(0);

            if (_quads.Count >= 4)
            {
                GL.Begin(GL.QUADS);
                int quadCount = Mathf.Min(_quadColors.Count, _quads.Count / 4);
                for (int i = 0; i < quadCount; i++)
                {
                    GL.Color(_quadColors[i]);
                    int vertex = i * 4;
                    GL.Vertex3(_quads[vertex].x, _quads[vertex].y, 0f);
                    GL.Vertex3(_quads[vertex + 1].x, _quads[vertex + 1].y, 0f);
                    GL.Vertex3(_quads[vertex + 2].x, _quads[vertex + 2].y, 0f);
                    GL.Vertex3(_quads[vertex + 3].x, _quads[vertex + 3].y, 0f);
                }
                GL.End();
            }

            if (_lines.Count >= 2)
            {
                // GL.LINES is one pixel wide on supported Unity backends.
                GL.Begin(GL.LINES);
                int lineCount = Mathf.Min(_lineColors.Count, _lines.Count / 2);
                for (int i = 0; i < lineCount; i++)
                {
                    GL.Color(_lineColors[i]);
                    int vertex = i * 2;
                    GL.Vertex3(_lines[vertex].x, _lines[vertex].y, 0f);
                    GL.Vertex3(_lines[vertex + 1].x, _lines[vertex + 1].y, 0f);
                }
                GL.End();
            }

            GL.PopMatrix();
            RenderTexture.active = prevActive;
        }

        private void BuildBuffers()
        {
            _quads.Clear();
            _quadColors.Clear();
            _lines.Clear();
            _lineColors.Clear();

            if (drawBackground)
            {
                if (fillViewBackground)
                {
                    // Feed the camera rect back through chart space so the fill uses the same
                    // AddQuad path. Chart Y grows downward, so the screen top maps to the
                    // smaller chart Y.
                    double left = (_viewRect.xMin - _offsetX) / _scale;
                    double right = (_viewRect.xMax - _offsetX) / _scale;
                    double top = chartHeight - (_viewRect.yMax - _offsetY) / _scale;
                    double bottom = chartHeight - (_viewRect.yMin - _offsetY) / _scale;
                    AddQuad(left, top, right - left, bottom - top, bgColor);
                }
                else
                {
                    AddQuad(0.0, 0.0, chartWidth, chartHeight, bgColor);
                }
            }

            if (panels == null) { return; }
            for (int p = 0; p < panels.Count; p++)
            {
                LedPanel panel = panels[p];
                if (panel == null || panel.w <= 0f || panel.h <= 0f) { continue; }
                double cellW = panel.cols > 0f ? panel.w / panel.cols : panel.w;
                double cellH = panel.rows > 0f ? panel.h / panel.rows : panel.h;

                if (showChecker)
                {
                    int nc = Mathf.CeilToInt(panel.cols);
                    int nr = Mathf.CeilToInt(panel.rows);
                    Color lightColor = Lighten(panel.color, 0.28f);
                    for (int j = 0; j < nr; j++)
                    {
                        for (int i = 0; i < nc; i++)
                        {
                            double cx = panel.x + i * cellW;
                            double cy = panel.y + j * cellH;
                            double cw = System.Math.Min(cellW, panel.x + panel.w - cx);
                            double ch = System.Math.Min(cellH, panel.y + panel.h - cy);
                            if (cw <= 0.0 || ch <= 0.0) { continue; }
                            AddQuad(cx, cy, cw, ch, ((i + j) % 2 == 0) ? panel.color : lightColor);
                        }
                    }
                }
                else
                {
                    AddQuad(panel.x, panel.y, panel.w, panel.h, panel.color);
                }

                Color gridColor = WithOpacity(lineColor, lineOpacity);
                Color detailColor = WithOpacity(lineColor, Mathf.Min(1f, lineOpacity + 0.15f));
                Color borderColor = WithOpacity(lineColor, Mathf.Min(1f, lineOpacity + 0.3f));

                if (showModGrid)
                {
                    int colsFloor = Mathf.FloorToInt(panel.cols);
                    int rowsFloor = Mathf.FloorToInt(panel.rows);
                    for (int i = 0; i <= colsFloor; i++)
                    {
                        double px = panel.x + i * cellW;
                        AddLine(px, panel.y, px, panel.y + panel.h, gridColor);
                    }
                    AddLine(panel.x + panel.w, panel.y, panel.x + panel.w, panel.y + panel.h, gridColor);
                    for (int j = 0; j <= rowsFloor; j++)
                    {
                        double py = panel.y + j * cellH;
                        AddLine(panel.x, py, panel.x + panel.w, py, gridColor);
                    }
                    AddLine(panel.x, panel.y + panel.h, panel.x + panel.w, panel.y + panel.h, gridColor);
                }

                if (showDiag)
                {
                    AddLine(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h, detailColor);
                    AddLine(panel.x + panel.w, panel.y, panel.x, panel.y + panel.h, detailColor);
                }

                if (showCircle)
                {
                    double radius = System.Math.Min(panel.w, panel.h) * 0.45;
                    AddEllipse(panel.x + panel.w * 0.5, panel.y + panel.h * 0.5, radius, detailColor);
                }

                if (showPanelBorder)
                {
                    AddRect(panel.x, panel.y, panel.w, panel.h, borderColor);
                }
            }
        }

        private static Color Lighten(Color color, float amount)
        {
            return new Color(color.r + (1f - color.r) * amount,
                             color.g + (1f - color.g) * amount,
                             color.b + (1f - color.b) * amount,
                             color.a);
        }

        private static Color WithOpacity(Color color, float opacity)
        {
            return new Color(color.r, color.g, color.b, opacity);
        }

        private void AddQuad(double x, double y, double w, double h, Color color)
        {
            _quads.Add(Pt(x, y));
            _quads.Add(Pt(x, y + h));
            _quads.Add(Pt(x + w, y + h));
            _quads.Add(Pt(x + w, y));
            _quadColors.Add(color);
        }

        private void AddLine(double ax, double ay, double bx, double by, Color color)
        {
            _lines.Add(Pt(ax, ay));
            _lines.Add(Pt(bx, by));
            _lineColors.Add(color);
        }

        private void AddRect(double x, double y, double w, double h, Color color)
        {
            AddLine(x, y, x + w, y, color);
            AddLine(x + w, y, x + w, y + h, color);
            AddLine(x + w, y + h, x, y + h, color);
            AddLine(x, y + h, x, y, color);
        }

        private void AddEllipse(double cx, double cy, double radius, Color color)
        {
            const int segments = 64;
            double prevX = cx + radius;
            double prevY = cy;
            for (int i = 1; i <= segments; i++)
            {
                double angle = (i / (double)segments) * (2.0 * System.Math.PI);
                double curX = cx + radius * System.Math.Cos(angle);
                double curY = cy + radius * System.Math.Sin(angle);
                AddLine(prevX, prevY, curX, curY, color);
                prevX = curX;
                prevY = curY;
            }
        }

        private void OnGUI()
        {
            Camera cam = GetComponent<Camera>();
            if (chartVisible && Event.current.type == EventType.Repaint && UpdateTransform(cam))
            {
                DrawLabels();
            }

            if (!showPanel) { return; }

            const float w = 150f, margin = 8f;
            const float h = 270f;
            float sw = w * PANEL_SCALE, sh = h * PANEL_SCALE;
            bool left = (panelCorner == CompositionGuides.PanelCorner.TopLeft || panelCorner == CompositionGuides.PanelCorner.BottomLeft);
            bool top = (panelCorner == CompositionGuides.PanelCorner.TopLeft || panelCorner == CompositionGuides.PanelCorner.TopRight);
            float x = left ? margin : Screen.width - sw - margin;
            float y = top ? margin : Screen.height - sh - margin;

            var prevMatrix = GUI.matrix;
            float pivotX = left ? x : x + sw;
            float pivotY = top ? y : y + sh;
            GUIUtility.ScaleAroundPivot(new Vector2(PANEL_SCALE, PANEL_SCALE), new Vector2(pivotX, pivotY));

            GUILayout.BeginArea(new Rect(x, y, w, h), GUI.skin.box);
            GUILayout.BeginVertical();
            chartVisible = Tgl(chartVisible ? "LEDChart：表示" : "LEDChart：非表示", chartVisible);
            showChecker = Tgl("市松", showChecker);
            showModGrid = Tgl("境界線", showModGrid);
            showDiag = Tgl("対角線", showDiag);
            showCircle = Tgl("円", showCircle);
            showLabel = Tgl("ラベル", showLabel);
            showPanelBorder = Tgl("外枠", showPanelBorder);
            fitToScreen = !Tgl("等倍", !fitToScreen);
            GUILayout.EndVertical();
            GUILayout.EndArea();
            GUI.matrix = prevMatrix;
        }

        private static bool Tgl(string label, bool value)
        {
            return GUILayout.Toggle(value, label, "Button");
        }

        private void DrawLabels()
        {
            GUIStyle style = new GUIStyle(GUI.skin.label);
            style.fontSize = (int)TEXT_BASE_SIZE;
            style.normal.textColor = lineColor;

            if (showLabel && panels != null)
            {
                float labelFont = Mathf.Max(18f, chartHeight * 0.016f);
                float pad = labelFont * 0.6f;
                float lineHeight = labelFont * 1.3f;
                style.alignment = TextAnchor.UpperLeft;
                style.fontStyle = FontStyle.Normal;
                for (int p = 0; p < panels.Count; p++)
                {
                    LedPanel panel = panels[p];
                    if (panel == null || panel.w <= 0f || panel.h <= 0f) { continue; }
                    DrawScaledText(FormatPanelName(panel), panel.x + pad, panel.y + pad, labelFont, style, false);
                    DrawScaledText("W:" + System.Math.Round(panel.w), panel.x + pad, panel.y + pad + lineHeight, labelFont, style, false);
                    DrawScaledText("H:" + System.Math.Round(panel.h), panel.x + pad, panel.y + pad + lineHeight * 2f, labelFont, style, false);
                    DrawScaledText("X:" + System.Math.Round(panel.x), panel.x + pad, panel.y + pad + lineHeight * 3f, labelFont, style, false);
                    DrawScaledText("Y:" + System.Math.Round(panel.y), panel.x + pad, panel.y + pad + lineHeight * 4f, labelFont, style, false);
                }
            }

            float centerFont = chartWidth * 0.11f;
            style.alignment = TextAnchor.MiddleCenter;
            if (!string.IsNullOrEmpty(centerText))
            {
                style.fontStyle = FontStyle.Normal;
                DrawScaledText(centerText, chartWidth * 0.5, chartHeight * 0.42, centerFont, style, true);
            }

            string resolution = autoRes ? chartWidth + " × " + chartHeight : resText;
            if (!string.IsNullOrEmpty(resolution))
            {
                style.fontStyle = FontStyle.Bold;
                DrawScaledText(resolution, chartWidth * 0.5, chartHeight * 0.63, centerFont, style, true);
            }
        }

        private static string FormatPanelName(LedPanel panel)
        {
            return panel.name + "  " + FormatNumber(panel.cols) + "×" + FormatNumber(panel.rows)
                + " (W" + panel.physW.ToString("N0") + "mm × H" + panel.physH.ToString("N0") + "mm)";
        }

        private static string FormatNumber(float value)
        {
            if (Mathf.Approximately(value, Mathf.Round(value))) { return Mathf.RoundToInt(value).ToString(); }
            return value.ToString("0.################");
        }

        private void DrawScaledText(string text, double cx, double cy, float chartFontSize, GUIStyle style, bool centered)
        {
            Vector2 guiPoint = GuiPt(cx, cy);
            float targetSize = chartFontSize * _scale;
            float textScale = targetSize / TEXT_BASE_SIZE;
            if (textScale <= 0f) { return; }

            Vector2 baseSize = style.CalcSize(new GUIContent(text));
            Rect rect;
            if (centered)
            {
                rect = new Rect(guiPoint.x - baseSize.x * textScale * 0.5f,
                                guiPoint.y - baseSize.y * textScale * 0.5f,
                                baseSize.x * textScale, baseSize.y * textScale);
            }
            else
            {
                rect = new Rect(guiPoint.x, guiPoint.y, baseSize.x * textScale, baseSize.y * textScale);
            }

            var prevMatrix = GUI.matrix;
            GUIUtility.ScaleAroundPivot(new Vector2(textScale, textScale), new Vector2(rect.x, rect.y));
            GUI.Label(new Rect(rect.x, rect.y, baseSize.x, baseSize.y), text, style);
            GUI.matrix = prevMatrix;
        }


        [ContextMenu("プリセット: 16:9 4K 1パネル")]
        private void LoadUhd4K()
        {
            chartWidth = 3840;
            chartHeight = 2160;
            bgColor = Color.black;
            lineColor = Color.white;
            centerText = "Center Video Wall";
            if (panels == null) { panels = new List<LedPanel>(); }
            panels.Clear();
            panels.Add(new LedPanel
            {
                name = "Main", color = new Color(0f, 103f / 255f, 196f / 255f, 1f),
                x = 0f, y = 0f, w = 3840f, h = 2160f, cols = 20f, rows = 11.25f,
                physW = 9000f, physH = 5060f
            });
        }

        [ContextMenu("プリセット: 複数パネルの例")]
        private void LoadExample()
        {
            chartWidth = 3420;
            chartHeight = 2090;
            bgColor = Color.black;
            lineColor = Color.white;
            centerText = "Center Video Wall";
            if (panels == null) { panels = new List<LedPanel>(); }
            panels.Clear();
            panels.Add(new LedPanel
            {
                name = "P8", color = new Color(1f, 0f, 0f, 1f),
                x = 210f, y = 35f, w = 3000f, h = 1140f, cols = 15f, rows = 2.5f,
                physW = 9000f, physH = 3000f
            });
            panels.Add(new LedPanel
            {
                name = "P2", color = new Color(1f, 0f, 1f, 1f),
                x = 210f, y = 1175f, w = 3000f, h = 880f, cols = 18f, rows = 5f,
                physW = 9000f, physH = 2500f
            });
        }

        [ContextMenu("セルフチェック: 座標変換")]
        private void SelfCheckTransform()
        {
            Camera cam = GetComponent<Camera>();
            if (cam == null)
            {
                Debug.LogWarning("LED Chart 座標変換セルフチェック: Camera がありません。", this);
                return;
            }
            var pr = cam.pixelRect;
            if (pr.width <= 0f || pr.height <= 0f || chartWidth <= 0 || chartHeight <= 0)
            {
                Debug.LogWarning("LED Chart 座標変換セルフチェック: 有効な描画領域がありません。", this);
                return;
            }

            bool originalFit = fitToScreen;
            bool allPassed = true;
            for (int mode = 0; mode < 2; mode++)
            {
                fitToScreen = mode == 0;
                UpdateTransform(cam);
                Vector2 topLeft = Pt(0.0, 0.0);
                Vector2 topRight = Pt(chartWidth, 0.0);
                Vector2 bottomLeft = Pt(0.0, chartHeight);
                Vector2 bottomRight = Pt(chartWidth, chartHeight);
                float width = topRight.x - topLeft.x;
                float height = topLeft.y - bottomLeft.y;
                Vector2 center = (topLeft + bottomRight) * 0.5f;
                Vector2 expectedCenter = pr.center;
                // The view-fill background converts the camera rect into chart space, so verify
                // that pushing it back through Pt() lands exactly on the camera rect again.
                double fillLeft = (_viewRect.xMin - _offsetX) / _scale;
                double fillRight = (_viewRect.xMax - _offsetX) / _scale;
                double fillTop = chartHeight - (_viewRect.yMax - _offsetY) / _scale;
                double fillBottom = chartHeight - (_viewRect.yMin - _offsetY) / _scale;
                Vector2 fillTopLeft = Pt(fillLeft, fillTop);
                Vector2 fillBottomRight = Pt(fillRight, fillBottom);
                bool fillOk = Mathf.Abs(fillTopLeft.x - pr.xMin) <= 1e-3f
                    && Mathf.Abs(fillTopLeft.y - pr.yMax) <= 1e-3f
                    && Mathf.Abs(fillBottomRight.x - pr.xMax) <= 1e-3f
                    && Mathf.Abs(fillBottomRight.y - pr.yMin) <= 1e-3f;

                bool passed = Mathf.Abs(width - chartWidth * _scale) <= 1e-3f
                    && Mathf.Abs(height - chartHeight * _scale) <= 1e-3f
                    && Vector2.Distance(center, expectedCenter) <= 1e-3f
                    && topLeft.y > bottomRight.y
                    && fillOk;
                allPassed &= passed;
                if (passed)
                {
                    Debug.Log("LED Chart 座標変換セルフチェック: " + (fitToScreen ? "フィット" : "等倍") + " 成功", this);
                }
                else
                {
                    Debug.LogError("LED Chart 座標変換セルフチェック: " + (fitToScreen ? "フィット" : "等倍") + " 失敗", this);
                }
            }
            fitToScreen = originalFit;
            if (allPassed) { Debug.Log("LED Chart 座標変換セルフチェック: 全項目成功", this); }
        }
    }
}
