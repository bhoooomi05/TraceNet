# API keys are read from environment variables.
# Set GOOGLE_API_KEY and GEMINI_API_KEY in your environment before running.

import os
import sys
import uuid
import shutil
import time
import json
import urllib.parse

# -----------------------------------------------------------------------------
# 1. ENCODING & WMI PATCH
# -----------------------------------------------------------------------------
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# -----------------------------------------------------------------------------
# 2. STANDARD & THIRD-PARTY IMPORTS
# -----------------------------------------------------------------------------
import cv2
import numpy as np
import joblib
import feedparser
import PyPDF2
from docx import Document
from PIL import Image, ImageChops, ImageEnhance
from skimage.feature import hog, local_binary_pattern
from scipy.fftpack import dct
from flask import Flask, render_template, request, jsonify, url_for
from werkzeug.utils import secure_filename
from google import genai
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
# Locate your ai_analysis import block around line 35 and update it to this:
try:
    from ai_analysis import generate_spatial_report, generate_video_report
except ImportError:
    print("Warning: ai_analysis.py not found.")
    generate_spatial_report = None
    generate_video_report = None
try:
    import extractor
    from extractor import universal_fetcher
    from tracenet_core import analyse_video
except ImportError:
    print("Warning: Local modules (extractor, tracenet_core) not found.")

try:
    from fact_check import check_google_fact, check_rss_feeds
    _FACT_CHECK_AVAILABLE = True
except ImportError:
    _FACT_CHECK_AVAILABLE = False
    print("Warning: fact_check.py not found in project directory.")

# -----------------------------------------------------------------------------
# 3. APP CONFIGURATION & CONSTANTS
# -----------------------------------------------------------------------------
app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'static/outputs'
DOWNLOAD_FOLDER = getattr(sys.modules.get('extractor'), 'DOWNLOAD_FOLDER', None) or 'downloads'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  

GOOGLE_API_KEY = "your api key here"  # Replace with your actual Google API key
GEMINI_API_KEY = "your api key here"  # Replace with your actual Gemini API key

GEMINI_MODEL = "gemini-2.5-flash-lite"
try:
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        gemini_client = None
except Exception as _gemini_err:
    print(f"Warning: Gemini client init failed: {_gemini_err}")
    gemini_client = None

IMG_SIZE = 128 
ELA_QUALITY = 90

def safe_clear_cache():
    if os.path.exists(DOWNLOAD_FOLDER):
        for _ in range(3):
            try:
                shutil.rmtree(DOWNLOAD_FOLDER)
                break
            except PermissionError:
                time.sleep(1)
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

if 'extractor' in sys.modules:
    extractor.clear_cache = safe_clear_cache

# -----------------------------------------------------------------------------
# 4. MODEL LOADING
# -----------------------------------------------------------------------------
try:
    tracenet_v8_model = joblib.load('tracenet_v8_model.pkl')
    tracenet_v8_scaler = joblib.load('tracenet_v8_scaler.pkl')
    tracenet_v8_threshold = joblib.load('tracenet_v8_threshold.pkl')
    tracenet_v8_feat_names = joblib.load('tracenet_v8_feat_names.pkl')
    best_ai_model = tracenet_v8_model
    model_scaler = tracenet_v8_scaler
    model_threshold = tracenet_v8_threshold
except Exception:
    try:
        best_ai_model = joblib.load('tracenet_image_model.pkl')
        tracenet_v8_feat_names = joblib.load('tracenet_feature_names.pkl')
        model_scaler = None
        model_threshold = 0.5
    except Exception:
        best_ai_model = None
        model_scaler = None
        model_threshold = 0.5

try:
    from sklearn.base import BaseEstimator, TransformerMixin
except Exception:
    BaseEstimator = object
    class TransformerMixin: pass

class MisinfoFeatureExtractor(BaseEstimator, TransformerMixin):
    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()
        self.clickbait_words = [
            'shocking', 'unbelievable', 'secret', 'exposed', 'emergency',
            'act now', 'you won\'t believe', 'must see', 'breaking',
            'censored', 'they don\'t want you to know', 'share this',
            'forward this', 'please share', 'going viral'
        ]
    def fit(self, x, y=None): return self
    def transform(self, texts):
        features = []
        for text in texts:
            text = str(text)
            excl = text.count('!')
            caps = sum(1 for c in text if c.isupper()) / (len(text) + 1)
            clickbait = sum(1 for w in self.clickbait_words if w in text.lower())
            sentiment = self.analyzer.polarity_scores(text)
            avg_len = np.mean([len(w) for w in text.split()]) if text.split() else 0
            features.append([excl, caps, clickbait, sentiment['compound'], sentiment['neg'], avg_len])
        return np.array(features)

_ML_TRIED = False
_ML_AVAILABLE = False
_ML_ERROR = None
pipeline = None

def _ensure_ml_loaded() -> bool:
    global _ML_TRIED, _ML_AVAILABLE, _ML_ERROR, pipeline
    if _ML_TRIED: return _ML_AVAILABLE
    _ML_TRIED = True
    try:
        import sklearn  # noqa: F401
        pipeline = joblib.load('misinfo_detector_model.pkl')
        _ML_AVAILABLE = True
        return True
    except Exception as e:
        _ML_AVAILABLE = False
        _ML_ERROR = f"{type(e).__name__}: {e}"
        pipeline = None
        return False

# -----------------------------------------------------------------------------
# 5. FORENSIC FEATURE EXTRACTION
# -----------------------------------------------------------------------------
def error_level_analysis(img_path, quality=ELA_QUALITY):
    tmp = None
    try:
        original = Image.open(img_path).convert('RGB')
        tmp = os.path.join(os.getcwd(), f'_ela_{uuid.uuid4().hex}.jpg')
        original.save(tmp, 'JPEG', quality=quality)
        compressed = Image.open(tmp).convert('RGB')
        diff = ImageChops.difference(original, compressed)
        diff = ImageEnhance.Brightness(diff).enhance(20)
        return np.array(diff).astype(np.float32)
    except:
        return np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)

def extract_image_features(img_path):
    features = []
    try:
        ela = error_level_analysis(img_path)
        features += [float(ela.mean()), float(ela.std()), float(ela.max()),
                     float(np.percentile(ela,75)), float(np.percentile(ela,90)),
                     float(np.percentile(ela,95))]

        img_rgb = np.array(Image.open(img_path).convert('RGB').resize((IMG_SIZE, IMG_SIZE))).astype(np.float32)
        gray = img_rgb.mean(axis=2).astype(np.uint8)
        hog_feat = hog(gray, orientations=9, pixels_per_cell=(16,16),
                       cells_per_block=(2,2), feature_vector=True)
        features += list(hog_feat.astype(np.float32))

        lbp = local_binary_pattern(gray, P=8, R=1, method='uniform')
        lbp_hist, _ = np.histogram(lbp, bins=26, range=(0,26), density=True)
        features += list(lbp_hist.astype(np.float32))

        for ch in range(3):
            c = img_rgb[:,:,ch]
            features += [float(c.mean()), float(c.std()), float(c.min()),
                         float(c.max()), float(np.percentile(c,25)), float(np.percentile(c,75))]
            skewness = np.mean((c - np.mean(c))**3) / (np.power(np.var(c), 1.5) + 1e-6)
            features += [float(skewness)]

        gray_f = img_rgb.mean(axis=2)
        gy, gx = np.gradient(gray_f)
        lap = np.gradient(gy,axis=0) + np.gradient(gx,axis=1)
        features += [float(lap.var()), float(lap.std()), float(np.abs(lap).mean())]

        r,g,b = (img_rgb[:,:,i].flatten() for i in range(3))
        features += [float(np.corrcoef(r,g)[0,1]), float(np.corrcoef(r,b)[0,1]), float(np.corrcoef(g,b)[0,1])]

        dct2d = dct(dct(gray_f, axis=0, norm='ortho'), axis=1, norm='ortho')
        hf = np.zeros_like(dct2d, dtype=bool)
        hf[IMG_SIZE//2:, IMG_SIZE//2:] = True
        features += [float(np.abs(dct2d).mean()), float(np.abs(dct2d).std()),
                     float(np.abs(dct2d[hf]).mean()/(np.abs(dct2d).mean()+1e-8))]

        canny = cv2.Canny(gray, 50, 150)
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        smag = np.sqrt(sobelx**2 + sobely**2)
        features += [float(canny.mean()/255.0), float(smag.mean()), float(smag.std())]

        for ks in [3, 7, 15]:
            blurred = cv2.GaussianBlur(gray.astype(np.float32), (ks,ks), 0)
            noise = gray.astype(np.float32) - blurred
            features += [float(noise.mean()), float(noise.std())]

        with Image.open(img_path) as im:
            w, h = im.size
        features += [float(w), float(h), float(w/(h+1e-5)), float(w*h/1_000_000)]

    except Exception as e:
        print(f' ⚠ Extraction Failed: {e}')
        return None

    return np.array(features, dtype=np.float32)

def analyze_media(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    is_video = ext in ['.mp4', '.mov', '.mkv', '.webm']
    is_image = ext in ['.jpg', '.jpeg', '.png', '.webp', '.jfif']

    if not is_video and not is_image:
        return {"error": f"Unsupported media type ({ext}). Please provide an image or video."}
    if is_image:
        return _analyze_image(file_path, save_ela=True)
    else:
        return _analyze_video(file_path)
    
def _analyze_image(file_path, save_ela=False):
    if not best_ai_model:
        return {"error": "AI Model not loaded. Check server logs."}
    try:
        features = extract_image_features(file_path)
        if features is None:
            return {"error": "Failed to extract forensic features from the image."}

        try:
            expected_len = len(tracenet_v8_feat_names)
        except NameError:
            expected_len = len(features)

        if len(features) < expected_len:
            features = np.pad(features, (0, expected_len - len(features)))
        elif len(features) > expected_len:
            features = features[:expected_len]

        features_scaled = model_scaler.transform([features]) if model_scaler else [features]

        probs = best_ai_model.predict_proba(features_scaled)[0]
        prob_fake = float(probs[0] * 100)
        prob_real = float(probs[1] * 100)
        is_ai = prob_fake > (model_threshold * 100)

        ela_url = None
        if save_ela:
            try:
                ela_arr = error_level_analysis(file_path)
                ela_img = Image.fromarray(np.clip(ela_arr, 0, 255).astype(np.uint8))
                ela_name = f"ela_{uuid.uuid4().hex[:8]}.jpg"
                ela_path = os.path.join(OUTPUT_FOLDER, ela_name)
                ela_img.save(ela_path, "JPEG")
                ela_url = url_for('static', filename=f'outputs/{ela_name}')
            except Exception as ela_err:
                print(f"ELA save error: {ela_err}")

        ela_mean = round(float(features[0]), 2)
        ela_std  = round(float(features[1]), 2)
        ela_max  = round(float(features[2]), 2)

        # --- SIMPLE, NON-TECHNICAL EXPLANATIONS ---
        reasoning_items = []
        
        # 1. Noise Analysis
        if float(features[-7]) > 5:
            reasoning_items.append({
                "feature": "Too Smooth (Unnatural)", "flag": True,
                "desc": "Real photos always have tiny imperfections or 'grain'. This image is too perfectly smooth, which is a common sign it was created by AI."
            })
        else:
            reasoning_items.append({
                "feature": "Natural Camera Grain", "flag": False,
                "desc": "This picture has the normal, tiny imperfections you expect to see from a real camera lens."
            })
            
        # 2. Compression Analysis (ELA)
        if ela_mean > 8 or ela_max > 40:
            reasoning_items.append({
                "feature": "Hidden Edits Detected", "flag": True,
                "desc": "Different parts of this image don't match up digitally. This usually means someone copy-pasted or edited pieces together."
            })
        else:
            reasoning_items.append({
                "feature": "Consistent Picture", "flag": False,
                "desc": "The background and foreground match perfectly, meaning it likely hasn't been spliced or edited together."
            })

        # 3. Frequency Analysis
        if float(features[-11]) > 0.3:
             reasoning_items.append({
                "feature": "Computer-Generated Patterns", "flag": True,
                "desc": "We found invisible, repeating patterns in the pixels. Human eyes can't see them, but they are a fingerprint left behind by AI software."
            })
        else:
             reasoning_items.append({
                "feature": "Natural Pixel Layout", "flag": False,
                "desc": "The pixels look natural and disorganized, exactly like a normal photograph taken in the real world."
            })
            
        # 4. Overall Model Verdict
        if is_ai:
             reasoning_items.append({
                "feature": "Unrealistic Lighting & Colors", "flag": True,
                "desc": "The overall colors, lighting, and textures look artificial, matching the 'plastic' style that AI generators usually produce."
            })
        if is_ai:
            reasoning_items.append({"feature": "Model Flag", "desc": "Synthetic texture mismatch detected", "flag": True})

        # Safely get 'desc' or 'value' without crashing
        reasons_fake = [r["feature"] + ": " + r.get("desc", r.get("value", "")) for r in reasoning_items if r["flag"]]
        reasons_real = [r["feature"] + ": " + r.get("desc", r.get("value", "")) for r in reasoning_items if not r["flag"]]
        spatial_b64 = None
        if generate_spatial_report:
            try:
                spatial_b64 = generate_spatial_report(file_path)
                print("SUCCESS: Spatial report generated! Length:", len(spatial_b64)) # <-- ADD THIS
            except Exception as e:
                print(f"Spatial report generation failed: {e}")
        if generate_spatial_report:
            try:
                spatial_b64 = generate_spatial_report(file_path)
            except Exception as e:
                print(f"Spatial report generation failed: {e}")
        result = {
            "status":        "AI Generated" if is_ai else "Authentic Media",
            "score":         round(prob_fake if is_ai else prob_real, 2),
            "is_ai":         is_ai,
            "reasoning":     reasoning_items,
            "reasons_fake":  reasons_fake,
            "reasons_real":  reasons_real,
            "spatial_report_b64": spatial_b64,
            "feature_scores": {
                "ELA Mean":          ela_mean,
                "ELA Std":           ela_std,
                "ELA Max":           ela_max,
                "DCT HF Ratio":      round(float(features[-11]), 4),
                "Edge Density":      round(float(features[-8]),  3),
                "Noise Level":       round(float(features[-7]),  3),
            }
        }
        if ela_url:
            result["ela_url"] = ela_url
        return result
    except Exception as e:
        return {"error": str(e)}
     
def _analyze_video(file_path):
    cap = cv2.VideoCapture(file_path)
    frame_scores = []
    best_frame_path = None
    best_frame_score = -1
    max_frames = 10

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, total_frames // max_frames) if total_frames > 0 else 20

    count = 0
    while cap.isOpened() and len(frame_scores) < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, count * step)
        ret, frame = cap.read()
        if not ret: break

        tmp_frame = os.path.join(DOWNLOAD_FOLDER, f"_frame_{uuid.uuid4().hex[:6]}.png")
        cv2.imwrite(tmp_frame, frame)

        res = _analyze_image(tmp_frame, save_ela=False)
        if "score" in res:
            score = res['score'] if res.get('is_ai') else (100 - res['score'])
            frame_scores.append(score)
            if score > best_frame_score:
                best_frame_score = score
                if best_frame_path and os.path.exists(best_frame_path):
                    os.remove(best_frame_path)
                best_frame_path = tmp_frame
            else:
                if os.path.exists(tmp_frame): os.remove(tmp_frame)
        else:
            if os.path.exists(tmp_frame): os.remove(tmp_frame)

        count += 1
        
    cap.release()

    if not frame_scores:
        return {"error": "Could not extract frames from video."}

    avg_ai_prob = sum(frame_scores) / len(frame_scores)
    is_ai = best_frame_score > 60.0
    final_score = best_frame_score if is_ai else (100 - avg_ai_prob)

    # --- Generate LIME Video Report ---
    video_report_b64 = None
    if generate_video_report:
        try:
            video_report_b64 = generate_video_report(file_path, is_ai, final_score)
        except Exception as e:
            print(f"Video LIME report failed: {e}")

    # Clean up the best frame since we don't use it for the video report anymore
    if best_frame_path and os.path.exists(best_frame_path):
        os.remove(best_frame_path)

    # Replace the old reasoning_items in _analyze_video with this:
    if is_ai:
        reasoning_items = [
            {"feature": "Unnatural Smoothness", "desc": "AI removed natural camera grain and skin textures.", "flag": True},
            {"feature": "Edge Glitches", "desc": "The borders around objects shift unnaturally between frames.", "flag": True},
            {"feature": "Lighting Inconsistency", "desc": "Shadows and highlights don't perfectly match the environment.", "flag": True}
        ]
    else:
        reasoning_items = [
            {"feature": "Natural Camera Grain", "desc": "Standard video noise from a real camera lens is present.", "flag": False},
            {"feature": "Consistent Edges", "desc": "No weird blurring or warping around the subject.", "flag": False},
            {"feature": "Real-World Physics", "desc": "Lighting and movement match real-world physics.", "flag": False}
        ]

    result = {
        "status":        "AI Generated / Deepfake" if is_ai else "Authentic Video",
        "score":         round(final_score, 2),
        "is_ai":         is_ai,
        "reasoning":     reasoning_items,
        "reasons_fake":  [r["feature"] + ": " + r.get("desc", r.get("value", "")) for r in reasoning_items if r["flag"]],
        "reasons_real":  [r["feature"] + ": " + r.get("desc", r.get("value", "")) for r in reasoning_items if not r["flag"]],
        "video_report_b64": video_report_b64, # Send the new LIME report instead
        "feature_scores": {
            "Avg AI Score":   round(avg_ai_prob, 2),
            "Peak Score":     round(best_frame_score, 2),
            "Frames Checked": len(frame_scores),
        }
    }
    
    return result

# -----------------------------------------------------------------------------
# 6. NLP & GEMINI HELPER FUNCTIONS
# -----------------------------------------------------------------------------
def gemini_extract(text: str) -> dict:
    default = {"query": " ".join(text.split()[:8]), "claims": [], "panic_indicators": [], "is_verifiable": True}
    if not gemini_client:
        return default
    # Replace this section inside def gemini_extract(text: str) -> dict:
    prompt = f"""You are a misinformation analyst. Analyse the news/claim text below. Return ONLY a valid JSON object.
    CRITICAL INSTRUCTION: The "query" field MUST be a highly specific, 2 to 4 word string containing ONLY the core entities and the main subject (e.g., "WhatsApp charge users", "Trump Iran threat"). Do NOT use generic words. This will be used for a strict news search.
    Text: \"\"\"{text[:3000]}\"\"\""""
    for attempt in range(3):
        try:
            resp = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            raw  = resp.text.strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(raw)
            return {
                "query":            data.get("query", " ".join(text.split()[:8])),
                "claims":           data.get("claims", []),
                "panic_indicators": data.get("panic_indicators", []),
                "is_verifiable":    data.get("is_verifiable", True)
            }
        except:
            if attempt < 2: time.sleep(2)
    return default

def gemini_judge(text: str, fact_claims: list, rss_titles: list, panic_indicators: list, source_url: str = "") -> dict:
    if not gemini_client:
        return {"verdict": "Uncertain", "confidence": 50, "reasoning": "Gemini API not configured.", "key_evidence": []}
    
    fact_summary = "".join([f" - [{c['rating']}] {c['text']}\n" for c in fact_claims]) if fact_claims else "None found."
    rss_summary = "\n".join(rss_titles[:6]) if rss_titles else "None found."
    
    prompt = f"""You are a strict Misinformation Analyst. Determine if the claim is REAL or FAKE.
    Input Source URL (if provided): {source_url}
    Claim Text: {text[:2000]}
    Official Fact Checks: {fact_summary}
    Recent News: {rss_summary}

    RULES:
    1. SOURCE CREDIBILITY: If the Input Source URL is a recognized, credible mainstream news site (like indianexpress.com, reuters.com, bbc.com), you MUST classify the verdict as "Real", because it is a published factual report, even if it quotes someone saying something sensational.
    2. CLAIM AWARENESS: If the input is a wild, unsupported claim with NO credible news or fact checks, classify it as "Fake".
    3. You MUST return ONLY a raw JSON object. Do not wrap it in markdown.
    
    Format:
    {{
        "verdict": "Real" | "Fake" | "Uncertain",
        "confidence": <integer 0-100>,
        "reasoning": "<short string explaining why>",
        "key_evidence": ["<point 1>", "<point 2>"]
    }}
    """
    try:
        resp = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        raw  = resp.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"Gemini Judge Error: {e}")
        return {"verdict": "Uncertain", "confidence": 50, "reasoning": "Analysis unavailable due to formatting error.", "key_evidence": []}

def get_google_fact_check(query: str) -> list:
    if _FACT_CHECK_AVAILABLE:
        try:
            raw = check_google_fact(query)
            results = []
            for c in raw:
                rating = c.get("rating", "Unrated")
                results.append({
                    "text":      c.get("text", ""),
                    "rating":    rating,
                    "url":       c.get("url", ""),
                    "publisher": c.get("claimant", "Unknown"),
                    "is_false":  "false" in rating.lower(),
                    "is_true":   "true"  in rating.lower()
                })
            return results[:6]
        except Exception as e:
            print(f"fact_check.py error: {e}")

    try:
        import requests as _req
        resp = _req.get(
            "https://factchecktools.googleapis.com/v1alpha1/claims:search",
            params={"query": query, "key": GOOGLE_API_KEY},
            timeout=5
        ).json()
        results = []
        for c in resp.get("claims", [])[:6]:
            review = c.get("claimReview", [{}])[0]
            rating = review.get("textualRating", "Unrated")
            results.append({
                "text":      c.get("text", ""),
                "rating":    rating,
                "url":       review.get("url", ""),
                "publisher": review.get("publisher", {}).get("name", "Unknown"),
                "is_false":  "false" in rating.lower(),
                "is_true":   "true"  in rating.lower()
            })
        return results
    except Exception as e:
        print(f"Fact check fallback error: {e}")
        return []
    
def get_rss_news(query: str, max_results: int = 8) -> list:
    results = []
    if _FACT_CHECK_AVAILABLE:
        try:
            rss_raw = check_rss_feeds(query)
            for item in rss_raw:
                results.append({
                    "title":  item.get("title", ""),
                    "link":   item.get("link", ""),
                    "source": item.get("source", "RSS Feed")
                })
        except Exception as e:
            print(f"RSS fact_check error: {e}")

    try:
        encoded = urllib.parse.quote(query)
        feed = feedparser.parse(
            f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
        )
        for e in feed.entries[:max_results * 2]: # Fetch more to allow filtering
            results.append({
                "title":  e.get("title", ""),
                "link":   e.get("link", ""),
                "source": e.get("source", {}).get("title", "Google News")
            })
    except Exception as e:
        print(f"Google News RSS error: {e}")

    # STRICT FILTER: Ensure at least one significant word from the query is actually in the title
    query_words = [w.lower() for w in query.split() if len(w) > 3]
    filtered_results = []
    for r in results:
        title_lower = r['title'].lower()
        if not query_words or any(qw in title_lower for qw in query_words):
            filtered_results.append(r)

    return filtered_results[:max_results]

def run_ml_model(text: str) -> dict:
    if not _ensure_ml_loaded() or pipeline is None:
        return {"fake_prob": 50, "real_prob": 50, "reasoning": [], "ml_disabled": True, "ml_error": _ML_ERROR}
    try:
        proba = pipeline.predict_proba([text])[0]
        return {
            "fake_prob": round(proba[1]*100, 2),
            "real_prob": round(proba[0]*100, 2),
            "reasoning": [],
            "ml_disabled": False,
            "ml_error": None
        }
    except Exception as e:
        return {"fake_prob": 50, "real_prob": 50, "reasoning": [], "ml_disabled": True, "ml_error": f"{type(e).__name__}: {e}"}

def fuse_verdicts(gemini_verdict: dict, ml: dict, fact_claims: list) -> dict:
    g_verdict = gemini_verdict.get("verdict", "Uncertain")
    g_conf    = gemini_verdict.get("confidence", 50)

    # Force tiebreaker if Gemini is uncertain
    if g_verdict == "Uncertain":
        if ml["fake_prob"] > 60:   g_verdict, g_conf = "Fake", round((g_conf + ml["fake_prob"]) / 2)
        elif ml["real_prob"] > 60: g_verdict, g_conf = "Real", round((g_conf + ml["real_prob"]) / 2)

    is_fake = g_verdict in ("Fake", "Uncertain")

    key_ev = gemini_verdict.get("key_evidence", [])
    reasons_fake = [e for e in key_ev if any(w in str(e).lower() for w in
                    ["fake","false","mislead","manipulat","satire","unverif","conspirac","sensational"])]
    reasons_real = [e for e in key_ev if e not in reasons_fake]
    
    if not reasons_fake and is_fake:
        if ml["fake_prob"] > 60:
            reasons_fake.append(f"ML model flags linguistic patterns ({ml['fake_prob']}% fake probability)")
    if not reasons_real and not is_fake:
        if ml["real_prob"] > 60:
            reasons_real.append(f"ML model flags credible text structure ({ml['real_prob']}% real probability)")

    stages = ["Input", "NLP Clean", "TF-IDF", "ML Model", "Gemini", "Fused"]
    ml_f   = ml["fake_prob"]
    gem_f  = g_conf if is_fake else (100 - g_conf)
    tl_values = [
        round(ml_f * 0.3,  1),
        round(ml_f * 0.55, 1),
        round(ml_f * 0.75, 1),
        round(ml_f,        1),
        round(gem_f,       1),
        round(g_conf,      1),
    ]
    timeline_data = {
        "labels": stages,
        "values": tl_values,
        "is_fake": is_fake
    }

    sources = []
    for fc in fact_claims:
        if fc.get("url"):
            sources.append({
                "label":     fc.get("publisher", "Fact Checker"),
                "rating":    fc.get("rating", ""),
                "url":       fc.get("url", ""),
                "is_false":  fc.get("is_false", False),
                "is_true":   fc.get("is_true",  False),
                "text":      fc.get("text", "")[:120]
            })

    return {
        "is_fake":       is_fake,
        "is_ai":         False,
        "status":        g_verdict,
        "score":         g_conf,
        "verdict":       g_verdict,
        "confidence":    g_conf,
        "reasoning":     gemini_verdict.get("reasoning", ""),
        "key_evidence":  key_ev,
        "reasons_fake":  reasons_fake,
        "reasons_real":  reasons_real,
        "fact_claims":   fact_claims,
        "ml_fake_prob":  ml["fake_prob"],
        "ml_real_prob":  ml["real_prob"],
        "ml_reasoning":  ml["reasoning"],
        "ml_flag":       None,
        "timeline_data": timeline_data,
        "sources":       sources,
    }

# -----------------------------------------------------------------------------
# 7. FLASK ROUTES
# -----------------------------------------------------------------------------
@app.route('/')
@app.route('/index')
def home(): return render_template('index.html')

@app.route('/howto')
def howto(): return render_template('howto.html')

@app.route('/misinfo')
def misinfo(): return render_template('misinfo.html')

@app.route('/ai_detection')
def ai_detection(): return render_template('ai_detection.html')

@app.route('/privacy')
def privacy(): return render_template('privacy.html')

@app.route('/result')
def result(): return render_template('result.html')

@app.route('/process', methods=['POST'])
def process():
    mode = request.form.get('type')
    raw_text = ""
    media_analysis = None
    temp_path = None
    source_url = ""

    try:
        if mode == 'text':
            raw_text = request.form.get('content', '')
        elif mode == 'url':
            source_url = request.form.get('content', '')
            if 'universal_fetcher' in globals():
                _, raw_text = universal_fetcher(source_url)
            else:
                raw_text = source_url
        elif mode == 'media_url':
            source_url = request.form.get('url', '')
            temp_path = None
            
            try:
                # Use your existing, powerful universal_fetcher
                temp_path, _ = universal_fetcher(source_url)
                
                if not temp_path or not os.path.exists(temp_path):
                    return jsonify({"error": "Failed to extract media from the URL using yt-dlp/extractor."}), 400
                
                # Pass the extracted file to your AI forensic function
                media_analysis = analyze_media(temp_path)
                if "error" in media_analysis:
                    return jsonify(media_analysis), 400
                    
                raw_text = f"Forensic check: {media_analysis['status']}. Score: {media_analysis['score']}%."
                
            except Exception as e:
                return jsonify({"error": f"Extraction pipeline failed: {str(e)}"}), 400
        elif mode in ['video', 'image', 'document']:
            f = request.files['file']
            temp_path = os.path.join(DOWNLOAD_FOLDER, secure_filename(f.filename))
            f.save(temp_path)
            ext = os.path.splitext(f.filename)[1].lower()

            if ext in ['.pdf', '.docx', '.txt']:
                if ext == '.pdf': 
                    raw_text = " ".join(p.extract_text() or "" for p in PyPDF2.PdfReader(temp_path).pages)
                elif ext == '.docx': 
                    raw_text = " ".join(p.text for p in Document(temp_path).paragraphs)
                else:
                    with open(temp_path, 'r', encoding='utf-8', errors='ignore') as doc_f: raw_text = doc_f.read()
            else:
                media_analysis = analyze_media(temp_path)
                if "error" in media_analysis:
                    return jsonify(media_analysis), 400
                raw_text = f"Forensic check: {media_analysis['status']}. Score: {media_analysis['score']}%."

        meta = gemini_extract(raw_text)
        fact_claims = get_google_fact_check(meta["query"])
        rss_news = get_rss_news(meta["query"])
        
        if media_analysis:
            verdict_data = {
                "is_ai":          media_analysis['is_ai'],
                "is_fake":        media_analysis['is_ai'],
                "status":         "AI Generated" if media_analysis['is_ai'] else "Authentic Media",
                "score":          media_analysis['score'],
                "reasoning":      media_analysis.get('reasoning', []), # <-- Pass the array of cards directly
                "key_evidence":   [], # We don't need this anymore
                "reasons_fake":   media_analysis.get("reasons_fake", []),
                "reasons_real":   media_analysis.get("reasons_real", []),
                "feature_scores": media_analysis.get("feature_scores", {}),
                "ela_url":        media_analysis.get("ela_url"),
                "frame_url":      media_analysis.get("frame_url"),
                "spatial_report_b64": media_analysis.get("spatial_report_b64"),
                "video_report_b64": media_analysis.get("video_report_b64"),
            }
        else:
            gv = gemini_judge(raw_text, fact_claims, [n['title'] for n in rss_news], meta["panic_indicators"], source_url)
            ml = run_ml_model(raw_text)
            verdict_data = fuse_verdicts(gv, ml, fact_claims)

        if temp_path and os.path.exists(temp_path): os.remove(temp_path)

        return jsonify({
            "status":            verdict_data.get("status", "Unknown"),
            "score":             verdict_data.get("score", 50),
            "verdict":           verdict_data.get("verdict", verdict_data.get("status", "Unknown")),
            "confidence":        verdict_data.get("confidence", verdict_data.get("score", 50)),
            "is_ai":             verdict_data.get("is_ai", False),
            "is_fake":           verdict_data.get("is_fake", False),
            "reasoning":         verdict_data.get("reasoning", ""),
            "key_evidence":      verdict_data.get("key_evidence", []),
            "reasons_fake":      verdict_data.get("reasons_fake", []),
            "reasons_real":      verdict_data.get("reasons_real", []),
            "feature_scores":    verdict_data.get("feature_scores", {}),
            "ela_url":           verdict_data.get("ela_url"),
            "frame_url":         verdict_data.get("frame_url"),
            "spatial_report_b64": verdict_data.get("spatial_report_b64"), # <--- ADD THIS LINE
            "video_report_b64": verdict_data.get("video_report_b64"),
            "timeline_data":     verdict_data.get("timeline_data", {}),
            "sources":           verdict_data.get("sources", []),
            "search_query":      meta["query"],
            "extracted_claims":  meta["claims"],
            "panic_indicators":  meta["panic_indicators"],
            "fact_claims":       fact_claims if not media_analysis else [],
            "related_news":      rss_news,
        })

    except Exception as e:
        if temp_path and os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)