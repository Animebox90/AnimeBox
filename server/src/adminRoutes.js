import fs from "fs";
import path from "path";
import crypto from "crypto";
async function fetchTmdb(pathname) {
  const apiKey = String(
    process.env.TMDB_API_KEY || ""
  ).trim();

  if (!apiKey) {
    const error = new Error(
      "TMDB_API_KEY is missing in .env"
    );
    error.statusCode = 500;
    throw error;
  }

  const url = new URL(
    `https://api.themoviedb.org/3${pathname}`
  );

  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data?.status_message ||
        "TMDB request failed"
    );

    error.statusCode = response.status;

    throw error;
  }

  return data;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "admin.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          categories: ["Latest", "Trending", "Popular"],
          anime: [],
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readData() {
  ensureDataFile();

  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    const categories = Array.isArray(data.categories)
  ? data.categories
      .map((category) => String(category).trim())
      .filter(Boolean)
  : [];

const uniqueCategories = [
  ...new Map(
    categories.map((category) => [
      category.toLowerCase(),
      category,
    ])
  ).values(),
];

return {
  categories: uniqueCategories,
  anime: Array.isArray(data.anime)
    ? data.anime
    : [],
};
  } catch {
    return {
      categories: ["Latest", "Trending", "Popular"],
      anime: [],
    };
  }
}

function writeData(data) {
  ensureDataFile();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getAdminPassword() {
  return String(
    process.env.ADMIN_PASSWORD || ""
  ).trim();
}

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token || token !== req.app.locals.adminToken) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  next();
}
export function registerAdminRoutes(
  app,
  { getFullAnimeDetail }
) {
  ensureDataFile();

  /*
  =========================================================
  PUBLIC ADMIN CATEGORIES
  =========================================================
  */

  app.get(
    "/api/anime/categories",
    (req, res) => {
      const data = readData();

      res.json({
        success: true,
        categories: data.categories || [],
      });
    }
  );

  /*
  =========================================================
  PUBLIC CATEGORY ANIME
  =========================================================
  */

  app.get(
    "/api/anime/category/:name",
    (req, res) => {
      try {
        const name = decodeURIComponent(
          req.params.name || ""
        ).trim();

        const data = readData();

        const categoryExists =
          data.categories.some(
            (category) =>
              String(category)
                .toLowerCase() ===
              name.toLowerCase()
          );

        if (!categoryExists) {
          return res.status(404).json({
            success: false,
            message: "Category not found",
            results: [],
          });
        }

        const results = data.anime.filter(
          (item) =>
            String(item.category || "")
              .toLowerCase() ===
            name.toLowerCase()
        );

        res.json({
          success: true,
          category: name,
          results,
        });
      } catch (error) {
        console.error(
          "Public category error:",
          error
        );

        res.status(500).json({
          success: false,
          message: "Failed to load category",
          results: [],
        });
      }
    }
  );
  /*
  =========================================================
  ADMIN LOGIN
  =========================================================
  */

  app.post("/api/admin/login", (req, res) => {
    const password = String(
      req.body?.password || ""
    );

    const adminPassword = getAdminPassword();

    if (!adminPassword) {
      return res.status(500).json({
        success: false,
        message:
          "ADMIN_PASSWORD is missing in .env",
      });
    }

    if (password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });
    }

    const token = createToken();

    app.locals.adminToken = token;

    res.json({
      success: true,
      token,
    });
  });

  /*
  =========================================================
  ADMIN LOGOUT
  =========================================================
  */

  app.post(
    "/api/admin/logout",
    requireAdmin,
    (req, res) => {
      app.locals.adminToken = null;

      res.json({
        success: true,
      });
    }
  );

  /*
  =========================================================
  ADMIN DATA
  =========================================================
  */

  app.get(
    "/api/admin/catalog",
    requireAdmin,
    (req, res) => {
      const data = readData();

      res.json({
        success: true,
        ...data,
      });
    }
  );

  /*
=========================================================
ADD CATEGORY
=========================================================
*/

app.post(
  "/api/admin/categories",
  requireAdmin,
  (req, res) => {
    try {
      const name = String(
        req.body?.name || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const data = readData();

      const exists = data.categories.some(
        (category) =>
          String(category)
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      );

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Category already exists",
        });
      }

      data.categories.push(name);

      writeData(data);

      res.json({
        success: true,
        message: "Category created successfully",
        categories: data.categories,
      });
    } catch (error) {
      console.error(
        "Create category error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to create category",
      });
    }
  }
);
  /*
  =========================================================
  DELETE CATEGORY
  =========================================================
  */

  app.delete(
    "/api/admin/categories/:name",
    requireAdmin,
    (req, res) => {
      const category = decodeURIComponent(
        req.params.name
      );

      const data = readData();

      if (
        !data.categories.some(
          (item) => item === category
        )
      ) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      data.categories =
        data.categories.filter(
          (item) => item !== category
        );

      /*
        Remove deleted category
        from existing anime.
      */
      data.anime = data.anime.map((item) => {
        if (item.category === category) {
          return {
            ...item,
            category: null,
          };
        }

        return item;
      });

      writeData(data);

      res.json({
        success: true,
        categories: data.categories,
      });
    }
  );
/*
=========================================================
ADD ANIME
=========================================================
*/

app.post(
  "/api/admin/anime",
  requireAdmin,
  async (req, res) => {
    try {
      const source = String(
        req.body?.source || "anilist"
      )
        .trim()
        .toLowerCase();

      const anilistId = Number(
        req.body?.anilistId
      );

      const tmdbId = Number(
        req.body?.tmdbId
      );

      const category = String(
        req.body?.category || ""
      ).trim();

      /*
      =====================================================
      VALIDATE SOURCE
      =====================================================
      */

      if (
        source !== "anilist" &&
        source !== "tmdb"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Source must be AniList or TMDB",
        });
      }

      /*
      =====================================================
      VALIDATE CATEGORY
      =====================================================
      */

      const data = readData();

      if (
        category &&
        !data.categories.some(
          (item) =>
            String(item).toLowerCase() ===
            category.toLowerCase()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected category does not exist",
        });
      }

      /*
      =====================================================
      ANILIST POSTING
      =====================================================
      */

      if (source === "anilist") {
        if (
          !Number.isInteger(anilistId) ||
          anilistId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid AniList ID",
          });
        }

        const alreadyExists =
          data.anime.some(
            (item) =>
              Number(item.anilistId) ===
              anilistId
          );

        if (alreadyExists) {
          return res.status(409).json({
            success: false,
            message:
              "This anime is already added",
          });
        }

        const anime =
          await getFullAnimeDetail(
            anilistId
          );

        if (!anime) {
          return res.status(404).json({
            success: false,
            message: "Anime not found",
          });
        }

        const item = {
          id:
            anime.anilistId ||
            anilistId,

          source: "anilist",

          anilistId,

          title:
            anime.title || {},

          poster:
            anime.poster || null,

          coverImage:
            anime.coverImage || null,

          backdrop:
            anime.backdrop || null,

          genres:
            anime.genres || [],

          description:
            anime.description || "",

          contentType:
            anime.contentType || null,

          format:
            anime.format || null,

          tmdbId:
            anime.tmdbId || null,

          imdbId:
            anime.imdbId ||
            anime.externalIds?.imdbId ||
            null,

          category:
            category || null,

          addedAt:
            new Date().toISOString(),
        };

        data.anime.push(item);

        writeData(data);

        return res.json({
          success: true,
          message:
            "Anime added successfully",
          anime: item,
        });
      }

      /*
      =====================================================
      TMDB POSTING
      =====================================================
      */

      if (
        !Number.isInteger(tmdbId) ||
        tmdbId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid TMDB ID",
        });
      }

      /*
      TMDB source is intended for
      Anime Series / TV content.
      */

      const tmdbDetails =
        await fetchTmdb(
          `/tv/${tmdbId}`
        );

      if (!tmdbDetails?.id) {
        return res.status(404).json({
          success: false,
          message:
            "TMDB series not found",
        });
      }

      /*
      =====================================================
      CHECK DUPLICATE TMDB ID
      =====================================================
      */

      const tmdbAlreadyExists =
        data.anime.some(
          (item) =>
            Number(item.tmdbId) ===
            tmdbId
        );

      if (tmdbAlreadyExists) {
        return res.status(409).json({
          success: false,
          message:
            "This TMDB series is already added",
        });
      }

      /*
      =====================================================
      GET TMDB EXTERNAL IDS
      =====================================================
      */

      let externalIds = {};

      try {
        externalIds =
          await fetchTmdb(
            `/tv/${tmdbId}/external_ids`
          );
      } catch {
        externalIds = {};
      }

      /*
      =====================================================
      TRY TO RESOLVE ANILIST ID
      =====================================================
      */

      let resolvedAnime = null;

      const searchTitle =
        tmdbDetails.name ||
        tmdbDetails.original_name ||
        "";

      if (searchTitle) {
        try {
          /*
          getFullAnimeDetail expects AniList ID,
          so we first search AniList by title.
          */

          const query = `
            query ($search: String) {
              Page(page: 1, perPage: 10) {
                media(
                  search: $search,
                  type: ANIME
                ) {
                  id
                  title {
                    romaji
                    english
                    native
                  }
                  format
                  status
                  startDate {
                    year
                    month
                    day
                  }
                }
              }
            }
          `;

          const response =
            await fetch(
              "https://graphql.anilist.co",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                  Accept:
                    "application/json",
                },

                body: JSON.stringify({
                  query,
                  variables: {
                    search: searchTitle,
                  },
                }),
              }
            );

          const result =
            await response.json();

          const matches =
            result?.data?.Page?.media || [];

          /*
          Prefer TV / ONA results.
          */

          resolvedAnime =
            matches.find(
              (item) =>
                item.format === "TV" ||
                item.format === "ONA"
            ) ||
            matches[0] ||
            null;
        } catch (error) {
          console.error(
            "AniList TMDB title resolve error:",
            error
          );
        }
      }

      /*
      =====================================================
      ANILIST ID
      =====================================================
      */

      const resolvedAniListId =
        resolvedAnime?.id || null;

      /*
      =====================================================
      BUILD ITEM
      =====================================================
      */

      const item = {
        id:
          resolvedAniListId ||
          `tmdb-${tmdbId}`,

        source: "tmdb",

        anilistId:
          resolvedAniListId,

        tmdbId,

        imdbId:
          externalIds?.imdb_id ||
          null,

        title: {
          english:
            tmdbDetails.name ||
            null,

          romaji:
            resolvedAnime?.title?.romaji ||
            tmdbDetails.original_name ||
            null,

          native:
            resolvedAnime?.title?.native ||
            null,
        },

        poster:
          tmdbDetails.poster_path
            ? `https://image.tmdb.org/t/p/w500${tmdbDetails.poster_path}`
            : null,

        coverImage:
          tmdbDetails.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${tmdbDetails.backdrop_path}`
            : null,

        backdrop:
          tmdbDetails.backdrop_path
            ? `https://image.tmdb.org/t/p/original${tmdbDetails.backdrop_path}`
            : null,

        genres:
          Array.isArray(
            tmdbDetails.genres
          )
            ? tmdbDetails.genres.map(
                (genre) => genre.name
              )
            : [],

        description:
          tmdbDetails.overview || "",

        contentType:
          "series",

        format:
          "TV",

        status:
          tmdbDetails.status || null,

        releaseDate:
          tmdbDetails.first_air_date ||
          null,

        category:
          category || null,

        addedAt:
          new Date().toISOString(),

        tmdbSeasons:
          Array.isArray(
            tmdbDetails.seasons
          )
            ? tmdbDetails.seasons
            : [],
      };

      data.anime.push(item);

      writeData(data);

      return res.json({
        success: true,
        message:
          "TMDB series added successfully",
        anime: item,
      });
    } catch (error) {
      console.error(
        "Admin add anime error:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to add anime",
      });
    }
  }
);
  /*
  =========================================================
  DELETE ANIME
  =========================================================
  */

  app.delete(
    "/api/admin/anime/:id",
    requireAdmin,
    (req, res) => {
      const id = Number(
        req.params.id
      );

      const data = readData();

      const before =
        data.anime.length;

      data.anime =
        data.anime.filter(
          (item) =>
            Number(item.anilistId) !== id
        );

      if (
        data.anime.length === before
      ) {
        return res.status(404).json({
          success: false,
          message: "Anime not found",
        });
      }

      writeData(data);

      res.json({
        success: true,
        message: "Anime removed",
      });
    }
  );

  /*
  =========================================================
  CHANGE ANIME CATEGORY
  =========================================================
  */

  app.patch(
    "/api/admin/anime/:id",
    requireAdmin,
    (req, res) => {
      const id = Number(
        req.params.id
      );

      const category = String(
        req.body?.category || ""
      ).trim();

      const data = readData();

      const anime =
        data.anime.find(
          (item) =>
            Number(item.anilistId) === id
        );

      if (!anime) {
        return res.status(404).json({
          success: false,
          message: "Anime not found",
        });
      }

      if (
        category &&
        !data.categories.includes(category)
      ) {
        return res.status(400).json({
          success: false,
          message: "Category does not exist",
        });
      }

      anime.category =
        category || null;

      writeData(data);

      res.json({
        success: true,
        anime,
      });
    }
  );
}