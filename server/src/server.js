import "dotenv/config";
import express from "express";
import cors from "cors";
import { registerAdminRoutes } from "./adminRoutes.js";
const app = express();

const PORT = process.env.PORT || 4000;

const ANILIST_URL = "https://graphql.anilist.co";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://anime-box-livid.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Postman/curl/server-side requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked: ${origin}`)
      );
    },
    credentials: true,
  })
);

app.use(express.json());
registerAdminRoutes(app, {
  getFullAnimeDetail,
});

/* =========================================================
   BASIC HELPERS
========================================================= */

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeTitle(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tmdbImage(path, size = "original") {
  if (!path) return null;

  if (String(path).startsWith("http")) {
    return path;
  }

  return `${TMDB_IMAGE}/${size}${path}`;
}

/* =========================================================
   TYPE HELPERS
========================================================= */

/*
  AnimeBox content types:

  MOVIE
  SERIES

  AniList has several non-movie formats.
  Everything except MOVIE is treated as series for AnimeBox.
*/

function normalizeContentType(value) {
  const type = String(value || "").toLowerCase();

  if (type === "movie") {
    return "movie";
  }

  if (type === "series" || type === "tv") {
    return "series";
  }

  return null;
}
function isAniListMovie(media) {
  return (
    String(media?.format || "").toUpperCase() === "MOVIE"
  );
}

function isAniListSeries(media) {
  const format = String(
    media?.format || ""
  ).toUpperCase();

  return (
    format === "TV" ||
    format === "ONA"
  );
}

function isSupportedAnimeFormat(media) {
  return (
    isAniListMovie(media) ||
    isAniListSeries(media)
  );
}
/* =========================================================
   ANILIST REQUEST
========================================================= */
async function anilistFetch(query, variables = {}, retries = 2) {
  if (!String(query || "").trim()) {
    throw new Error("AniList GraphQL query is empty");
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      const response = await fetch(ANILIST_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },

        body: JSON.stringify({
          query: String(query),
          variables: variables || {},
        }),

        signal: controller.signal,
      });

      clearTimeout(timeout);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          `AniList HTTP ${response.status}: ${
            json?.errors?.[0]?.message ||
            response.statusText
          }`
        );
      }

      if (json?.errors?.length) {
        throw new Error(
          json.errors
            .map((error) => error.message)
            .join(", ")
        );
      }

      if (!json?.data) {
        throw new Error(
          "AniList returned no data"
        );
      }

      return json.data;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(700 * (attempt + 1));
      }
    }
  }

  throw lastError;
}
/* =========================================================
   TMDB REQUEST
========================================================= */

async function tmdbFetch(path, params = {}, retries = 2) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("TMDB_API_KEY is missing in .env");
  }

  const url = new URL(`${TMDB_BASE}${path}`);

  // TMDB v3 API Key authentication
  url.searchParams.set("api_key", apiKey);

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, value);
    }
  });

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      const response = await fetch(url, {
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          `TMDB HTTP ${response.status}: ${
            json?.status_message ||
            response.statusText
          }`
        );
      }

      return json;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(700 * (attempt + 1));
      }
    }
  }

  throw lastError;
}
/* =========================================================
   ANILIST GRAPHQL - DETAIL
========================================================= */

const ANIME_BY_ID_QUERY = `
query AnimeById($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    type
    format
    status
    season
    seasonYear
    episodes
    duration
    averageScore
    meanScore
    popularity
    countryOfOrigin

    description

    startDate {
      year
      month
      day
    }

    endDate {
      year
      month
      day
    }

    title {
      romaji
      english
      native
      userPreferred
    }

    coverImage {
      extraLarge
      large
      medium
      color
    }

    bannerImage

    genres

    studios {
      nodes {
        id
        name
      }
    }

    externalLinks {
      id
      url
      site
      type
    }

    relations {
      edges {
        relationType

        node {
          id
          type
          format

          title {
            romaji
            english
            native
          }
        }
      }
    }
  }
}
`;

/* =========================================================
   ANILIST EXTERNAL IDS
========================================================= */

function getAniListImdbId(media) {
  const links = media?.externalLinks || [];

  const imdbLink = links.find((link) => {
    const site = String(
      link?.site || ""
    ).toLowerCase();

    const url = String(
      link?.url || ""
    ).toLowerCase();

    return (
      site.includes("imdb") ||
      url.includes("imdb.com/title/")
    );
  });

  if (!imdbLink?.url) {
    return null;
  }

  const match = imdbLink.url.match(
    /imdb\.com\/title\/(tt\d+)/i
  );

  return match?.[1] || null;
}

/* =========================================================
   ANILIST MOVIE FORMATTER
========================================================= */

function formatAniListMovie(media) {
  const title = media.title || {};

  const averageScore = safeNumber(
    media.averageScore ?? media.meanScore
  );

  return {
    id: media.id,

    anilistId: media.id,

    tmdbId: null,

    imdbId: getAniListImdbId(media),

    source: "anilist",

    contentType: "movie",

    title: {
      english: title.english || null,
      romaji: title.romaji || null,
      native: title.native || null,
      userPreferred:
        title.userPreferred || null,
    },

    description: cleanText(
      media.description || ""
    ),

    poster:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      media.coverImage?.medium ||
      null,

    coverImage:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      media.coverImage?.medium ||
      null,

    backdrop:
      media.bannerImage || null,

    bannerImage:
      media.bannerImage || null,

    genres:
      media.genres || [],

    rating: averageScore,

    averageScore,

    popularity:
      safeNumber(media.popularity),

    status:
      media.status || null,

    format:
      media.format || "MOVIE",

    season:
      media.season || null,

    seasonYear:
      media.seasonYear || null,

    startDate:
      media.startDate || null,

    endDate:
      media.endDate || null,

    episodes:
      media.episodes || 1,

    episodeCount:
      media.episodes || 1,

    duration:
      media.duration || null,

    countryOfOrigin:
      media.countryOfOrigin || null,

    studios:
      media.studios?.nodes?.map(
        (studio) => studio.name
      ) || [],

    externalIds: {
      malId:
        media.idMal || null,

      imdbId:
        getAniListImdbId(media),
    },

    seasons: [
      {
        seasonNumber: 1,
        name: "Movie",
        episodeCount: 1,
      },
    ],
  };
}

/* =========================================================
   TMDB SEARCH TV
========================================================= */

async function searchTmdbTv(title, year = null) {
  const candidates = [];

  const titles = [
    title?.english,
    title?.romaji,
    title?.native,
    title?.userPreferred,
  ].filter(Boolean);

  const uniqueTitles = [
    ...new Set(
      titles
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];

  for (const searchTitle of uniqueTitles) {
    try {
      const params = {
        query: searchTitle,
        include_adult: "false",
        language: "en-US",
        page: 1,
      };

      /*
        IMPORTANT:
        Do not force the year on the first search.
        Some anime have different TMDB/AniList years.
      */

      const result = await tmdbFetch(
        "/search/tv",
        params
      );

      for (const item of result?.results || []) {
        candidates.push(item);
      }
    } catch (error) {
      console.warn(
        `TMDB search failed for "${searchTitle}":`,
        error.message
      );
    }
  }

  if (!candidates.length) {
    return null;
  }

  const unique = Array.from(
    new Map(
      candidates.map((item) => [
        item.id,
        item,
      ])
    ).values()
  );

  const normalizedTitles =
    uniqueTitles.map(normalizeTitle);

  function scoreCandidate(item) {
    let score = 0;

    const candidateNames = [
      item.name,
      item.original_name,
    ]
      .filter(Boolean)
      .map(normalizeTitle);

    /*
      Exact match
    */

    if (
      candidateNames.some((name) =>
        normalizedTitles.includes(name)
      )
    ) {
      score += 100;
    }

    /*
      Partial title match
    */

    for (const searchTitle of normalizedTitles) {
      for (const candidateName of candidateNames) {
        if (
          candidateName.includes(searchTitle) ||
          searchTitle.includes(candidateName)
        ) {
          score += 35;
        }
      }
    }

    /*
      Japanese anime
    */

    if (
      item.original_language === "ja" ||
      item.origin_country?.includes("JP")
    ) {
      score += 30;
    }

    /*
      Matching year
    */

    if (
      year &&
      item.first_air_date
    ) {
      const itemYear = Number(
        item.first_air_date.slice(0, 4)
      );

      if (itemYear === Number(year)) {
        score += 20;
      } else if (
        Math.abs(
          itemYear - Number(year)
        ) <= 1
      ) {
        score += 8;
      }
    }

    /*
      Has poster
    */

    if (item.poster_path) {
      score += 3;
    }

    /*
      Popularity only as a small tie-breaker
    */

    score += Math.min(
      Number(item.popularity || 0) / 100,
      10
    );

    return score;
  }

  unique.sort(
    (a, b) =>
      scoreCandidate(b) -
      scoreCandidate(a)
  );

  const best = unique[0];

  if (!best?.id) {
    return null;
  }

  console.log(
    `[TMDB] Resolved "${uniqueTitles[0]}" -> ${best.id} (${best.name})`
  );

  return best;
}

/* =========================================================
   RESOLVE TMDB SERIES
========================================================= */

async function resolveTmdbSeries(media) {
  const title = media?.title || {};

  const year =
    media?.startDate?.year ||
    media?.seasonYear ||
    null;

  const imdbId = getAniListImdbId(media);

  console.log("[TMDB] Resolving AniList:", media?.id, {
    english: title?.english,
    romaji: title?.romaji,
    native: title?.native,
    userPreferred: title?.userPreferred,
    year,
    imdbId,
  });

  // =========================================================
  // 1. IMDb -> TMDB
  // =========================================================

  if (imdbId) {
    try {
      console.log(`[TMDB] Trying IMDb: ${imdbId}`);

      const findResult = await tmdbFetch(
        `/find/${imdbId}`,
        {
          external_source: "imdb_id",
          language: "en-US",
        }
      );

      const tvResult =
        findResult?.tv_results?.[0];

      if (tvResult?.id) {
        console.log(
          `[TMDB] IMDb SUCCESS: ${imdbId} -> ${tvResult.id}`
        );

        return {
          tmdbId: tvResult.id,
          imdbId,
        };
      }
    } catch (error) {
      console.warn(
        "[TMDB] IMDb lookup failed:",
        error.message
      );
    }
  }

  // =========================================================
  // 2. Prepare all possible AniList titles
  // =========================================================

  const titles = [
    title?.english,
    title?.romaji,
    title?.native,
    title?.userPreferred,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  const uniqueTitles = [
    ...new Set(titles),
  ];

  console.log(
    "[TMDB] Searching titles:",
    uniqueTitles
  );

  // =========================================================
  // 3. Search every title
  // =========================================================

  const candidates = [];

  for (const searchTitle of uniqueTitles) {
    try {
      console.log(
        `[TMDB] Searching TV: "${searchTitle}"`
      );

      const result = await tmdbFetch(
        "/search/tv",
        {
          query: searchTitle,
          include_adult: "false",
          language: "en-US",
          page: 1,
        }
      );

      for (const item of result?.results || []) {
        candidates.push(item);
      }
    } catch (error) {
      console.warn(
        `[TMDB] Search failed "${searchTitle}":`,
        error.message
      );
    }
  }

  if (!candidates.length) {
    console.warn(
      `[TMDB] No TV results found for AniList ${media?.id}`
    );

    return null;
  }

  // =========================================================
  // 4. Remove duplicates
  // =========================================================

  const uniqueCandidates = Array.from(
    new Map(
      candidates.map((item) => [
        item.id,
        item,
      ])
    ).values()
  );

  // =========================================================
  // 5. Score TMDB candidates
  // =========================================================

  const normalizedSearchTitles =
    uniqueTitles.map(normalizeTitle);

  function scoreCandidate(item) {
    let score = 0;

    const names = [
      item?.name,
      item?.original_name,
    ]
      .filter(Boolean)
      .map(normalizeTitle);

    // Exact title
    for (const name of names) {
      if (
        normalizedSearchTitles.includes(name)
      ) {
        score += 100;
      }
    }

    // Partial title
    for (const searchTitle of normalizedSearchTitles) {
      for (const candidateName of names) {
        if (
          candidateName.includes(searchTitle) ||
          searchTitle.includes(candidateName)
        ) {
          score += 35;
        }
      }
    }

    // Japanese origin
    if (
      item?.original_language === "ja" ||
      item?.origin_country?.includes("JP")
    ) {
      score += 30;
    }

    // Year match
    if (
      year &&
      item?.first_air_date
    ) {
      const tmdbYear = Number(
        item.first_air_date.slice(0, 4)
      );

      if (
        tmdbYear === Number(year)
      ) {
        score += 25;
      } else if (
        Math.abs(
          tmdbYear - Number(year)
        ) <= 1
      ) {
        score += 10;
      }
    }

    // Has poster
    if (item?.poster_path) {
      score += 5;
    }

    // Has backdrop
    if (item?.backdrop_path) {
      score += 3;
    }

    // Popularity only as tie breaker
    score += Math.min(
      Number(item?.popularity || 0) / 100,
      10
    );

    return score;
  }

  uniqueCandidates.sort(
    (a, b) =>
      scoreCandidate(b) -
      scoreCandidate(a)
  );

  const best =
    uniqueCandidates[0];

  if (!best?.id) {
    console.warn(
      `[TMDB] Could not select candidate for AniList ${media?.id}`
    );

    return null;
  }

  console.log(
    `[TMDB] FINAL RESOLUTION: AniList ${media?.id} -> TMDB ${best.id} (${best.name})`
  );

  return {
    tmdbId: best.id,
    imdbId,
  };
}

/* =========================================================
   TMDB SERIES FORMATTER
========================================================= */

function formatTmdbSeries(
  tv,
  anilistMedia,
  externalIds = {},
  resolvedIds = {}
) {
  const genres =
    tv.genres
      ?.map((genre) => genre.name)
      .filter(Boolean) || [];

  const seasons =
    (tv.seasons || [])
      .filter(
        (season) =>
          Number(
            season.season_number
          ) > 0
      )
      .map((season) => ({
        seasonNumber:
          season.season_number,

        name:
          season.name ||
          `Season ${season.season_number}`,

        overview:
          season.overview || "",

        airDate:
          season.air_date || null,

        poster:
          tmdbImage(
            season.poster_path,
            "w500"
          ),

        episodeCount:
          season.episode_count || 0,
      }));

  const anilistTitle =
    anilistMedia?.title || {};

  const imdbId =
    externalIds?.imdb_id ||
    resolvedIds?.imdbId ||
    getAniListImdbId(anilistMedia) ||
    null;

  const tmdbId =
    tv?.id ||
    resolvedIds?.tmdbId ||
    null;

  return {
    id: anilistMedia.id,

    anilistId:
      anilistMedia.id,

    tmdbId,

    imdbId,

    source: "tmdb",

    contentType: "series",

    title: {
      english:
        tv.name ||
        anilistTitle.english ||
        null,

      romaji:
        anilistTitle.romaji ||
        tv.original_name ||
        tv.name ||
        null,

      native:
        anilistTitle.native ||
        null,

      userPreferred:
        tv.name ||
        anilistTitle.userPreferred ||
        anilistTitle.english ||
        anilistTitle.romaji ||
        null,
    },

    description:
      tv.overview ||
      cleanText(
        anilistMedia.description || ""
      ),

    poster:
      tmdbImage(
        tv.poster_path,
        "w500"
      ) ||
      anilistMedia.coverImage?.extraLarge ||
      anilistMedia.coverImage?.large ||
      null,

    coverImage:
      tmdbImage(
        tv.poster_path,
        "w500"
      ) ||
      anilistMedia.coverImage?.extraLarge ||
      null,

    backdrop:
      tmdbImage(
        tv.backdrop_path,
        "original"
      ) ||
      anilistMedia.bannerImage ||
      null,

    bannerImage:
      tmdbImage(
        tv.backdrop_path,
        "original"
      ) ||
      anilistMedia.bannerImage ||
      null,

    genres,

    rating:
      safeNumber(tv.vote_average) ??
      safeNumber(
        anilistMedia.averageScore
          ? anilistMedia.averageScore / 10
          : null
      ),

    averageScore:
      safeNumber(tv.vote_average),

    popularity:
      safeNumber(tv.popularity),

    status:
      tv.status || null,

    format: "TV",

    firstAirDate:
      tv.first_air_date || null,

    lastAirDate:
      tv.last_air_date || null,

    startDate:
      tv.first_air_date || null,

    endDate:
      tv.last_air_date || null,

    numberOfSeasons:
      tv.number_of_seasons ||
      seasons.length,

    numberOfEpisodes:
      tv.number_of_episodes || 0,

    episodeCount:
      tv.number_of_episodes || 0,

    duration:
      tv.episode_run_time?.[0] ||
      null,

    countryOfOrigin:
      tv.origin_country?.[0] ||
      anilistMedia.countryOfOrigin ||
      null,

    studios:
      tv.production_companies?.map(
        (company) => company.name
      ) || [],

    networks:
      tv.networks?.map(
        (network) => network.name
      ) || [],

    externalIds: {
      malId:
        anilistMedia.idMal || null,

      imdbId,
    },

    seasons,
  };
}

/* =========================================================
   GET ANILIST ANIME
========================================================= */

async function getAniListAnime(id) {
  const data =
    await anilistFetch(
      ANIME_BY_ID_QUERY,
      {
        id: Number(id),
      }
    );

  return data?.Media || null;
}

/* =========================================================
   GET FULL ANIME DETAIL
========================================================= */

async function getFullAnimeDetail(
  anilistId
) {
  const media =
    await getAniListAnime(anilistId);

  if (!media) {
    const error = new Error(
      "Anime not found on AniList"
    );

    error.statusCode = 404;

    throw error;
  }

  /*
    MOVIE
  */

  if (isAniListMovie(media)) {
  return formatAniListMovie(media);
}

if (!isAniListSeries(media)) {
  const error = new Error(
    `Unsupported AniList format: ${media.format || "UNKNOWN"}`
  );

  error.statusCode = 422;

  throw error;
}

const resolved =
  await resolveTmdbSeries(media);

  if (!resolved?.tmdbId) {
    return {
      ...formatAniListMovie(media),

      contentType: "series",

      source: "tmdb",

      tmdbId: null,

      imdbId:
        getAniListImdbId(media),

      tmdbResolved: false,

      seasons: [],
    };
  }

  const [tv, externalIds] =
    await Promise.all([
      tmdbFetch(
        `/tv/${resolved.tmdbId}`,
        {
          language: "en-US",
        }
      ),

      tmdbFetch(
        `/tv/${resolved.tmdbId}/external_ids`,
        {
          language: "en-US",
        }
      ),
    ]);

  return {
    ...formatTmdbSeries(
      tv,
      media,
      externalIds,
      resolved
    ),

    tmdbResolved: true,
  };
}

/* =========================================================
   SEASON DETAILS
========================================================= */

async function getSeasonDetails(
  anilistId,
  seasonNumber
) {
  const media =
    await getAniListAnime(anilistId);

  if (!media) {
    throw new Error(
      "Anime not found on AniList"
    );
  }

  /*
    MOVIE
  */

  if (isAniListMovie(media)) {
    return {
      source: "anilist",

      anilistId: media.id,

      tmdbId: null,

      imdbId:
        getAniListImdbId(media),

      seasonNumber: 1,

      name: "Movie",

      overview:
        cleanText(
          media.description || ""
        ),

      episodes: [
        {
          id: `${media.id}-movie-1`,

          episodeNumber: 1,

          name:
            media.title?.english ||
            media.title?.romaji ||
            media.title?.native ||
            "Movie",

          overview:
            cleanText(
              media.description || ""
            ),

          airDate:
            media.startDate
              ? [
                  media.startDate.year,

                  String(
                    media.startDate.month ||
                      1
                  ).padStart(2, "0"),

                  String(
                    media.startDate.day ||
                      1
                  ).padStart(2, "0"),
                ].join("-")
              : null,

          still: null,

          runtime:
            media.duration || null,
        },
      ],
    };
  }

  /*
    SERIES
  */
if (!isAniListSeries(media)) {
  const error = new Error(
    `This anime format does not support TV seasons: ${
      media.format || "UNKNOWN"
    }`
  );

  error.statusCode = 422;

  throw error;
}
  const resolved =
    await resolveTmdbSeries(media);

  if (!resolved?.tmdbId) {
    throw new Error(
      "TMDB series could not be resolved for this anime"
    );
  }

  const season =
    await tmdbFetch(
      `/tv/${resolved.tmdbId}/season/${Number(
        seasonNumber
      )}`,
      {
        language: "en-US",
      }
    );

  const imdbId =
    resolved.imdbId ||
    getAniListImdbId(media);

  return {
    source: "tmdb",

    anilistId: media.id,

    tmdbId: resolved.tmdbId,

    imdbId,

    seasonNumber:
      season.season_number ??
      Number(seasonNumber),

    name:
      season.name ||
      `Season ${seasonNumber}`,

    overview:
      season.overview || "",

    airDate:
      season.air_date || null,

    poster:
      tmdbImage(
        season.poster_path,
        "w500"
      ),

    episodeCount:
      season.episodes?.length || 0,

    episodes:
      (season.episodes || []).map(
        (episode) => ({
          id: episode.id,

          episodeNumber:
            episode.episode_number,

          name:
            episode.name ||
            `Episode ${episode.episode_number}`,

          overview:
            episode.overview || "",

          airDate:
            episode.air_date || null,

          still:
            tmdbImage(
              episode.still_path,
              "w500"
            ),

          runtime:
            episode.runtime || null,

          rating:
            safeNumber(
              episode.vote_average
            ),
        })
      ),
  };
}

/* =========================================================
   ANILIST LIST QUERY
========================================================= */
const ANIME_LIST_QUERY = `
query AnimeList(
  $page: Int,
  $perPage: Int,
  $sort: [MediaSort],
  $genre: String,
  $format: MediaFormat,
  $statusIn: [MediaStatus]
) {
  Page(
    page: $page,
    perPage: $perPage
  ) {
    pageInfo {
      currentPage
      lastPage
      hasNextPage
      total
    }

    media(
      type: ANIME,
      sort: $sort,
      genre: $genre,
      format: $format,
      status_in: $statusIn
    ) {
      id
      idMal
      format
      status
      season
      seasonYear
      episodes
      duration
      averageScore
      popularity

      title {
        romaji
        english
        native
        userPreferred
      }

      coverImage {
        extraLarge
        large
        medium
      }

      bannerImage
      genres

      startDate {
        year
        month
        day
      }

      endDate {
        year
        month
        day
      }
    }
  }
}
`;
/* =========================================================
   FORMAT ANIME CARD
========================================================= */
function formatAnimeCard(media) {
  const format = String(
    media?.format || ""
  ).toUpperCase();

  let contentType = null;

  if (format === "MOVIE") {
    contentType = "movie";
  } else if (
    format === "TV" ||
    format === "ONA"
  ) {
    contentType = "series";
  }

  return {
    id: media.id,

    anilistId:
      media.id,

    title: {
      english:
        media.title?.english || null,

      romaji:
        media.title?.romaji || null,

      native:
        media.title?.native || null,

      userPreferred:
        media.title?.userPreferred || null,
    },

    poster:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      media.coverImage?.medium ||
      null,

    coverImage:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      media.coverImage?.medium ||
      null,

    backdrop:
      media.bannerImage || null,

    genres:
      media.genres || [],

    rating:
      safeNumber(
        media.averageScore
      ),

    popularity:
      safeNumber(
        media.popularity
      ),

    status:
      media.status || null,

    format:
      media.format || null,

    contentType,

    season:
      media.season || null,

    seasonYear:
      media.seasonYear || null,

    startDate:
      media.startDate || null,

    endDate:
      media.endDate || null,

    episodes:
      media.episodes || null,

    duration:
      media.duration || null,

    externalIds: {
      malId:
        media.idMal || null,
    },
  };
}
/* =========================================================
   COMMON LIST PARAMS
========================================================= */

function getListParams(req) {
  const page = Math.max(
    1,
    Number(req.query.page) || 1
  );

  const perPage = Math.min(
    50,
    Math.max(
      1,
      Number(req.query.perPage) || 30
    )
  );

  const sortParam = String(
    req.query.sort ||
      "START_DATE_DESC"
  ).toUpperCase();

  const allowedSorts = new Set([
    "START_DATE_DESC",
    "START_DATE",
    "POPULARITY_DESC",
    "SCORE_DESC",
    "TRENDING_DESC",
  ]);

  const sort =
    allowedSorts.has(sortParam)
      ? sortParam
      : "START_DATE_DESC";

  const genre =
    String(
      req.query.genre || ""
    ).trim();

  const type =
    normalizeContentType(
      req.query.type
    );

  return {
    page,
    perPage,
    sort,
    genre,
    type,
  };
}

/* =========================================================
   ANIME LIST
========================================================= */
app.get(
  "/api/anime",
  async (req, res) => {
    try {
      const {
        page,
        perPage,
        sort,
        genre,
        type,
      } = getListParams(req);

      /*
        AnimeBox:
        - Latest should contain only released/releasing anime.
        - NOT_YET_RELEASED must never reach the frontend.
      */

      const format =
        type === "movie"
          ? "MOVIE"
          : undefined;

      const data =
        await anilistFetch(
          ANIME_LIST_QUERY,
          {
            page,
            perPage,
            sort: [sort],
            genre: genre || undefined,
            format,

            // IMPORTANT:
            // Only currently releasing + already finished anime
            statusIn: [
              "RELEASING",
              "FINISHED",
            ],
          }
        );

      const pageData = data?.Page;

      /*
        Extra safety filter.
        Even if AniList somehow returns a future anime,
        it will be removed before sending to frontend.
      */
     let results =
  (pageData?.media || [])
    .filter(
      (anime) =>
        isSupportedAnimeFormat(anime)
    )
    .filter(
      (anime) =>
        anime.status !==
        "NOT_YET_RELEASED"
    )
    .map(formatAnimeCard);

      /*
        Extra release-date safety.
        If an anime has a future start date,
        don't show it in Latest.
      */
      const today = new Date();

      results = results.filter((anime) => {
        const startDate = anime.startDate;

        if (
          startDate?.year &&
          startDate?.month &&
          startDate?.day
        ) {
          const releaseDate = new Date(
            Number(startDate.year),
            Number(startDate.month) - 1,
            Number(startDate.day)
          );

          if (releaseDate > today) {
            return false;
          }
        }

        return true;
      });

      /*
        SERIES FILTER
      */
      if (type === "series") {
  results = results.filter(
    (anime) =>
      anime.format === "TV" ||
      anime.format === "ONA"
  );
}

      res.json({
        success: true,

        page:
          pageData?.pageInfo
            ?.currentPage || page,

        perPage,

        total:
          pageData?.pageInfo?.total || 0,

        lastPage:
          pageData?.pageInfo?.lastPage ||
          null,

        hasNextPage:
          Boolean(
            pageData?.pageInfo
              ?.hasNextPage
          ),

        type:
          type || "all",

        genre:
          genre || null,

        sort,

        results,
      });

    } catch (error) {
      console.error(
        "Anime list error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch anime",
      });
    }
  }
);

/* =========================================================
   TRENDING
========================================================= */

app.get(
  "/api/anime/trending",
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        Number(req.query.page) || 1
      );

      const perPage = Math.min(
        50,
        Math.max(
          1,
          Number(req.query.perPage) || 30
        )
      );

      const genre =
        String(
          req.query.genre || ""
        ).trim();

      const type =
        normalizeContentType(
          req.query.type
        );

      const format =
        type === "movie"
          ? "MOVIE"
          : undefined;

      const data =
        await anilistFetch(
          ANIME_LIST_QUERY,
          {
            page,
            perPage,

            sort: [
              "TRENDING_DESC",
            ],

            genre:
              genre || undefined,

            format,
          }
        );

      const pageData =
        data?.Page;

      let results =
        (pageData?.media || [])
          .map(formatAnimeCard);

     if (type === "series") {
  results = results.filter(
    (anime) =>
      anime.format === "TV" ||
      anime.format === "ONA"
  );
}

      res.json({
        success: true,

        page,

        hasNextPage:
          Boolean(
            pageData?.pageInfo
              ?.hasNextPage
          ),

        type:
          type || "all",

        genre:
          genre || null,

        results,
      });
    } catch (error) {
      console.error(
        "Trending anime error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch trending anime",
      });
    }
  }
);

/* =========================================================
   POPULAR
========================================================= */

app.get(
  "/api/anime/popular",
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        Number(req.query.page) || 1
      );

      const perPage = Math.min(
        50,
        Math.max(
          1,
          Number(req.query.perPage) || 30
        )
      );

      const genre =
        String(
          req.query.genre || ""
        ).trim();

      const type =
        normalizeContentType(
          req.query.type
        );

      const format =
        type === "movie"
          ? "MOVIE"
          : undefined;

      const data =
        await anilistFetch(
          ANIME_LIST_QUERY,
          {
            page,
            perPage,

            sort: [
              "POPULARITY_DESC",
            ],

            genre:
              genre || undefined,

            format,
          }
        );

      const pageData =
        data?.Page;

      let results =
        (pageData?.media || [])
          .map(formatAnimeCard);

      if (type === "series") {
        results =
          results.filter(
            (anime) =>
              anime.contentType ===
              "series"
          );
      }

      res.json({
        success: true,

        page,

        hasNextPage:
          Boolean(
            pageData?.pageInfo
              ?.hasNextPage
          ),

        type:
          type || "all",

        genre:
          genre || null,

        results,
      });
    } catch (error) {
      console.error(
        "Popular anime error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch popular anime",
      });
    }
  }
);

/* =========================================================
   GENRES
========================================================= */

/*
  AniList does not need a separate database for genres.

  This list is used by AnimeBox's Genres page and matches
  AniList genre names.
*/

const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

app.get(
  "/api/anime/genres",
  (req, res) => {
    res.json({
      success: true,

      results:
        ANIME_GENRES.map(
          (name) => ({
            name,
            slug: name,
          })
        ),
    });
  }
);

/* =========================================================
   SEARCH QUERY
========================================================= */

const SEARCH_QUERY = `
query (
  $search: String!,
  $page: Int,
  $perPage: Int,
  $genre: String,
  $format: MediaFormat
) {
  Page(
    page: $page,
    perPage: $perPage
  ) {
    pageInfo {
      currentPage
      lastPage
      hasNextPage
      total
    }

    media(
      search: $search,
      type: ANIME,
      genre: $genre,
      format: $format
    ) {
      id
      idMal
      type
      format
      title {
        romaji
        english
        native
        userPreferred
      }

      coverImage {
        large
        extraLarge
        medium
      }

      bannerImage

      description

      averageScore

      popularity

      episodes

      duration

      status

      season

      seasonYear

      startDate {
        year
        month
        day
      }

      endDate {
        year
        month
        day
      }

      genres
    }
  }
}
`;

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/anime/search",
  async (req, res) => {
    try {
      const q =
        String(
          req.query.q || ""
        ).trim();

      if (!q) {
        return res.json({
          success: true,
          results: [],
        });
      }

      const page = Math.max(
        1,
        Number(req.query.page) || 1
      );

      const perPage = Math.min(
        50,
        Math.max(
          1,
          Number(req.query.perPage) || 30
        )
      );

      const genre =
        String(
          req.query.genre || ""
        ).trim();

      const type =
        normalizeContentType(
          req.query.type
        );

      const format =
        type === "movie"
          ? "MOVIE"
          : undefined;

      const data =
        await anilistFetch(
          SEARCH_QUERY,
          {
            page,
            perPage,

            search: q,

            genre:
              genre || undefined,

            format,
          }
        );

      const pageData =
        data?.Page;

      let results =
        (pageData?.media || [])
          .map(formatAnimeCard);

      if (type === "series") {
        results =
          results.filter(
            (anime) =>
              anime.contentType ===
              "series"
          );
      }

      res.json({
        success: true,

        page:
          pageData?.pageInfo
            ?.currentPage || page,

        lastPage:
          pageData?.pageInfo
            ?.lastPage || null,

        total:
          pageData?.pageInfo
            ?.total || 0,

        hasNextPage:
          Boolean(
            pageData?.pageInfo
              ?.hasNextPage
          ),

        type:
          type || "all",

        genre:
          genre || null,

        results,
      });
    } catch (error) {
      console.error(
        "Anime search error:",
        error
      );

      res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to search anime",
      });
    }
  }
);


/* =========================================================
   ANIME DETAIL
========================================================= */

app.get(
  "/api/anime/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid AniList ID",
        });
      }

      const anime =
        await getFullAnimeDetail(id);

      res.json({
        success: true,
        anime,
      });
    } catch (error) {
      console.error(
        "Anime detail error:",
        error
      );

      res.status(
        error.statusCode || 500
      ).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch anime details",
      });
    }
  }
);

/* =========================================================
   SEASON
========================================================= */

app.get(
  "/api/anime/:id/season/:season",
  async (req, res) => {
    try {
      const anilistId =
        Number(req.params.id);

      const season =
        Number(req.params.season);

      if (
        !Number.isInteger(
          anilistId
        ) ||
        anilistId <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid AniList ID",
        });
      }

      if (
        !Number.isInteger(season) ||
        season < 1
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid season number",
        });
      }

      const seasonData =
        await getSeasonDetails(
          anilistId,
          season
        );

      res.json({
        success: true,
        ...seasonData,
      });
    } catch (error) {
      console.error(
        "Season error:",
        error
      );

     res.status(
  error.statusCode || 500
).json({
  success: false,
  message:
    error.message ||
    "Failed to fetch season",
});
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,

      name:
        "AnimeBox Backend",

      port:
        String(PORT),

      providers: {
        anilist: true,

        tmdb:
          Boolean(
            process.env.TMDB_API_KEY
          ),
      },
    });
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        "API route not found",
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled error:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        error.message ||
        "Internal server error",
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `AnimeBox Backend running on http://localhost:${PORT}`
    );

    console.log(
      "AniList: enabled"
    );

    console.log(
      `TMDB: ${
        process.env.TMDB_API_KEY
          ? "enabled"
          : "MISSING API KEY"
      }`
    );
  }
);