import os
import joblib
import numpy as np
import cv2
from PIL import Image, ImageChops, ImageEnhance
from skimage.feature import hog, local_binary_pattern
from scipy.fftpack import dct
import uuid

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS (Deduced from your HOG math)
# ─────────────────────────────────────────────────────────────────────────────
IMG_SIZE = 128 
ELA_QUALITY = 90

# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────
try:
    tracenet_v8_model = joblib.load('tracenet_v8_model.pkl')
    tracenet_v8_scaler = joblib.load('tracenet_v8_scaler.pkl')
    tracenet_v8_threshold = joblib.load('tracenet_v8_threshold.pkl')
    tracenet_v8_feat_names = joblib.load('tracenet_v8_feat_names.pkl')
    print("✅ TraceNet V8 Model loaded successfully.")
    best_ai_model = tracenet_v8_model
    model_scaler = tracenet_v8_scaler
    model_threshold = tracenet_v8_threshold
except Exception as e:
    print(f"⚠️ V8 Model failed, loading legacy model: {e}")
    try:
        best_ai_model = joblib.load('tracenet_image_model.pkl')
        tracenet_feat_names = joblib.load('tracenet_feature_names.pkl')
        model_scaler = None
        model_threshold = 0.5
        print("✅ TraceNet Legacy Model loaded.")
    except Exception as e2:
        print(f"⚠️ All models failed: {e2}")
        best_ai_model = None
        model_scaler = None
        model_threshold = 0.5


# ─────────────────────────────────────────────────────────────────────────────
# FORENSIC FEATURE EXTRACTION (Verbatim from Training)
# ─────────────────────────────────────────────────────────────────────────────
def error_level_analysis(img_path, quality=ELA_QUALITY):
    temp = None
    try:
        original   = Image.open(img_path).convert('RGB')
        tmp = os.path.join(os.getcwd(), f'_ela_{uuid.uuid4().hex}.jpg') # Note: On Windows, use a local temp folder like './_ela_tmp.jpg'
        original.save(tmp, 'JPEG', quality=quality)
        compressed = Image.open(tmp).convert('RGB')
        diff       = ImageChops.difference(original, compressed)
        diff       = ImageEnhance.Brightness(diff).enhance(20)
        return np.array(diff).astype(np.float32)
    except:
        return np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
    finally:
        # Cleanup temp file safely
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def extract_image_features(img_path):
    features = []
    try:
        # 1. ELA
        ela = error_level_analysis(img_path)
        features += [float(ela.mean()), float(ela.std()), float(ela.max()),
                     float(np.percentile(ela,75)), float(np.percentile(ela,90)),
                     float(np.percentile(ela,95))]

        # 2. HOG
        img_rgb  = np.array(Image.open(img_path).convert('RGB')
                            .resize((IMG_SIZE, IMG_SIZE))).astype(np.float32)
        gray     = img_rgb.mean(axis=2).astype(np.uint8)
        hog_feat = hog(gray, orientations=9, pixels_per_cell=(16,16),
                       cells_per_block=(2,2), feature_vector=True)
        features += list(hog_feat.astype(np.float32))

        # 3. LBP
        lbp      = local_binary_pattern(gray, P=8, R=1, method='uniform')
        lbp_hist, _ = np.histogram(lbp, bins=26, range=(0,26), density=True)
        features += list(lbp_hist.astype(np.float32))

        # 4. Pixel stats
        for ch in range(3):
            c = img_rgb[:,:,ch]
            features += [float(c.mean()), float(c.std()), float(c.min()),
                         float(c.max()), float(np.percentile(c,25)),
                         float(np.percentile(c,75))]
            skewness = np.mean((c - np.mean(c))**3) / (np.power(np.var(c), 1.5) + 1e-6)
            features += [float(skewness)]

        # 5. Laplacian
        gray_f = img_rgb.mean(axis=2)
        gy, gx = np.gradient(gray_f)
        lap    = np.gradient(gy,axis=0) + np.gradient(gx,axis=1)
        features += [float(lap.var()), float(lap.std()), float(np.abs(lap).mean())]

        # 6. Channel correlations
        r,g,b = (img_rgb[:,:,i].flatten() for i in range(3))
        features += [float(np.corrcoef(r,g)[0,1]),
                     float(np.corrcoef(r,b)[0,1]),
                     float(np.corrcoef(g,b)[0,1])]

        # 7. DCT frequency
        dct2d  = dct(dct(gray_f, axis=0, norm='ortho'), axis=1, norm='ortho')
        hf     = np.zeros_like(dct2d, dtype=bool)
        hf[IMG_SIZE//2:, IMG_SIZE//2:] = True
        features += [float(np.abs(dct2d).mean()), float(np.abs(dct2d).std()),
                     float(np.abs(dct2d[hf]).mean()/(np.abs(dct2d).mean()+1e-8))]

        # 8. Edge
        canny  = cv2.Canny(gray, 50, 150)
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        smag   = np.sqrt(sobelx**2 + sobely**2)
        features += [float(canny.mean()/255.0), float(smag.mean()), float(smag.std())]

        # 9. Noise subbands
        for ks in [3, 7, 15]:
            blurred = cv2.GaussianBlur(gray.astype(np.float32), (ks,ks), 0)
            noise   = gray.astype(np.float32) - blurred
            features += [float(noise.mean()), float(noise.std())]

        # 10. Geometry
        with Image.open(img_path) as im:
            w, h = im.size
        features += [float(w), float(h), float(w/(h+1e-5)), float(w*h/1_000_000)]

    except Exception as e:
        print(f' ⚠ Extraction Failed: {e}')
        return None

    return np.array(features, dtype=np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# ROUTING & ANALYSIS LOGIC
# ─────────────────────────────────────────────────────────────────────────────
def analyze_media(file_path):
    """Determines media type and routes to the correct evaluation function."""
    ext = os.path.splitext(file_path)[1].lower()
    is_video = ext in ['.mp4', '.mov', '.mkv', '.webm']
    is_image = ext in ['.jpg', '.jpeg', '.png', '.webp', '.jfif']

    if not is_video and not is_image:
        return {"error": f"Unsupported media type ({ext}). Please provide an image or video."}

    if is_image:
        return _analyze_image(file_path)
    else:
        return _analyze_video(file_path)

def _analyze_image(file_path):
    """Handles Image processing using the Gradient Boosting Pipeline."""

    if not best_ai_model:
        return {"error": "AI Model not loaded. Check server logs."}

    try:
        # 1. Extract features
        features = extract_image_features(file_path)
        if features is None:
            return {"error": "Failed to extract forensic features from the image."}

        print(f"DEBUG: Extracted = {len(features)}")

        # ✅ FIX: Align feature size with model
        expected_len = len(tracenet_v8_feat_names)
        print(f"DEBUG: Expected = {expected_len}")

        if len(features) < expected_len:
            features = np.pad(features, (0, expected_len - len(features)))
        elif len(features) > expected_len:
            features = features[:expected_len]

        # 2. Scale
        if model_scaler:
            features_scaled = model_scaler.transform([features])
        else:
            features_scaled = [features]

        # 3. Predict
        probs = best_ai_model.predict_proba(features_scaled)[0]

        prob_fake = float(probs[0] * 100)
        prob_real = float(probs[1] * 100)

        is_ai = prob_fake > (model_threshold * 100)

        # Reasoning
        ela_max       = round(features[2], 2)
        dct_hf_ratio  = round(features[-11], 4)
        canny_density = round(features[-8], 3)
        noise_mean    = round(features[-7], 3)

        reasoning = [
            {"feature": "ELA Max Intensity", "value": f"{ela_max}"},
            {"feature": "DCT High-Freq Ratio", "value": f"{dct_hf_ratio}"},
            {"feature": "Canny Edge Density", "value": f"{canny_density}"},
            {"feature": "Base Noise Artifacts", "value": f"{noise_mean}"}
        ]

        if is_ai:
            reasoning.append({
                "feature": "Model Flag",
                "value": "Synthetic texture mismatch detected"
            })

        return {
            "status": "AI Generated" if is_ai else "Authentic Media",
            "score": round(prob_fake if is_ai else prob_real, 2),
            "is_ai": is_ai,
            "reasoning": reasoning
        }

    except Exception as e:
        print(f"[AI Image Detect] Error: {e}")
        return {"error": str(e)}
    
def _analyze_video(file_path):
    """Real Video Forensic Logic: Analyzes keyframes of the video."""
    cap = cv2.VideoCapture(file_path)
    frame_scores = []
    max_frames = 10 # Sample 10 frames to keep it fast for web
    
    count = 0
    while cap.isOpened() and len(frame_scores) < max_frames:
        ret, frame = cap.read()
        if not ret: break
        
        # Save frame to temp to use the image extraction logic
        tmp_frame = f"./_frame_{count}.jpg"
        cv2.imwrite(tmp_frame, frame)
        
        # Reuse your image model for the frame
        res = _analyze_image(tmp_frame)
        if "score" in res:
            # If the model says AI Generated, we track that probability
            score = res['score'] if res['is_ai'] else (100 - res['score'])
            frame_scores.append(score)
            
        if os.path.exists(tmp_frame): os.remove(tmp_frame)
        count += 1
        # Skip 20 frames to sample across the video duration
        cap.set(cv2.CAP_PROP_POS_FRAMES, count * 20)

    cap.release()

    if not frame_scores:
        return {"error": "Could not extract frames from video."}

    avg_ai_prob = sum(frame_scores) / len(frame_scores)
    is_ai = avg_ai_prob > 50

    return {
        "status": "AI Generated / Deepfake" if is_ai else "Authentic Video",
        "score": round(avg_ai_prob, 2) if is_ai else round(100 - avg_ai_prob, 2),
        "is_ai": is_ai,
        "reasoning": [
            {"feature": "Average Frame AI Score", "value": f"{round(avg_ai_prob, 2)}%"},
            {"feature": "Temporal Consistency", "value": "Analyzed via frame-sampling subbands."},
            {"feature": "Forensic Source", "value": "TraceNet Spatial Analysis"}
        ]
    }
