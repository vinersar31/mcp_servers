# server.py
import asyncio
import feedparser
import datetime
from mcp.server.fastmcp import FastMCP
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

server = FastMCP("finance-politics-news")

# --- CONFIG ---
FINANCIAL_FEEDS = [
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",   # WSJ Markets
    "https://www.investing.com/rss/news.rss",          # Investing.com
    "https://www.ft.com/?format=rss",                  # Financial Times
]

POLITICAL_FEEDS = [
    "https://www.politico.com/rss/politics08.xml",     # Politico
    "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
]

SOURCE_WEIGHTS = {
    "wsj.com": 5,
    "ft.com": 5,
    "reuters.com": 4,
    "politico.com": 3,
    "nytimes.com": 3,
    "aljazeera.com": 2,
}

# --- HELPERS ---
def fetch_feed(url):
    return feedparser.parse(url).entries

def normalize_article(entry, source_type):
    return {
        "title": entry.get("title", ""),
        "link": entry.get("link", ""),
        "summary": entry.get("summary", ""),
        "published": entry.get("published", ""),
        "source_type": source_type,
    }

def recency_score(published):
    try:
        if hasattr(published, "tm_year"):  # if struct_time
            dt = datetime.datetime(*published[:6])
        else:
            return 0
        age_hours = (datetime.datetime.utcnow() - dt).total_seconds() / 3600
        return max(0, 10 - age_hours)  # newer = higher
    except Exception:
        return 0

def compute_score(article):
    weight = 1
    for domain, w in SOURCE_WEIGHTS.items():
        if domain in article["link"]:
            weight += w
    if "published_parsed" in article:
        weight += recency_score(article["published_parsed"])
    return weight

def fetch_articles(feeds, source_type):
    articles = []
    for url in feeds:
        try:
            entries = fetch_feed(url)
            for e in entries:
                art = normalize_article(e, source_type)
                if hasattr(e, "published_parsed"):
                    art["published_parsed"] = e.published_parsed
                art["score"] = compute_score(art)
                articles.append(art)
        except Exception as ex:
            print(f"Failed to fetch {url}: {ex}")
    return articles

# --- CLUSTERING / DEDUP ---
def cluster_and_dedupe(articles, threshold=0.75):
    if not articles:
        return []

    texts = [a["title"] + " " + a["summary"] for a in articles]
    vectorizer = TfidfVectorizer(stop_words="english")
    X = vectorizer.fit_transform(texts)
    sim_matrix = cosine_similarity(X)

    visited = set()
    clusters = []

    for i, art in enumerate(articles):
        if i in visited:
            continue
        cluster = [i]
        visited.add(i)
        for j in range(i + 1, len(articles)):
            if j not in visited and sim_matrix[i, j] >= threshold:
                cluster.append(j)
                visited.add(j)
        clusters.append(cluster)

    deduped = []
    for cluster in clusters:
        # pick representative with highest score
        best = max([articles[i] for i in cluster], key=lambda x: x["score"])
        best["cluster_size"] = len(cluster)
        deduped.append(best)

    return deduped

# --- MCP TOOLS ---
@server.tool()
async def get_financial_news(limit: int = 5):
    """Fetch latest financial news (clustered, ranked)."""
    articles = fetch_articles(FINANCIAL_FEEDS, "financial")
    clustered = cluster_and_dedupe(articles)
    ranked = sorted(clustered, key=lambda x: x["score"], reverse=True)
    return ranked[:limit]

@server.tool()
async def get_political_news(limit: int = 5):
    """Fetch latest political news (clustered, ranked)."""
    articles = fetch_articles(POLITICAL_FEEDS, "political")
    clustered = cluster_and_dedupe(articles)
    ranked = sorted(clustered, key=lambda x: x["score"], reverse=True)
    return ranked[:limit]

@server.tool()
async def get_top_ranked_news(limit: int = 10):
    """Fetch combined top financial + political news (clustered, ranked)."""
    financial = fetch_articles(FINANCIAL_FEEDS, "financial")
    political = fetch_articles(POLITICAL_FEEDS, "political")
    all_articles = financial + political
    clustered = cluster_and_dedupe(all_articles)
    ranked = sorted(clustered, key=lambda x: x["score"], reverse=True)
    return ranked[:limit]

# --- ENTRYPOINT ---
if __name__ == "__main__":
    asyncio.run(server.run())
