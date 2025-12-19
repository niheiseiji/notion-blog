import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import fs from "fs";
import path from "path";
import axios from "axios";
import "dotenv/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

function escapeAngleBracketsForMDX(markdown) {
  const codeBlockPlaceholders = [];
  const inlineCodePlaceholders = [];

  let result = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push(match);
    return placeholder;
  });

  result = result.replace(/`[^`]+`/g, (match) => {
    const placeholder = `__INLINE_CODE_${inlineCodePlaceholders.length}__`;
    inlineCodePlaceholders.push(match);
    return placeholder;
  });

  const htmlTagPattern = /^[a-z][a-z0-9]*$/i;
  result = result.replace(/<([^>]+)>/g, (match, content) => {
    const tagName = content.split(/\s/)[0].replace(/^\//, "");
    if (htmlTagPattern.test(tagName)) {
      return match;
    }
    return `\`${match}\``;
  });

  inlineCodePlaceholders.forEach((code, i) => {
    result = result.replace(`__INLINE_CODE_${i}__`, code);
  });
  codeBlockPlaceholders.forEach((code, i) => {
    result = result.replace(`__CODE_BLOCK_${i}__`, code);
  });

  return result;
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function rehostImages(mdString) {
  const imageRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  let replacedMarkdown = mdString;
  const matches = [...mdString.matchAll(imageRegex)];

  const isNotionAssetUrl = (urlString) => {
    try {
      const { hostname, pathname } = new URL(urlString);
      const hostMatches =
        hostname === "www.notion.so" ||
        hostname === "notion.so" ||
        hostname === "images.notion.so" ||
        hostname.includes("prod-files-secure.s3") ||
        hostname === "s3.us-west-2.amazonaws.com" ||
        hostname.endsWith("secure.notion-static.com");
      const pathIndicatesNotion = pathname.includes("secure.notion-static.com");
      return hostMatches || pathIndicatesNotion;
    } catch (_) {
      return false;
    }
  };

  const getExtensionFromContentType = (contentType) => {
    if (!contentType) return null;
    if (contentType.includes("image/png")) return ".png";
    if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return ".jpg";
    if (contentType.includes("image/webp")) return ".webp";
    if (contentType.includes("image/gif")) return ".gif";
    if (contentType.includes("image/svg+xml")) return ".svg";
    return null;
  };

  const getExtensionFromUrl = (urlString) => {
    try {
      const { pathname } = new URL(urlString);
      const withoutQuery = pathname.split("/").pop() || "";
      const dotIndex = withoutQuery.lastIndexOf(".");
      if (dotIndex > -1) {
        return withoutQuery.slice(dotIndex).toLowerCase();
      }
      return null;
    } catch (_) {
      return null;
    }
  };

  for (const match of matches) {
    const originalUrl = match[1];
    if (!isNotionAssetUrl(originalUrl)) continue;

    try {
      const response = await axios.get(originalUrl, { responseType: "arraybuffer" });
      const contentType = response.headers?.["content-type"] || "application/octet-stream";
      const extFromType = getExtensionFromContentType(contentType);
      const extFromUrl = getExtensionFromUrl(originalUrl);
      const fileExtension = extFromType || extFromUrl || ".bin";
      const fileBaseName = `notion_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const objectKey = `notion-images/${fileBaseName}${fileExtension}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: objectKey,
          Body: response.data,
          ContentType: contentType,
        })
      );

      const newUrl = `${process.env.CDN_BASE_URL}/${objectKey}`;
      replacedMarkdown = replacedMarkdown.split(originalUrl).join(newUrl);
      console.log(`✅ ${fileBaseName}${fileExtension} をアップロードしました`);
    } catch (error) {
      console.error(`❌ 画像アップロード失敗: ${originalUrl}`, error.message);
    }
  }

  return replacedMarkdown;
}

async function fetchPostsFromDatabase(filter = null) {
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID が設定されていません");
  }

  const posts = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const requestBody = {
      page_size: 100,
    };

    if (startCursor) {
      requestBody.start_cursor = startCursor;
    }

    if (filter) {
      requestBody.filter = filter;
    }

    const response = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    posts.push(...response.data.results);
    hasMore = response.data.has_more;
    startCursor = response.data.next_cursor;
  }

  return posts;
}

function extractR2ImageUrls(mdxContent) {
  const cdnBaseUrl = process.env.CDN_BASE_URL;
  if (!cdnBaseUrl) return [];

  const imageRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  const matches = [...mdxContent.matchAll(imageRegex)];
  const r2Urls = matches
    .map((match) => match[1])
    .filter((url) => url.startsWith(cdnBaseUrl));

  return r2Urls;
}

async function deleteR2Images(imageUrls) {
  const cdnBaseUrl = process.env.CDN_BASE_URL;
  if (!cdnBaseUrl) return;

  for (const url of imageUrls) {
    const objectKey = url.replace(`${cdnBaseUrl}/`, "");
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      })
    );
    console.log(`🗑️ R2画像を削除: ${objectKey}`);
  }
}

async function updatePublishStatus(pageId, status = "published") {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      publish_status: {
        select: {
          name: status,
        },
      },
    },
  });
}

function generateFrontMatter(post, markdownContent) {
  const title = post.properties?.title?.title?.[0]?.plain_text || "タイトルなし";
  const publishStatus = post.properties?.publish_status?.select?.name;
  const tags = post.properties?.tags?.multi_select?.map((tag) => tag.name) || [];
  const summary = post.properties?.summary?.rich_text?.[0]?.plain_text || "";
  const createdTime = post.created_time;
  const lastEditedTime = post.last_edited_time;

  const date = createdTime ? new Date(createdTime).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
  const lastmod = lastEditedTime ? new Date(lastEditedTime).toISOString().split("T")[0] : date;
  const draft = publishStatus !== "ready";
  const authors = ["nihei-seiji"];
  const layout = "PostSimple";

  const frontMatter = {
    title: `"${title}"`,
    date: `'${date}'`,
    tags: tags.length > 0 ? `[${tags.map((t) => `'${t}'`).join(", ")}]` : "[]",
    lastmod: `'${lastmod}'`,
    draft: draft.toString(),
    authors: `[${authors.map((a) => `'${a}'`).join(", ")}]`,
    layout: `'${layout}'`,
  };

  if (summary) {
    frontMatter.summary = `"${summary}"`;
  }

  const frontMatterString = Object.entries(frontMatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `---\n${frontMatterString}\n---\n\n${markdownContent}`;
}

async function syncNotionPosts() {
  console.log("📚 publish_status=ready の記事を取得中...");
  const filter = {
    property: "publish_status",
    select: {
      equals: "ready",
    },
  };
  const allPostsForFilter = await fetchPostsFromDatabase(filter);
  const readyPosts = allPostsForFilter.filter(
    (post) => post.properties?.publish_status?.select?.name === "ready"
  );

  console.log(`✅ ${readyPosts.length}件の記事を取得しました\n`);

  const outputDir = path.join(process.cwd(), "data/blog");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const post of readyPosts) {
    const title = post.properties?.title?.title?.[0]?.plain_text || "タイトルなし";
    const pageId = post.id;

    console.log(`\n📄 処理中: ${title}`);

    const mdBlocks = await n2m.pageToMarkdown(pageId);
    const mdResult = n2m.toMarkdownString(mdBlocks);
    const fullMarkdown = Array.isArray(mdResult?.children)
      ? [mdResult.parent, ...mdResult.children].join("\n")
      : typeof mdResult === "string"
      ? mdResult
      : mdResult?.parent || "";

    const updatedMd = await rehostImages(fullMarkdown);
    const escapedMd = escapeAngleBracketsForMDX(updatedMd);
    const mdxContent = generateFrontMatter(post, escapedMd);

    const articleId = post.properties?.ID?.unique_id?.number ?? "";
    const fileName = `${articleId}.mdx`;
    const outputPath = path.join(outputDir, fileName);

    // 同じIDの既存ファイルから画像を削除し、ファイルも削除
    const existingFiles = fs.readdirSync(outputDir);
    const oldFiles = existingFiles.filter(
      (file) => (file === `${articleId}.mdx` || file.startsWith(`${articleId}_`)) && file.endsWith(".mdx")
    );
    for (const oldFile of oldFiles) {
      const oldFilePath = path.join(outputDir, oldFile);
      const oldContent = fs.readFileSync(oldFilePath, "utf-8");
      const oldImageUrls = extractR2ImageUrls(oldContent);
      await deleteR2Images(oldImageUrls);
      if (oldFile !== fileName) {
        fs.unlinkSync(oldFilePath);
        console.log(`🗑️ 古いファイルを削除: ${oldFile}`);
      }
    }

    fs.writeFileSync(outputPath, mdxContent);
    console.log(`✅ ${fileName} を生成しました`);

    await updatePublishStatus(pageId);
    console.log(`✅ ${title} のステータスを published に更新しました`);
  }

  console.log(`\n✅ 全${readyPosts.length}件の記事をMDXに変換し、ステータスを更新しました`);
}

async function deleteNotionPosts() {
  console.log("\n🗑️ publish_status=delete の記事を取得中...");
  const filter = {
    property: "publish_status",
    select: {
      equals: "delete",
    },
  };
  const allPostsForFilter = await fetchPostsFromDatabase(filter);
  const deletePosts = allPostsForFilter.filter(
    (post) => post.properties?.publish_status?.select?.name === "delete"
  );

  console.log(`✅ ${deletePosts.length}件の削除対象記事を取得しました\n`);

  if (deletePosts.length === 0) {
    return;
  }

  const outputDir = path.join(process.cwd(), "data/blog");

  for (const post of deletePosts) {
    const title = post.properties?.title?.title?.[0]?.plain_text || "タイトルなし";
    const pageId = post.id;
    const articleId = post.properties?.ID?.unique_id?.number ?? "";

    console.log(`\n🗑️ 削除処理中: ${title}`);

    // 同じIDのファイルを検索して削除
    if (fs.existsSync(outputDir)) {
      const existingFiles = fs.readdirSync(outputDir);
      const targetFiles = existingFiles.filter(
        (file) => (file === `${articleId}.mdx` || file.startsWith(`${articleId}_`)) && file.endsWith(".mdx")
      );

      for (const targetFile of targetFiles) {
        const filePath = path.join(outputDir, targetFile);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const imageUrls = extractR2ImageUrls(fileContent);
        await deleteR2Images(imageUrls);
        fs.unlinkSync(filePath);
        console.log(`🗑️ ファイルを削除: ${targetFile}`);
      }
    }

    await updatePublishStatus(pageId, "deleted");
    console.log(`✅ ${title} のステータスを deleted に更新しました`);
  }

  console.log(`\n✅ 全${deletePosts.length}件の記事を削除しました`);
}

(async () => {
  await syncNotionPosts();
  await deleteNotionPosts();
})().catch((error) => {
  console.error("❌ 処理失敗:", error);
  process.exit(1);
});

