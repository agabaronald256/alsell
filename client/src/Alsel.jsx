import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const G = {
  gold: "#C9A84C",
  goldLight: "#E8C96A",
  goldDark: "#A07830",
  goldBg: "#F7F3E3",
  goldBgDark: "rgba(201,168,76,0.10)",
  black: "#0D0D0D",
  surface: "#1A1A1A",
  surface2: "#242424",
  cream: "#F7F5EE",
  ink: "#111111",
  ink2: "#555555",
  ink3: "#999999",
  border: "#EDEDED",
  borderDark: "rgba(255,255,255,0.07)",
  green: "#1A6B1A",
  greenBg: "#E8F4E8",
  red: "#B03030",
  redBg: "#FFF0F0",
};

const CATEGORIES = [
  { id: "all", label: "All", icon: "◈" },
  { id: "electronics", label: "Electronics", icon: "⌁" },
  { id: "fashion", label: "Fashion", icon: "◎" },
  { id: "cars", label: "Cars", icon: "◉" },
  { id: "property", label: "Property", icon: "⬡" },
  { id: "home", label: "Home", icon: "⬢" },
  { id: "hobbies", label: "Hobbies", icon: "◆" },
  { id: "books", label: "Books", icon: "▣" },
  { id: "sports", label: "Sports", icon: "◐" },
];

const TRENDING = [
  "iPhone 14",
  "Toyota Vitz",
  "PS5",
  "MacBook",
  "Sofa Set",
  "Nike Shoes",
];

const fmt = (n) => "UGX " + Number(n).toLocaleString();

const conditionColor = (c) => {
  if (c === "Brand new") return { bg: "#FBF5E0", color: "#8A6010" };
  if (c === "Like new") return { bg: "#E8F4E8", color: "#1A6B1A" };
  if (c === "Used") return { bg: "#F2F2F2", color: "#555" };
  return { bg: "#F2F2F2", color: "#888" };
};

const hashId = (id) => {
  if (typeof id === "number") return id;
  return Math.abs(
    String(id)
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0),
  );
};

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const authHeaders = () => {
  const token = localStorage.getItem("alsel_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// ── Listing placeholder ────────────────────────────────────────
const ListingPlaceholder = ({ id, category }) => {
  const palettes = {
    electronics: ["#1A1A2E", "#16213E", "#0F3460"],
    fashion: ["#2D1B2E", "#3D1A3D", "#4A235A"],
    cars: ["#1A2E1A", "#163016", "#0F3D0F"],
    property: ["#2E2A1A", "#302816", "#3D3010"],
    home: ["#2E1A1A", "#301616", "#3D1010"],
    hobbies: ["#1A2A2E", "#162830", "#0F303D"],
    sports: ["#1A1E2E", "#161C30", "#0F1C3D"],
    books: ["#2A1A2E", "#281630", "#301040"],
  };
  const colors = palettes[category] || palettes.electronics;
  const idx = hashId(id);
  const shapes = [
    <rect
      key="r"
      x="30%"
      y="25%"
      width="40%"
      height="50%"
      rx="8"
      fill={G.gold}
      opacity="0.15"
    />,
    <circle key="c" cx="50%" cy="50%" r="22%" fill={G.gold} opacity="0.12" />,
    <polygon
      key="p"
      points="50,20 80,70 20,70"
      fill={G.gold}
      opacity="0.12"
      transform="translate(25,15) scale(1.8)"
    />,
  ];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 200 160"
      style={{ background: colors[idx % colors.length] }}
    >
      {shapes[idx % shapes.length]}
      <text
        x="50%"
        y="85%"
        textAnchor="middle"
        fill={G.gold}
        opacity="0.4"
        fontSize="11"
        fontFamily="DM Sans,sans-serif"
      >
        {CATEGORIES.find((c) => c.id === category)?.label || "Item"}
      </text>
    </svg>
  );
};

// ── Navbar ─────────────────────────────────────────────────────
function Navbar({
  darkMode,
  setDarkMode,
  onSell,
  searchQuery,
  setSearchQuery,
  onSearch,
  user,
  onAuthOpen,
  onNotifications,
  unreadCount,
  onOffers,
  onFavourites,
  onBundles,
  onSecurity,
}) {
  return (
    <nav
      style={{
        background: darkMode ? G.black : "#fff",
        borderBottom: `1px solid ${darkMode ? G.borderDark : G.border}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 20px",
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontFamily: "'Clash Display','DM Sans',sans-serif",
            fontWeight: 700,
            letterSpacing: -1,
            color: G.gold,
            flexShrink: 0,
          }}
        >
          al<span style={{ color: darkMode ? "#fff" : G.ink }}>sel</span>
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 480,
            display: "flex",
            alignItems: "center",
            background: darkMode ? G.surface : G.cream,
            border: `1.5px solid ${darkMode ? "rgba(201,168,76,0.2)" : G.border}`,
            borderRadius: 10,
            padding: "0 14px",
            height: 40,
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke={G.ink3} strokeWidth="1.5" />
            <path
              d="M9 9L13 13"
              stroke={G.ink3}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search listings..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 13,
              color: darkMode ? "rgba(255,255,255,0.8)" : G.ink,
              outline: "none",
              fontFamily: "DM Sans,sans-serif",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: G.ink3,
                fontSize: 16,
              }}
            >
              ×
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              background: "none",
              border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : G.border}`,
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: darkMode ? G.gold : G.ink2,
              fontSize: 14,
            }}
          >
            {darkMode ? "☀" : "☾"}
          </button>
          {user && (
            <>
              <button
                onClick={onFavourites}
                title="Favourites"
                style={{
                  background: "none",
                  border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : G.border}`,
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: darkMode ? G.gold : G.ink2,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 12 11" fill="none">
                  <path
                    d="M6 10S1 6.5 1 3.5A2.5 2.5 0 0 1 6 2.27 2.5 2.5 0 0 1 11 3.5C11 6.5 6 10 6 10Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
              </button>
              <button
                onClick={onOffers}
                title="Offers"
                style={{
                  background: "none",
                  border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : G.border}`,
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: darkMode ? G.gold : G.ink2,
                  fontSize: 13,
                }}
              >
                ◎
              </button>
              <button onClick={onBundles} title="Bundles" style={{ background: "none", border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : G.border}`, borderRadius: 8, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: darkMode ? G.gold : G.ink2, fontSize: 13 }}>
                ◈
              </button>
              <button
                onClick={onNotifications}
                style={{
                  position: "relative",
                  background: "none",
                  border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : G.border}`,
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: darkMode ? G.gold : G.ink2,
                  fontSize: 14,
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: G.gold,
                      color: G.black,
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      fontSize: 9,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {user && (
                <button onClick={onSecurity} title="Security Centre"
                  style={{ background: "none", border: `1px solid ${darkMode?"rgba(255,255,255,0.1)":G.border}`, borderRadius: 8, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: darkMode?G.gold:G.ink2, fontSize: 14 }}>
                  🔐
                </button>
              )}
            </>
          )}
          <button
            onClick={onSell}
            style={{
              background: G.gold,
              color: G.black,
              border: "none",
              borderRadius: 9,
              padding: "0 18px",
              height: 36,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            + Sell
          </button>
          <div
            onClick={onAuthOpen}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: darkMode ? "rgba(201,168,76,0.15)" : G.goldBg,
              border: "1px solid rgba(201,168,76,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: G.gold,
              cursor: "pointer",
            }}
          >
            {user ? user.username.slice(0, 2).toUpperCase() : "?"}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────
function Hero({ onSearch, searchQuery, setSearchQuery }) {
  return (
    <div
      style={{
        background: G.black,
        padding: "52px 20px 48px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 300,
          height: 300,
          opacity: 0.04,
          pointerEvents: "none",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 300 300">
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx="300"
              cy="0"
              r={80 + i * 40}
              fill="none"
              stroke={G.gold}
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 20,
            background: "rgba(201,168,76,0.15)",
            color: G.gold,
            marginBottom: 16,
            letterSpacing: 0.5,
          }}
        >
          Uganda's #1 marketplace
        </div>
        <h1
          style={{
            fontSize: "clamp(32px,5vw,52px)",
            fontFamily: "'Clash Display','DM Sans',sans-serif",
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 8px",
            letterSpacing: -1.5,
            lineHeight: 1.1,
          }}
        >
          Buy &amp; sell
          <br />
          <span style={{ color: G.gold }}>anything.</span>
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.4)",
            margin: "0 0 28px",
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          Thousands of listings near you, updated daily.
        </p>
        <div
          style={{
            maxWidth: 560,
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(201,168,76,0.3)",
            borderRadius: 12,
            padding: "0 6px 0 16px",
            height: 52,
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <circle
              cx="5.5"
              cy="5.5"
              r="4"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
            />
            <path
              d="M9 9L13 13"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search for phones, cars, furniture..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              color: "#fff",
              outline: "none",
              fontFamily: "DM Sans,sans-serif",
            }}
          />
          <button
            onClick={onSearch}
            style={{
              background: G.gold,
              color: G.black,
              border: "none",
              borderRadius: 9,
              padding: "0 20px",
              height: 40,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "DM Sans,sans-serif",
              flexShrink: 0,
            }}
          >
            Search
          </button>
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Trending:
          </span>
          {TRENDING.map((t) => (
            <button
              key={t}
              onClick={() => {
                setSearchQuery(t);
                onSearch(t);
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(201,168,76,0.15)";
                e.target.style.borderColor = "rgba(201,168,76,0.4)";
                e.target.style.color = G.gold;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255,255,255,0.06)";
                e.target.style.borderColor = "rgba(255,255,255,0.1)";
                e.target.style.color = "rgba(255,255,255,0.6)";
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Category strip ─────────────────────────────────────────────
function CategoryStrip({ active, setActive, darkMode }) {
  return (
    <div
      style={{
        background: darkMode ? G.surface : "#fff",
        borderBottom: `1px solid ${darkMode ? G.borderDark : G.border}`,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          gap: 4,
          height: 54,
          alignItems: "center",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
              style={{
                background: isActive ? G.gold : "transparent",
                color: isActive
                  ? G.black
                  : darkMode
                    ? "rgba(255,255,255,0.5)"
                    : G.ink2,
                border: isActive
                  ? "none"
                  : `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : G.border}`,
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ fontSize: 11 }}>{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────
function FilterBar({
  sort,
  setSort,
  condition,
  setCondition,
  darkMode,
  count,
  nearMe,
  onNearMe,
  onClearNearMe,
}) {
  return (
    <div
      style={{
        background: darkMode ? G.black : G.cream,
        padding: "12px 20px",
        borderBottom: `1px solid ${darkMode ? G.borderDark : G.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: darkMode ? "rgba(255,255,255,0.4)" : G.ink3,
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          {count} listing{count !== 1 ? "s" : ""}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {["All", "Brand new", "Like new", "Used"].map((c) => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              style={{
                background:
                  condition === c
                    ? darkMode
                      ? G.goldBgDark
                      : G.goldBg
                    : "transparent",
                color:
                  condition === c
                    ? G.gold
                    : darkMode
                      ? "rgba(255,255,255,0.4)"
                      : G.ink3,
                border: `1px solid ${condition === c ? "rgba(201,168,76,0.3)" : darkMode ? "rgba(255,255,255,0.08)" : G.border}`,
                borderRadius: 20,
                padding: "5px 13px",
                fontSize: 12,
                fontWeight: condition === c ? 600 : 400,
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
                transition: "all 0.15s",
              }}
            >
              {c}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              background: darkMode ? G.surface : "#fff",
              color: darkMode ? "rgba(255,255,255,0.7)" : G.ink,
              border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : G.border}`,
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "DM Sans,sans-serif",
              outline: "none",
            }}
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
          {navigator.geolocation && (
            <button
              onClick={() =>
                nearMe
                  ? onClearNearMe && onClearNearMe()
                  : navigator.geolocation.getCurrentPosition(
                      (pos) =>
                        onNearMe &&
                        onNearMe(pos.coords.latitude, pos.coords.longitude),
                    )
              }
              style={{
                background: nearMe
                  ? darkMode
                    ? G.goldBgDark
                    : G.goldBg
                  : "transparent",
                color: nearMe
                  ? G.gold
                  : darkMode
                    ? "rgba(255,255,255,0.4)"
                    : G.ink3,
                border: `1px solid ${nearMe ? "rgba(201,168,76,0.3)" : darkMode ? "rgba(255,255,255,0.08)" : G.border}`,
                borderRadius: 20,
                padding: "5px 13px",
                fontSize: 12,
                fontWeight: nearMe ? 600 : 400,
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              📍 Near me
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auction badge ──────────────────────────────────────────────
function AuctionBadge({ endsAt, darkMode }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt) - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) setTimeLeft(`${Math.floor(h/24)}d ${h%24}h`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const isUrgent = new Date(endsAt) - Date.now() < 3600000;

  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: isUrgent ? G.redBg : G.goldBg, color: isUrgent ? G.red : G.goldDark, fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 3 }}>
      ⏱ {timeLeft}
    </span>
  );
}

// ── Listing card ───────────────────────────────────────────────
function ListingCard({ listing, darkMode, onOpen, isFaved, onFave }) {
  const [hovered, setHovered] = useState(false);
  const cond = conditionColor(listing.condition);
  return (
    <div
      onClick={() => onOpen(listing)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: darkMode ? G.surface : "#fff",
        border: `1px solid ${darkMode ? (hovered ? "rgba(201,168,76,0.3)" : G.borderDark) : hovered ? "rgba(201,168,76,0.4)" : G.border}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered
          ? `0 8px 24px rgba(0,0,0,${darkMode ? "0.4" : "0.08"})`
          : "none",
      }}
    >
      <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
        {listing.photos && listing.photos.length > 0 ? (
          <img src={listing.photos[0]} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ListingPlaceholder id={listing.id} category={listing.category} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFave(listing.id);
          }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: isFaved ? G.gold : "rgba(0,0,0,0.5)",
            border: isFaved ? "none" : "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <svg width="13" height="12" viewBox="0 0 12 11" fill="none">
            <path
              d="M6 10S1 6.5 1 3.5A2.5 2.5 0 0 1 6 2.27 2.5 2.5 0 0 1 11 3.5C11 6.5 6 10 6 10Z"
              fill={isFaved ? G.black : "none"}
              stroke={isFaved ? G.black : "#fff"}
              strokeWidth="1.3"
            />
          </svg>
        </button>
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            fontSize: 10,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          {timeAgo(listing.created_at)}
        </div>
      </div>
      <div style={{ padding: "12px 14px 14px" }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: darkMode ? G.gold : G.ink,
            fontFamily: "DM Sans,sans-serif",
            marginBottom: 3,
          }}
        >
          {fmt(listing.price)}
        </div>
        <div
          style={{
            fontSize: 13,
            color: darkMode ? "rgba(255,255,255,0.7)" : G.ink2,
            fontFamily: "DM Sans,sans-serif",
            marginBottom: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {listing.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {listing.condition && listing.condition !== "N/A" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: darkMode ? "rgba(201,168,76,0.1)" : cond.bg,
                color: darkMode ? G.goldLight : cond.color,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {listing.condition}
            </span>
          )}
          {listing.is_boosted && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(201,168,76,0.15)", color: G.gold, fontFamily: "DM Sans,sans-serif" }}>⚡ Boosted</span>
          )}
          {listing.is_auction && listing.auction_ends_at && (
            <AuctionBadge endsAt={listing.auction_ends_at} darkMode={darkMode} />
          )}
          <span
            style={{
              fontSize: 11,
              color: G.ink3,
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            📍 {listing.location}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Listing grid ───────────────────────────────────────────────
function ListingGrid({ listings, darkMode, onOpen, favs, onFave }) {
  if (listings.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "80px 20px",
          fontFamily: "DM Sans,sans-serif",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>◈</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: darkMode ? "rgba(255,255,255,0.4)" : G.ink2,
          }}
        >
          No listings found
        </div>
        <div style={{ fontSize: 13, marginTop: 4, color: G.ink3 }}>
          Try a different search or category
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: 16,
      }}
    >
      {listings.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          darkMode={darkMode}
          onOpen={onOpen}
          isFaved={favs.includes(l.id)}
          onFave={onFave}
        />
      ))}
    </div>
  );
}

// ── Listing detail ─────────────────────────────────────────────
function ListingDetail({
  listing,
  darkMode,
  onClose,
  isFaved,
  onFave,
  user,
  onMakeOffer,
  onAuthRequired,
  onReport,
  showToast,
}) {
  const [showBidModal, setShowBidModal] = useState(false);
  const [auction, setAuction] = useState(null);
  const [offerAmt, setOfferAmt] = useState(
    Math.round((listing.price * 0.85) / 1000) * 1000,
  );
  const [offerSent, setOfferSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSent, setReviewSent] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (listing.is_auction) {
      fetch(`${API}/auctions/listing/${listing.id}`)
        .then(r => r.json())
        .then(data => !data.error && setAuction(data));
    }
  }, [listing.id, listing.is_auction]);
  const cond = conditionColor(listing.condition);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  const handleOffer = async () => {
    if (!user) {
      onAuthRequired();
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/offers`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ listing_id: listing.id, amount: offerAmt }),
      });
      const data = await res.json();
      if (res.ok) {
        setOfferSent(true);
        onMakeOffer && onMakeOffer(data);
      } else alert(data.error || "Failed to send offer");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 640,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        <div style={{ height: 280 }}>
          {listing.photos && listing.photos.length > 0 ? (
            <img src={listing.photos[0]} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <ListingPlaceholder id={listing.id} category={listing.category} />
          )}
        </div>
        <div style={{ padding: "24px 28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: darkMode ? G.gold : G.ink,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                {fmt(listing.price)}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  color: textPrimary,
                  fontFamily: "DM Sans,sans-serif",
                  marginTop: 4,
                }}
              >
                {listing.title}
              </div>
            </div>
            <button
              onClick={() => onFave(listing.id)}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: isFaved ? G.gold : "transparent",
                border: `1.5px solid ${isFaved ? G.gold : borderColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <svg width="16" height="15" viewBox="0 0 12 11" fill="none">
                <path
                  d="M6 10S1 6.5 1 3.5A2.5 2.5 0 0 1 6 2.27 2.5 2.5 0 0 1 11 3.5C11 6.5 6 10 6 10Z"
                  fill={isFaved ? G.black : "none"}
                  stroke={isFaved ? G.black : darkMode ? G.gold : G.ink2}
                  strokeWidth="1.3"
                />
              </svg>
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            {listing.condition && listing.condition !== "N/A" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: darkMode ? "rgba(201,168,76,0.1)" : cond.bg,
                  color: darkMode ? G.goldLight : cond.color,
                }}
              >
                {listing.condition}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: darkMode ? "rgba(255,255,255,0.05)" : G.cream,
                color: textSecondary,
              }}
            >
              📍 {listing.location}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: darkMode ? "rgba(255,255,255,0.05)" : G.cream,
                color: textSecondary,
              }}
            >
              {timeAgo(listing.created_at)}
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: textSecondary,
              lineHeight: 1.7,
              fontFamily: "DM Sans,sans-serif",
              marginBottom: 20,
            }}
          >
            {listing.description || "No description provided."}
          </p>

          {/* Seller row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: darkMode ? G.surface2 : G.cream,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: darkMode ? G.goldBgDark : G.goldBg,
                border: "1px solid rgba(201,168,76,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: G.gold,
              }}
            >
              {listing.seller ? listing.seller[0].toUpperCase() : "?"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: textPrimary,
                    fontFamily: "DM Sans,sans-serif",
                  }}
                >
                  {listing.seller || "Seller"}
                </div>
                {listing.is_verified && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 20,
                      background: "rgba(26,107,26,0.1)",
                      color: G.green,
                    }}
                  >
                    ✓ Verified
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: G.gold }}>
                {"★".repeat(Math.round(listing.seller_rating || 5))}
                <span style={{ color: textSecondary, marginLeft: 4 }}>
                  {listing.seller_rating
                    ? Number(listing.seller_rating).toFixed(1)
                    : "New seller"}
                </span>
                {listing.seller_trust_score > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: textSecondary }}>
                    · Trust {listing.seller_trust_score}/100
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {user && listing.user_id === user.id && (
                <button onClick={() => setShowEdit(true)}
                  style={{ background: darkMode ? G.goldBgDark : G.goldBg, border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: G.gold, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 600 }}>
                  ✎ Edit
                </button>
              )}
              {user && listing.user_id !== user.id && (
                <button onClick={() => onReport && onReport(listing)}
                  style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, color: G.ink3, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
                  Report
                </button>
              )}
            </div>
          </div>

          {/* Boost button */}
          {user && listing.user_id === user.id && (
            <div style={{ padding: '0 16px 12px' }}>
              <button onClick={() => setShowBoost(true)}
                style={{ width: '100%', background: G.goldBg, border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: G.goldDark, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 600, textAlign: 'center' }}>
                ⚡ Boost this listing
              </button>
            </div>
          )}

          {/* Auction / Offer */}
          {listing.is_auction && auction ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ background: darkMode?G.surface2:G.cream, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>Current bid</div>
                  <AuctionBadge endsAt={auction.ends_at} darkMode={darkMode} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>{fmt(auction.current_price)}</div>
                <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>{auction.bid_count || 0} bids · started at {fmt(auction.starting_price)}</div>
              </div>
              <button onClick={() => { if (!user) { onAuthRequired(); return; } setShowBidModal(true); }}
                style={{ width: "100%", background: G.gold, color: G.black, border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                ⏱ Place a bid
              </button>
              {showBidModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto" }}>
                  <BidModal listing={listing} auction={auction} darkMode={darkMode} onClose={() => setShowBidModal(false)} user={user}
                    onBidPlaced={(updated) => setAuction(prev => ({...prev, current_price: updated.current_price, bid_count: (prev.bid_count||0)+1}))} />
                </div>
              )}
            </div>
          ) : !listing.is_auction ? (
            !offerSent ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", display: "block", marginBottom: 6 }}>Your offer (UGX)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" value={offerAmt} onChange={(e) => setOfferAmt(Number(e.target.value))}
                    style={{ flex: 1, background: darkMode?G.surface2:G.cream, border: `1px solid ${borderColor}`, borderRadius: 9, padding: "10px 14px", fontSize: 14, color: textPrimary, fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                  <button onClick={handleOffer} disabled={sending}
                    style={{ background: G.gold, color: G.black, border: "none", borderRadius: 9, padding: "0 22px", fontSize: 14, fontWeight: 700, cursor: sending?"not-allowed":"pointer", fontFamily: "DM Sans,sans-serif", flexShrink: 0, opacity: sending?0.7:1 }}>
                    {sending ? "Sending..." : "Make offer"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: textSecondary, marginTop: 5, fontFamily: "DM Sans,sans-serif" }}>
                  Suggested: {fmt(Math.round(listing.price * 0.85 / 1000) * 1000)} (15% below asking)
                </div>
              </div>
            ) : (
              <div style={{ background: darkMode?"rgba(201,168,76,0.08)":G.goldBg, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 10, padding: "14px 16px", marginBottom: 12, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>Offer sent — {fmt(offerAmt)}</div>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 3 }}>Check your offers inbox for updates</div>
              </div>
            )
          ) : null}

          {/* Leave a review */}
          {user && listing.user_id !== user.id && (
            <div style={{ marginTop: 12 }}>
              {!showReview ? (
                <button
                  onClick={() => setShowReview(true)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: 10,
                    padding: "12px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: textSecondary,
                    cursor: "pointer",
                    fontFamily: "DM Sans,sans-serif",
                    marginTop: 8,
                  }}
                >
                  ★ Leave a review
                </button>
              ) : reviewSent ? (
                <div
                  style={{
                    background: darkMode ? "rgba(26,107,26,0.1)" : G.greenBg,
                    border: "1px solid rgba(26,107,26,0.3)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: G.green,
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    Review submitted — thank you!
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: darkMode ? G.surface2 : G.cream,
                    borderRadius: 12,
                    padding: "16px",
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: textPrimary,
                      fontFamily: "DM Sans,sans-serif",
                      marginBottom: 12,
                    }}
                  >
                    Rate this seller
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setReviewForm((f) => ({ ...f, rating: s }))
                        }
                        style={{
                          fontSize: 22,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color:
                            s <= reviewForm.rating
                              ? G.gold
                              : darkMode
                                ? "rgba(255,255,255,0.15)"
                                : "#DDD",
                          transition: "color 0.15s",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(e) =>
                      setReviewForm((f) => ({ ...f, comment: e.target.value }))
                    }
                    placeholder="Share your experience with this seller..."
                    style={{
                      width: "100%",
                      background: darkMode ? G.surface : G.cream,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 9,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: textPrimary,
                      fontFamily: "DM Sans,sans-serif",
                      outline: "none",
                      resize: "none",
                      height: 80,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => setShowReview(false)}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: `1px solid ${borderColor}`,
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 13,
                        color: textSecondary,
                        cursor: "pointer",
                        fontFamily: "DM Sans,sans-serif",
                      }}
                    >
                      Cancel
              </button>
              <button
                      onClick={async () => {
                        setSubmittingReview(true);
                        try {
                          const res = await fetch(`${API}/reviews`, {
                            method: "POST",
                            headers: authHeaders(),
                            body: JSON.stringify({
                              seller_id: listing.user_id,
                              listing_id: listing.id,
                              rating: reviewForm.rating,
                              comment: reviewForm.comment,
                            }),
                          });
                          if (res.ok) setReviewSent(true);
                          else {
                            const d = await res.json();
                            alert(d.error || "Failed to submit review");
                          }
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setSubmittingReview(false);
                        }
                      }}
                      disabled={submittingReview}
                      style={{
                        flex: 2,
                        background: G.gold,
                        border: "none",
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: G.black,
                        cursor: submittingReview ? "not-allowed" : "pointer",
                        fontFamily: "DM Sans,sans-serif",
                        opacity: submittingReview ? 0.7 : 1,
                      }}
                    >
                      {submittingReview ? "Submitting..." : "Submit review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto" }}>
          <EditListingModal
            listing={listing}
            darkMode={darkMode}
            onClose={() => setShowEdit(false)}
            onSaved={(updated) => {
              onClose();
              showToast('Listing updated!');
            }}
            showToast={showToast}
          />
        </div>
      )}
      {showBoost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto" }}>
          <BoostModal listing={listing} darkMode={darkMode} onClose={() => setShowBoost(false)}
            onBoosted={() => setShowBoost(false)} showToast={showToast} />
        </div>
      )}
    </div>
  );
}

// ── Chat modal ─────────────────────────────────────────────────
function ChatModal({ offer, darkMode, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [socket, setSocket] = useState(null);
  const bottomRef = useRef(null);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  useEffect(() => {
    fetch(`${API}/messages/${offer.id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setMessages(data));
    const s = io(SOCKET_URL);
    s.emit("join_room", offer.id);
    s.on("receive_message", (msg) => setMessages((prev) => [...prev, msg]));
    setSocket(s);
    return () => s.disconnect();
  }, [offer.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!body.trim() || !socket) return;
    socket.emit("send_message", {
      offer_id: offer.id,
      sender_id: user.id,
      sender_name: user.username,
      body: body.trim(),
    });
    setBody("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: 560,
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {offer.listing_title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: G.gold,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Offer: {fmt(offer.amount)} · {offer.status}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: textSecondary,
                fontSize: 13,
                fontFamily: "DM Sans,sans-serif",
                marginTop: 40,
              }}
            >
              No messages yet. Start the conversation.
            </div>
          )}
          {messages.map((m) => {
            const isMe = m.sender_id === user.id;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "72%",
                    background: isMe ? G.gold : darkMode ? G.surface2 : G.cream,
                    borderRadius: isMe
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                    padding: "10px 14px",
                  }}
                >
                  {!isMe && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.gold,
                        marginBottom: 3,
                        fontFamily: "DM Sans,sans-serif",
                      }}
                    >
                      {m.sender_name}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 14,
                      color: isMe ? G.black : textPrimary,
                      fontFamily: "DM Sans,sans-serif",
                      lineHeight: 1.5,
                    }}
                  >
                    {m.body}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: isMe ? "rgba(0,0,0,0.4)" : textSecondary,
                      marginTop: 4,
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    {timeAgo(m.sent_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${borderColor}`,
            display: "flex",
            gap: 8,
          }}
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            style={{
              flex: 1,
              background: darkMode ? G.surface2 : G.cream,
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              color: textPrimary,
              fontFamily: "DM Sans,sans-serif",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              background: G.gold,
              color: G.black,
              border: "none",
              borderRadius: 10,
              padding: "0 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Offers inbox ───────────────────────────────────────────────
function OffersModal({ darkMode, onClose, user, onOpenChat }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  const loadOffers = async () => {
    try {
      const res = await fetch(`${API}/offers/mine`, { headers: authHeaders() });
      const data = await res.json();
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleAction = async (id, action, amount) => {
    try {
      const body =
        action === "counter" ? JSON.stringify({ amount }) : JSON.stringify({});
      const res = await fetch(`${API}/offers/${id}/${action}`, {
        method: "PATCH",
        headers: authHeaders(),
        body,
      });
      const data = await res.json();
      if (res.ok) await loadOffers();
      else alert(data.error || "Action failed");
    } catch (err) {
      console.error(err);
    }
  };

  const statusColor = (s) => {
    if (s === "accepted") return { bg: G.greenBg, color: G.green };
    if (s === "declined") return { bg: G.redBg, color: G.red };
    if (s === "countered") return { bg: G.goldBg, color: G.goldDark };
    return {
      bg: darkMode ? "rgba(255,255,255,0.05)" : "#F5F5F5",
      color: G.ink3,
    };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 560,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Offers inbox
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px", maxHeight: 520, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: textSecondary,
                fontFamily: "DM Sans,sans-serif",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          )}
          {!loading && offers.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>
                ◎
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: textSecondary,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                No offers yet
              </div>
            </div>
          )}
          {offers.map((o) => {
            const sc = statusColor(o.status);
            const isSeller = o.seller_id === user?.id;
            return (
              <div
                key={o.id}
                style={{
                  background: darkMode ? G.surface2 : G.cream,
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: textPrimary,
                      fontFamily: "DM Sans,sans-serif",
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    {o.listing_title}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: G.gold,
                    fontWeight: 600,
                    fontFamily: "DM Sans,sans-serif",
                    marginBottom: 4,
                  }}
                >
                  {fmt(o.amount)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    fontFamily: "DM Sans,sans-serif",
                    marginBottom: 10,
                  }}
                >
                  {isSeller
                    ? `Buyer: ${o.buyer_name}`
                    : `Asking: ${fmt(o.listing_price)}`}{" "}
                  · {timeAgo(o.created_at)}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onOpenChat(o)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      color: textSecondary,
                      cursor: "pointer",
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    💬 Chat
                  </button>
                  {isSeller && o.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleAction(o.id, "accept")}
                        style={{
                          background: G.greenBg,
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 12,
                          color: G.green,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "DM Sans,sans-serif",
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction(o.id, "decline")}
                        style={{
                          background: G.redBg,
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 12,
                          color: G.red,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "DM Sans,sans-serif",
                        }}
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Notifications panel ────────────────────────────────────────
function NotificationsModal({ darkMode, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  useEffect(() => {
    fetch(`${API}/notifications`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setNotifications(Array.isArray(data) ? data : []);
        setLoading(false);
      });
    fetch(`${API}/notifications/read`, {
      method: "PATCH",
      headers: authHeaders(),
    });
  }, []);

  const typeIcon = (t) => {
    if (t === "new_offer") return "◎";
    if (t === "offer_accepted") return "✓";
    if (t === "offer_declined") return "×";
    if (t === "offer_countered") return "↺";
    if (t === "new_review") return "★";
    if (t === "price_drop") return "↓";
    if (t === "new_bid") return "⏱";
    if (t === "auction_won") return "🏆";
    if (t === "auction_ended") return "⏱";
    return "•";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Notifications
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: textSecondary,
                fontFamily: "DM Sans,sans-serif",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>
                🔔
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: textSecondary,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                No notifications yet
              </div>
            </div>
          )}
          {notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                padding: "14px 20px",
                borderBottom:
                  i < notifications.length - 1
                    ? `1px solid ${borderColor}`
                    : "none",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                background: n.read
                  ? "transparent"
                  : darkMode
                    ? "rgba(201,168,76,0.05)"
                    : "rgba(201,168,76,0.04)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: darkMode ? G.goldBgDark : G.goldBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: G.gold,
                  flexShrink: 0,
                }}
              >
                {typeIcon(n.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: textPrimary,
                    fontFamily: "DM Sans,sans-serif",
                    lineHeight: 1.5,
                  }}
                >
                  {n.message}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: textSecondary,
                    marginTop: 3,
                    fontFamily: "DM Sans,sans-serif",
                  }}
                >
                  {timeAgo(n.created_at)}
                </div>
              </div>
              {!n.read && (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: G.gold,
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Favourites modal ───────────────────────────────────────────
function FavouritesModal({ darkMode, onClose, onOpen }) {
  const [favListings, setFavListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;

  useEffect(() => {
    fetch(`${API}/favourites`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setFavListings(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 560,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Saved listings
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px", maxHeight: 520, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: textSecondary,
                fontFamily: "DM Sans,sans-serif",
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          )}
          {!loading && favListings.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>
                ♡
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: textSecondary,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                No saved listings yet
              </div>
              <div style={{ fontSize: 13, color: G.ink3, marginTop: 4 }}>
                Tap the heart on any listing to save it
              </div>
            </div>
          )}
          {favListings.map((l) => {
            const dropped = l.price_at_save && Number(l.price) < Number(l.price_at_save);
            const dropPct = dropped ? Math.round(((l.price_at_save - l.price) / l.price_at_save) * 100) : 0;
            return (
              <div key={l.id} onClick={() => { onClose(); onOpen(l); }}
                style={{ display: "flex", gap: 12, padding: "12px", borderRadius: 12, marginBottom: 8, background: darkMode?G.surface2:G.cream, cursor: "pointer", border: dropped?`1px solid rgba(26,107,26,0.3)`:"1px solid transparent" }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                  {l.photos?.[0] ? <img src={l.photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <ListingPlaceholder id={l.id} category={l.category} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: darkMode?G.gold:G.ink, fontFamily: "DM Sans,sans-serif" }}>{fmt(l.price)}</div>
                    {dropped && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: G.greenBg, color: G.green, fontFamily: "DM Sans,sans-serif" }}>
                        ↓ {dropPct}% drop
                      </span>
                    )}
                  </div>
                  {dropped && (
                    <div style={{ fontSize: 11, color: G.ink3, fontFamily: "DM Sans,sans-serif", textDecoration: "line-through", marginBottom: 2 }}>
                      was {fmt(l.price_at_save)}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: textPrimary, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
                  <div style={{ fontSize: 11, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>📍 {l.location} · {l.seller}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Report modal ───────────────────────────────────────────────
function ReportModal({ listing, darkMode, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;
  const inputStyle = {
    width: "100%",
    background: darkMode ? G.surface2 : G.cream,
    border: `1px solid ${borderColor}`,
    borderRadius: 9,
    padding: "11px 14px",
    fontSize: 14,
    color: textPrimary,
    fontFamily: "DM Sans,sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const reasons = [
    "Fake listing",
    "Wrong price",
    "Scam / fraud",
    "Inappropriate content",
    "Already sold",
    "Other",
  ];

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          listing_id: listing.id,
          reported_user_id: listing.user_id,
          reason,
          details,
        }),
      });
      if (res.ok) setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Report listing
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "24px" }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: textPrimary,
                  fontFamily: "DM Sans,sans-serif",
                  marginBottom: 6,
                }}
              >
                Report submitted
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: textSecondary,
                  fontFamily: "DM Sans,sans-serif",
                  marginBottom: 20,
                }}
              >
                We'll review this listing and take action if needed.
              </div>
              <button
                onClick={onClose}
                style={{
                  background: G.gold,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: G.black,
                  cursor: "pointer",
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    display: "block",
                    marginBottom: 8,
                    fontFamily: "DM Sans,sans-serif",
                    fontWeight: 500,
                  }}
                >
                  Reason
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {reasons.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 20,
                        border: `1px solid ${reason === r ? G.gold : borderColor}`,
                        background:
                          reason === r
                            ? darkMode
                              ? G.goldBgDark
                              : G.goldBg
                            : "transparent",
                        color: reason === r ? G.gold : textSecondary,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "DM Sans,sans-serif",
                        fontWeight: reason === r ? 600 : 400,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    display: "block",
                    marginBottom: 5,
                    fontFamily: "DM Sans,sans-serif",
                    fontWeight: 500,
                  }}
                >
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Tell us more about the issue..."
                  style={{ ...inputStyle, height: 80, resize: "none" }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                style={{
                  background: reason ? G.gold : "#ccc",
                  border: "none",
                  borderRadius: 10,
                  padding: "13px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: G.black,
                  cursor: reason ? "pointer" : "not-allowed",
                  fontFamily: "DM Sans,sans-serif",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bid modal ──────────────────────────────────────────────────
function BidModal({ listing, auction, darkMode, onClose, user, onBidPlaced }) {
  const [bids, setBids] = useState([]);
  const [amount, setAmount] = useState(Number(auction.current_price) + 50000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  useEffect(() => {
    fetch(`${API}/auctions/${auction.id}/bids`, { headers: authHeaders() })
      .then(r => r.json()).then(data => Array.isArray(data) && setBids(data));

    const calc = () => {
      const diff = new Date(auction.ends_at) - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [auction.id, auction.ends_at]);

  const placeBid = async () => {
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(`${API}/auctions/${auction.id}/bid`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setBids(prev => [{ id: Date.now(), bidder_name: user.username, amount, created_at: new Date() }, ...prev]);
        setAmount(amount + 50000);
        onBidPlaced && onBidPlaced(data);
      } else setError(data.error || "Failed to place bid");
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: bg, borderRadius: 18, width: "100%", maxWidth: 520, overflow: "hidden" }}>
        <div style={{ background: G.black, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "DM Sans,sans-serif" }}>{listing.title}</div>
            <div style={{ fontSize: 12, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>⏱ {timeLeft} remaining</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Current price */}
          <div style={{ background: darkMode?G.surface2:G.cream, borderRadius: 12, padding: "16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>Current bid</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>{fmt(auction.current_price)}</div>
              <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>{auction.bid_count || bids.length} bid{(auction.bid_count || bids.length) !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>Starting price</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: textPrimary, fontFamily: "DM Sans,sans-serif" }}>{fmt(auction.starting_price)}</div>
            </div>
          </div>

          {/* Bid input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", display: "block", marginBottom: 6, fontWeight: 500 }}>Your bid (UGX)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                style={{ flex: 1, background: darkMode?G.surface2:G.cream, border: `1px solid ${borderColor}`, borderRadius: 9, padding: "11px 14px", fontSize: 15, color: textPrimary, fontFamily: "DM Sans,sans-serif", outline: "none", fontWeight: 600 }} />
              <button onClick={placeBid} disabled={submitting}
                style={{ background: G.gold, color: G.black, border: "none", borderRadius: 9, padding: "0 22px", fontSize: 14, fontWeight: 700, cursor: submitting?"not-allowed":"pointer", fontFamily: "DM Sans,sans-serif", opacity: submitting?0.7:1 }}>
                {submitting ? "..." : "Bid"}
              </button>
            </div>
            {/* Quick bid buttons */}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[50000, 100000, 200000].map(inc => (
                <button key={inc} onClick={() => setAmount(Number(auction.current_price) + inc)}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${borderColor}`, borderRadius: 8, padding: "6px", fontSize: 11, color: textSecondary, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                  +{fmt(inc).replace("UGX ","")}
                </button>
              ))}
            </div>
            {error && <div style={{ marginTop: 8, fontSize: 13, color: G.red, fontFamily: "DM Sans,sans-serif" }}>{error}</div>}
          </div>

          {/* Bid history */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bid history</div>
            {bids.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: textSecondary, fontSize: 13, fontFamily: "DM Sans,sans-serif" }}>No bids yet — be the first!</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {bids.map((b, i) => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: i===0?(darkMode?"rgba(201,168,76,0.08)":G.goldBg):( darkMode?G.surface2:G.cream), borderRadius: 8, border: i===0?`1px solid rgba(201,168,76,0.2)`:"none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {i===0 && <span style={{ fontSize: 10, fontWeight: 700, color: G.gold }}>👑</span>}
                      <span style={{ fontSize: 13, color: textPrimary, fontFamily: "DM Sans,sans-serif", fontWeight: i===0?600:400 }}>{b.bidder_name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: i===0?G.gold:textPrimary, fontFamily: "DM Sans,sans-serif" }}>{fmt(b.amount)}</div>
                      <div style={{ fontSize: 10, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>{timeAgo(b.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bundles modal ───────────────────────────────────────────────
function BundlesModal({ darkMode, onClose, user, onAuthRequired, showToast }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", bundle_price: "", listing_ids: [] });
  const [creating, setCreating] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;
  const inputStyle = { width: "100%", background: darkMode?G.surface2:G.cream, border:`1px solid ${borderColor}`, borderRadius: 9, padding: "10px 14px", fontSize: 14, color: textPrimary, fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" };

  useEffect(() => {
    fetch(`${API}/bundles`)
      .then(r => r.json()).then(data => { setBundles(Array.isArray(data)?data:[]); setLoading(false); });
  }, []);

  const loadMyListings = async () => {
    const res = await fetch(`${API}/bundles/seller/listings`, { headers: authHeaders() });
    const data = await res.json();
    setMyListings(Array.isArray(data) ? data : []);
  };

  const handleCreate = async () => {
    if (form.listing_ids.length < 2) { alert("Select at least 2 listings"); return; }
    setCreating(true);
    try {
      const res = await fetch(`${API}/bundles`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ title: form.title, description: form.description, bundle_price: Number(form.bundle_price), listing_ids: form.listing_ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setBundles(prev => [data, ...prev]);
        setShowCreate(false);
        setForm({ title: "", description: "", bundle_price: "", listing_ids: [] });
        showToast("Bundle created!");
      } else alert(data.error || "Failed to create bundle");
    } catch { alert("Network error"); }
    finally { setCreating(false); }
  };

  const toggleListing = (id) => {
    setForm(f => ({
      ...f,
      listing_ids: f.listing_ids.includes(id) ? f.listing_ids.filter(i => i !== id) : [...f.listing_ids, id]
    }));
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: bg, borderRadius: 18, width: "100%", maxWidth: 580, overflow: "hidden" }}>
        <div style={{ background: G.black, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: "DM Sans,sans-serif" }}>◈ Bundles</div>
          <div style={{ display: "flex", gap: 8 }}>
            {user && (
              <button onClick={() => { setShowCreate(!showCreate); loadMyListings(); }}
                style={{ background: G.gold, color: G.black, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                + Create
              </button>
            )}
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>

        <div style={{ maxHeight: 580, overflowY: "auto" }}>
          {/* Create form */}
          {showCreate && (
            <div style={{ padding: "16px", borderBottom: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: "DM Sans,sans-serif", marginBottom: 12 }}>Create a bundle</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={inputStyle} placeholder="Bundle title e.g. Full Home Studio Setup" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
                <textarea style={{...inputStyle, height: 60, resize: "none"}} placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
                <input style={inputStyle} type="number" placeholder="Bundle price (UGX)" value={form.bundle_price} onChange={e => setForm(f => ({...f, bundle_price: e.target.value}))} />
                <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", fontWeight: 500 }}>Select listings to bundle (min 2):</div>
                {myListings.length === 0 ? (
                  <div style={{ fontSize: 13, color: G.ink3, fontFamily: "DM Sans,sans-serif", padding: "8px 0" }}>No active listings found. Post some listings first.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {myListings.map(l => (
                      <div key={l.id} onClick={() => toggleListing(l.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: `1px solid ${form.listing_ids.includes(l.id)?G.gold:borderColor}`, background: form.listing_ids.includes(l.id)?(darkMode?G.goldBgDark:G.goldBg):"transparent", cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.listing_ids.includes(l.id)?G.gold:borderColor}`, background: form.listing_ids.includes(l.id)?G.gold:"transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {form.listing_ids.includes(l.id) && <span style={{ fontSize: 10, color: G.black, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
                          <div style={{ fontSize: 11, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>{fmt(l.price)} · {l.condition}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {form.listing_ids.length >= 2 && form.bundle_price && (
                  <div style={{ background: darkMode?G.surface2:G.cream, borderRadius: 9, padding: "10px 14px", fontSize: 13, color: G.gold, fontFamily: "DM Sans,sans-serif", fontWeight: 500 }}>
                    Bundle saves buyers UGX {(myListings.filter(l => form.listing_ids.includes(l.id)).reduce((s,l)=>s+Number(l.price),0) - Number(form.bundle_price)).toLocaleString()}
                  </div>
                )}
                <button onClick={handleCreate} disabled={creating || form.listing_ids.length < 2 || !form.title || !form.bundle_price}
                  style={{ background: G.gold, border: "none", borderRadius: 9, padding: "11px", fontSize: 14, fontWeight: 700, color: G.black, cursor: "pointer", fontFamily: "DM Sans,sans-serif", opacity: creating?0.7:1 }}>
                  {creating ? "Creating..." : "Create bundle"}
                </button>
              </div>
            </div>
          )}

          {/* Bundle list */}
          <div style={{ padding: "16px" }}>
            {loading && <div style={{ textAlign: "center", padding: "40px", color: textSecondary, fontFamily: "DM Sans,sans-serif", fontSize: 13 }}>Loading...</div>}
            {!loading && bundles.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>◈</div>
                <div style={{ fontSize: 15, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>No bundles yet</div>
                <div style={{ fontSize: 13, color: G.ink3, marginTop: 4 }}>Create one to sell multiple items together</div>
              </div>
            )}
            {bundles.map(b => (
              <div key={b.id} style={{ background: darkMode?G.surface2:G.cream, borderRadius: 12, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}
                onClick={() => setSelectedBundle(selectedBundle?.id===b.id ? null : b)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: "DM Sans,sans-serif" }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>by {b.seller} · {b.item_count} items</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>{fmt(b.bundle_price)}</div>
                    {b.original_price && Number(b.original_price) > Number(b.bundle_price) && (
                      <div style={{ fontSize: 11, color: G.green, fontFamily: "DM Sans,sans-serif" }}>
                        Save {fmt(Number(b.original_price) - Number(b.bundle_price))}
                      </div>
                    )}
                  </div>
                </div>
                {b.description && <div style={{ fontSize: 13, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>{b.description}</div>}
                {selectedBundle?.id === b.id && (
                  <BundleDetail bundleId={b.id} darkMode={darkMode} textSecondary={textSecondary} textPrimary={textPrimary} borderColor={borderColor} user={user} onAuthRequired={onAuthRequired} showToast={showToast} onClose={onClose} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BundleDetail({ bundleId, darkMode, textSecondary, textPrimary, borderColor, user, onAuthRequired, showToast, onClose }) {
  const [detail, setDetail] = useState(null);
  const [offerSent, setOfferSent] = useState(false);

  useEffect(() => {
    fetch(`${API}/bundles/${bundleId}`)
      .then(r => r.json()).then(data => !data.error && setDetail(data));
  }, [bundleId]);

  if (!detail) return <div style={{ fontSize: 13, color: textSecondary, fontFamily: "DM Sans,sans-serif", padding: "8px 0" }}>Loading items...</div>;

  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Items in this bundle</div>
      {detail.items.map(item => (
        <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${borderColor}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
            {item.photos?.[0] ? <img src={item.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ListingPlaceholder id={item.id} category={item.category} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: textPrimary, fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
            <div style={{ fontSize: 11, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>{fmt(item.price)} individually</div>
          </div>
        </div>
      ))}
      {!offerSent ? (
        <button onClick={() => { if (!user) { onAuthRequired(); return; } setOfferSent(true); showToast("Bundle offer sent!"); }}
          style={{ width: "100%", marginTop: 12, background: G.gold, color: G.black, border: "none", borderRadius: 9, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
          ◈ Buy bundle — {fmt(detail.bundle_price)}
        </button>
      ) : (
        <div style={{ marginTop: 12, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 9, padding: "12px", textAlign: "center", fontSize: 13, color: G.gold, fontFamily: "DM Sans,sans-serif", fontWeight: 600 }}>
          Bundle offer sent! The seller will contact you.
        </div>
      )}
    </div>
  );
}

// ── Boost modal ─────────────────────────────────────────────────
function BoostModal({ listing, darkMode, onClose, onBoosted, showToast }) {
  const [credits, setCredits] = useState(null);
  const [duration, setDuration] = useState(24);
  const [boosting, setBoosting] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  useEffect(() => {
    fetch(`${API}/boosts/credits`, { headers: authHeaders() })
      .then(r => r.json()).then(data => setCredits(data.credits));
  }, []);

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const res = await fetch(`${API}/boosts/listing/${listing.id}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ duration_hours: duration }),
      });
      const data = await res.json();
      if (res.ok) {
        setBoosted(true);
        setCredits(data.credits_remaining);
        onBoosted && onBoosted();
        showToast('Listing boosted!');
      } else showToast(data.error || 'Failed to boost');
    } catch { showToast('Network error'); }
    finally { setBoosting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: bg, borderRadius: 18, width: "100%", maxWidth: 420, overflow: "hidden" }}>
        <div style={{ background: G.black, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: "DM Sans,sans-serif" }}>⚡ Boost listing</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>
          {boosted ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "DM Sans,sans-serif", marginBottom: 6 }}>Listing boosted!</div>
              <div style={{ fontSize: 13, color: textSecondary, fontFamily: "DM Sans,sans-serif", marginBottom: 20 }}>Your listing will appear at the top of search results for {duration} hours.</div>
              <button onClick={onClose} style={{ background: G.gold, border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, color: G.black, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>Done</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Listing preview */}
              <div style={{ background: darkMode?G.surface2:G.cream, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: "DM Sans,sans-serif" }}>{listing.title}</div>
                <div style={{ fontSize: 12, color: G.gold, fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>{fmt(listing.price)}</div>
              </div>

              {/* Credits */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: darkMode?"rgba(201,168,76,0.08)":G.goldBg, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: "DM Sans,sans-serif" }}>Boost credits</div>
                  <div style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>Each boost uses 1 credit</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>{credits ?? "..."}</div>
              </div>

              {/* Duration */}
              <div>
                <label style={{ fontSize: 12, color: textSecondary, fontFamily: "DM Sans,sans-serif", display: "block", marginBottom: 8, fontWeight: 500 }}>Boost duration</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[6, 24, 48, 72].map(h => (
                    <button key={h} onClick={() => setDuration(h)}
                      style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${duration===h?G.gold:borderColor}`, background: duration===h?(darkMode?G.goldBgDark:G.goldBg):"transparent", color: duration===h?G.gold:textSecondary, fontSize: 12, fontWeight: duration===h?700:400, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* What boosting does */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Appears at top of all listings", "Gold ⚡ Boosted badge on card", "More visibility to buyers", "Higher chance of a quick sale"].map(benefit => (
                  <div key={benefit} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: textSecondary, fontFamily: "DM Sans,sans-serif" }}>
                    <span style={{ color: G.gold, fontSize: 11 }}>✓</span>{benefit}
                  </div>
                ))}
              </div>

              <button onClick={handleBoost} disabled={boosting || credits === 0}
                style={{ background: credits === 0 ? "#ccc" : G.gold, border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, color: G.black, cursor: credits===0?"not-allowed":"pointer", fontFamily: "DM Sans,sans-serif", opacity: boosting?0.7:1 }}>
                {boosting ? "Boosting..." : credits === 0 ? "No credits remaining" : `⚡ Boost for ${duration}h — 1 credit`}
              </button>
              {credits === 0 && (
                <div style={{ fontSize: 12, color: textSecondary, textAlign: "center", fontFamily: "DM Sans,sans-serif" }}>
                  You've used all your free credits. More credits coming in Phase 5 with payments.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Security Centre ─────────────────────────────────────────────
function SecurityCentre({ darkMode, onClose, user, showToast }) {
  const [trustData, setTrustData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [twoFAStatus, setTwoFAStatus] = useState(null);
  const [twoFASetup, setTwoFASetup] = useState(null);
  const [totpInput, setTotpInput] = useState('');
  const [activeTab, setActiveTab] = useState('trust');
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? G.surface : '#fff';
  const textPrimary = darkMode ? '#fff' : G.ink;
  const textSecondary = darkMode ? 'rgba(255,255,255,0.5)' : G.ink2;
  const borderColor = darkMode ? G.borderDark : G.border;

  useEffect(() => {
    const load = async () => {
      try {
        const [trust, devs, history, tfa] = await Promise.all([
          fetch(`${API}/trust/me`, { headers: authHeaders() }).then(r => r.json()),
          fetch(`${API}/trust/devices`, { headers: authHeaders() }).then(r => r.json()),
          fetch(`${API}/trust/login-history`, { headers: authHeaders() }).then(r => r.json()),
          fetch(`${API}/2fa/status`, { headers: authHeaders() }).then(r => r.json()),
        ]);
        setTrustData(trust);
        setDevices(Array.isArray(devs) ? devs : []);
        setLoginHistory(Array.isArray(history) ? history : []);
        setTwoFAStatus(tfa);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSetup2FA = async () => {
    try {
      const res = await fetch(`${API}/2fa/setup`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setTwoFASetup(data);
      else showToast(data.error || 'Failed to setup 2FA');
    } catch { showToast('Network error'); }
  };

  const handleEnable2FA = async () => {
    try {
      const res = await fetch(`${API}/2fa/enable`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ token: totpInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAStatus({ enabled: true });
        setTwoFASetup(null);
        setTotpInput('');
        showToast('2FA enabled successfully!');
      } else showToast(data.error || 'Invalid code');
    } catch { showToast('Network error'); }
  };

  const handleDisable2FA = async () => {
    const code = prompt('Enter your authenticator code to disable 2FA:');
    if (!code) return;
    try {
      const res = await fetch(`${API}/2fa/disable`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ token: code }),
      });
      const data = await res.json();
      if (res.ok) { setTwoFAStatus({ enabled: false }); showToast('2FA disabled'); }
      else showToast(data.error || 'Invalid code');
    } catch { showToast('Network error'); }
  };

  const handleRemoveDevice = async (id) => {
    try {
      await fetch(`${API}/trust/devices/${id}`, { method: 'DELETE', headers: authHeaders() });
      setDevices(prev => prev.filter(d => d.id !== id));
      showToast('Device removed');
    } catch { showToast('Network error'); }
  };

  const getTrustColor = (score) => {
    if (score >= 80) return '#A0C4FF';
    if (score >= 60) return G.gold;
    if (score >= 40) return '#9E9E9E';
    if (score >= 20) return '#CD7F32';
    return G.ink3;
  };

  const tabs = ['trust', '2fa', 'devices', 'history'];

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ background: bg, borderRadius: 18, width: '100%', maxWidth: 580, overflow: 'hidden' }}>
        <div style={{ background: G.black, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: 'DM Sans,sans-serif' }}>🔐 Security Centre</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans,sans-serif', marginTop: 2 }}>{user?.username}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${borderColor}` }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ flex: 1, padding: '12px 6px', background: 'transparent', border: 'none', borderBottom: activeTab===t?`2px solid ${G.gold}`:'2px solid transparent', fontSize: 12, fontWeight: activeTab===t?600:400, color: activeTab===t?G.gold:textSecondary, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', textTransform: 'capitalize' }}>
              {t === '2fa' ? '2FA' : t === 'history' ? 'Login history' : t}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: textSecondary, fontFamily: 'DM Sans,sans-serif', fontSize: 13 }}>Loading...</div>}

          {!loading && activeTab === 'trust' && trustData && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', border: `4px solid ${getTrustColor(trustData.score)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', background: darkMode?G.surface2:G.cream }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: getTrustColor(trustData.score), fontFamily: 'DM Sans,sans-serif', lineHeight: 1 }}>{trustData.score}</div>
                  <div style={{ fontSize: 10, color: textSecondary, fontFamily: 'DM Sans,sans-serif' }}>/ 100</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: getTrustColor(trustData.score), fontFamily: 'DM Sans,sans-serif' }}>{trustData.level?.level} Seller</div>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 4, fontFamily: 'DM Sans,sans-serif' }}>Your trust score is visible to buyers</div>
              </div>

              {trustData.breakdown && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Rating score', value: trustData.breakdown.rating_score, max: 30, desc: 'Based on your seller ratings' },
                    { label: 'Verification score', value: trustData.breakdown.verification_score, max: 25, desc: 'Phone +10pts, ID +15pts' },
                    { label: 'Activity score', value: trustData.breakdown.activity_score, max: 20, desc: 'Based on completed sales' },
                    { label: 'Account age', value: trustData.breakdown.age_score, max: 15, desc: 'Months on Alsel (max 15)' },
                    { label: 'Response rate', value: trustData.breakdown.response_score, max: 10, desc: 'How quickly you respond to offers' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: textPrimary, fontFamily: 'DM Sans,sans-serif' }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontFamily: 'DM Sans,sans-serif', color: G.gold }}>{item.value}/{item.max}</span>
                      </div>
                      <div style={{ height: 6, background: darkMode?G.surface2:G.cream, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(item.value/item.max)*100}%`, background: G.gold, borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: textSecondary, marginTop: 2, fontFamily: 'DM Sans,sans-serif' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 20, padding: '14px 16px', background: darkMode?G.surface2:G.cream, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: 'DM Sans,sans-serif', marginBottom: 10 }}>Verification status</div>
                {[
                  { label: 'Email', verified: true, pts: 0 },
                  { label: 'Government ID', verified: trustData.user?.is_verified, pts: 15 },
                  { label: 'Two-factor auth', verified: trustData.user?.two_fa_enabled, pts: 0 },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${borderColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: item.verified ? G.green : G.ink3 }}>{item.verified ? '✓' : '○'}</span>
                      <span style={{ fontSize: 13, color: textPrimary, fontFamily: 'DM Sans,sans-serif' }}>{item.label}</span>
                    </div>
                    {item.pts > 0 && !item.verified && (
                      <span style={{ fontSize: 11, color: G.gold, fontFamily: 'DM Sans,sans-serif' }}>+{item.pts} pts</span>
                    )}
                    {item.verified && <span style={{ fontSize: 11, color: G.green, fontFamily: 'DM Sans,sans-serif' }}>Verified</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && activeTab === '2fa' && (
            <div>
              <div style={{ padding: '14px 16px', background: darkMode?G.surface2:G.cream, borderRadius: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: 'DM Sans,sans-serif' }}>Two-factor authentication</div>
                    <div style={{ fontSize: 12, color: textSecondary, marginTop: 2, fontFamily: 'DM Sans,sans-serif' }}>
                      {twoFAStatus?.enabled ? 'Your account is protected with 2FA' : 'Add an extra layer of security to your account'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: twoFAStatus?.enabled ? 'rgba(61,214,140,0.15)' : 'rgba(255,255,255,0.05)', color: twoFAStatus?.enabled ? G.green : G.ink3 }}>
                    {twoFAStatus?.enabled ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </div>

              {!twoFAStatus?.enabled && !twoFASetup && (
                <button onClick={handleSetup2FA}
                  style={{ width: '100%', background: G.gold, border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, color: G.black, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
                  Set up 2FA with Authenticator app
                </button>
              )}

              {twoFASetup && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 13, color: textSecondary, fontFamily: 'DM Sans,sans-serif', lineHeight: 1.6 }}>
                    1. Install Google Authenticator or Authy on your phone<br/>
                    2. Scan the QR code below<br/>
                    3. Enter the 6-digit code to confirm
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <img src={twoFASetup.qr_code} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 12, background: '#fff', padding: 8 }} />
                  </div>
                  <div style={{ padding: '10px 14px', background: darkMode?G.surface2:G.cream, borderRadius: 9, fontSize: 12, fontFamily: 'DM Sans,sans-serif', color: textSecondary, wordBreak: 'break-all' }}>
                    Manual entry: <span style={{ color: G.gold, userSelect: 'all' }}>{twoFASetup.secret}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: textSecondary, fontFamily: 'DM Sans,sans-serif', display: 'block', marginBottom: 6 }}>Enter the 6-digit code from your app</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={totpInput} onChange={e => setTotpInput(e.target.value)} maxLength={6}
                        placeholder="000000"
                        style={{ flex: 1, background: darkMode?G.surface2:G.cream, border: `1px solid ${borderColor}`, borderRadius: 9, padding: '11px 14px', fontSize: 18, color: textPrimary, fontFamily: 'DM Sans,sans-serif', outline: 'none', letterSpacing: 8, textAlign: 'center' }} />
                      <button onClick={handleEnable2FA} disabled={totpInput.length !== 6}
                        style={{ background: G.gold, border: 'none', borderRadius: 9, padding: '0 20px', fontSize: 14, fontWeight: 700, color: G.black, cursor: totpInput.length !== 6 ? 'not-allowed' : 'pointer', opacity: totpInput.length !== 6 ? 0.5 : 1 }}>
                        Verify
                      </button>
                    </div>
                  </div>
                  {twoFASetup.backup_codes && (
                    <div style={{ padding: '14px 16px', background: darkMode?'rgba(201,168,76,0.08)':G.goldBg, border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.gold, marginBottom: 8, fontFamily: 'DM Sans,sans-serif' }}>⚠ Save your backup codes</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {twoFASetup.backup_codes.map(c => (
                          <div key={c} style={{ fontSize: 12, fontFamily: 'DM Sans,sans-serif', color: textPrimary, background: darkMode?G.surface2:G.cream, padding: '4px 8px', borderRadius: 6, letterSpacing: 2 }}>{c}</div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: textSecondary, marginTop: 8, fontFamily: 'DM Sans,sans-serif' }}>Store these somewhere safe. Each can only be used once if you lose your phone.</div>
                    </div>
                  )}
                </div>
              )}

              {twoFAStatus?.enabled && (
                <button onClick={handleDisable2FA}
                  style={{ width: '100%', background: 'transparent', border: `1.5px solid rgba(224,80,80,0.4)`, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, color: G.red, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
                  Disable 2FA
                </button>
              )}
            </div>
          )}

          {!loading && activeTab === 'devices' && (
            <div>
              <div style={{ fontSize: 13, color: textSecondary, fontFamily: 'DM Sans,sans-serif', marginBottom: 16 }}>
                These devices have logged into your account. Remove any you don't recognise.
              </div>
              {devices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: textSecondary, fontFamily: 'DM Sans,sans-serif', fontSize: 13 }}>No devices recorded</div>
              ) : devices.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${borderColor}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: darkMode?G.surface2:G.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {d.user_agent?.includes('Mobile') ? '📱' : '💻'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: textPrimary, fontFamily: 'DM Sans,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.user_agent?.slice(0, 60) || 'Unknown device'}
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, fontFamily: 'DM Sans,sans-serif', marginTop: 2 }}>
                      IP: {d.ip_address} · Last seen: {d.last_seen ? new Date(d.last_seen).toLocaleDateString() : 'Unknown'}
                    </div>
                    {d.trusted && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'rgba(61,214,140,0.1)', color: G.green, fontFamily: 'DM Sans,sans-serif' }}>Trusted</span>}
                  </div>
                  <button onClick={() => handleRemoveDevice(d.id)}
                    style={{ background: 'rgba(224,80,80,0.1)', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, color: G.red, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', flexShrink: 0 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === 'history' && (
            <div>
              <div style={{ fontSize: 13, color: textSecondary, fontFamily: 'DM Sans,sans-serif', marginBottom: 16 }}>
                Recent login activity on your account.
              </div>
              {loginHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: textSecondary, fontFamily: 'DM Sans,sans-serif', fontSize: 13 }}>No login history</div>
              ) : loginHistory.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < loginHistory.length-1 ? `1px solid ${borderColor}` : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.status === 'success' || h.status === 'success_2fa' ? G.green : G.red, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: textPrimary, fontFamily: 'DM Sans,sans-serif' }}>
                      {h.status === 'success' ? 'Successful login' : h.status === 'success_2fa' ? 'Login with 2FA' : 'Failed login attempt'}
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, fontFamily: 'DM Sans,sans-serif' }}>
                      IP: {h.ip_address || 'Unknown'} · {new Date(h.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: h.status.includes('success') ? 'rgba(61,214,140,0.1)' : 'rgba(224,80,80,0.1)', color: h.status.includes('success') ? G.green : G.red }}>
                    {h.status.includes('success') ? 'OK' : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth modal ─────────────────────────────────────────────────
function AuthModal({ darkMode, onClose, onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? "rgba(255,255,255,0.08)" : G.border;
  const inputStyle = {
    width: "100%",
    background: darkMode ? G.surface2 : G.cream,
    border: `1px solid ${borderColor}`,
    borderRadius: 9,
    padding: "11px 14px",
    fontSize: 14,
    color: textPrimary,
    fontFamily: "DM Sans,sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : {
              email: form.email,
              username: form.username,
              password: form.password,
            };
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      localStorage.setItem("alsel_token", data.token);
      localStorage.setItem("alsel_user", JSON.stringify(data.user));
      onAuth(data.user);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 420,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: G.gold,
              fontFamily: "DM Sans,sans-serif",
              letterSpacing: -0.5,
            }}
          >
            al<span style={{ color: "#fff" }}>sel</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{ display: "flex", borderBottom: `1px solid ${borderColor}` }}
        >
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "14px",
                background: "transparent",
                border: "none",
                borderBottom:
                  mode === m ? `2px solid ${G.gold}` : "2px solid transparent",
                fontSize: 14,
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? G.gold : textSecondary,
                cursor: "pointer",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <button
            onClick={() =>
              (window.location.href = `${API.replace("/api", "")}/api/auth/google`)
            }
            style={{
              width: "100%",
              background: "#fff",
              border: "1.5px solid #DADCE0",
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "DM Sans,sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "#3C4043",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                height: 1,
                background: darkMode ? "rgba(255,255,255,0.08)" : G.border,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: G.ink3,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              or
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: darkMode ? "rgba(255,255,255,0.08)" : G.border,
              }}
            />
          </div>
          {mode === "register" && (
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: textSecondary,
                  display: "block",
                  marginBottom: 5,
                  fontFamily: "DM Sans,sans-serif",
                  fontWeight: 500,
                }}
              >
                Username
              </label>
              <input
                style={inputStyle}
                placeholder="e.g. johndoe"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
          )}
          <div>
            <label
              style={{
                fontSize: 12,
                color: textSecondary,
                display: "block",
                marginBottom: 5,
                fontFamily: "DM Sans,sans-serif",
                fontWeight: 500,
              }}
            >
              Email
            </label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: textSecondary,
                display: "block",
                marginBottom: 5,
                fontFamily: "DM Sans,sans-serif",
                fontWeight: 500,
              }}
            >
              Password
            </label>
            <input
              style={inputStyle}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {error && (
            <div
              style={{
                background: "rgba(220,50,50,0.1)",
                border: "1px solid rgba(220,50,50,0.3)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#E05050",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: G.gold,
              color: G.black,
              border: "none",
              borderRadius: 10,
              padding: "13px",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "DM Sans,sans-serif",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Location picker ────────────────────────────────────────────
function LocationPicker({ value, onChange }) {
  function ClickHandler() {
    useMapEvents({
      click(e) {
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  }
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : [0.3476, 32.5825]}
      zoom={12}
      style={{ height: 200, width: "100%", borderRadius: 10, zIndex: 1 }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler />
      {value && <Marker position={[value.lat, value.lng]} />}
    </MapContainer>
  );
}

// ── Edit listing modal ───────────────────────────────────────────
function EditListingModal({ listing, darkMode, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    price: listing.price || '',
    category: listing.category || 'electronics',
    condition: listing.condition || 'Used',
    location: listing.location || '',
    photos: listing.photos || [],
  });
  const [saving, setSaving] = useState(false);
  const bg = darkMode ? G.surface : '#fff';
  const textPrimary = darkMode ? '#fff' : G.ink;
  const textSecondary = darkMode ? 'rgba(255,255,255,0.5)' : G.ink2;
  const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : G.border;
  const inputStyle = {
    width: '100%', background: darkMode ? G.surface2 : G.cream,
    border: `1px solid ${borderColor}`, borderRadius: 9,
    padding: '11px 14px', fontSize: 14, color: textPrimary,
    fontFamily: 'DM Sans,sans-serif', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 12, color: textSecondary, fontFamily: 'DM Sans,sans-serif',
    display: 'block', marginBottom: 5, fontWeight: 500,
  };

  const handleSave = async () => {
    if (!form.title || !form.price) {
      showToast('Title and price are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: Number(form.price),
          category: form.category,
          condition: form.condition,
          location: form.location,
          photos: form.photos,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data);
        showToast('Listing updated!');
        onClose();
      } else {
        showToast(data.error || 'Failed to update listing');
      }
    } catch {
      showToast('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ background: bg, borderRadius: 18, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: G.black, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'DM Sans,sans-serif' }}>Edit listing</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Photos */}
          <div>
            <label style={labelStyle}>Photos</label>
            {form.photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 8 }}>
                {form.photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                      style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div onClick={() => document.getElementById('edit-photo-input').click()}
              style={{ border: `2px dashed ${darkMode ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.4)'}`, borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, color: textSecondary, fontFamily: 'DM Sans,sans-serif' }}>+ Add more photos</div>
            </div>
            <input id="edit-photo-input" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple style={{ display: 'none' }}
              onChange={async (e) => {
                const files = Array.from(e.target.files);
                if (!files.length) return;
                const remaining = 10 - form.photos.length;
                if (remaining <= 0) { showToast('Maximum 10 photos'); return; }
                const toUpload = files.slice(0, remaining);
                const uploaded = [];
                for (const file of toUpload) {
                  const fd = new FormData();
                  fd.append('images', file);
                  try {
                    const res = await fetch(`${API}/images`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${localStorage.getItem('alsel_token')}` },
                      body: fd,
                    });
                    const data = await res.json();
                    if (data.urls) uploaded.push(...data.urls);
                  } catch (err) { console.error(err); }
                }
                if (uploaded.length) setForm(f => ({ ...f, photos: [...f.photos, ...uploaded].slice(0, 10) }));
                e.target.value = '';
              }}
            />
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Listing title" />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, height: 100, resize: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your item..." />
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Price (UGX)</label>
            <input style={inputStyle} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            {form.price && <div style={{ fontSize: 11, color: G.gold, marginTop: 4, fontFamily: 'DM Sans,sans-serif' }}>{fmt(Number(form.price))}</div>}
          </div>

          {/* Condition */}
          <div>
            <label style={labelStyle}>Condition</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Brand new', 'Like new', 'Used', 'For parts'].map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, condition: c }))}
                  style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${form.condition === c ? G.gold : borderColor}`, background: form.condition === c ? (darkMode ? G.goldBgDark : G.goldBg) : 'transparent', color: form.condition === c ? G.gold : textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: form.condition === c ? 600 : 400 }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Kampala, Entebbe..." />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['active', 'paused', 'sold'].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1px solid ${(form.status || 'active') === s ? G.gold : borderColor}`, background: (form.status || 'active') === s ? (darkMode ? G.goldBgDark : G.goldBg) : 'transparent', color: (form.status || 'active') === s ? G.gold : textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: (form.status || 'active') === s ? 600 : 400, textTransform: 'capitalize' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${borderColor}`, borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, color: textSecondary, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, background: G.gold, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: G.black, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans,sans-serif', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sell modal ─────────────────────────────────────────────────
function SellModal({ darkMode, onClose, onPost }) {
  const [step, setStep] = useState(1);
  const [sellMode, setSellMode] = useState("fixed");
  const [auctionForm, setAuctionForm] = useState({ duration_hours: 24, reserve_price: "" });
  const [form, setForm] = useState({
    title: "",
    category: "electronics",
    price: "",
    condition: "Brand new",
    location: "",
    description: "",
    latitude: null,
    longitude: null,
    photos: [],
  });
  const bg = darkMode ? G.surface : "#fff";
  const textPrimary = darkMode ? "#fff" : G.ink;
  const textSecondary = darkMode ? "rgba(255,255,255,0.5)" : G.ink2;
  const borderColor = darkMode ? "rgba(255,255,255,0.08)" : G.border;
  const inputStyle = {
    width: "100%",
    background: darkMode ? G.surface2 : G.cream,
    border: `1px solid ${borderColor}`,
    borderRadius: 9,
    padding: "11px 14px",
    fontSize: 14,
    color: textPrimary,
    fontFamily: "DM Sans,sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 12,
    color: textSecondary,
    fontFamily: "DM Sans,sans-serif",
    display: "block",
    marginBottom: 5,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 18,
          width: "100%",
          maxWidth: 500,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: G.black,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "DM Sans,sans-serif",
            }}
          >
            Post a listing
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: "flex",
            padding: "0 24px",
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          {["Details", "Pricing", "Post"].map((s, i) => (
            <div
              key={s}
              onClick={() => i + 1 < step && setStep(i + 1)}
              style={{
                flex: 1,
                padding: "14px 0",
                textAlign: "center",
                borderBottom:
                  step === i + 1
                    ? `2px solid ${G.gold}`
                    : "2px solid transparent",
                fontSize: 13,
                fontWeight: step === i + 1 ? 600 : 400,
                color: step === i + 1 ? G.gold : textSecondary,
                fontFamily: "DM Sans,sans-serif",
                cursor: i + 1 < step ? "pointer" : "default",
              }}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Sell mode toggle */}
        <div style={{ display: "flex", gap: 8, padding: "16px 24px 0" }}>
          {[["fixed","Fixed price"],["auction","Auction"]].map(([mode, label]) => (
            <button key={mode} onClick={() => setSellMode(mode)}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${sellMode===mode?G.gold:borderColor}`, background: sellMode===mode?(darkMode?G.goldBgDark:G.goldBg):"transparent", color: sellMode===mode?G.gold:textSecondary, fontSize: 13, fontWeight: sellMode===mode?700:400, cursor: "pointer", fontFamily: "DM Sans,sans-serif", transition: "all 0.15s" }}>
              {mode === "auction" ? "⏱ " : "◈ "}{label}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>
                  Photos{" "}
                  <span style={{ fontWeight: 400, color: G.ink3 }}>
                    (up to 10)
                  </span>
                </label>
                <div
                  onClick={() => document.getElementById("photo-input").click()}
                  style={{
                    border: `2px dashed ${darkMode ? "rgba(201,168,76,0.3)" : "rgba(201,168,76,0.5)"}`,
                    borderRadius: 12,
                    padding: "16px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {form.photos && form.photos.length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(80px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {form.photos.map((url, i) => (
                        <div
                          key={i}
                          style={{
                            position: "relative",
                            aspectRatio: "1",
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm((f) => ({
                                ...f,
                                photos: f.photos.filter((_, j) => j !== i),
                              }));
                            }}
                            style={{
                              position: "absolute",
                              top: 3,
                              right: 3,
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "rgba(0,0,0,0.6)",
                              border: "none",
                              color: "#fff",
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {form.photos.length < 10 && (
                        <div
                          style={{
                            aspectRatio: "1",
                            borderRadius: 8,
                            border: `1px dashed ${G.gold}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: G.gold,
                            fontSize: 20,
                            opacity: 0.5,
                          }}
                        >
                          +
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: "20px 0" }}>
                      <div
                        style={{ fontSize: 24, opacity: 0.3, marginBottom: 6 }}
                      >
                        ◈
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: textSecondary,
                          fontFamily: "DM Sans,sans-serif",
                        }}
                      >
                        Tap to add photos
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: G.ink3,
                          marginTop: 2,
                          fontFamily: "DM Sans,sans-serif",
                        }}
                      >
                        JPG, PNG or WebP · max 10MB each
                      </div>
                    </div>
                  )}
                </div>
                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (!files.length) return;

                    // Check we don't exceed 10 photos
                    const remaining = 10 - (form.photos?.length || 0);
                    if (remaining <= 0) { alert("Maximum 10 photos reached"); e.target.value = ''; return; }
                    const toUpload = files.slice(0, remaining);

                    // Upload each file individually to avoid timeout
                    const uploaded = [];
                    for (const file of toUpload) {
                      const fd = new FormData();
                      fd.append('images', file);
                      try {
                        const res = await fetch(`${API}/images`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${localStorage.getItem('alsel_token')}` },
                          body: fd,
                        });
                        const data = await res.json();
                        if (data.urls) uploaded.push(...data.urls);
                      } catch (err) {
                        console.error('Upload error:', err);
                      }
                    }

                    if (uploaded.length > 0) {
                      setForm(f => ({ ...f, photos: [...(f.photos || []), ...uploaded].slice(0, 10) }));
                    }
                    e.target.value = '';
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Listing title</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. iPhone 14 Pro..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <div style={{ position: "relative" }}>
                  <textarea
                    style={{
                      ...inputStyle,
                      height: 90,
                      resize: "none",
                      paddingRight: 100,
                    }}
                    placeholder="Describe your item or click Generate..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                  <button
                    onClick={async () => {
                      if (!form.title) {
                        alert("Enter a title first");
                        return;
                      }
                      setForm((f) => ({ ...f, description: "Generating..." }));
                      try {
                        const res = await fetch(`${API}/ai/describe`, {
                          method: "POST",
                          headers: authHeaders(),
                          body: JSON.stringify({
                            title: form.title,
                            category: form.category,
                            condition: form.condition,
                            price: form.price,
                          }),
                        });
                        const data = await res.json();
                        setForm((f) => ({
                          ...f,
                          description: data.description || "",
                        }));
                      } catch {
                        setForm((f) => ({ ...f, description: "" }));
                      }
                    }}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: G.gold,
                      color: G.black,
                      border: "none",
                      borderRadius: 7,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    ✦ Generate
                  </button>
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Price (UGX)</label>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <button
                  onClick={async () => {
                    if (!form.title) {
                      alert("Enter a title first");
                      return;
                    }
                    try {
                      const res = await fetch(`${API}/ai/price`, {
                        method: "POST",
                        headers: authHeaders(),
                        body: JSON.stringify({
                          title: form.title,
                          category: form.category,
                          condition: form.condition,
                        }),
                      });
                      const data = await res.json();
                      if (data.suggested) {
                        setForm((f) => ({
                          ...f,
                          price: String(data.suggested),
                        }));
                        alert(
                          `Suggested range: UGX ${data.min?.toLocaleString()} – ${data.max?.toLocaleString()}`,
                        );
                      }
                    } catch {
                      alert("Could not suggest price");
                    }
                  }}
                  style={{
                    marginTop: 6,
                    background: "transparent",
                    border: `1px solid rgba(201,168,76,0.4)`,
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 12,
                    color: G.gold,
                    cursor: "pointer",
                    fontFamily: "DM Sans,sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  ✦ Suggest price with AI
                </button>
              </div>
              {sellMode === "auction" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 14px", background: darkMode?G.surface2:G.cream, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: G.gold, fontFamily: "DM Sans,sans-serif" }}>⏱ Auction settings</div>
                  <div>
                    <label style={labelStyle}>Duration</label>
                    <select style={{...inputStyle, cursor: "pointer"}} value={auctionForm.duration_hours} onChange={e => setAuctionForm(f => ({...f, duration_hours: Number(e.target.value)}))}>
                      <option value={1}>1 hour</option>
                      <option value={6}>6 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>2 days</option>
                      <option value={72}>3 days</option>
                      <option value={168}>7 days</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Reserve price (optional)</label>
                    <input style={inputStyle} type="number" placeholder="Minimum price to sell"
                      value={auctionForm.reserve_price} onChange={e => setAuctionForm(f => ({...f, reserve_price: e.target.value}))} />
                    <div style={{ fontSize: 11, color: G.ink3, marginTop: 4, fontFamily: "DM Sans,sans-serif" }}>If no bid meets this price, item won't sell</div>
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Location name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Kampala, Entebbe..."
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Pin on map{" "}
                  <span style={{ fontWeight: 400, color: G.ink3 }}>
                    (tap to place)
                  </span>
                </label>
                <LocationPicker
                  value={
                    form.latitude
                      ? { lat: form.latitude, lng: form.longitude }
                      : null
                  }
                  onChange={({ lat, lng }) =>
                    setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
                  }
                />
                {form.latitude && (
                  <div
                    style={{
                      fontSize: 11,
                      color: G.ink3,
                      marginTop: 4,
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                  </div>
                )}
              </div>
              <div
                style={{
                  background: darkMode ? G.surface2 : G.cream,
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    marginBottom: 2,
                    fontFamily: "DM Sans,sans-serif",
                  }}
                >
                  Preview price
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: darkMode ? G.gold : G.ink,
                    fontFamily: "DM Sans,sans-serif",
                  }}
                >
                  {form.price ? fmt(Number(form.price)) : "UGX —"}
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: G.goldBg,
                  border: `2px solid ${G.gold}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  fontSize: 28,
                }}
              >
                {sellMode === "auction" ? "⏱" : "◈"}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: textPrimary,
                  fontFamily: "DM Sans,sans-serif",
                  marginBottom: 6,
                }}
              >
                Ready to post
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: textSecondary,
                  fontFamily: "DM Sans,sans-serif",
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Your listing{" "}
                <strong style={{ color: textPrimary }}>
                  {form.title || "Untitled"}
                </strong>{" "}
                will go live immediately.
              </div>
              <div
                style={{
                  background: darkMode ? G.surface2 : G.cream,
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 20,
                  textAlign: "left",
                }}
              >
                {[
                  [
                    "Category",
                    CATEGORIES.find((c) => c.id === form.category)?.label,
                  ],
                  [sellMode === "auction" ? "Starting bid" : "Price", form.price ? fmt(Number(form.price)) : "—"],
                  ["Condition", form.condition],
                  ["Location", form.location || "—"],
                  ...(sellMode === "auction" ? [["Duration", `${auctionForm.duration_hours}h`]] : []),
                  ...(sellMode === "auction" && auctionForm.reserve_price ? [["Reserve", fmt(Number(auctionForm.reserve_price))]] : []),
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      fontSize: 13,
                      fontFamily: "DM Sans,sans-serif",
                    }}
                  >
                    <span style={{ color: textSecondary }}>{k}</span>
                    <span style={{ color: textPrimary, fontWeight: 500 }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: textSecondary,
                  cursor: "pointer",
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                style={{
                  flex: 2,
                  background: G.gold,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: G.black,
                  cursor: "pointer",
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={() => { onPost(form, sellMode, auctionForm); onClose(); }}
                style={{
                  flex: 2,
                  background: G.gold,
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: G.black,
                  cursor: "pointer",
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                {sellMode === "auction" ? "Start auction ⏱" : "Post listing ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function Alsel() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('alsel_darkmode');
    return saved !== null ? saved === 'true' : true;
  });
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [condition, setCondition] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [nearMe, setNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showSell, setShowSell] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [showBundles, setShowBundles] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [reportListing, setReportListing] = useState(null);
  const [bidListing, setBidListing] = useState(null);
  const [bidAuction, setBidAuction] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [favs, setFavs] = useState([]);
  const [listings, setListings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("alsel_user"));
    } catch {
      return null;
    }
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Handle Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userParam = params.get("user");
    if (token && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem("alsel_token", token);
        localStorage.setItem("alsel_user", JSON.stringify(userData));
        setUser(userData);
        showToast(`Welcome, ${userData.username}!`);
        window.history.replaceState({}, "", "/");
      } catch (err) {
        console.error("OAuth redirect error:", err);
      }
    }
  }, []);

  // Fetch listings
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== "all") params.append("category", category);
        if (condition !== "All") params.append("condition", condition);
        if (activeSearch) params.append("q", activeSearch);
        if (sort) params.append("sort", sort);
        if (nearMe && userCoords) {
          params.append("lat", userCoords.lat);
          params.append("lng", userCoords.lng);
          params.append("radius", "20");
        }
        params.append("page", page);
        const res = await fetch(`${API}/listings?${params}`);
        const data = await res.json();
        if (data.listings) {
          setListings(data.listings);
          setTotalCount(data.total || 0);
          setTotalPages(data.pages || 1);
        } else {
          setListings(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [category, condition, activeSearch, sort, nearMe, userCoords, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [category, condition, activeSearch, sort, nearMe, userCoords]);

  // Fetch unread notifications
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API}/notifications`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (Array.isArray(data))
          setUnreadCount(data.filter((n) => !n.read).length);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch favourites
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/favourites`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFavs(data.map((f) => f.id));
      });
  }, [user]);

  useEffect(() => {
    localStorage.setItem('alsel_darkmode', darkMode);
  }, [darkMode]);

  const toggleFav = async (id) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    const isFaved = favs.includes(id);
    setFavs((prev) => (isFaved ? prev.filter((f) => f !== id) : [...prev, id]));
    try {
      if (isFaved)
        await fetch(`${API}/favourites/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      else
        await fetch(`${API}/favourites`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ listing_id: id }),
        });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (override) =>
    setActiveSearch(typeof override === "string" ? override : searchQuery);
  const handleAuth = (userData) => {
    setUser(userData);
    showToast(`Welcome, ${userData.username}!`);
    setUnreadCount(0);
  };
  const handleLogout = () => {
    localStorage.removeItem("alsel_token");
    localStorage.removeItem("alsel_user");
    setUser(null);
    setFavs([]);
    setUnreadCount(0);
    showToast("Signed out");
  };

  const handlePost = async (form, sellMode, auctionForm) => {
    const token = localStorage.getItem("alsel_token");
    if (!token) { showToast("Please sign in"); setShowAuth(true); return; }
    try {
      const endpoint = sellMode === "auction" ? `${API}/auctions` : `${API}/listings`;
      const body = sellMode === "auction"
        ? { title: form.title, description: form.description, category: form.category, condition: form.condition, location: form.location, photos: form.photos||[], starting_price: Number(form.price), reserve_price: auctionForm.reserve_price ? Number(auctionForm.reserve_price) : null, duration_hours: auctionForm.duration_hours }
        : { title: form.title, description: form.description, price: Number(form.price), category: form.category, condition: form.condition, location: form.location, latitude: form.latitude, longitude: form.longitude, photos: form.photos||[] };
      const res = await fetch(endpoint, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        const newListing = sellMode === "auction" ? data.listing : data;
        setListings(prev => [newListing, ...prev]);
        showToast(sellMode === "auction" ? "Auction started!" : "Listing posted!");
      } else showToast(data.error || "Failed to post");
    } catch { showToast("Network error"); }
  };

  const handleOpenListing = (listing) => {
    if (listing.is_auction) {
      setBidListing(listing);
      fetch(`${API}/auctions/listing/${listing.id}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => setBidAuction(data))
        .catch(() => setSelectedListing(listing));
    } else {
      setSelectedListing(listing);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: darkMode ? G.black : G.cream,
        fontFamily: "DM Sans,sans-serif",
        transition: "background 0.3s",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {selectedListing && !showSell && !showAuth && !activeChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <ListingDetail
            listing={selectedListing}
            darkMode={darkMode}
            onClose={() => setSelectedListing(null)}
            isFaved={favs.includes(selectedListing.id)}
            onFave={toggleFav}
            user={user}
            onMakeOffer={() => showToast("Offer sent!")}
            onAuthRequired={() => setShowAuth(true)}
            onReport={(l) => {
              setSelectedListing(null);
              setReportListing(l);
            }}
            showToast={showToast}
          />
        </div>
      )}
      {showSell && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <SellModal
            darkMode={darkMode}
            onClose={() => setShowSell(false)}
            onPost={handlePost}
          />
        </div>
      )}
      {showSecurity && (
        <div style={{ position:"fixed", inset:0, zIndex:200, overflowY:"auto" }}>
          <SecurityCentre darkMode={darkMode} onClose={() => setShowSecurity(false)} user={user} showToast={showToast} />
        </div>
      )}
      {showAuth && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <AuthModal
            darkMode={darkMode}
            onClose={() => setShowAuth(false)}
            onAuth={handleAuth}
          />
        </div>
      )}
      {showNotifications && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <NotificationsModal
            darkMode={darkMode}
            onClose={() => {
              setShowNotifications(false);
              setUnreadCount(0);
            }}
          />
        </div>
      )}
      {showOffers && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <OffersModal
            darkMode={darkMode}
            onClose={() => setShowOffers(false)}
            user={user}
            onOpenChat={(offer) => {
              setShowOffers(false);
              setActiveChat(offer);
            }}
          />
        </div>
      )}
      {showFavourites && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <FavouritesModal
            darkMode={darkMode}
            onClose={() => setShowFavourites(false)}
            onOpen={handleOpenListing}
          />
        </div>
      )}
      {bidListing && bidAuction && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <BidModal
            listing={bidListing}
            auction={bidAuction}
            darkMode={darkMode}
            onClose={() => { setBidListing(null); setBidAuction(null); }}
            user={user}
            onBidPlaced={() => {
              fetch(`${API}/auctions/${bidAuction.id}`, { headers: authHeaders() })
                .then(r => r.json()).then(data => setBidAuction(data));
            }}
          />
        </div>
      )}
      {showBundles && (
        <div style={{ position:"fixed", inset:0, zIndex:200, overflowY:"auto" }}>
          <BundlesModal darkMode={darkMode} onClose={() => setShowBundles(false)} user={user} onAuthRequired={() => setShowAuth(true)} showToast={showToast} />
        </div>
      )}
      {reportListing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <ReportModal
            listing={reportListing}
            darkMode={darkMode}
            onClose={() => setReportListing(null)}
          />
        </div>
      )}
      {activeChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            overflowY: "auto",
          }}
        >
          <ChatModal
            offer={activeChat}
            darkMode={darkMode}
            onClose={() => setActiveChat(null)}
            user={user}
          />
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: G.gold,
            color: G.black,
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 300,
            fontFamily: "DM Sans,sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onSell={() => (user ? setShowSell(true) : setShowAuth(true))}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        user={user}
        onAuthOpen={() => (user ? handleLogout() : setShowAuth(true))}
        onNotifications={() => setShowNotifications(true)}
        onOffers={() => (user ? setShowOffers(true) : setShowAuth(true))}
        onFavourites={() =>
          user ? setShowFavourites(true) : setShowAuth(true)
        }
        onBundles={() => setShowBundles(true)}
        onSecurity={() => setShowSecurity(true)}
        unreadCount={unreadCount}
      />
      <Hero
        onSearch={handleSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <CategoryStrip
        active={category}
        setActive={(c) => {
          setCategory(c);
          setActiveSearch("");
          setSearchQuery("");
        }}
        darkMode={darkMode}
      />
      <FilterBar
        sort={sort}
        setSort={setSort}
        condition={condition}
        setCondition={setCondition}
        darkMode={darkMode}
        count={totalCount}
        nearMe={nearMe}
        onNearMe={(lat, lng) => {
          setUserCoords({ lat, lng });
          setNearMe(true);
          setActiveSearch("");
          setSearchQuery("");
        }}
        onClearNearMe={() => {
          setNearMe(false);
          setUserCoords(null);
        }}
      />

      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}
      >
        {activeSearch && (
          <div
            style={{
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: darkMode ? "#fff" : G.ink,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Results for "{activeSearch}"
            </span>
            <button
              onClick={() => {
                setActiveSearch("");
                setSearchQuery("");
              }}
              style={{
                background: "none",
                border: "none",
                color: G.gold,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Clear ×
            </button>
          </div>
        )}
        {loading && listings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div
              style={{
                fontSize: 13,
                color: darkMode ? "rgba(255,255,255,0.3)" : G.ink3,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Loading listings...
            </div>
          </div>
        ) : (
          <>
            <ListingGrid
              listings={listings}
              darkMode={darkMode}
              onOpen={handleOpenListing}
              favs={favs}
              onFave={toggleFav}
            />
            {page < totalPages && listings.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 24, marginBottom: 8 }}>
                <button onClick={() => setPage(p => p + 1)} disabled={loading}
                  style={{ background: darkMode ? G.surface2 : G.cream, border: `1px solid ${darkMode ? G.borderDark : G.border}`, borderRadius: 10, padding: "11px 28px", fontSize: 13, fontWeight: 600, color: darkMode ? "#fff" : G.ink, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "DM Sans,sans-serif", transition: "all 0.15s" }}>
                  {loading ? "Loading..." : "Load more listings"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          background: G.black,
          borderTop: "1px solid rgba(201,168,76,0.1)",
          padding: "32px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontFamily: "DM Sans,sans-serif",
            fontWeight: 700,
            color: G.gold,
            marginBottom: 6,
            letterSpacing: -0.5,
          }}
        >
          al<span style={{ color: "#fff" }}>sel</span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          © 2026 Alsel · Uganda's marketplace ·
        </div>
      </div>
    </div>
  );
}
