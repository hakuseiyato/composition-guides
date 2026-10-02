# composition-guides — Claude 向け案内

Illustrator / After Effects / Premiere Pro / Unity 用の構図ガイドツール（Blender アドオン `composition_check` の移植）。

## 導入・更新・アンインストールを頼まれたら

**[INSTALL.md](INSTALL.md) の手順にだけ従う**。独自のやり方で導入しない。

- 対象ソフトをユーザーに確認し、該当する節を上から順に実行する。各手順の「判定」を満たしてから次へ進む。
- 「⚠ ユーザー確認」の手順は、実行前に説明して許可を得る（UAC 昇格・レジストリ・Unity プロジェクトのパス）。
- Premiere Pro に導入したら、「ガイドは書き出しに焼き込まれる（書き出し前に表示切替で無効化する）」ことを必ず伝える。

## 開発するとき

- 構成と設計は [doc/architecture.md](doc/architecture.md)、機能と使い方の詳細は [README.md](README.md)、変更履歴は [CHANGELOG.md](CHANGELOG.md) にある。
- `src/**/*.jsx` と `cep*/js/*.js` は **ES3**（ExtendScript 互換）で書く。`let` / `const` / アロー関数 / テンプレートリテラルは使わない。
- `dist/` `cep/jsx/engine.jsx` `cep_ppro/js/engine.js` `cep_ppro/jsx/host.jsx` `cep_ppro/js/ui.js` `cep_ppro/css/style.css` は**ビルドの生成物**。直接編集せず、`src/` か `cep/` を直してから `pwsh -NoProfile -File build.ps1` を実行する。
- 検証コマンド:
  - `pwsh -NoProfile -File build.ps1`
  - `node tools\ppro-smoke.js`（Premiere 版のエンジン）
- `install.ps1` / `install.cmd` / `tools/dev-install.ps1` / `sync.ps1` / `ae-install.ps1` は、ユーザーの環境を書き換えるコマンドとして扱う。検証目的で勝手に実行しない。
  - 検証するときは、子プロセスの `$env:APPDATA` をスクラッチに向け、AE は `-AeRoot <スクラッチ>`、Unity はダミーのプロジェクトを使う。
- 配布物の作成は `pwsh -NoProfile -File tools\package.ps1`。出力先は `release\`（git 管理外）で、CHANGELOG と manifest のバージョンが一致しないと止まる。
