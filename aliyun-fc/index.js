const { createHash } = require("node:crypto");

const DATE_RANGES = {
  all: [1514736000, 1609430399],
  2018: [1514736000, 1546271999],
  2019: [1546272000, 1577807999],
  2020: [1577808000, 1609430399],
};

const MIXIN_KEY_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

const FALLBACK_MIXIN_KEY = "ea1db124af3c7062474693fa704f4ff8";
const ALLOWED_ORIGIN = "https://qingnanzhi.github.io";
const UPSTREAM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Referer: "https://search.bilibili.com/",
  Accept: "application/json",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function response(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
      ...extraHeaders,
    },
    isBase64Encoded: false,
    body: data === null ? "" : JSON.stringify(data),
  };
}

function parseEvent(event) {
  if (Buffer.isBuffer(event)) event = event.toString("utf8");
  if (typeof event === "string") {
    try {
      return JSON.parse(event);
    } catch {
      return {};
    }
  }
  return event || {};
}

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function getMixinKey() {
  try {
    const navResponse = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      headers: UPSTREAM_HEADERS,
    });
    if (!navResponse.ok) return FALLBACK_MIXIN_KEY;
    const payload = await navResponse.json();
    const imgUrl = payload?.data?.wbi_img?.img_url || "";
    const subUrl = payload?.data?.wbi_img?.sub_url || "";
    const imgKey = imgUrl.slice(imgUrl.lastIndexOf("/") + 1, imgUrl.lastIndexOf("."));
    const subKey = subUrl.slice(subUrl.lastIndexOf("/") + 1, subUrl.lastIndexOf("."));
    const source = imgKey + subKey;
    if (source.length < 64) return FALLBACK_MIXIN_KEY;
    return MIXIN_KEY_TABLE.map((index) => source[index]).join("").slice(0, 32);
  } catch {
    return FALLBACK_MIXIN_KEY;
  }
}

async function signedSearchUrl(params) {
  const mixinKey = await getMixinKey();
  params.wts = String(Math.floor(Date.now() / 1000));
  const query = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]).replace(/[!'()*]/g, ""))}`)
    .join("&");
  const signature = createHash("md5").update(query + mixinKey).digest("hex");
  return `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}&w_rid=${signature}`;
}

exports.handler = async function handler(rawEvent) {
  const event = parseEvent(rawEvent);
  const method = String(event?.requestContext?.http?.method || "GET").toUpperCase();

  if (method === "OPTIONS") return response(204, null);
  if (method !== "GET") return response(405, { error: "仅支持 GET 请求" });

  const query = event.queryParameters || {};
  const keyword = String(query.q || "").trim();
  const year = String(query.year || "all");
  const page = Math.min(Math.max(Number(query.page) || 1, 1), 50);

  if (!keyword || keyword.length > 50) {
    return response(400, { error: "请输入 1—50 个字符的关键词" });
  }
  if (!DATE_RANGES[year]) return response(400, { error: "年份参数无效" });

  const [start, end] = DATE_RANGES[year];
  try {
    const url = await signedSearchUrl({
      search_type: "video",
      keyword,
      order: "pubdate",
      page: String(page),
      page_size: "24",
      pubtime_begin_s: String(start),
      pubtime_end_s: String(end),
    });
    const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) throw new Error(`B站接口返回 ${upstream.status}`);
    const payload = await upstream.json();
    if (payload.code !== 0 || !payload.data?.result) {
      throw new Error(payload.message || "搜索接口暂不可用");
    }

    const videos = payload.data.result
      .filter((video) => video.pubdate >= start && video.pubdate <= end && /^BV[0-9A-Za-z]+$/.test(video.bvid || ""))
      .map((video) => ({
        bvid: video.bvid,
        title: cleanText(video.title),
        author: cleanText(video.author),
        category: cleanText(video.typename || "视频"),
        pubdate: video.pubdate,
        views: Number(video.play) || 0,
        danmaku: Number(video.video_review) || 0,
        duration: cleanText(video.duration || ""),
        cover: video.pic ? `https:${video.pic.replace(/^https?:/, "")}` : "",
        url: `https://www.bilibili.com/video/${video.bvid}/`,
      }));

    return response(
      200,
      {
        keyword,
        year,
        page,
        total: Number(payload.data.numResults) || videos.length,
        videos,
      },
      { "Cache-Control": "public, max-age=60" },
    );
  } catch (error) {
    return response(502, {
      error: "暂时无法获取 B 站搜索结果，请稍后再试",
      detail: error.message,
    });
  }
};
