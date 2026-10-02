using System.Collections.Generic;
using UnityEngine;

namespace Yato.CompositionGuides
{
    [ExecuteAlways]
    [RequireComponent(typeof(Camera))]
    [DisallowMultipleComponent]
    [AddComponentMenu("Yato/Composition Guides")]
    public class CompositionGuides : MonoBehaviour
    {
        public enum TriangleOrientation { TL_BR, TR_BL }
        public enum DivisionAxis { Horizontal, Vertical }
        public enum SymmetryAxis { Horizontal, Vertical, Both }
        public enum SpiralOrientation { TL, TR, BL, BR }
        public enum AspectRatioPreset { R1_1, R9_16, R16_9, R4_3, R21_9, Custom }
        public enum PerspectiveMode { OnePoint, TwoPoint, ThreePoint }
        public enum PanelCorner { TopLeft, TopRight, BottomLeft, BottomRight }

        [Header("共通 / Common")]
        [Tooltip("ガイド線の色")]
        public Color lineColor = new Color(0f, 1f, 1f, 0.8f);

        [Header("パネル / In-Game Panel")]
        [Tooltip("Game ビュー内に ON/OFF トグルパネルを表示する（false でパネルのみ非表示・線は出る）")]
        public bool showPanel = true;
        [Tooltip("パネルを表示する画面の隅")]
        public PanelCorner panelCorner = PanelCorner.TopLeft;

        [Header("構図 / Composition")]
        public bool showThirds = true;
        public bool showGolden = false;
        public bool showDiagonal = false;
        public bool showCenter = false;
        public bool showTriangle = false;
        public TriangleOrientation triangleOrientation = TriangleOrientation.TL_BR;
        public bool showGoldenSection = false;

        [Header("絵画 / Painting")]
        public bool showDivision = false;
        public DivisionAxis divisionAxis = DivisionAxis.Horizontal;
        public bool showSymmetry = false;
        public SymmetryAxis symmetryAxis = SymmetryAxis.Vertical;

        [Header("パラメトリック / Parametric")]
        public bool showSpiral = false;
        public SpiralOrientation spiralOrientation = SpiralOrientation.TL;

        public bool showHorizontalLine = false;
        [Range(0f, 1f)] public float horizontalPos = 0.5f;

        public bool showVerticalLine = false;
        [Range(0f, 1f)] public float verticalPos = 0.5f;

        public bool showSlanted = false;
        public float slantedAngleDeg = 30f;
        [Min(1)] public int slantedCount = 4;
        public float slantedSpread = 0.9f;

        public bool showPattern = false;
        [Min(2)] public int patternCols = 6;
        [Min(2)] public int patternRows = 6;

        public bool showBullseye = false;
        [Min(0)] public int bullseyeRings = 2;

        [Header("領域 / Area")]
        public bool showSafeArea = false;
        [Range(0f, 1f)] public float safeAction = 0.9f;
        [Range(0f, 1f)] public float safeTitle = 0.8f;

        public bool showAspect = false;
        public AspectRatioPreset aspectRatio = AspectRatioPreset.R9_16;
        public float aspectCustomW = 2.39f;
        public float aspectCustomH = 1.0f;

        [Header("パース / Perspective")]
        public bool showPerspective = false;
        public PerspectiveMode perspectiveMode = PerspectiveMode.TwoPoint;
        [Range(0f, 1f)] public float horizonV = 0.5f;
        [Range(0f, 1f)] public float vp1U = 0.5f;
        public float vpSpread = 0.9f;
        public float vp3Dist = 1.5f;
        [Min(2)] public int perspectiveLines = 12;
        public bool showVpMarker = true;
        public bool showHorizon = true;

        [Header("枠 / Frame")]
        public bool showFrame = false;

        private const double PHI = 1.6180339887498949;
        private static readonly double PHI_SHORT = 1.0 / (1.0 + PHI);
        private static readonly double PHI_LONG = PHI / (1.0 + PHI);

        private Material _material;
        private float _fLeft, _fBottom, _fW, _fH;
        private readonly List<Vector2> _segments = new List<Vector2>();
        public bool guidesVisible = true;
        private const float PANEL_SCALE = 1.4f;

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
            DrawGuides(cam);
        }

        private void OnCameraPostRender(Camera cam)
        {
            if (cam != GetComponent<Camera>()) { return; }
            DrawGuides(cam);
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

        private void DrawGuides(Camera cam)
        {
            var pr = cam.pixelRect;
            _fLeft = pr.xMin;
            _fBottom = pr.yMin;
            _fW = pr.width;
            _fH = pr.height;
            if (_fW <= 0f || _fH <= 0f) { return; }

            BuildSegments();
            if (_segments.Count < 2) { return; }

            EnsureMaterial();
            if (_material == null) { return; }

            var prevActive = RenderTexture.active;
            RenderTexture.active = cam.targetTexture;
            GL.PushMatrix();
            GL.LoadPixelMatrix(0, cam.pixelWidth, 0, cam.pixelHeight);
            _material.SetPass(0);
            GL.Begin(GL.LINES);
            GL.Color(lineColor);
            int n = _segments.Count - (_segments.Count % 2);
            for (int i = 0; i < n; i += 2)
            {
                GL.Vertex3(_segments[i].x, _segments[i].y, 0f);
                GL.Vertex3(_segments[i + 1].x, _segments[i + 1].y, 0f);
            }
            GL.End();
            GL.PopMatrix();
            RenderTexture.active = prevActive;
        }

        private void OnGUI()
        {
            if (!showPanel) { return; }

            const float w = 150f, margin = 8f;
            const float h = 280f;
            float sw = w * PANEL_SCALE, sh = h * PANEL_SCALE;
            bool left = (panelCorner == PanelCorner.TopLeft || panelCorner == PanelCorner.BottomLeft);
            bool top = (panelCorner == PanelCorner.TopLeft || panelCorner == PanelCorner.TopRight);
            float x = left ? margin : Screen.width - sw - margin;
            float y = top ? margin : Screen.height - sh - margin;

            var prevMatrix = GUI.matrix;
            float pivotX = left ? x : x + sw;
            float pivotY = top ? y : y + sh;
            GUIUtility.ScaleAroundPivot(new Vector2(PANEL_SCALE, PANEL_SCALE), new Vector2(pivotX, pivotY));

            GUILayout.BeginArea(new Rect(x, y, w, h), GUI.skin.box);
            GUILayout.BeginVertical();

            guidesVisible = Tgl(guidesVisible ? "CompGuide：表示" : "CompGuide：非表示", guidesVisible);

            showThirds = Tgl("三分割", showThirds);
            showGolden = Tgl("黄金比", showGolden);
            showDiagonal = Tgl("対角線", showDiagonal);
            showCenter = Tgl("中央十字", showCenter);
            showGoldenSection = Tgl("黄金分割", showGoldenSection);
            showSpiral = Tgl("螺旋", showSpiral);
            showSlanted = Tgl("斜線", showSlanted);
            showSafeArea = Tgl("セーフ", showSafeArea);
            showAspect = Tgl("アスペクト", showAspect);
            showFrame = Tgl("フレーム", showFrame);

            GUILayout.EndVertical();
            GUILayout.EndArea();
            GUI.matrix = prevMatrix;
        }

        private static bool Tgl(string label, bool value)
        {
            return GUILayout.Toggle(value, label, "Button");
        }

        private Vector2 Uv(double u, double v)
        {
            return new Vector2(_fLeft + (float)(u * _fW), _fBottom + (float)(v * _fH));
        }

        private void AddLine(Vector2 a, Vector2 b)
        {
            _segments.Add(a);
            _segments.Add(b);
        }

        private void AddLineUV(double u0, double v0, double u1, double v1)
        {
            AddLine(Uv(u0, v0), Uv(u1, v1));
        }

        private void AddRect(Vector2 p0, Vector2 p1, Vector2 p2, Vector2 p3)
        {
            AddLine(p0, p1);
            AddLine(p1, p2);
            AddLine(p2, p3);
            AddLine(p3, p0);
        }

        private void AddEllipse(float cx, float cy, float rx, float ry)
        {
            const int segments = 64;
            Vector2 prev = new Vector2(cx + rx, cy);
            for (int i = 1; i <= segments; i++)
            {
                double a = (i / (double)segments) * (2.0 * System.Math.PI);
                Vector2 cur = new Vector2(cx + rx * (float)System.Math.Cos(a),
                                          cy + ry * (float)System.Math.Sin(a));
                AddLine(prev, cur);
                prev = cur;
            }
        }

        private void AddPolyline(List<Vector2> pts, bool closed)
        {
            if (pts.Count < 2) { return; }
            for (int i = 0; i < pts.Count - 1; i++)
            {
                AddLine(pts[i], pts[i + 1]);
            }
            if (closed) { AddLine(pts[pts.Count - 1], pts[0]); }
        }

        private static double[] ClipLineUV(double x0, double y0, double x1, double y1)
        {
            double[] p = { -(x1 - x0), (x1 - x0), -(y1 - y0), (y1 - y0) };
            double[] q = { x0, 1.0 - x0, y0, 1.0 - y0 };
            double u1 = 0.0, u2 = 1.0;
            for (int i = 0; i < 4; i++)
            {
                if (p[i] == 0.0)
                {
                    if (q[i] < 0.0) { return null; }
                }
                else
                {
                    double t = q[i] / p[i];
                    if (p[i] < 0.0)
                    {
                        if (t > u2) { return null; }
                        if (t > u1) { u1 = t; }
                    }
                    else
                    {
                        if (t < u1) { return null; }
                        if (t < u2) { u2 = t; }
                    }
                }
            }
            return new double[]
            {
                x0 + u1 * (x1 - x0), y0 + u1 * (y1 - y0),
                x0 + u2 * (x1 - x0), y0 + u2 * (y1 - y0)
            };
        }

        private static double[] ClipLineRect(double p0x, double p0y, double p1x, double p1y,
                                             double xmin, double ymin, double xmax, double ymax)
        {
            double x0 = p0x, y0 = p0y, x1 = p1x, y1 = p1y;
            double dx = x1 - x0, dy = y1 - y0;
            double[] p = { -dx, dx, -dy, dy };
            double[] q = { x0 - xmin, xmax - x0, y0 - ymin, ymax - y0 };
            double u1 = 0.0, u2 = 1.0;
            for (int i = 0; i < 4; i++)
            {
                if (System.Math.Abs(p[i]) < 1e-12)
                {
                    if (q[i] < 0) { return null; }
                }
                else
                {
                    double t = q[i] / p[i];
                    if (p[i] < 0)
                    {
                        if (t > u2) { return null; }
                        if (t > u1) { u1 = t; }
                    }
                    else
                    {
                        if (t < u1) { return null; }
                        if (t < u2) { u2 = t; }
                    }
                }
            }
            if (u1 > u2) { return null; }
            return new double[] { x0 + u1 * dx, y0 + u1 * dy, x0 + u2 * dx, y0 + u2 * dy };
        }

        private static Vector2 Foot(Vector2 p, Vector2 a, Vector2 b)
        {
            double abx = b.x - a.x;
            double aby = b.y - a.y;
            double denom = abx * abx + aby * aby;
            if (denom < 1e-9) { return new Vector2(a.x, a.y); }
            double t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom;
            return new Vector2(a.x + (float)(t * abx), a.y + (float)(t * aby));
        }

        private void BuildSegments()
        {
            _segments.Clear();
            if (!guidesVisible) { return; }

            if (showThirds) { Thirds(); }
            if (showGolden) { Golden(); }
            if (showDiagonal) { Diagonal(); }
            if (showCenter) { Center(); }
            if (showTriangle) { Triangle(); }
            if (showGoldenSection) { GoldenSection(); }

            if (showDivision) { Division(); }
            if (showSymmetry) { Symmetry(); }

            if (showSpiral) { Spiral(); }
            if (showHorizontalLine) { HorizontalLine(); }
            if (showVerticalLine) { VerticalLine(); }
            if (showSlanted) { Slanted(); }
            if (showPattern) { Pattern(); }
            if (showBullseye) { Bullseye(); }

            if (showSafeArea) { SafeArea(); }
            if (showAspect) { AspectMask(); }

            if (showPerspective) { Perspective(); }

            if (showFrame) { FrameBorder(); }
        }

        private void Thirds()
        {
            double[] us = { 1.0 / 3.0, 2.0 / 3.0 };
            for (int i = 0; i < us.Length; i++)
            {
                AddLineUV(us[i], 0.0, us[i], 1.0);
                AddLineUV(0.0, us[i], 1.0, us[i]);
            }
        }

        private void Golden()
        {
            double[] us = { PHI_SHORT, PHI_LONG };
            for (int i = 0; i < us.Length; i++)
            {
                AddLineUV(us[i], 0.0, us[i], 1.0);
                AddLineUV(0.0, us[i], 1.0, us[i]);
            }
        }

        private void Diagonal()
        {
            AddLineUV(0.0, 0.0, 1.0, 1.0);
            AddLineUV(1.0, 0.0, 0.0, 1.0);
        }

        private void Center()
        {
            AddLineUV(0.5, 0.0, 0.5, 1.0);
            AddLineUV(0.0, 0.5, 1.0, 0.5);
        }

        private void Triangle()
        {
            Vector2 bl = Uv(0.0, 0.0), br = Uv(1.0, 0.0);
            Vector2 tr = Uv(1.0, 1.0), tl = Uv(0.0, 1.0);
            Vector2 a, b, c1, c2;
            if (triangleOrientation == TriangleOrientation.TL_BR)
            {
                a = tl; b = br; c1 = tr; c2 = bl;
            }
            else
            {
                a = tr; b = bl; c1 = tl; c2 = br;
            }
            AddLine(a, b);
            AddLine(c1, Foot(c1, a, b));
            AddLine(c2, Foot(c2, a, b));
        }

        private void GoldenSection()
        {
            Vector2 bl = Uv(0.0, 0.0), br = Uv(1.0, 0.0);
            Vector2 tr = Uv(1.0, 1.0), tl = Uv(0.0, 1.0);
            AddLine(tl, br);
            AddLine(tr, bl);
            AddLine(tr, Foot(tr, tl, br));
            AddLine(bl, Foot(bl, tl, br));
            AddLine(tl, Foot(tl, tr, bl));
            AddLine(br, Foot(br, tr, bl));
        }

        private void Division()
        {
            if (divisionAxis == DivisionAxis.Horizontal)
            {
                AddLineUV(0.0, 0.5, 1.0, 0.5);
            }
            else
            {
                AddLineUV(0.5, 0.0, 0.5, 1.0);
            }
        }

        private void Symmetry()
        {
            if (symmetryAxis == SymmetryAxis.Horizontal || symmetryAxis == SymmetryAxis.Both)
            {
                AddLineUV(0.0, 0.5, 1.0, 0.5);
            }
            if (symmetryAxis == SymmetryAxis.Vertical || symmetryAxis == SymmetryAxis.Both)
            {
                AddLineUV(0.5, 0.0, 0.5, 1.0);
            }
        }

        private void FrameBorder()
        {
            AddRect(Uv(0.0, 0.0), Uv(1.0, 0.0), Uv(1.0, 1.0), Uv(0.0, 1.0));
        }

        private void HorizontalLine()
        {
            double p = System.Math.Max(0.0, System.Math.Min(1.0, horizontalPos));
            AddLineUV(0.0, p, 1.0, p);
        }

        private void VerticalLine()
        {
            double p = System.Math.Max(0.0, System.Math.Min(1.0, verticalPos));
            AddLineUV(p, 0.0, p, 1.0);
        }

        private void Slanted()
        {
            double ang = slantedAngleDeg * System.Math.PI / 180.0;
            int count = System.Math.Max(1, slantedCount);
            double spread = slantedSpread;

            double dx = System.Math.Cos(ang), dy = System.Math.Sin(ang);
            double nx = -dy, ny = dx;
            double cu = 0.5, cv = 0.5;
            double L = 2.0;

            for (int i = 0; i < count; i++)
            {
                double t = (count == 1) ? 0.0 : ((i / (double)(count - 1)) - 0.5) * spread;
                double ou = cu + nx * t, ov = cv + ny * t;
                double[] clip = ClipLineUV(ou - dx * L, ov - dy * L, ou + dx * L, ov + dy * L);
                if (clip == null) { continue; }
                AddLineUV(clip[0], clip[1], clip[2], clip[3]);
            }
        }

        private void Pattern()
        {
            int cols = System.Math.Max(2, Mathf.RoundToInt(patternCols));
            int rows = System.Math.Max(2, Mathf.RoundToInt(patternRows));
            for (int i = 1; i < cols; i++)
            {
                double u = i / (double)cols;
                AddLineUV(u, 0.0, u, 1.0);
            }
            for (int i = 1; i < rows; i++)
            {
                double v = i / (double)rows;
                AddLineUV(0.0, v, 1.0, v);
            }
        }

        private void Bullseye()
        {
            int rings = System.Math.Max(0, Mathf.RoundToInt(bullseyeRings));
            double cr = 0.04;
            AddLineUV(0.5 - cr, 0.5, 0.5 + cr, 0.5);
            AddLineUV(0.5, 0.5 - cr, 0.5, 0.5 + cr);
            if (rings > 0)
            {
                Vector2 center = Uv(0.5, 0.5);
                double maxR = 0.45;
                for (int k = 1; k <= rings; k++)
                {
                    double r = (k / (double)rings) * maxR;
                    AddEllipse(center.x, center.y, (float)(r * _fW), (float)(r * _fH));
                }
            }
        }

        private void Spiral()
        {
            double[] rect = { 0.0, 0.0, 1.0, 1.0 };
            SpiralOrientation cur = spiralOrientation;
            const int iterations = 8;
            List<Vector2> arcUv = new List<Vector2>();

            for (int step = 0; step < iterations; step++)
            {
                double u0 = rect[0], v0 = rect[1], u1 = rect[2], v1 = rect[3];
                double w = u1 - u0, h = v1 - v0;
                if (w <= 1e-5 || h <= 1e-5) { break; }
                double sq = (w >= h) ? h : w;
                double cx, cy, angleStart;
                double[] nextRect;
                SpiralOrientation nextCorner;

                if (w >= h)
                {
                    if (cur == SpiralOrientation.TL || cur == SpiralOrientation.BL)
                    {
                        nextRect = new double[] { u0 + sq, v0, u1, v1 };
                        if (cur == SpiralOrientation.TL)
                        {
                            cx = u0 + sq; cy = v0; angleStart = System.Math.PI / 2; nextCorner = SpiralOrientation.BL;
                        }
                        else
                        {
                            cx = u0 + sq; cy = v1; angleStart = System.Math.PI; nextCorner = SpiralOrientation.TL;
                        }
                    }
                    else
                    {
                        nextRect = new double[] { u0, v0, u1 - sq, v1 };
                        if (cur == SpiralOrientation.TR)
                        {
                            cx = u1 - sq; cy = v0; angleStart = 0.0; nextCorner = SpiralOrientation.BR;
                        }
                        else
                        {
                            cx = u1 - sq; cy = v1; angleStart = -System.Math.PI / 2; nextCorner = SpiralOrientation.TR;
                        }
                    }
                }
                else
                {
                    if (cur == SpiralOrientation.TL || cur == SpiralOrientation.TR)
                    {
                        nextRect = new double[] { u0, v0, u1, v1 - sq };
                        if (cur == SpiralOrientation.TL)
                        {
                            cx = u1; cy = v1 - sq; angleStart = System.Math.PI / 2; nextCorner = SpiralOrientation.TR;
                        }
                        else
                        {
                            cx = u0; cy = v1 - sq; angleStart = 0.0; nextCorner = SpiralOrientation.TL;
                        }
                    }
                    else
                    {
                        nextRect = new double[] { u0, v0 + sq, u1, v1 };
                        if (cur == SpiralOrientation.BL)
                        {
                            cx = u1; cy = v0 + sq; angleStart = System.Math.PI; nextCorner = SpiralOrientation.BR;
                        }
                        else
                        {
                            cx = u0; cy = v0 + sq; angleStart = -System.Math.PI / 2; nextCorner = SpiralOrientation.BL;
                        }
                    }
                }

                const int segments = 18;
                for (int i = 0; i <= segments; i++)
                {
                    double a = angleStart + (i / (double)segments) * (System.Math.PI / 2);
                    arcUv.Add(new Vector2((float)(cx + sq * System.Math.Cos(a)),
                                          (float)(cy + sq * System.Math.Sin(a))));
                }
                rect = nextRect;
                cur = nextCorner;
            }

            List<Vector2> coords = new List<Vector2>(arcUv.Count);
            for (int q = 0; q < arcUv.Count; q++)
            {
                coords.Add(Uv(arcUv[q].x, arcUv[q].y));
            }
            AddPolyline(coords, false);
        }

        private void InsetRect(double ratio)
        {
            double margin = (1.0 - ratio) / 2.0;
            double u0 = margin, u1 = 1.0 - margin, v0 = margin, v1 = 1.0 - margin;
            AddRect(Uv(u0, v0), Uv(u1, v0), Uv(u1, v1), Uv(u0, v1));
        }

        private void SafeArea()
        {
            InsetRect(safeAction);
            InsetRect(safeTitle);
        }

        private double AspectPresetValue(AspectRatioPreset preset)
        {
            switch (preset)
            {
                case AspectRatioPreset.R1_1: return 1.0;
                case AspectRatioPreset.R9_16: return 9.0 / 16.0;
                case AspectRatioPreset.R16_9: return 16.0 / 9.0;
                case AspectRatioPreset.R4_3: return 4.0 / 3.0;
                case AspectRatioPreset.R21_9: return 21.0 / 9.0;
                default: return 1.0;
            }
        }

        private void AspectMask()
        {
            double sceneAspect = _fW / (double)_fH;
            double target;
            if (aspectRatio == AspectRatioPreset.Custom)
            {
                if (aspectCustomH <= 1e-6) { return; }
                target = aspectCustomW / (double)aspectCustomH;
            }
            else
            {
                target = AspectPresetValue(aspectRatio);
            }
            double scaleU, scaleV;
            if (target >= sceneAspect)
            {
                scaleV = sceneAspect / target; scaleU = 1.0;
            }
            else
            {
                scaleU = target / sceneAspect; scaleV = 1.0;
            }
            double mu = (1.0 - scaleU) / 2.0, mv = (1.0 - scaleV) / 2.0;
            double u0 = mu, u1 = 1.0 - mu, v0 = mv, v1 = 1.0 - mv;
            AddRect(Uv(u0, v0), Uv(u1, v0), Uv(u1, v1), Uv(u0, v1));
        }

        private void RaysFromVP(Vector2 vp, int n)
        {
            double xMin = _fLeft, yMin = _fBottom, xMax = _fLeft + _fW, yMax = _fBottom + _fH;
            Vector2 center = Uv(0.5, 0.5);
            double dxRef = center.x - vp.x, dyRef = center.y - vp.y;
            if (System.Math.Abs(dxRef) < 1e-6 && System.Math.Abs(dyRef) < 1e-6) { return; }
            double baseAng = System.Math.Atan2(dyRef, dxRef);

            double[][] corners =
            {
                new double[] { xMin, yMin }, new double[] { xMax, yMin },
                new double[] { xMax, yMax }, new double[] { xMin, yMax }
            };
            double aMin = 1e9, aMax = -1e9;
            for (int c = 0; c < corners.Length; c++)
            {
                double a = System.Math.Atan2(corners[c][1] - vp.y, corners[c][0] - vp.x);
                double diff = ((a - baseAng + System.Math.PI) % (2 * System.Math.PI)) - System.Math.PI;
                if (diff < aMin) { aMin = diff; }
                if (diff > aMax) { aMax = diff; }
            }

            double diag = System.Math.Sqrt(
                (xMax - xMin) * (xMax - xMin) + (yMax - yMin) * (yMax - yMin));
            double length = diag * 2.0;
            if (n < 2) { n = 2; }

            for (int i = 0; i < n; i++)
            {
                double t = i / (double)(n - 1);
                double ang = baseAng + aMin + t * (aMax - aMin);
                double endX = vp.x + length * System.Math.Cos(ang);
                double endY = vp.y + length * System.Math.Sin(ang);
                double[] clip = ClipLineRect(vp.x, vp.y, endX, endY, xMin, yMin, xMax, yMax);
                if (clip != null)
                {
                    AddLine(new Vector2((float)clip[0], (float)clip[1]),
                            new Vector2((float)clip[2], (float)clip[3]));
                }
            }
        }

        private void VpMarker(Vector2 vp)
        {
            double xMin = _fLeft, yMin = _fBottom, xMax = _fLeft + _fW, yMax = _fBottom + _fH;
            if (!(vp.x >= xMin && vp.x <= xMax && vp.y >= yMin && vp.y <= yMax))
            {
                return;
            }
            float size = (float)((xMax - xMin) * 0.01);
            AddLine(new Vector2(vp.x - size, vp.y), new Vector2(vp.x + size, vp.y));
            AddLine(new Vector2(vp.x, vp.y - size), new Vector2(vp.x, vp.y + size));
        }

        private void Perspective()
        {
            double hv = horizonV;
            int n = System.Math.Max(2, Mathf.RoundToInt(perspectiveLines));

            List<Vector2> vps = new List<Vector2>();

            if (perspectiveMode == PerspectiveMode.OnePoint)
            {
                Vector2 vp1 = Uv(vp1U, hv);
                RaysFromVP(vp1, n);
                vps.Add(vp1);
            }
            else
            {
                double uL = 0.5 - vpSpread;
                double uR = 0.5 + vpSpread;
                Vector2 vpL = Uv(uL, hv);
                Vector2 vpR = Uv(uR, hv);
                RaysFromVP(vpL, n);
                RaysFromVP(vpR, n);
                vps.Add(vpL); vps.Add(vpR);

                if (perspectiveMode == PerspectiveMode.ThreePoint)
                {
                    Vector2 vp3 = Uv(0.5, hv + vp3Dist);
                    RaysFromVP(vp3, n);
                    if (showVpMarker) { VpMarker(vp3); }
                }
            }

            if (showHorizon)
            {
                AddLine(Uv(0.0, hv), Uv(1.0, hv));
            }

            if (showVpMarker)
            {
                for (int i = 0; i < vps.Count; i++) { VpMarker(vps[i]); }
            }
        }
    }
}
