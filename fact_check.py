import requests
import feedparser

GOOGLE_API_KEY = "Your Google API Key Here"

def check_google_fact(query):
    url = f"https://factchecktools.googleapis.com/v1alpha1/claims:search?query={query}&key={GOOGLE_API_KEY}"
    response = requests.get(url).json()
    
    results = []
    if "claims" in response:
        for claim in response["claims"][:3]: # Top 3 results
            results.append({
                "text": claim['text'],
                "claimant": claim.get('claimant', 'Unknown'),
                "rating": claim['claimReview'][0]['textualRating'],
                "url": claim['claimReview'][0]['url'],
                "source": "Google Fact Check"
            })
    return results

def check_rss_feeds(query):
    # Example RSS: PolitiFact
    feeds = ["https://www.politifact.com/rss/all/"]
    matching_news = []
    
    for url in feeds:
        feed = feedparser.parse(url)
        for entry in feed.entries:
            if any(word.lower() in entry.title.lower() for word in query.split()[:3]):
                matching_news.append({
                    "title": entry.title,
                    "link": entry.link,
                    "source": "RSS Feed"
                })
    return matching_news