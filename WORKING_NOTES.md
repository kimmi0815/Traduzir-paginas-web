# TWP Fast — 開発の再開手順

最終更新: 2026-09-05。開発ブランチは `chrome-mv3`。

## 目標と現在地

他のブラウザでもChrome標準の自動翻訳に近い速度と操作感で使えるよう、TWPを改善している個人用フォークです。

- 高速化: 表示領域を優先するスケジューリング、先読み、動的コンテンツの処理、並列処理数の制御を実装済み。既存コミットは `e013d14` と `3955a81`。測定手順と条件は [latency QA](qa/translation-latency/README.md) を参照。すべてのページで一律に同じ速度向上を保証するものではありません。
- ポップアップ: 原文／翻訳先のタブ、詳細メニュー、翻訳サービス表示を中心に整理。Chromeを参照したデザインはユーザー確認済み。Asideで大きすぎるというフィードバックを受け、通常時を **280×92 CSS px** に縮小済み。ブラウザの外枠・表示倍率はこの寸法に含みません。
- 設定: 9カテゴリ、ライト／ダーク表示、オン／オフのスイッチ、言語・サイトルールのカード表示、キーボード操作を整備。設定画面から寄付・リリースノート・問題報告・翻訳協力への補助リンクを削除。
- 設定画面の補助項目削除は設定画面の範囲です。ポップアップの詳細メニューには、寄付や翻訳改善などの既存項目が残っています。

## 別のPCで始める

GitとNode.jsを用意します。手元でのビルド確認環境は **Node.js 22.22.3** です。

```sh
git clone --branch chrome-mv3 https://github.com/kimmi0815/Traduzir-paginas-web.git twp-fast
cd twp-fast
npm ci
npm run build:local-sourcemaps
```

既にチェックアウト済みの場合は、ローカルの変更を確認してから更新します。

```sh
git status
git switch chrome-mv3
git pull --ff-only origin chrome-mv3
npm ci
npm run build:local-sourcemaps
```

`build/` と `node_modules/` はGit管理外です。別のPCでは必ずビルドしてください。ブラウザ内の設定・辞書・キャッシュはGitでは同期されません。必要な設定は設定画面のストレージからバックアップ／復元できます。

## Aside / Chromiumへ読み込む

1. 拡張機能の管理画面（`chrome://extensions/`、Asideでは `aside://extensions/`）を開き、デベロッパーモードを有効にする。
2. 「パッケージ化されていない拡張機能を読み込む」で、チェックアウト先の **`build/TWP_10.2.5.0_Chromium_MV3/`** を選択する。
3. フォルダ直下に `manifest.json` があることを確認する。リポジトリのルートや `build/` 自体を選ぶと「マニフェストを読み込めませんでした」になる。
4. 標準版とこのフォークを同時に有効にすると翻訳が重複する可能性があるため、使用する方を選ぶ。既存版を削除する必要はない。
5. コード変更後は再ビルドし、拡張機能カードの再読み込みボタンを押す。既に開いていたWebページも再読み込みして、更新後のコンテンツスクリプトを使う。

macOSのフォルダ選択画面では、`⌘⇧G` で上記フォルダの絶対パスを入力すると確実です。初回読み込み時は、全サイトへのアクセスと `webRequest` を含む既存の権限が要求されます。

## UIプレビュー

```sh
node qa/ui-design/server.mjs
```

`http://127.0.0.1:4190/preview.html` を開きます。実装のHTML/CSS/JSとモックの拡張APIを使うプレビューです。実際のページ翻訳やインストール済み拡張機能の設定変更は行いません。

主なファイル:

- `src/popup/old-popup.{html,css,js}`: コンパクトなポップアップ。既存設定 `useOldPopup=yes` がこのUIを選ぶ。
- `src/options/options.{html,js}`、`native-options.css`、`settings-ui.js`: 設定画面。
- `src/lib/ui-theme.css`: ポップアップと設定の共通テーマ。
- `qa/ui-design/`: プレビュー、モック、検証記録。拡張機能のビルドには含まれない。

## 確認済みと次の確認

Chromium／Firefox向けビルドと差分の空白チェックは成功。モック環境では翻訳／原文切り替え、メニュー、言語選択、設定保存、ルール追加・削除、キーボード操作を確認。設定の全9ページはデスクトップ幅と390px幅で横にはみ出さないことを確認済み。

Asideではユーザーが新版ポップアップを実際に表示したスクリーンショットを共有済み。その後の **280pxへの縮小版は再読み込み後の実機確認待ち**。次はこのサイズ感、実ページの翻訳／復元、設定保存をAside上で確認する。

速度と翻訳品質の検証条件は [latency QA](qa/translation-latency/README.md)、UIの検証範囲は [UI QA](qa/ui-design/README.md)、設定の詳細レビューは [settings review](qa/ui-design/settings-review.md) を参照。

## 継続時の方針

翻訳品質・プロバイダ・辞書・ページレイアウトを保つ。UI調整のために翻訳エンジンを変更しない。ユーザーが承認したChrome風の簡素な構成を維持し、今後の修正は実機フィードバックに沿って進める。

`origin` はこの個人用フォーク。上流を比較する場合は必要に応じて `upstream` を追加する。

```sh
git remote add upstream https://github.com/FilipePS/Traduzir-paginas-web.git
```

既に同名のリモートがある場合は追加不要。通常の作業は `origin/chrome-mv3` へプッシュし、上流へのプッシュは行わない。
