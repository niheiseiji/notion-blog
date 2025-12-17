# NiheiのNotion blog
## set up
1. Node.js 18 以上がインストールされていることを確認します。
2. 依存関係をインストールします。

```bash
npm install
```

3. 環境変数を `.env.local` に設定します。
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
4. 開発サーバーを起動します。

```bash
npm run dev
```

5. ブラウザで `http://localhost:3000` を開き、動作を確認します。

## Notion記事の同期

Notionデータベースから`publish_status=ready`の記事を取得し、`data/blog/`にMDXファイルとして保存します。

```bash
npm run deploy
```

### 必要な環境変数

- `NOTION_TOKEN` - Notion APIトークン
- `NOTION_DATABASE_ID` - NotionデータベースID
- `R2_ENDPOINT` - Cloudflare R2エンドポイント
- `R2_ACCESS_KEY_ID` - R2アクセスキー
- `R2_SECRET_ACCESS_KEY` - R2シークレットキー
- `R2_BUCKET` - R2バケット名
- `CDN_BASE_URL` - 画像CDNのベースURL
