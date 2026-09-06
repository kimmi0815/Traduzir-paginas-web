# <img src="src/icons/icon-128.png" width="40" alt=""> Native Translate

**いつものブラウザに、標準のような翻訳を。**

Chrome標準の翻訳に近い速さと操作感を目指した、TWPベースの翻訳拡張機能です。

- 高速なページ翻訳とスクロール先の先読み
- 言語タブ中心のコンパクトなポップアップとシンプルな設定画面
- 原文 → 訳文の順に読める対訳モード
- 通常はグレー、翻訳中は青＋下線のA文アイコン
- Google・Bing・Yandexの翻訳サービスとカスタム辞書

**[最新版をダウンロード](https://github.com/kimmi0815/Traduzir-paginas-web/releases/latest)** · **[導入手順](INSTALL.md)** · [変更履歴](CHANGELOG.md)

## ブラウザ対応

| ブラウザ | 配布と導入 |
|---|---|
| Aside / Chrome / Edge / BraveなどのChromium系 | Chromium MV3 ZIPを展開し、拡張機能画面から読み込み |
| Firefoxデスクトップ | 未署名の開発・一時読み込み用ZIP。通常の常設インストールにはMozilla署名が必要 |
| Safari / iOS | このリリースでは非対応 |

Asideでの利用を中心に開発しています。各ブラウザ・各サイトでの動作を一律に保証するものではありません。ストア配布や自動更新はまだ提供していません。

## 開発

```sh
npm ci
npm run build:local-sourcemaps
```

Chromiumの読み込み先は `build/NativeTranslate_11.0.0_Chromium_MV3/`。
Firefox用は `build/NativeTranslate_11.0.0_Firefox_Unsigned/`。

[開発再開手順](WORKING_NOTES.md) · [UIの検証](qa/ui-design/README.md) · [翻訳速度の検証](qa/translation-latency/README.md)

アニメーション比較はQA資料として保存していますが、本体には含めていません。

## クレジットとライセンス

[FilipePS / Translate Web Pages (TWP)](https://github.com/FilipePS/Traduzir-paginas-web) を基にした個人用フォークです。原作者・貢献者に感謝します。[MPL-2.0](LICENSE)に従ってソースを公開しています。[上流の説明資料](docs/UPSTREAM_README.md)内のストアリンクは元のTWPを指します。

Googleまたはブラウザ各社の公式製品ではありません。翻訳対象のテキストは選択した翻訳サービスに送信されます。
