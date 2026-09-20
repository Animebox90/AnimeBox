import React, { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Film,
  Home as HomeIcon,
  Search,
  Star,
  Play,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3X3,
  X,
} from "lucide-react";

import "./styles.css";

const API = "http://localhost:4000/api";

const FALLBACK_POSTER =
  "https://via.placeholder.com/500x750/16181e/ffffff?text=No+Poster";

const FALLBACK_BACKDROP =
  "https://via.placeholder.com/1500x600/101116/ffffff?text=AnimeBox";

/* =========================================================
   HELPERS
========================================================= */

function getAnimeId(anime) {
  return (
    anime?.anilistId ||
    anime?.id ||
    anime?.malId ||
    null
  );
}

function getTitle(anime) {
  if (!anime) return "Unknown Anime";

  if (typeof anime.title === "string") {
    return anime.title;
  }

  return (
    anime.title?.english ||
    anime.title?.romaji ||
    anime.title?.native ||
    anime.name ||
    anime.originalTitle ||
    "Unknown Anime"
  );
}

function getNativeTitle(anime) {
  if (!anime) return "";

  if (typeof anime.title === "object") {
    return (
      anime.title?.native ||
      anime.nativeTitle ||
      ""
    );
  }

  return anime.nativeTitle || "";
}

function getPoster(anime) {
  return (
    anime?.coverImage?.extraLarge ||
    anime?.coverImage?.large ||
    anime?.coverImage?.medium ||
    anime?.poster ||
    anime?.poster_path ||
    FALLBACK_POSTER
  );
}

function getBackdrop(anime) {
  return (
    anime?.bannerImage ||
    anime?.backdrop ||
    anime?.backdrop_path ||
    anime?.backdrop_path_url ||
    FALLBACK_BACKDROP
  );
}

function getScore(anime) {
  if (!anime) return null;

  if (
    typeof anime.averageScore === "number"
  ) {
    return anime.averageScore / 10;
  }

  if (
    typeof anime.vote_average === "number"
  ) {
    return anime.vote_average;
  }

  if (
    typeof anime.rating === "number"
  ) {
    return anime.rating > 10
      ? anime.rating / 10
      : anime.rating;
  }

  return null;
}

function getYear(anime) {
  if (!anime) return null;

  if (
    anime.startDate &&
    typeof anime.startDate === "object" &&
    anime.startDate.year
  ) {
    return anime.startDate.year;
  }

  if (
    anime.firstAirDate &&
    typeof anime.firstAirDate === "string"
  ) {
    return anime.firstAirDate.slice(0, 4);
  }

  if (
    anime.releaseDate &&
    typeof anime.releaseDate === "string"
  ) {
    return anime.releaseDate.slice(0, 4);
  }

  if (
    typeof anime.seasonYear === "number"
  ) {
    return anime.seasonYear;
  }

  if (
    anime.year !== undefined &&
    anime.year !== null
  ) {
    return anime.year;
  }

  return null;
}

function getReleaseDate(anime) {
  if (!anime) return "";

  if (
    anime.startDate &&
    typeof anime.startDate === "object"
  ) {
    const year =
      Number(anime.startDate.year) || 0;

    const month =
      Number(anime.startDate.month) || 0;

    const day =
      Number(anime.startDate.day) || 0;

    if (year && month && day) {
      return `${String(day).padStart(
        2,
        "0"
      )}/${String(month).padStart(
        2,
        "0"
      )}/${year}`;
    }

    if (year && month) {
      return `${String(month).padStart(
        2,
        "0"
      )}/${year}`;
    }

    if (year) {
      return String(year);
    }
  }

  if (
    typeof anime.firstAirDate ===
      "string" &&
    anime.firstAirDate
  ) {
    return anime.firstAirDate;
  }

  if (
    typeof anime.releaseDate ===
      "string" &&
    anime.releaseDate
  ) {
    return anime.releaseDate;
  }

  if (
    typeof anime.release_date ===
      "string"
  ) {
    return anime.release_date;
  }

  return "";
}

function getReleaseTimestamp(anime) {
  if (!anime) return 0;

  if (
    anime.startDate &&
    typeof anime.startDate === "object"
  ) {
    const year =
      Number(anime.startDate.year) || 0;

    const month =
      Number(anime.startDate.month) || 1;

    const day =
      Number(anime.startDate.day) || 1;

    if (year) {
      return new Date(
        year,
        month - 1,
        day
      ).getTime();
    }
  }

  const dateValue =
    anime?.firstAirDate ||
    anime?.releaseDate ||
    anime?.release_date ||
    anime?.start_date ||
    "";

  if (dateValue) {
    const timestamp =
      new Date(
        dateValue
      ).getTime();

    if (
      Number.isFinite(timestamp)
    ) {
      return timestamp;
    }
  }

  if (
    anime?.seasonYear
  ) {
    return new Date(
      Number(anime.seasonYear),
      0,
      1
    ).getTime();
  }

  if (
    anime?.year
  ) {
    return new Date(
      Number(anime.year),
      0,
      1
    ).getTime();
  }

  return 0;
}

function getGenres(anime) {
  if (!anime) return [];

  if (Array.isArray(anime.genres)) {
    return anime.genres
      .map((genre) => {
        if (
          typeof genre === "string"
        ) {
          return genre;
        }

        return (
          genre?.name ||
          genre?.title ||
          ""
        );
      })
      .filter(Boolean);
  }

  return [];
}

function getFormat(anime) {
  return (
    anime?.format ||
    anime?.type ||
    ""
  );
}

function getEpisodeCount(anime) {
  if (!anime) return 0;

  return (
    Number(
      anime?.episodes
    ) ||
    Number(
      anime?.episodeCount
    ) ||
    Number(
      anime?.numberOfEpisodes
    ) ||
    0
  );
}

function getDuration(anime) {
  return (
    anime?.duration ||
    anime?.episodeDuration ||
    null
  );
}

function stripHtml(value) {
  if (!value) return "";

  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(
  text,
  length = 230
) {
  const clean = stripHtml(text);

  if (clean.length <= length) {
    return clean;
  }

  return `${clean
    .slice(0, length)
    .trim()}...`;
}

function getQuality(anime) {
  return (
    anime?.quality ||
    anime?.videoQuality ||
    anime?.qualityBadge ||
    ""
  );
}

function getStatus(anime) {
  return (
    anime?.status ||
    anime?.airingStatus ||
    ""
  );
}

function getEpisodeNumber(
  episode
) {
  return (
    Number(
      episode?.episodeNumber
    ) ||
    Number(
      episode?.episode_number
    ) ||
    Number(episode?.number) ||
    Number(episode?.episode) ||
    0
  );
}

function uniqueById(items) {
  const map = new Map();

  for (const item of items || []) {
    const id = getAnimeId(item);

    if (!id) continue;

    if (!map.has(String(id))) {
      map.set(
        String(id),
        item
      );
    }
  }

  return Array.from(
    map.values()
  );
}

function isMovie(anime) {
  const format = String(
    anime?.format ||
      anime?.type ||
      ""
  ).toUpperCase();

  return (
    format === "MOVIE" ||
    format === "FILM"
  );
}

function isSeries(anime) {
  return !isMovie(anime);
}

function getSeasons(anime) {
  if (!anime) return [];

  if (
    !Array.isArray(anime.seasons)
  ) {
    return [];
  }

  const seasons =
    anime.seasons
      .map((season) => {
        if (
          typeof season === "number"
        ) {
          return season;
        }

        if (
          season &&
          typeof season === "object"
        ) {
          return (
            season?.seasonNumber ??
            season?.season_number ??
            season?.season ??
            season?.number ??
            null
          );
        }

        return null;
      })
      .map(Number)
      .filter(
        (season) =>
          Number.isFinite(
            season
          ) &&
          season > 0
      );

  return [
    ...new Set(seasons),
  ].sort(
    (a, b) => a - b
  );
}

/*
  =========================================================
  TYPE HELPERS
  =========================================================
*/

function getAnimeType(anime) {
  if (!anime) return "";

  const format = String(
    anime?.format ||
      anime?.type ||
      ""
  ).toUpperCase();

  if (
    format === "MOVIE" ||
    format === "FILM"
  ) {
    return "movie";
  }

  return "series";
}

function filterByType(
  items,
  type
) {
  if (
    type !== "movie" &&
    type !== "series"
  ) {
    return items || [];
  }

  return (
    items || []
  ).filter(
    (item) =>
      getAnimeType(item) ===
      type
  );
}

function filterByGenre(
  items,
  genre
) {
  if (!genre) {
    return items || [];
  }

  const target =
    String(
      genre
    ).trim().toLowerCase();

  if (!target) {
    return items || [];
  }

  return (
    items || []
  ).filter(
    (item) =>
      getGenres(item).some(
        (itemGenre) =>
          String(
            itemGenre
          )
            .trim()
            .toLowerCase() ===
          target
      )
  );
}

function sortByReleaseDate(
  items
) {
  return [
    ...(items || []),
  ].sort(
    (a, b) =>
      getReleaseTimestamp(
        b
      ) -
      getReleaseTimestamp(
        a
      )
  );
}

async function fetchJSON(
  url,
  options = {}
) {
  const response = await fetch(
    url,
    options
  );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      `Invalid server response (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  if (
    data?.success === false
  ) {
    throw new Error(
      data?.message ||
        "Request failed"
    );
  }

  return data;
}

/* =========================================================
   LOGO
========================================================= */

function Logo() {
  return (
    <Link
      to="/"
      className="logo"
      aria-label="AnimeBox Home"
    >
      <span className="logo-mark">
        <Film
          size={19}
          strokeWidth={2.2}
        />
      </span>

      <span className="logo-text">
        Anime<span>Box</span>
      </span>
    </Link>
  );
}
/* =========================================================
   HEADER
========================================================= */

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    setSearch(params.get("search") || "");
  }, [location.pathname, location.search]);

  /* =========================================================
     LOAD CATEGORIES
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await fetch(
          `${API}/anime/categories`
        );

        const data = await response.json();

        if (cancelled) return;

        if (response.ok && data?.success) {
          const uniqueCategories = Array.isArray(
            data.categories
          )
            ? [
                ...new Map(
                  data.categories.map((category) => [
                    String(category).toLowerCase(),
                    category,
                  ])
                ).values(),
              ]
            : [];

          setCategories(uniqueCategories);
        } else {
          setCategories([]);
        }
      } catch (error) {
        console.error(
          "Category loading error:",
          error
        );

        if (!cancelled) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  /* =========================================================
     LIVE SEARCH
  ========================================================= */

  useEffect(() => {
    const query = search.trim();

    if (!searchOpen || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const response = await fetch(
          `${API}/anime/search?q=${encodeURIComponent(
            query
          )}&page=1&perPage=20`
        );

        const data = await response.json();

        if (cancelled) return;

        let results = Array.isArray(
          data?.results
        )
          ? data.results
          : [];

        /*
          AnimeBox only supports:
          MOVIE
          TV
          ONA
        */

        results = results.filter((item) => {
          const format = String(
            item?.format ||
              item?.type ||
              ""
          ).toUpperCase();

          return (
            format === "MOVIE" ||
            format === "TV" ||
            format === "ONA"
          );
        });

        results = uniqueById(results).slice(
          0,
          20
        );

        setSearchResults(results);
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Live search error:",
            error
          );

          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, searchOpen]);

  /* =========================================================
     ESC KEY
  ========================================================= */

  useEffect(() => {
    if (!searchOpen) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [searchOpen]);

  /* =========================================================
     SUBMIT
  ========================================================= */

  function handleSubmit(event) {
    event.preventDefault();

    const value = search.trim();

    if (!value) {
      return;
    }

    setSearchOpen(false);

    navigate(
      `/anime?search=${encodeURIComponent(
        value
      )}`
    );
  }

  /* =========================================================
     OPEN ANIME
  ========================================================= */

  function openSearchResult(anime) {
    const id = getAnimeId(anime);

    if (!id) return;

    setSearchOpen(false);

    navigate(`/anime/${id}`);
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">

          <Logo />

          <nav className="nav">

            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/anime"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Anime
            </NavLink>

            <NavLink
              to="/trending"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Trending
            </NavLink>

            <NavLink
              to="/genres"
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              Genres
            </NavLink>

            {categories.map((category) => (
              <NavLink
                key={category}
                to={`/category/${encodeURIComponent(
                  category
                )}`}
                className={({ isActive }) =>
                  isActive ? "active" : ""
                }
              >
                {category}
              </NavLink>
            ))}

          </nav>

          {/* SEARCH BOX */}

          <form
            className="search-box"
            onSubmit={handleSubmit}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
              }}
            >
              <Search
                size={17}
                style={{
                  position: "absolute",
                  left: "13px",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  color: "#737681",
                  pointerEvents: "none",
                }}
              />

              <input
                type="search"
                placeholder="Search"
                value={search}
                onFocus={() =>
                  setSearchOpen(true)
                }
                onChange={(event) => {
                  setSearch(
                    event.target.value
                  );
                  setSearchOpen(true);
                }}
                style={{
                  paddingLeft: "38px",
                }}
                aria-label="Search anime"
              />
            </div>
          </form>

        </div>
      </header>

      {/* =====================================================
          SEARCH OVERLAY
      ===================================================== */}

      {searchOpen && (
        <div
          className="search-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSearchOpen(false);
            }
          }}
        >

          <div
            className="search-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="search-modal-top">

              <h2>Search</h2>

              <div className="search-modal-actions">

                <div className="search-type">
                  Anime
                  <span>⌄</span>
                </div>

                <button
                  type="button"
                  className="search-close"
                  onClick={() =>
                    setSearchOpen(false)
                  }
                  aria-label="Close search"
                >
                  <X size={21} />
                </button>

              </div>

            </div>

            {/* SEARCH INPUT */}

            <form
              className="search-modal-input"
              onSubmit={handleSubmit}
            >
              <Search size={20} />

              <input
                autoFocus
                type="search"
                value={search}
                placeholder="Search anime..."
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

              {searchLoading && (
                <span className="search-spinner" />
              )}
            </form>

            {/* RESULTS */}

            {search.trim().length >= 2 && (
              <div className="search-results">

                {searchLoading &&
                searchResults.length === 0 ? (
                  <div className="search-message">
                    Searching...
                  </div>
                ) : searchResults.length ===
                  0 ? (
                  <div className="search-message">
                    No anime found
                  </div>
                ) : (
                  searchResults.map((anime) => {

                    const title =
                      getTitle(anime);

                    const poster =
                      getPoster(anime);

                    const score =
                      getScore(anime);

                    const year =
                      getYear(anime);

                    const format =
                      String(
                        anime?.format ||
                          anime?.type ||
                          ""
                      ).toUpperCase();

                    const type =
                      format === "MOVIE"
                        ? "MOVIE"
                        : "SERIES";

                    return (
                      <button
                        type="button"
                        className="search-result"
                        key={String(
                          getAnimeId(anime)
                        )}
                        onClick={() =>
                          openSearchResult(
                            anime
                          )
                        }
                      >

                        <img
                          src={poster}
                          alt={title}
                          onError={(event) => {
                            event.currentTarget.src =
                              FALLBACK_POSTER;
                          }}
                        />

                        <div className="search-result-info">

                          <div className="search-result-title">
                            {title}
                          </div>

                          <div className="search-result-meta">

                            {score !== null && (
                              <span className="search-rating">
                                <Star
                                  size={11}
                                  fill="currentColor"
                                />
                                {score.toFixed(
                                  1
                                )}
                              </span>
                            )}

                            {year && (
                              <span>
                                {year}
                              </span>
                            )}

                            <span className="search-result-type">
                              {type}
                            </span>

                          </div>

                        </div>

                      </button>
                    );
                  })
                )}

              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
/* =========================================================
   MOBILE NAV
========================================================= */

function BottomNav() {
  const location = useLocation();

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await fetch(
          `${API}/anime/categories`
        );

        const data = await response.json();

        if (cancelled) return;

        if (
          response.ok &&
          data?.success &&
          Array.isArray(data.categories)
        ) {
          const uniqueCategories = [
            ...new Map(
              data.categories.map((category) => [
                String(category).toLowerCase(),
                category,
              ])
            ).values(),
          ];

          setCategories(uniqueCategories);
        } else {
          setCategories([]);
        }
      } catch (error) {
        console.error(
          "Mobile category loading error:",
          error
        );

        if (!cancelled) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    location.search,
  ]);

  return (
    <nav className="bottom-nav">

      {/* HOME */}

      <NavLink
        to="/"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        <HomeIcon size={19} />
        <span>Home</span>
      </NavLink>


      {/* ANIME */}

      <NavLink
        to="/anime"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        <Film size={19} />
        <span>Anime</span>
      </NavLink>


      {/* TRENDING */}

      <NavLink
        to="/trending"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        <Star size={19} />
        <span>Trending</span>
      </NavLink>


      {/* GENRES */}

      <NavLink
        to="/genres"
        className={({ isActive }) =>
          isActive ? "active" : ""
        }
      >
        <Grid3X3 size={19} />
        <span>Genres</span>
      </NavLink>


      {/* =================================================
          ADMIN CATEGORIES
      ================================================= */}

      {categories.map((category) => (
        <NavLink
          key={category}
          to={`/category/${encodeURIComponent(
            category
          )}`}
          className={({ isActive }) =>
            isActive ? "active" : ""
          }
        >
          <span>{category}</span>
        </NavLink>
      ))}

    </nav>
  );
}

/* =========================================================
   FOOTER
========================================================= */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">

        <div className="footer-column footer-about">
          <h3>ABOUT ANIMEBOX</h3>

          <p>
            AnimeBox is an anime discovery and streaming platform designed
            to help users discover anime, seasons, episodes and related
            information in one place.
          </p>
        </div>

        <div className="footer-column">
          <h3>QUICK LINKS</h3>

          <Link to="/">Home</Link>
          <Link to="/anime">Anime</Link>
          <Link to="/trending">Trending</Link>
          <Link to="/genres">Genres</Link>
        </div>

        <div className="footer-column">
          <h3>NAVIGATE</h3>

          <Link to="/dmca">DMCA Policy</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/contact">Contact Us</Link>
        </div>

      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} AnimeBox. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* =========================================================
   LEGAL / INFORMATION PAGES
========================================================= */

function LegalPage({
  title,
  children,
}) {
  return (
    <PageWrapper>
      <section className="legal-page">
        <div className="legal-container">

          <h1>{title}</h1>

          <p className="legal-updated">
            Last updated: {new Date().getFullYear()}
          </p>

          {children}

        </div>
      </section>
    </PageWrapper>
  );
}


/* =========================================================
   DMCA
========================================================= */

function DMCAPage() {
  return (
    <LegalPage title="DMCA Policy">

      <h2>Copyright Notice</h2>

      <p>
        AnimeBox respects the intellectual property rights of
        copyright owners and expects users and third-party
        providers to do the same.
      </p>

      <p>
        AnimeBox does not claim ownership of copyrighted content
        that may be referenced through third-party sources.
      </p>

      <h2>Copyright Infringement Claims</h2>

      <p>
        If you believe that copyrighted material is being made
        available through a link or source associated with AnimeBox
        without proper authorization, you may contact us with the
        relevant information.
      </p>

      <p>
        Please provide enough information for us to identify the
        material and understand your copyright claim.
      </p>

      <h2>Third-Party Sources</h2>

      <p>
        AnimeBox may reference or link to third-party services.
        AnimeBox does not control the content, availability, or
        copyright status of material hosted by independent
        third-party services.
      </p>

      <h2>Contact</h2>

      <p>
        For copyright-related concerns, please contact us through
        the Contact page.
      </p>

    </LegalPage>
  );
}


/* =========================================================
   PRIVACY
========================================================= */

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">

      <h2>Overview</h2>

      <p>
        AnimeBox respects your privacy. This Privacy Policy
        explains the general types of information that may be
        processed when you use the website.
      </p>

      <h2>Information We Collect</h2>

      <p>
        AnimeBox is designed to provide anime-related information
        and streaming links without requiring users to create an
        account.
      </p>

      <p>
        Depending on the services used on the website, basic
        technical information such as browser type, device
        information, IP address, or request information may be
        processed by the website, hosting provider, analytics
        services, or third-party services.
      </p>

      <h2>Cookies</h2>

      <p>
        AnimeBox or third-party services may use cookies or similar
        technologies for functionality, analytics, security, or
        advertising purposes.
      </p>

      <h2>Third-Party Services</h2>

      <p>
        AnimeBox may use third-party services such as content
        databases, hosting providers, analytics services,
        advertising networks, or external media providers.
        These services may have their own privacy policies.
      </p>

      <h2>External Links</h2>

      <p>
        AnimeBox may contain links to external websites. We are not
        responsible for the privacy practices or content of
        external websites.
      </p>

      <h2>Changes to This Policy</h2>

      <p>
        This Privacy Policy may be updated from time to time.
        Updated versions will be published on this page.
      </p>

    </LegalPage>
  );
}


/* =========================================================
   TERMS
========================================================= */

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">

      <h2>Acceptance of Terms</h2>

      <p>
        By accessing AnimeBox, you agree to use the website in
        accordance with these Terms of Service and applicable laws.
      </p>

      <h2>Use of the Website</h2>

      <p>
        AnimeBox provides anime-related information, metadata,
        discovery features, and links to external or third-party
        services.
      </p>

      <p>
        You agree not to misuse the website, interfere with its
        operation, abuse its APIs, or use automated systems in a
        way that causes excessive load or disruption.
      </p>

      <h2>Third-Party Content</h2>

      <p>
        Some information, links, media, or services accessible
        through AnimeBox may be provided by third parties.
        AnimeBox does not necessarily host or control third-party
        content.
      </p>

      <h2>Availability</h2>

      <p>
        We may modify, suspend, or discontinue parts of the website
        at any time. We do not guarantee that every feature or
        external service will always be available.
      </p>

      <h2>External Websites</h2>

      <p>
        AnimeBox may link to external websites and services.
        Users should review the terms and policies of those
        services before using them.
      </p>

      <h2>Changes to These Terms</h2>

      <p>
        These Terms of Service may be updated from time to time.
        The latest version will be published on this page.
      </p>

    </LegalPage>
  );
}


/* =========================================================
   CONTACT
========================================================= */

function ContactPage() {
  return (
    <LegalPage title="Contact Us">

      <p>
        If you have a question, copyright concern, technical issue,
        or other website-related request, you can contact the
        AnimeBox team.
      </p>

      <div className="contact-box">

        <h2>Email</h2>

        <p>
          <a href="mailto:YOUR-EMAIL@example.com">
            YOUR-EMAIL@example.com
          </a>
        </p>

        <p className="contact-note">
          Replace this email address with your actual AnimeBox
          support email before launching the website.
        </p>

      </div>

      <h2>Copyright Requests</h2>

      <p>
        For copyright-related requests, please provide sufficient
        information to identify the relevant material and explain
        your request clearly.
      </p>

    </LegalPage>
  );
}
/* =========================================================
   PAGE WRAPPER
========================================================= */
function PageWrapper({
  children,
}) {
  const location = useLocation();

  const hideFooter =
    location.pathname.startsWith("/watch") ||
    location.pathname.startsWith("/admin");

  return (
    <>
      <Header />

      <main className="main">
        {children}
      </main>

      {!hideFooter && <Footer />}

      <BottomNav />
    </>
  );
}

/* =========================================================
   ANIME CARD
========================================================= */

function AnimeCard({
  anime,
}) {
  const navigate =
    useNavigate();

  const id =
    getAnimeId(anime);

  const title =
    getTitle(anime);

  const poster =
    getPoster(anime);

  const score =
    getScore(anime);

  const year =
    getYear(anime);

  const episodes =
    getEpisodeCount(anime);

  const quality =
    getQuality(anime);

  const genres =
    getGenres(anime).slice(
      0,
      2
    );

  function openAnime() {
    if (!id) return;

    navigate(
      `/anime/${id}`
    );
  }

  function handleKeyDown(
    event
  ) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openAnime();
    }
  }

  return (
    <article
      className="anime-card"
      onClick={openAnime}
      onKeyDown={
        handleKeyDown
      }
      tabIndex={0}
      role="button"
      aria-label={`Open ${title}`}
    >
      <div className="poster">
        <img
          src={poster}
          alt={title}
          loading="lazy"
          onError={(
            event
          ) => {
            event.currentTarget.src =
              FALLBACK_POSTER;
          }}
        />

        {quality && (
          <span className="quality-badge">
            {quality}
          </span>
        )}

        {score !== null && (
          <span className="rating-badge">
            <Star
              size={10}
              fill="currentColor"
              style={{
                verticalAlign:
                  "-1px",
                marginRight:
                  "3px",
              }}
            />
            {score.toFixed(
              1
            )}
          </span>
        )}
      </div>

      <div className="card-info">
        <div
          className="card-title"
          title={title}
        >
          {title}
        </div>

        <div className="card-meta">
          {year && (
            <span>
              {year}
            </span>
          )}

          {year &&
            (episodes ||
              getFormat(
                anime
              )) && (
              <span className="dot" />
            )}

          {episodes ? (
            <span>
              {episodes}{" "}
              {episodes === 1
                ? "Ep"
                : "Eps"}
            </span>
          ) : getFormat(
              anime
            ) ? (
            <span>
              {getFormat(
                anime
              )}
            </span>
          ) : null}
        </div>

        {genres.length >
          0 && (
          <div className="tags">
            {genres.map(
              (genre) => (
                <span
                  className="tag"
                  key={genre}
                >
                  {genre}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* =========================================================
   ANIME SECTION
========================================================= */

function AnimeSection({
  title,
  anime = [],
  link = "",
  showAll = false,
}) {
  const items =
    uniqueById(anime);

  if (!items.length) {
    return null;
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          {title}
        </h2>

        {showAll &&
          link && (
            <Link
              to={link}
              className="section-link"
            >
              View All →
            </Link>
          )}
      </div>

      <div className="anime-grid">
        {items.map(
          (
            animeItem
          ) => (
            <AnimeCard
              key={String(
                getAnimeId(
                  animeItem
                )
              )}
              anime={
                animeItem
              }
            />
          )
        )}
      </div>
    </section>
  );
}

/* =========================================================
   HERO
========================================================= */

function Hero({
  anime,
}) {
  const navigate =
    useNavigate();

  if (!anime) return null;

  const id =
    getAnimeId(anime);

  const title =
    getTitle(anime);

  const score =
    getScore(anime);

  const year =
    getYear(anime);

  const episodes =
    getEpisodeCount(anime);

  const genres =
    getGenres(anime).slice(
      0,
      3
    );

  const backdrop =
    getBackdrop(anime);

  const background = `
    linear-gradient(
      90deg,
      rgba(7, 8, 12, 0.96) 0%,
      rgba(7, 8, 12, 0.82) 35%,
      rgba(7, 8, 12, 0.28) 78%,
      rgba(7, 8, 12, 0.18) 100%
    ),
    url("${backdrop}")
  `;

  return (
    <section
      className="hero"
      style={{
        backgroundImage:
          background,
        backgroundPosition:
          "center",
        backgroundSize:
          "cover",
      }}
    >
      <div className="hero-content">
        <div className="tags">
          <span className="tag">
            NOW TRENDING
          </span>

          {genres.map(
            (genre) => (
              <span
                className="tag"
                key={genre}
              >
                {genre}
              </span>
            )
          )}
        </div>

        <h1 className="hero-title">
          {title}
        </h1>

        <div
          className="card-meta"
          style={{
            marginBottom:
              "13px",
            color:
              "#c8cbd2",
            fontSize:
              "12px",
          }}
        >
          {score !== null && (
            <span>
              <Star
                size={12}
                fill="currentColor"
                style={{
                  verticalAlign:
                    "-2px",
                  marginRight:
                    "3px",
                  color:
                    "#ffd84a",
                }}
              />
              {score.toFixed(
                1
              )}
            </span>
          )}

          {score !== null &&
            year && (
              <span className="dot" />
            )}

          {year && (
            <span>
              {year}
            </span>
          )}

          {year &&
            episodes >
              0 && (
              <span className="dot" />
            )}

          {episodes > 0 && (
            <span>
              {episodes}{" "}
              Episodes
            </span>
          )}
        </div>

        <p className="hero-description">
          {truncate(
            anime.description ||
              anime.overview ||
              "Discover this anime on AnimeBox.",
            250
          )}
        </p>

        {id && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              navigate(
                `/anime/${id}`
              )
            }
          >
            <Play
              size={14}
              fill="currentColor"
              style={{
                verticalAlign:
                  "-2px",
                marginRight:
                  "7px",
              }}
            />
            Explore Anime
          </button>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   HOME GENRES
========================================================= */

const HOME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
];

/* =========================================================
   HOME
========================================================= */

function Home() {
  const [latest, setLatest] =
    useState([]);

  const [trending, setTrending] =
    useState([]);

  const [popular, setPopular] =
    useState([]);

  const [genres, setGenres] =
    useState(HOME_GENRES);

  const [heroAnime, setHeroAnime] =
    useState(null);

  const [heroIndex, setHeroIndex] =
    useState(0);

  const [page, setPage] =
    useState(1);

  const [
    loadingLatest,
    setLoadingLatest,
  ] = useState(true);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    latestError,
    setLatestError,
  ] = useState("");

  const [hasMore, setHasMore] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      setLoadingLatest(true);
      setLatestError("");

      try {
        const [
          latestResponse,
          trendingResponse,
          popularResponse,
        ] = await Promise.all([
          fetchJSON(
            `${API}/anime?page=1&perPage=50&sort=START_DATE_DESC`
          ),
          fetchJSON(
            `${API}/anime/trending`
          ),
          fetchJSON(
            `${API}/anime/popular`
          ),
        ]);

        if (cancelled) return;

        const latestResults =
          sortByReleaseDate(
            uniqueById(
              latestResponse?.results ||
                []
            )
          );

        const trendingResults =
          uniqueById(
            trendingResponse?.results ||
              []
          );

        const popularResults =
          uniqueById(
            popularResponse?.results ||
              []
          );

        setLatest(
          latestResults
        );

        setTrending(
          trendingResults
        );

        setPopular(
          popularResults
        );

        setGenres(
          HOME_GENRES
        );

        const heroItems =
          trendingResults.length >
          0
            ? trendingResults
            : latestResults;

        setHeroAnime(
          heroItems[0] ||
            null
        );

        setHeroIndex(0);

       setPage(1);

setHasMore(
  Boolean(
    latestResponse?.hasNextPage
  )
);
      } catch (error) {
        if (!cancelled) {
          setLatestError(
            error.message ||
              "Failed to load anime."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLatest(
            false
          );
        }
      }
    }

    loadHome();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trending.length) {
      return;
    }

    const timer =
      setInterval(() => {
        setHeroIndex(
          (current) => {
            const next =
              (current + 1) %
              trending.length;

            setHeroAnime(
              trending[next]
            );

            return next;
          }
        );
      }, 6500);

    return () =>
      clearInterval(
        timer
      );
  }, [trending]);

  async function loadMore() {
    if (
      loadingMore ||
      !hasMore
    ) {
      return;
    }

    const nextPage =
      page + 1;

    setLoadingMore(true);

    try {
      const response =
        await fetchJSON(
          `${API}/anime?page=${nextPage}&perPage=50&sort=START_DATE_DESC`
        );

      const newResults =
        sortByReleaseDate(
          uniqueById(
            response?.results ||
              []
          )
        );

      setLatest(
        (current) =>
          sortByReleaseDate(
            uniqueById([
              ...current,
              ...newResults,
            ])
          )
      );

      setPage(
        nextPage
      );

      setHasMore(
  Boolean(
    response?.hasNextPage
  )
);
    } catch (error) {
      console.error(
        "Load more error:",
        error
      );
    } finally {
      setLoadingMore(
        false
      );
    }
  }

  function changeHero(
    direction
  ) {
    if (!trending.length) {
      return;
    }

    setHeroIndex(
      (current) => {
        let next =
          current +
          direction;

        if (next < 0) {
          next =
            trending.length -
            1;
        }

        if (
          next >=
          trending.length
        ) {
          next = 0;
        }

        setHeroAnime(
          trending[next]
        );

        return next;
      }
    );
  }

  return (
    <>
      {heroAnime && (
        <div
          style={{
            position:
              "relative",
          }}
        >
          <Hero
            anime={
              heroAnime
            }
          />

          {trending.length >
            1 && (
            <div
              style={{
                position:
                  "absolute",
                right: "28px",
                bottom: "25px",
                zIndex: 5,
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "7px",
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() =>
                  changeHero(
                    -1
                  )
                }
                aria-label="Previous hero"
                style={{
                  minHeight:
                    "35px",
                  minWidth:
                    "35px",
                  padding:
                    "0",
                }}
              >
                <ChevronLeft
                  size={16}
                />
              </button>

              <button
                type="button"
                className="btn"
                onClick={() =>
                  changeHero(
                    1
                  )
                }
                aria-label="Next hero"
                style={{
                  minHeight:
                    "35px",
                  minWidth:
                    "35px",
                  padding:
                    "0",
                }}
              >
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          )}
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Latest Anime
          </h2>

          <Link
            to="/anime"
            className="section-link"
          >
            View All →
          </Link>
        </div>

        {loadingLatest &&
        latest.length ===
          0 ? (
          <div className="loading">
            Loading latest anime...
          </div>
        ) : latestError &&
          latest.length ===
            0 ? (
          <div className="error">
            {latestError}
          </div>
        ) : latest.length ===
          0 ? (
          <div className="empty-state">
            No anime found.
          </div>
        ) : (
          <div className="anime-grid">
            {latest.map(
              (anime) => (
                <AnimeCard
                  key={String(
                    getAnimeId(
                      anime
                    )
                  )}
                  anime={anime}
                />
              )
            )}
          </div>
        )}

        {latest.length >
          0 && (
          <>
            {hasMore ? (
              <div className="load-more-wrapper">
                <button
                  type="button"
                  className="load-more"
                  onClick={
                    loadMore
                  }
                  disabled={
                    loadingMore
                  }
                >
                  {loadingMore
                    ? "Loading..."
                    : "Load More"}
                </button>
              </div>
            ) : (
              <div className="no-more">
                No more anime available.
              </div>
            )}
          </>
        )}
      </section>

      <AnimeSection
        title="Trending Anime"
        anime={
          trending
        }
        link="/trending"
        showAll
      />

      <AnimeSection
        title="Popular Anime"
        anime={
          popular
        }
        link="/anime"
        showAll
      />

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Browse Genres
          </h2>

          <Link
            to="/genres"
            className="section-link"
          >
            View All →
          </Link>
        </div>

        <div className="genre-list">
          {genres
            .slice(0, 18)
            .map((genre) => {
              const genreName =
                typeof genre ===
                "string"
                  ? genre
                  : genre?.name || "";

              const genreId =
                typeof genre ===
                "object"
                  ? genre?.id ||
                    genreName
                  : genreName;

              if (!genreName) {
                return null;
              }

              return (
                <Link
                  key={String(
                    genreId
                  )}
                  to={`/anime?genre=${encodeURIComponent(
                    genreId
                  )}`}
                  className="tag"
                >
                  {genreName}
                </Link>
              );
            })}
        </div>
      </section>
    </>
  );
}

/* =========================================================
   ANIME PAGE
========================================================= */

function AnimePage() {
  const [
    searchParams,
  ] = useSearchParams();

  const search = (
    searchParams.get(
      "search"
    ) || ""
  ).trim();

  const genre = (
    searchParams.get(
      "genre"
    ) || ""
  ).trim();

  const type = (
    searchParams.get(
      "type"
    ) || ""
  ).trim().toLowerCase();

  const [anime, setAnime] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnime() {
      setLoading(true);
      setError("");

      try {
        let response;

        if (search) {
          response =
            await fetchJSON(
              `${API}/anime/search?q=${encodeURIComponent(
                search
              )}&page=1&perPage=50`
            );
        } else {
          const genreQuery =
            genre
              ? `&genre=${encodeURIComponent(
                  genre
                )}`
              : "";

          /*
            Backend may ignore type.
            We therefore filter it
            safely on frontend too.
          */

          response =
            await fetchJSON(
              `${API}/anime?page=1&perPage=50&sort=START_DATE_DESC${genreQuery}`
            );
        }

        if (cancelled) {
          return;
        }

        let results =
          uniqueById(
            response?.results ||
              []
          );

        /*
          Genre filtering fallback.
        */

        if (genre) {
          results =
            filterByGenre(
              results,
              genre
            );
        }

        /*
          Movie / Series filtering.
        */

        if (
          type === "movie" ||
          type === "series"
        ) {
          results =
            filterByType(
              results,
              type
            );
        }

        /*
          Latest/release order.
        */

        results =
          sortByReleaseDate(
            results
          );

        setAnime(
          results
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "Failed to load anime."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnime();

    return () => {
      cancelled = true;
    };
  }, [
    search,
    genre,
    type,
  ]);

  let pageTitle =
    "Anime";

  if (search) {
    pageTitle = `Search: ${search}`;
  } else if (
    type === "movie"
  ) {
    pageTitle =
      "Anime Movies";
  } else if (
    type === "series"
  ) {
    pageTitle =
      "Anime Series";
  } else if (genre) {
    pageTitle =
      genre;
  }

  return (
    <section
      className="section"
      style={{
        marginTop: 0,
      }}
    >
      <div className="section-header">
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "22px",
          }}
        >
          <Link
            to="/anime?type=movie"
            className="btn"
          >
            🎬 Anime Movies
          </Link>

          <Link
            to="/anime?type=series"
            className="btn"
          >
            📺 Anime Series
          </Link>
        </div>

        <h1 className="section-title">
          {pageTitle}
        </h1>
      </div>

      {loading ? (
        <div className="loading">
          Loading anime...
        </div>
      ) : error ? (
        <div className="error">
          {error}
        </div>
      ) : anime.length ===
        0 ? (
        <div className="empty-state">
          No anime found.
        </div>
      ) : (
        <div className="anime-grid">
          {anime.map(
            (item) => (
              <AnimeCard
                key={String(
                  getAnimeId(
                    item
                  )
                )}
                anime={item}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   TRENDING
========================================================= */

function TrendingPage() {
  const [anime, setAnime] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTrending() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetchJSON(
            `${API}/anime/trending`
          );

        if (cancelled) return;

        setAnime(
          uniqueById(
            response?.results ||
              []
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "Failed to load trending anime."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTrending();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="section"
      style={{
        marginTop: 0,
      }}
    >
      <div className="section-header">
        <h1 className="section-title">
          Trending Anime
        </h1>
      </div>

      {loading ? (
        <div className="loading">
          Loading trending anime...
        </div>
      ) : error ? (
        <div className="error">
          {error}
        </div>
      ) : anime.length ===
        0 ? (
        <div className="empty-state">
          No trending anime found.
        </div>
      ) : (
        <div className="anime-grid">
          {anime.map(
            (item) => (
              <AnimeCard
                key={String(
                  getAnimeId(
                    item
                  )
                )}
                anime={item}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   GENRES
========================================================= */

function GenresPage() {
  const navigate =
    useNavigate();

  /*
    Backend currently does not
    expose /anime/genres.
    Use the same known AniList
    genre list locally.
  */

  const genres =
    HOME_GENRES;

  return (
    <section
      className="section"
      style={{
        marginTop: 0,
      }}
    >
      <div className="section-header">
        <h1 className="section-title">
          Anime Genres
        </h1>
      </div>

      {genres.length ===
      0 ? (
        <div className="empty-state">
          No genres found.
        </div>
      ) : (
        <div className="genre-list">
          {genres.map(
            (genre) => {
              const name =
                typeof genre ===
                "string"
                  ? genre
                  : genre?.name ||
                    "";

              const id =
                typeof genre ===
                "object"
                  ? genre?.id ||
                    name
                  : name;

              if (!name)
                return null;

              return (
                <button
                  type="button"
                  className="tag"
                  key={String(
                    id
                  )}
                  onClick={() =>
                    navigate(
                      `/anime?genre=${encodeURIComponent(
                        id
                      )}`
                    )
                  }
                >
                  {name}
                </button>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   DETAIL PAGE
========================================================= */

function AnimeDetail() {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const [anime, setAnime] =
    useState(null);

  const [
    seasonData,
    setSeasonData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    episodesLoading,
    setEpisodesLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    selectedSeason,
    setSelectedSeason,
  ] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnime() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetchJSON(
            `${API}/anime/${encodeURIComponent(
              id
            )}`
          );

        if (cancelled) return;

        const animeData =
          response?.anime ||
          response?.result ||
          response?.data ||
          response;

        if (
          !animeData ||
          typeof animeData !==
            "object"
        ) {
          throw new Error(
            "Invalid anime details response."
          );
        }

        setAnime(
          animeData
        );

        let availableSeasons =
          getSeasons(
            animeData
          );

        if (
          isMovie(
            animeData
          )
        ) {
          availableSeasons = [
            1,
          ];
        }

        if (
          availableSeasons.length ===
          0
        ) {
          availableSeasons = [
            1,
          ];
        }

        setSelectedSeason(
          availableSeasons[0]
        );
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Anime detail error:",
            err
          );

          setError(
            err.message ||
              "Failed to load anime details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id) {
      loadAnime();
    } else {
      setLoading(false);
      setError(
        "Invalid anime ID."
      );
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (
      !id ||
      selectedSeason === null
    ) {
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(
        true
      );

      setSeasonData(
        null
      );

      try {
        const response =
          await fetchJSON(
            `${API}/anime/${encodeURIComponent(
              id
            )}/season/${encodeURIComponent(
              selectedSeason
            )}`
          );

        if (cancelled) return;

        const episodes =
          Array.isArray(
            response?.episodes
          )
            ? response.episodes
            : Array.isArray(
                response?.season
                  ?.episodes
              )
            ? response.season
                .episodes
            : Array.isArray(
                response?.result
                  ?.episodes
              )
            ? response.result
                .episodes
            : [];

        setSeasonData({
          ...response,
          episodes,
        });
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Episode loading error:",
            err
          );

          setSeasonData({
            episodes: [],
            error:
              err.message ||
              "Failed to load episodes.",
          });
        }
      } finally {
        if (!cancelled) {
          setEpisodesLoading(
            false
          );
        }
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    selectedSeason,
  ]);

  let seasons =
    getSeasons(anime);

  if (
    isMovie(anime)
  ) {
    seasons = [1];
  }

  if (!seasons.length) {
    seasons = [1];
  }

  const animeId =
    getAnimeId(anime);

  const title =
    getTitle(anime);

  const nativeTitle =
    getNativeTitle(anime);

  const score =
    getScore(anime);

  const year =
    getYear(anime);

  const releaseDate =
    getReleaseDate(anime);

  const poster =
    getPoster(anime);

  const backdrop =
    getBackdrop(anime);

  const description =
    stripHtml(
      anime?.description ||
        anime?.overview ||
        ""
    ) ||
    "No description available.";

  const genres =
    getGenres(anime);

  const status =
    getStatus(anime);

  const format =
    getFormat(anime);

  const episodesCount =
    getEpisodeCount(anime);

  const duration =
    getDuration(anime);

  const episodes =
    Array.isArray(
      seasonData?.episodes
    )
      ? seasonData.episodes
      : [];

  const heroBackground = `
    linear-gradient(
      90deg,
      rgba(7, 8, 12, 0.98) 0%,
      rgba(7, 8, 12, 0.88) 35%,
      rgba(7, 8, 12, 0.45) 75%,
      rgba(7, 8, 12, 0.25) 100%
    ),
    linear-gradient(
      0deg,
      rgba(7, 8, 12, 0.95),
      transparent 65%
    ),
    url("${backdrop}")
  `;

  if (loading) {
    return (
      <section
        className="section"
        style={{
          marginTop: 0,
        }}
      >
        <div className="loading">
          Loading anime details...
        </div>
      </section>
    );
  }

  if (
    error ||
    !anime
  ) {
    return (
      <section
        className="section"
        style={{
          marginTop: 0,
        }}
      >
        <div className="error">
          {error ||
            "Anime not found."}
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className="detail-hero"
        style={{
          backgroundImage:
            heroBackground,
          backgroundSize:
            "cover",
          backgroundPosition:
            "center",
        }}
      >
        <div className="hero-content">
          <button
            type="button"
            className="btn"
            onClick={() =>
              navigate(-1)
            }
            style={{
              marginBottom:
                "14px",
            }}
          >
            <ChevronLeft
              size={15}
              style={{
                verticalAlign:
                  "-3px",
                marginRight:
                  "5px",
              }}
            />
            Back
          </button>

          {genres.length >
            0 && (
            <div className="tags">
              {genres
                .slice(
                  0,
                  5
                )
                .map(
                  (genre) => (
                    <span
                      className="tag"
                      key={String(
                        genre
                      )}
                    >
                      {genre}
                    </span>
                  )
                )}
            </div>
          )}

          <h1 className="hero-title">
            {title}
          </h1>

          {nativeTitle &&
            nativeTitle !==
              title && (
              <div
                style={{
                  color:
                    "#9699a3",
                  fontSize:
                    "13px",
                  marginBottom:
                    "12px",
                }}
              >
                {nativeTitle}
              </div>
            )}

          <div
            className="card-meta"
            style={{
              marginBottom:
                "14px",
              fontSize:
                "12px",
              color:
                "#c6c9d1",
            }}
          >
            {score !== null && (
              <span>
                <Star
                  size={12}
                  fill="currentColor"
                  style={{
                    verticalAlign:
                      "-2px",
                    marginRight:
                      "4px",
                    color:
                      "#ffd84a",
                  }}
                />
                {score.toFixed(
                  1
                )}
              </span>
            )}

            {score !== null &&
              year && (
              <span className="dot" />
            )}

            {year && (
              <span>
                {year}
              </span>
            )}

            {format && (
              <>
                <span className="dot" />
                <span>
                  {format}
                </span>
              </>
            )}

            {status && (
              <>
                <span className="dot" />
                <span>
                  {status}
                </span>
              </>
            )}

            {episodesCount >
              0 && (
              <>
                <span className="dot" />
                <span>
                  {
                    episodesCount
                  }{" "}
                  Episodes
                </span>
              </>
            )}
          </div>

          <p className="hero-description">
            {description}
          </p>
        </div>
      </section>

      <section
        className="section"
        style={{
          marginTop:
            "30px",
        }}
      >
        <div
          className="detail-info"
          style={{
            display:
              "flex",
            alignItems:
              "flex-start",
            gap: "25px",
            flexWrap:
              "wrap",
          }}
        >
          <div className="detail-poster">
            <img
              src={poster}
              alt={title}
              onError={(
                event
              ) => {
                event.currentTarget.src =
                  FALLBACK_POSTER;
              }}
            />
          </div>

          <div
            style={{
              flex:
                "1 1 500px",
              minWidth: 0,
            }}
          >
            <div className="section-header">
              <h2 className="section-title">
                Anime Information
              </h2>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(145px, 1fr))",
                gap: "18px",
              }}
            >
              {releaseDate && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Release
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      releaseDate
                    }
                  </span>
                </div>
              )}

              {status && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Status
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      status
                    }
                  </span>
                </div>
              )}

              {episodesCount >
                0 && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Episodes
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      episodesCount
                    }
                  </span>
                </div>
              )}

              {duration && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Duration
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      duration
                    }{" "}
                    min
                  </span>
                </div>
              )}

              {anime.countryOfOrigin && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Country
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {
                      anime.countryOfOrigin
                    }
                  </span>
                </div>
              )}

              {anime.originCountry && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Country
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                    }}
                  >
                    {Array.isArray(
                      anime.originCountry
                    )
                      ? anime.originCountry.join(
                          ", "
                        )
                      : anime.originCountry}
                  </span>
                </div>
              )}

              {anime.source && (
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#fff",
                      marginBottom:
                        "5px",
                    }}
                  >
                    Source
                  </strong>

                  <span
                    style={{
                      color:
                        "#a7abb5",
                      fontSize:
                        "12px",
                      textTransform:
                        "capitalize",
                    }}
                  >
                    {
                      anime.source
                    }
                  </span>
                </div>
              )}

              {isSeries(
                anime
              ) &&
                anime.tmdbId && (
                  <div>
                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#fff",
                        marginBottom:
                          "5px",
                      }}
                    >
                      TMDB ID
                    </strong>

                    <span
                      style={{
                        color:
                          "#a7abb5",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        anime.tmdbId
                      }
                    </span>
                  </div>
                )}

              {isSeries(
                anime
              ) &&
                anime.imdbId && (
                  <div>
                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#fff",
                        marginBottom:
                          "5px",
                      }}
                    >
                      IMDb ID
                    </strong>

                    <span
                      style={{
                        color:
                          "#a7abb5",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        anime.imdbId
                      }
                    </span>
                  </div>
                )}
            </div>

            {genres.length >
              0 && (
              <div
                className="tags"
                style={{
                  marginTop:
                    "18px",
                }}
              >
                {genres.map(
                  (genre) => (
                    <span
                      className="tag"
                      key={String(
                        genre
                      )}
                    >
                      {genre}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {seasons.length >
        0 && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              Seasons
            </h2>
          </div>

          <div className="genre-list">
            {seasons.map(
              (season) => {
                const active =
                  Number(
                    selectedSeason
                  ) ===
                  Number(
                    season
                  );

                return (
                  <button
                    type="button"
                    key={String(
                      season
                    )}
                    className="tag"
                    onClick={() =>
                      setSelectedSeason(
                        Number(
                          season
                        )
                      )
                    }
                    style={{
                      cursor:
                        "pointer",
                      borderColor:
                        active
                          ? "rgba(255, 23, 68, 0.7)"
                          : undefined,
                      background:
                        active
                          ? "rgba(255, 23, 68, 0.15)"
                          : undefined,
                      color:
                        active
                          ? "#fff"
                          : undefined,
                    }}
                  >
                    Season{" "}
                    {season}
                  </button>
                );
              }
            )}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Season{" "}
            {selectedSeason ||
              1}{" "}
            Episodes
          </h2>

          {episodesCount >
            0 && (
            <span className="section-link">
              {
                episodesCount
              }{" "}
              Episodes
            </span>
          )}
        </div>

        {episodesLoading ? (
          <div className="loading">
            Loading episodes...
          </div>
        ) : episodes.length ===
          0 ? (
          <div className="empty-state">
            No episodes available.
          </div>
        ) : (
          <div className="episode-grid">
            {episodes.map(
              (
                episode,
                index
              ) => {
                const episodeNumber =
                  getEpisodeNumber(
                    episode
                  ) ||
                  index + 1;

                const episodeTitle =
                  typeof episode?.title ===
                  "string"
                    ? episode.title
                    : episode?.name ||
                      "";

                return (
                  <button
                    type="button"
                    className="episode-card"
                    key={String(
                      episodeNumber
                    )}
                    onClick={() => {
                      if (
                        !animeId
                      ) {
                        return;
                      }

                      navigate(
                        `/watch/${animeId}/${selectedSeason || 1}/${episodeNumber}`
                      );
                    }}
                  >
                    <strong>
                      Episode{" "}
                      {
                        episodeNumber
                      }
                    </strong>

                    {episodeTitle && (
                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#858995",
                          fontSize:
                            "11px",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          episodeTitle
                        }
                      </div>
                    )}
                  </button>
                );
              }
            )}
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================================
   WATCH PAGE
========================================================= */

function WatchPage() {
  const {
    id,
    season,
    episode,
  } = useParams();

  const navigate =
    useNavigate();

  const anilistId =
    Number(id);

  const seasonNumber =
    Number(season) || 1;

  const episodeNumber =
    Number(episode) || 1;

  const [anime, setAnime] =
    useState(null);

  const [
    seasonData,
    setSeasonData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWatchData() {
      setLoading(true);
      setError("");

      try {
        const [
          animeResponse,
          seasonResponse,
        ] =
          await Promise.all([
            fetchJSON(
              `${API}/anime/${encodeURIComponent(
                anilistId
              )}`
            ),

            fetchJSON(
              `${API}/anime/${encodeURIComponent(
                anilistId
              )}/season/${encodeURIComponent(
                seasonNumber
              )}`
            ),
          ]);

        if (cancelled) return;

        const animeData =
          animeResponse?.anime ||
          animeResponse?.result ||
          animeResponse?.data ||
          animeResponse;

        if (
          !animeData ||
          typeof animeData !==
            "object"
        ) {
          throw new Error(
            "Invalid anime details response."
          );
        }

        setAnime(
          animeData
        );

        const episodes =
          Array.isArray(
            seasonResponse?.episodes
          )
            ? seasonResponse.episodes
            : Array.isArray(
                seasonResponse
                  ?.season
                  ?.episodes
              )
            ? seasonResponse
                .season.episodes
            : Array.isArray(
                seasonResponse
                  ?.result
                  ?.episodes
              )
            ? seasonResponse
                .result.episodes
            : [];

        setSeasonData({
          ...seasonResponse,
          episodes,
        });
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Watch page error:",
            err
          );

          setError(
            err.message ||
              "Failed to load watch page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (anilistId) {
      loadWatchData();
    } else {
      setLoading(false);
      setError(
        "Invalid AniList ID."
      );
    }

    return () => {
      cancelled = true;
    };
  }, [
    anilistId,
    seasonNumber,
  ]);

  if (loading) {
    return (
      <div className="watch-page">
        <div className="loading">
          Loading player...
        </div>
      </div>
    );
  }

  if (
    error ||
    !anime
  ) {
    return (
      <div className="watch-page">
        <div className="error">
          {error ||
            "Anime not found."}
        </div>
      </div>
    );
  }

  const title =
    getTitle(anime);

  const episodes =
    seasonData?.episodes ||
    [];

  /* ========================================================
     PROVIDER LOGIC
  ========================================================

     MOVIE
       Details      -> AniList
       Player       -> AniList
       Download     -> AniList

     SERIES
       Details      -> TMDB
       Seasons      -> TMDB
       Episodes     -> TMDB
       Player       -> TMDB TV
       Server 1     -> TMDB
       Server 2     -> NHD API
  ======================================================== */

  const movie =
    isMovie(anime);

  const tmdbId =
    anime?.tmdbId ||
    anime?.tmdb_id ||
    anime?.externalIds
      ?.tmdbId ||
    anime?.externalIds
      ?.tmdb_id ||
    null;

  const imdbId =
    anime?.imdbId ||
    anime?.imdb_id ||
    anime?.externalIds
      ?.imdbId ||
    anime?.externalIds
      ?.imdb_id ||
    null;

  let playerUrl = "";

  /*
    MOVIE PLAYER
  */

  if (movie) {
    playerUrl =
      `https://embed.filmu.in/anime/` +
      `${anilistId}/${seasonNumber}/${episodeNumber}`;
  }

  /*
    SERIES PLAYER
  */

  if (
    !movie &&
    tmdbId
  ) {
    playerUrl =
      `https://embed.filmu.in/tv/` +
      `${tmdbId}/${seasonNumber}/${episodeNumber}`;
  }

  /*
    MOVIE DOWNLOAD
  */

  const movieDownloadUrl =
    `https://streamrip.fun/anime/` +
    `${anilistId}/${episodeNumber}`;

  /*
    SERIES DOWNLOAD SERVER 1
  */

  const seriesDownloadUrl1 =
    tmdbId
      ? `https://streamrip.fun/tv/${tmdbId}/${seasonNumber}/${episodeNumber}`
      : "";

  /*
    SERIES DOWNLOAD SERVER 2
  */

  const seriesDownloadId =
    imdbId ||
    tmdbId ||
    null;

  const seriesDownloadUrl2 =
    seriesDownloadId
      ? `https://nhdapi.com/dl/tv/${seriesDownloadId}/${seasonNumber}/${episodeNumber}`
      : "";

  /* ========================================================
     PREVIOUS / NEXT EPISODE
  ======================================================== */

  const currentIndex =
    episodes.findIndex(
      (item) =>
        Number(
          getEpisodeNumber(
            item
          )
        ) ===
        Number(
          episodeNumber
        )
    );

  const previousEpisode =
    currentIndex > 0
      ? getEpisodeNumber(
          episodes[
            currentIndex -
              1
          ]
        )
      : episodeNumber > 1
      ? episodeNumber - 1
      : null;

  const nextEpisode =
    currentIndex >= 0 &&
    currentIndex <
      episodes.length - 1
      ? getEpisodeNumber(
          episodes[
            currentIndex +
              1
          ]
        )
      : episodes.length ===
        0
      ? episodeNumber + 1
      : null;

  function goToEpisode(
    number
  ) {
    if (!number) {
      return;
    }

    navigate(
      `/watch/${anilistId}/${seasonNumber}/${number}`
    );
  }

  return (
    <div className="watch-page">
      {/* =================================================
          PLAYER
      ================================================= */}

      <section
        className="section"
        style={{
          marginTop: 0,
        }}
      >
        <div className="section-header">
          <h1 className="section-title">
            {title}
          </h1>

          <Link
            to={`/anime/${anilistId}`}
            className="section-link"
          >
            Anime Details →
          </Link>
        </div>

        {movie ? (
          <div
            className="tag"
            style={{
              display:
                "inline-flex",
              marginBottom:
                "12px",
            }}
          >
            Movie • AniList
          </div>
        ) : (
          <div
            className="tag"
            style={{
              display:
                "inline-flex",
              marginBottom:
                "12px",
            }}
          >
            Series • TMDB
          </div>
        )}

        {playerUrl ? (
          <div className="player-wrapper">
            <iframe
              src={playerUrl}
              title={`${title} Episode ${episodeNumber}`}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
            />
          </div>
        ) : (
          <div className="error">
            TMDB ID is not available
            for this series, so
            the player cannot be
            generated yet.
          </div>
        )}
      </section>

      {/* =================================================
          DOWNLOAD
      ================================================= */}

      <section className="section">
        <div className="download-wrapper">
          <h3>
            Download Episode{" "}
            {episodeNumber}
          </h3>

          {movie ? (
            <div>
              <a
                href={
                  movieDownloadUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="download-btn"
              >
                Download Episode{" "}
                {episodeNumber}
              </a>
            </div>
          ) : (
            <div
              style={{
                display:
                  "flex",
                gap: "10px",
                flexWrap:
                  "wrap",
              }}
            >
              {seriesDownloadUrl1 && (
                <a
                  href={
                    seriesDownloadUrl1
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-btn"
                >
                  Download Server 1
                </a>
              )}

              {seriesDownloadUrl2 && (
                <a
                  href={
                    seriesDownloadUrl2
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-btn"
                >
                  Download Server 2
                </a>
              )}

              {!seriesDownloadUrl1 &&
                !seriesDownloadUrl2 && (
                  <div className="error">
                    No download server
                    is available for
                    this episode.
                  </div>
                )}
            </div>
          )}
        </div>
      </section>

      {/* =================================================
          PREVIOUS / NEXT
      ================================================= */}

      <section className="section">
        <div className="episode-controls">
          <button
            type="button"
            className="btn"
            disabled={
              !previousEpisode
            }
            onClick={() =>
              goToEpisode(
                previousEpisode
              )
            }
          >
            <ChevronLeft
              size={15}
              style={{
                verticalAlign:
                  "-3px",
                marginRight:
                  "4px",
              }}
            />
            Previous
          </button>

          <span className="tag">
            Season{" "}
            {seasonNumber}{" "}
            • Episode{" "}
            {episodeNumber}
          </span>

          <button
            type="button"
            className="btn"
            disabled={
              !nextEpisode
            }
            onClick={() =>
              goToEpisode(
                nextEpisode
              )
            }
          >
            Next
            <ChevronRight
              size={15}
              style={{
                verticalAlign:
                  "-3px",
                marginLeft:
                  "4px",
              }}
            />
          </button>
        </div>
      </section>

      {/* =================================================
          EPISODE LIST
      ================================================= */}

      {episodes.length >
        0 && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              Episodes
            </h2>
          </div>

          <div className="episode-grid">
            {episodes.map(
              (
                episodeItem,
                index
              ) => {
                const number =
                  getEpisodeNumber(
                    episodeItem
                  ) ||
                  index + 1;

                const isCurrent =
                  Number(
                    number
                  ) ===
                  Number(
                    episodeNumber
                  );

                const episodeTitle =
                  typeof episodeItem?.title ===
                  "string"
                    ? episodeItem.title
                    : episodeItem?.name ||
                      "";

                return (
                  <button
                    type="button"
                    className="episode-card"
                    key={String(
                      number
                    )}
                    onClick={() =>
                      goToEpisode(
                        number
                      )
                    }
                    style={{
                      borderColor:
                        isCurrent
                          ? "rgba(255, 23, 68, 0.65)"
                          : undefined,
                      background:
                        isCurrent
                          ? "rgba(255, 23, 68, 0.12)"
                          : undefined,
                    }}
                  >
                    <strong>
                      Episode{" "}
                      {number}
                    </strong>

                    {episodeTitle && (
                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#858995",
                          fontSize:
                            "11px",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          episodeTitle
                        }
                      </div>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* =================================================
          CURRENT INFO
      ================================================= */}

      <section className="section">
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            gap: "10px",
            flexWrap:
              "wrap",
          }}
        >
          <span className="tag">
            <Clock
              size={11}
              style={{
                verticalAlign:
                  "-2px",
                marginRight:
                  "4px",
              }}
            />
            Season{" "}
            {seasonNumber}
          </span>

          <span className="tag">
            Episode{" "}
            {episodeNumber}
          </span>

          {!movie &&
            tmdbId && (
              <span className="tag">
                TMDB{" "}
                {tmdbId}
              </span>
            )}

          {!movie &&
            imdbId && (
              <span className="tag">
                IMDb{" "}
                {imdbId}
              </span>
            )}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   DYNAMIC CATEGORY PAGE
========================================================= */

function CategoryPage() {
  const { name } = useParams();

  const [anime, setAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const categoryName = decodeURIComponent(
    name || ""
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCategory() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `${API}/anime/category/${encodeURIComponent(
              categoryName
            )}`
          );

        const data =
          await response.json();

        if (cancelled) return;

        if (
          !response.ok ||
          data?.success === false
        ) {
          throw new Error(
            data?.message ||
              "Failed to load category"
          );
        }

        setAnime(
          Array.isArray(
            data.results
          )
            ? data.results
            : []
        );
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Category page error:",
            err
          );

          setError(
            err.message ||
              "Failed to load category"
          );

          setAnime([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (categoryName) {
      loadCategory();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  if (loading) {
    return (
      <section className="section">
        <div className="loading">
          Loading {categoryName}...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="error">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="section">

      <div className="section-header">
        <h1 className="section-title">
          {categoryName}
        </h1>
      </div>

      {anime.length > 0 ? (
        <div className="anime-grid">
          {uniqueById(anime).map(
            (item) => (
              <AnimeCard
                key={String(
                  getAnimeId(item)
                )}
                anime={item}
              />
            )
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div>
            <h2>
              No Anime Found
            </h2>

            <p>
              No anime has been
              assigned to this
              category yet.
            </p>
          </div>
        </div>
      )}

    </section>
  );
}
function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(
    () =>
      Boolean(
        localStorage.getItem(
          "animebox_admin_token"
        )
      )
  );

  const [password, setPassword] =
    useState("");

  const [token, setToken] =
    useState(
      () =>
        localStorage.getItem(
          "animebox_admin_token"
        ) || ""
    );

  const [categories, setCategories] =
    useState([]);

  const [anime, setAnime] =
    useState([]);

  const [anilistId, setAnilistId] =
    useState("");

const [source, setSource] =
  useState("anilist");

const [tmdbId, setTmdbId] =
  useState("");

  const [category, setCategory] =
    useState("");

  const [newCategory, setNewCategory] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const adminHeaders = {
    "Content-Type":
      "application/json",
    "x-admin-token": token,
  };

  async function login() {
    setMessage("");

    try {
      const response = await fetch(
        `${API}/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Login failed"
        );
      }

      localStorage.setItem(
        "animebox_admin_token",
        data.token
      );

      setToken(data.token);
      setLoggedIn(true);
      setPassword("");
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  async function loadCatalog() {
    try {
      const response = await fetch(
        `${API}/admin/catalog`,
        {
          headers: {
            "x-admin-token": token,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const data =
        await response.json();

      setCategories(
        data.categories || []
      );

      setAnime(
        data.anime || []
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  useEffect(() => {
    if (loggedIn && token) {
      loadCatalog();
    }
  }, [loggedIn, token]);

  function logout() {
    localStorage.removeItem(
      "animebox_admin_token"
    );

    setToken("");
    setLoggedIn(false);
  }

  async function addCategory() {
    const name =
      newCategory.trim();

    if (!name) return;

    try {
      const response =
        await fetch(
          `${API}/admin/categories`,
          {
            method: "POST",
            headers:
              adminHeaders,
            body: JSON.stringify({
              name,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed"
        );
      }

      setCategories(
        data.categories || []
      );

      setNewCategory("");
      setMessage(
        "Category created successfully."
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  async function deleteCategory(
    name
  ) {
    if (
      !window.confirm(
        `Delete category "${name}"?`
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/admin/categories/${encodeURIComponent(
            name
          )}`,
          {
            method: "DELETE",
            headers:
              adminHeaders,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed"
        );
      }

      setCategories(
        data.categories || []
      );

      await loadCatalog();
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  async function addAnime() {
  if (
    source === "anilist" &&
    !anilistId.trim()
  ) {
    setMessage(
      "AniList ID enter karo."
    );
    return;
  }

  if (
    source === "tmdb" &&
    !tmdbId.trim()
  ) {
    setMessage(
      "TMDB ID enter karo."
    );
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    const response =
      await fetch(
        `${API}/admin/anime`,
        {
          method: "POST",
          headers:
            adminHeaders,
          body: JSON.stringify({
            source,

            anilistId:
              source === "anilist"
                ? Number(anilistId)
                : undefined,

            tmdbId:
              source === "tmdb"
                ? Number(tmdbId)
                : undefined,

            category,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to add anime"
      );
    }

    setAnime((old) => [
      ...old,
      data.anime,
    ]);

    setAnilistId("");
    setTmdbId("");

    setMessage(
      "Anime added successfully."
    );
  } catch (error) {
    setMessage(
      error.message
    );
  } finally {
    setLoading(false);
  }
}

  async function removeAnime(
    id
  ) {
    if (
      !window.confirm(
        "Remove this anime?"
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/admin/anime/${id}`,
          {
            method: "DELETE",
            headers:
              adminHeaders,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed"
        );
      }

      setAnime((old) =>
        old.filter(
          (item) =>
            Number(
              item.anilistId
            ) !== Number(id)
        )
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  async function changeCategory(
    id,
    value
  ) {
    try {
      const response =
        await fetch(
          `${API}/admin/anime/${id}`,
          {
            method: "PATCH",
            headers:
              adminHeaders,
            body: JSON.stringify({
              category: value,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed"
        );
      }

      setAnime((old) =>
        old.map((item) =>
          Number(
            item.anilistId
          ) === Number(id)
            ? data.anime
            : item
        )
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  if (!loggedIn) {
    return (
      <div
        style={{
          maxWidth: 420,
          margin: "80px auto",
          padding: 24,
        }}
      >
        <h1>AnimeBox Admin</h1>

        <p>
          Enter admin password
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }
          placeholder="Admin password"
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
          }}
        />

        <button
          className="btn btn-primary"
          onClick={login}
        >
          Login
        </button>

        {message && (
          <p
            style={{
              marginTop: 15,
            }}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      className="section"
      style={{
        marginTop: 0,
      }}
    >
      <div
        className="section-header"
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="section-title">
          AnimeBox Admin
        </h1>

        <button
          className="btn"
          onClick={logout}
        >
          Logout
        </button>
      </div>

      {message && (
        <div
          className="empty-state"
          style={{
            marginBottom: 20,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div className="card">
         <h2>Add Anime</h2>

<select
  value={source}
  onChange={(e) =>
    setSource(e.target.value)
  }
  style={{
    width: "100%",
    padding: 12,
    marginTop: 12,
  }}
>
  <option value="anilist">
    AniList
  </option>

  <option value="tmdb">
    TMDB
  </option>
</select>

{source === "anilist" ? (
  <input
    value={anilistId}
    onChange={(e) =>
      setAnilistId(
        e.target.value
      )
    }
    placeholder="AniList ID"
    style={{
      width: "100%",
      padding: 12,
      marginTop: 12,
    }}
  />
) : (
  <input
    value={tmdbId}
    onChange={(e) =>
      setTmdbId(
        e.target.value
      )
    }
    placeholder="TMDB ID"
    style={{
      width: "100%",
      padding: 12,
      marginTop: 12,
    }}
  />
)}

          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value
              )
            }
            style={{
              width: "100%",
              padding: 12,
              marginTop: 12,
            }}
          >
            <option value="">
              No Category
            </option>

            {categories.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <button
            className="btn btn-primary"
            onClick={addAnime}
            disabled={loading}
            style={{
              marginTop: 12,
            }}
          >
            {loading
              ? "Adding..."
              : "Add Anime"}
          </button>
        </div>

        <div className="card">
          <h2>Create Category</h2>

          <input
            value={newCategory}
            onChange={(e) =>
              setNewCategory(
                e.target.value
              )
            }
            placeholder="Category name"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 12,
            }}
          />

          <button
            className="btn btn-primary"
            onClick={addCategory}
            style={{
              marginTop: 12,
            }}
          >
            Create Category
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Categories</h2>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 15,
          }}
        >
          {categories.map(
            (item) => (
              <div
                key={item}
                className="tag"
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>{item}</span>

                <button
                  type="button"
                  onClick={() =>
                    deleteCategory(
                      item
                    )
                  }
                  style={{
                    border: 0,
                    background:
                      "transparent",
                    color: "inherit",
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h2>Added Anime</h2>

        {anime.length === 0 ? (
          <p
            style={{
              marginTop: 15,
            }}
          >
            No manually added anime.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 15,
            }}
          >
            {anime.map(
              (item) => (
                <div
                  key={
                    item.anilistId
                  }
                  style={{
                    display:
                      "flex",
                    gap: 15,
                    alignItems:
                      "center",
                    padding: 12,
                    border:
                      "1px solid rgba(255,255,255,.08)",
                    borderRadius: 10,
                  }}
                >
                  {item.poster && (
                    <img
                      src={
                        item.poster
                      }
                      alt=""
                      style={{
                        width: 55,
                        height: 75,
                        objectFit:
                          "cover",
                        borderRadius: 6,
                      }}
                    />
                  )}

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <strong>
                      {item.title
                        ?.english ||
                        item.title
                          ?.romaji ||
                        item.title
                          ?.native ||
                        `AniList ${item.anilistId}`}
                    </strong>

                    <div
                      style={{
                        fontSize: 13,
                        opacity:
                          0.7,
                        marginTop: 5,
                      }}
                    >
                      {item.anilistId && (
  <>
    AniList ID:{" "}
    {item.anilistId}
    {" • "}
  </>
)}

{item.tmdbId && (
  <>
    TMDB ID:{" "}
    {item.tmdbId}
    {" • "}
  </>
)}

{item.contentType}
                    </div>
                  </div>

                  <select
                    value={
                      item.category ||
                      ""
                    }
                    onChange={(
                      e
                    ) =>
                      changeCategory(
                        item.anilistId,
                        e.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      No Category
                    </option>

                    {categories.map(
                      (cat) => (
                        <option
                          key={cat}
                          value={cat}
                        >
                          {cat}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    className="btn"
                    onClick={() =>
                      removeAnime(
                        item.anilistId
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
/* =========================================================
   NOT FOUND
========================================================= */

function NotFound() {
  return (
    <div className="empty-state">
      <div>
        <h1
          style={{
            color: "#fff",
            marginBottom:
              "10px",
          }}
        >
          404
        </h1>

        <p>
          This page could not
          be found.
        </p>

        <Link
          to="/"
          className="btn btn-primary"
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            marginTop:
              "18px",
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageWrapper>
            <Home />
          </PageWrapper>
        }
      />

      <Route
        path="/anime"
        element={
          <PageWrapper>
            <AnimePage />
          </PageWrapper>
        }
      />

      <Route
        path="/anime/:id"
        element={
          <PageWrapper>
            <AnimeDetail />
          </PageWrapper>
        }
      />

      <Route
        path="/watch/:id/:season/:episode"
        element={
          <PageWrapper>
            <WatchPage />
          </PageWrapper>
        }
      />

      <Route
        path="/trending"
        element={
          <PageWrapper>
            <TrendingPage />
          </PageWrapper>
        }
      />

      <Route
        path="/genres"
        element={
          <PageWrapper>
            <GenresPage />
          </PageWrapper>
        }
      />

      <Route
        path="/dmca"
        element={<DMCAPage />}
      />

      <Route
        path="/privacy"
        element={<PrivacyPage />}
      />

      <Route
        path="/terms"
        element={<TermsPage />}
      />

      <Route
        path="/contact"
        element={<ContactPage />}
      />

<Route
  path="/category/:name"
  element={
    <PageWrapper>
      <CategoryPage />
    </PageWrapper>
  }
/>

<Route
  path="/admin"
  element={
    <PageWrapper>
      <AdminPage />
    </PageWrapper>
  }
/>

      <Route
        path="*"
        element={
          <PageWrapper>
            <NotFound />
          </PageWrapper>
        }
      />
    </Routes>
  );
}