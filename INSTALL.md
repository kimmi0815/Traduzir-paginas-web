# Native Translate 11.0.0 — 導入手順

## Chromium系（Aside / Chrome / Edge / Braveなど）

1. [GitHub Releases](https://github.com/kimmi0815/Traduzir-paginas-web/releases/latest) の **NativeTranslate_11.0.0_Chromium_MV3.zip** をダウンロードして展開します。「Source code」のZIPではありません。
2. 展開したフォルダを、削除・移動しない場所に置きます。
3. ブラウザの拡張機能管理画面を開きます。Chromeは `chrome://extensions`、Edgeは `edge://extensions`、Braveは `brave://extensions`。Asideは設定から拡張機能画面を開きます。
4. デベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」を選びます。
5. **manifest.jsonが直接入っているフォルダ**を選択します。ZIPや、その親フォルダを選ばないでください。
6. 必要ならツールバーに固定し、翻訳するページを再読み込みします。

「⋮ → 対訳モード」で原文と訳文を並べて表示できます。オフで通常の翻訳、原文タブで復元します。

### 既存のTWP Fastから更新する場合

設定を維持するには、以前読み込んだフォルダをそのまま使い、その中身を新しいChromium ZIPの内容に置き換えてから、拡張機能画面の「再読み込み」を押してください。フォルダの場所を変えて再登録すると別の拡張機能として扱われることがあります。念のため更新前に設定画面のストレージから設定をエクスポートしてください。

11.0.0は旧10.2.5.0より新しい版です。名前とアイコンが変わります。GitHub ZIPには自動更新機能はありません。

## Firefoxデスクトップ（開発・一時読み込み）

このリリースの **NativeTranslate_11.0.0_Firefox_Unsigned.zip** は未署名です。通常のアドオンインストールとしてZIPを開いても導入できません。

1. ZIPをダウンロードして展開します。
2. Firefoxで `about:debugging#/runtime/this-firefox` を開きます。
3. 「一時的なアドオンを読み込む」を選び、展開先の `manifest.json` を選びます。
4. Firefoxを再起動すると一時インストールは解除されます。

常設配布にはMozillaによる署名が必要です。本リリースは署名済みXPIを含みません。上流TWPと混同しないようフォーク専用の拡張IDを使用しています。

## 配布ファイルの確認

同梱リリースの `SHA256SUMS.txt` と照合できます。macOSでは `shasum -a 256 ファイル名.zip`、Linuxでは `sha256sum ファイル名.zip` を使用します。

Chrome Web Store / Edge Add-ons / Firefox Add-onsへの公開はこのGitHubリリースには含まれません。SafariおよびiOSへのインストール形式も含まれません。

公式の導入説明: [Chromeのローカル拡張機能](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Firefoxの一時インストール](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [Firefoxの署名と配布](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
