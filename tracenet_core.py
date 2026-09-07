import os
import cv2
import numpy as np
import joblib
import subprocess
import matplotlib.cm as mplcm
from tqdm import tqdm
from PIL import Image
from skimage.feature import hog, local_binary_pattern
from scipy.fftpack import dct

IMG_SIZE = 128
ELA_QUALITY = 90

# -----------------------------------------------------------------------------
# LAZY LOAD MODEL
# -----------------------------------------------------------------------------
_MODEL_LOADED = False
best_model = None
feat_names = None

def load_video_model():
    global _MODEL_LOADED, best_model, feat_names
    if _MODEL_LOADED: return True

    # Check common locations for the model files
    model_paths = ['tracenet_video_model.pkl', 'models/tracenet_video_model.pkl']
    feat_paths = ['tracenet_video_feat_names.pkl', 'models/tracenet_video_feat_names.pkl']
    
    model_file = next((p for p in model_paths if os.path.exists(p)), None)
    feat_file = next((p for p in feat_paths if os.path.exists(p)), None)

    if not model_file or not feat_file:
        print("⚠ TraceNet Video Model not found! Ensure .pkl files are in the directory.")
        return False

    try:
        best_model = joblib.load(model_file)
        feat_names = joblib.load(feat_file)
        _MODEL_LOADED = True
        return True
    except Exception as e:
        print(f"⚠ Error loading TraceNet Video Model: {e}")
        return False

# -----------------------------------------------------------------------------
# FEATURE EXTRACTION
# -----------------------------------------------------------------------------
def ela_from_array(img_array, quality=ELA_QUALITY):
    tmp = 'temp_frame_ela.jpg'
    Image.fromarray(img_array).save(tmp, 'JPEG', quality=quality)
    compressed = np.array(Image.open(tmp).convert('RGB')).astype(np.float32)
    diff = np.abs(img_array.astype(np.float32) - compressed)
    if os.path.exists(tmp): os.remove(tmp)
    return (diff * 20).clip(0, 255)

def extract_frame_features(frame_rgb):
    feats = []
    try:
        frame_resized = cv2.resize(frame_rgb, (IMG_SIZE, IMG_SIZE))
        img           = frame_resized.astype(np.float32)
        gray          = cv2.cvtColor(frame_resized, cv2.COLOR_RGB2GRAY)
        ela = ela_from_array(frame_resized)
        
        feats += [float(ela.mean()), float(ela.std()), float(ela.max()),
                  float(np.percentile(ela,75)), float(np.percentile(ela,90)),
                  float(np.percentile(ela,95))]
        
        hog_feat = hog(gray, orientations=9, pixels_per_cell=(16,16),
                       cells_per_block=(2,2), feature_vector=True)
        feats += list(hog_feat.astype(np.float32))
        
        lbp      = local_binary_pattern(gray, P=8, R=1, method='uniform')
        lbp_hist, _ = np.histogram(lbp, bins=26, range=(0,26), density=True)
        feats += list(lbp_hist.astype(np.float32))
        
        for ch in range(3):
            c = img[:,:,ch]
            feats += [float(c.mean()), float(c.std()), float(c.min()),
                      float(c.max()), float(np.percentile(c,25)), float(np.percentile(c,75))]
            
        gray_f = img.mean(axis=2)
        gy, gx = np.gradient(gray_f)
        lap    = np.gradient(gy,axis=0) + np.gradient(gx,axis=1)
        feats += [float(lap.var()), float(lap.std()), float(np.abs(lap).mean())]
        
        r,g,b  = (img[:,:,i].flatten() for i in range(3))
        feats += [float(np.corrcoef(r,g)[0,1]), float(np.corrcoef(r,b)[0,1]),
                  float(np.corrcoef(g,b)[0,1])]
        
        dct2d  = dct(dct(gray_f, axis=0, norm='ortho'), axis=1, norm='ortho')
        hf     = np.zeros_like(dct2d, dtype=bool)
        hf[IMG_SIZE//2:, IMG_SIZE//2:] = True
        feats += [float(np.abs(dct2d).mean()), float(np.abs(dct2d).std()),
                  float(np.abs(dct2d[hf]).mean()/(np.abs(dct2d).mean()+1e-8))]
        
        canny  = cv2.Canny(gray, 50, 150)
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        smag   = np.sqrt(sobelx**2 + sobely**2)
        feats += [float(canny.mean()/255.0), float(smag.mean()), float(smag.std())]
        
        for ks in [3, 7, 15]:
            blurred = cv2.GaussianBlur(gray.astype(np.float32), (ks,ks), 0)
            noise   = gray.astype(np.float32) - blurred
            feats  += [float(noise.mean()), float(noise.std())]
    except Exception as e:
        return None
    return np.array(feats, dtype=np.float32)

def compute_optical_flow_features(frames_gray):
    if len(frames_gray) < 2: return [0.0]*6
    flow_mags, flow_vars, diff_means = [], [], []
    for i in range(len(frames_gray)-1):
        flow = cv2.calcOpticalFlowFarneback(
            frames_gray[i], frames_gray[i+1], None,
            0.5, 3, 15, 3, 5, 1.2, 0)
        mag, ang = cv2.cartToPolar(flow[...,0], flow[...,1])
        flow_mags.append(float(mag.mean()))
        flow_vars.append(float(ang.std()))
        diff = np.abs(frames_gray[i+1].astype(np.float32) - frames_gray[i].astype(np.float32))
        diff_means.append(float(diff.mean()))
    return [float(np.mean(flow_mags)), float(np.std(flow_mags)),
            float(np.mean(flow_vars)), float(np.std(flow_vars)),
            float(np.mean(diff_means)), float(np.std(diff_means))]

def compute_temporal_consistency(frame_feats_matrix):
    if frame_feats_matrix.shape[0] < 2: return [0.0]*4
    diffs = np.abs(np.diff(frame_feats_matrix, axis=0))
    return [float(diffs.mean()), float(diffs.std()),
            float(diffs.max()), float(frame_feats_matrix.var(axis=0).mean())]

def compute_face_region_consistency(frames_rgb):
    ela_means, skin_ratios = [], []
    for frame in frames_rgb:
        small = cv2.resize(frame, (64,64))
        ycrcb = cv2.cvtColor(small, cv2.COLOR_RGB2YCrCb)
        mask  = ((ycrcb[:,:,1]>=133)&(ycrcb[:,:,1]<=173)&
                 (ycrcb[:,:,2]>=77) &(ycrcb[:,:,2]<=127))
        skin_ratios.append(float(mask.mean()))
        ela = ela_from_array(small)
        ela_means.append(float(ela.mean(axis=2)[mask].mean() if mask.any() else ela.mean()))
    return [float(np.mean(ela_means)), float(np.std(ela_means)),
            float(np.mean(skin_ratios)), float(np.std(skin_ratios))]

def extract_video_features(video_path, n_frames=12):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened(): return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    if total < 2: cap.release(); return None
    idxs  = np.linspace(0, total-1, n_frames, dtype=int)
    frames_rgb, frames_gray = [], []
    
    for idx in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx); ret, fr = cap.read()
        if not ret: continue
        rgb  = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
        gray = cv2.cvtColor(cv2.resize(rgb,(IMG_SIZE,IMG_SIZE)), cv2.COLOR_RGB2GRAY)
        frames_rgb.append(rgb); frames_gray.append(gray)
    cap.release()
    
    if len(frames_rgb) < 2: return None
    feats_list = [f for f in [extract_frame_features(fr) for fr in frames_rgb] if f is not None]
    if len(feats_list) < 2: return None
    
    mat  = np.array(feats_list)
    agg  = np.concatenate([mat.mean(axis=0), mat.std(axis=0)])
    temp = np.array(
        compute_optical_flow_features(frames_gray) +
        compute_temporal_consistency(mat) +
        compute_face_region_consistency(frames_rgb) +
        [float(fps), float(total/fps), float(total)], dtype=np.float32)
    return np.concatenate([agg, temp]).astype(np.float32)

# -----------------------------------------------------------------------------
# FRAME LEVEL SCORING
# -----------------------------------------------------------------------------
def score_frame(frame_rgb, prev_gray=None):
    small = cv2.resize(frame_rgb, (IMG_SIZE, IMG_SIZE))
    gray  = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)

    ela      = ela_from_array(small)
    ela_gray = ela.mean(axis=2)
    ela_norm = (ela_gray - ela_gray.min()) / (np.ptp(ela_gray) + 1e-8)
    ela_score = float(ela_gray.mean()) / 30.0 

    flow_mag_map = None
    flow_score   = 0.0
    if prev_gray is not None:
        flow = cv2.calcOpticalFlowFarneback(
            prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag, _ = cv2.cartToPolar(flow[...,0], flow[...,1])
        flow_mag_map = mag
        flow_score = float(mag.std()) / (mag.mean() + 1e-8)
        flow_score = min(flow_score / 3.0, 1.0)

    gray_f   = small.astype(np.float32).mean(axis=2)
    smooth   = cv2.GaussianBlur(gray_f, (7,7), 0)
    noise    = np.abs(gray_f - smooth)
    noise_n  = (noise - noise.min()) / (np.ptp(noise) + 1e-8)
    noise_score = float(1.0 - noise_n.mean()) 

    lbp      = local_binary_pattern(gray, P=8, R=1, method='uniform')
    lbp_hist, _ = np.histogram(lbp, bins=26, range=(0,26), density=True)
    lbp_entropy = -np.sum(lbp_hist * np.log(lbp_hist + 1e-8))
    lbp_score   = float(max(0, 1.0 - lbp_entropy / 3.0))

    ycrcb = cv2.cvtColor(small, cv2.COLOR_RGB2YCrCb)
    skin  = ((ycrcb[:,:,1]>=133)&(ycrcb[:,:,1]<=173)&
             (ycrcb[:,:,2]>=77) &(ycrcb[:,:,2]<=127))
    skin_ela_score = float(ela_gray[skin].mean() / 30.0) if skin.any() else ela_score

    score = min(1.0, (
        0.30 * ela_score +
        0.25 * flow_score +
        0.20 * noise_score +
        0.15 * lbp_score +
        0.10 * skin_ela_score
    ))

    return (
        score, ela_norm, flow_mag_map, noise_n,
        {'ELA': ela_score, 'Motion': flow_score,
         'Noise': noise_score, 'Texture': lbp_score, 'Face': skin_ela_score}
    )

# -----------------------------------------------------------------------------
# RENDER ENGINE
# -----------------------------------------------------------------------------
def render_overlay_frame(
    frame_bgr, score, ela_norm, flow_mag, noise_map,
    signals, global_verdict, global_fake_pct, global_real_pct,
    frame_idx, total_frames, fps,
    history_scores, mode='split'
):
    H, W = frame_bgr.shape[:2]
    out   = frame_bgr.copy()

    ela_coloured   = (mplcm.hot(ela_norm)[:,:,:3] * 255).astype(np.uint8)
    ela_coloured   = cv2.cvtColor(ela_coloured, cv2.COLOR_RGB2BGR)
    ela_coloured_r = cv2.resize(ela_coloured, (W, H))

    if flow_mag is not None:
        flow_n = (flow_mag - flow_mag.min()) / (np.ptp(flow_mag) + 1e-8)
        flow_col = (mplcm.cool(flow_n)[:,:,:3] * 255).astype(np.uint8)
        flow_col = cv2.cvtColor(flow_col, cv2.COLOR_RGB2BGR)
        flow_col_r = cv2.resize(flow_col, (W, H))
    else:
        flow_col_r = frame_bgr.copy()

    noise_col = (mplcm.YlOrRd(noise_map)[:,:,:3] * 255).astype(np.uint8)
    noise_col = cv2.cvtColor(noise_col, cv2.COLOR_RGB2BGR)
    noise_col_r = cv2.resize(noise_col, (W, H))

    ela_blend   = cv2.addWeighted(frame_bgr, 0.45, ela_coloured_r, 0.55, 0)
    flow_blend  = cv2.addWeighted(frame_bgr, 0.45, flow_col_r,     0.55, 0)
    noise_blend = cv2.addWeighted(frame_bgr, 0.45, noise_col_r,    0.55, 0)

    if mode == 'split':
        mid = W // 2
        out[:, :mid]  = ela_blend[:, :mid]
        out[:, mid:]  = flow_blend[:, mid:]
        cv2.line(out, (mid, 0), (mid, H), (200,200,200), 1)
        cv2.putText(out, 'ELA map', (8, H-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255,255,255), 1, cv2.LINE_AA)
        cv2.putText(out, 'Motion map', (mid+6, H-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255,255,255), 1, cv2.LINE_AA)
    elif mode == 'ela':
        out = ela_blend
    elif mode == 'flow':
        out = flow_blend
    elif mode == 'noise':
        out = noise_blend

    ela_full = cv2.resize((ela_norm * 255).astype(np.uint8), (W, H))
    _, thresh = cv2.threshold(ela_full, int(ela_full.max() * 0.75), 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:3]
    box_colors = [(0,60,230), (0,140,255), (0,200,180)]   
    
    for ci, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < (W*H*0.005): continue   
        x,y,w,h = cv2.boundingRect(cnt)
        pad = 6
        x,y = max(0,x-pad), max(0,y-pad)
        w,h = min(W-x,w+2*pad), min(H-y,h+2*pad)
        color_bgr = box_colors[ci % len(box_colors)]
        cv2.rectangle(out, (x,y), (x+w,y+h), color_bgr, 2)
        labels = ['High suspicion','Medium suspicion','Low suspicion']
        cv2.putText(out, labels[ci], (x+3, y-4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, color_bgr, 1, cv2.LINE_AA)

    banner_h = max(52, H // 10)
    banner   = np.zeros((banner_h, W, 3), dtype=np.uint8)
    is_fake  = global_verdict == 'DEEPFAKE'
    banner_color = (50, 50, 210) if is_fake else (50, 160, 80)
    banner[:] = banner_color

    verdict_text = f'DEEPFAKE  {global_fake_pct:.0%} confidence' if is_fake else f'REAL  {global_real_pct:.0%} confidence'
    font_scale  = max(0.55, banner_h / 80)
    cv2.putText(banner, f'TraceNet | {verdict_text}',
                (10, banner_h//2 + 6),
                cv2.FONT_HERSHEY_DUPLEX, font_scale, (255,255,255), 1, cv2.LINE_AA)

    ts_sec = frame_idx / max(fps, 1)
    ts_str = f'{int(ts_sec//60):02d}:{ts_sec%60:05.2f}'
    cv2.putText(banner, ts_str, (W - 100, banner_h//2 + 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220,220,220), 1, cv2.LINE_AA)

    out = np.vstack([banner, out])
    H_out = out.shape[0]

    hud_h   = max(80, H // 6)
    hud     = np.zeros((hud_h, W, 3), dtype=np.uint8)
    hud[:]  = (30, 30, 30)

    score_pct = int(score * 100)
    score_col = (0, int(255*(1-score)), int(255*score))  
    cv2.putText(hud, f'Frame suspicion: {score_pct}%',
                (10, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.50,
                score_col, 1, cv2.LINE_AA)

    bar_x, bar_y = 10, 26
    bar_w = int((W - 20) * score)
    cv2.rectangle(hud, (bar_x, bar_y), (bar_x + W-20, bar_y+10), (70,70,70), -1)
    cv2.rectangle(hud, (bar_x, bar_y), (bar_x + bar_w, bar_y+10), score_col, -1)

    sig_labels = ['ELA', 'Motion', 'Noise', 'Texture', 'Face']
    sig_w      = (W - 20) // len(sig_labels)
    for si, (k, v) in enumerate(signals.items()):
        sx   = 10 + si * sig_w
        sy   = 44
        bh   = max(2, int((hud_h - sy - 18) * min(v, 1.0)))
        bc   = (0, int(255*(1-v)), int(255*v))
        cv2.rectangle(hud, (sx, sy), (sx+sig_w-4, sy+hud_h-sy-18), (55,55,55), -1)
        cv2.rectangle(hud, (sx, sy+hud_h-sy-18-bh), (sx+sig_w-4, sy+hud_h-sy-18), bc, -1)
        cv2.putText(hud, k, (sx, hud_h-5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (180,180,180), 1, cv2.LINE_AA)

    graph_w = min(160, W//4)
    graph_h = hud_h - 10
    gx      = W - graph_w - 6
    gy      = 5
    cv2.rectangle(hud, (gx, gy), (gx+graph_w, gy+graph_h), (55,55,55), -1)
    if len(history_scores) > 1:
        pts = []
        for hi, hs in enumerate(history_scores[-graph_w:]):
            px = gx + int(hi * graph_w / max(len(history_scores[-graph_w:]),1))
            py = gy + graph_h - int(hs * graph_h)
            pts.append((px, py))
        for pi in range(len(pts)-1):
            sc_here = history_scores[-(len(pts)-pi)]
            lc = (0, int(255*(1-sc_here)), int(255*sc_here))
            cv2.line(hud, pts[pi], pts[pi+1], lc, 1, cv2.LINE_AA)
    cv2.putText(hud, 'Suspicion history', (gx+2, gy+graph_h+0),
                cv2.FONT_HERSHEY_SIMPLEX, 0.28, (140,140,140), 1)

    out = np.vstack([out, hud])
    return out

# -----------------------------------------------------------------------------
# MAIN ANALYSIS PIPELINE
# -----------------------------------------------------------------------------
# Add this import at the top if you don't have it

def analyse_video(input_path, output_filename='tracenet_analysed.mp4', mode='split', max_frames=None):
    # Ensure model is loaded
    if not load_video_model():
        raise RuntimeError("TraceNet Video Model is missing.")

    output_dir = os.path.join('static', 'outputs')
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, output_filename)
    cap = cv2.VideoCapture(input_path)
    
    if not cap.isOpened():
        raise ValueError(f"Cannot open video file: {input_path}")

    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps    = cap.get(cv2.CAP_PROP_FPS) or 25.0
    W      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_proc = min(total, max_frames) if max_frames else total

    # 1. Global video prediction
    video_feats = extract_video_features(input_path, n_frames=12)
    if video_feats is not None:
        pred            = best_model.predict(video_feats.reshape(1,-1))[0]
        proba           = best_model.predict_proba(video_feats.reshape(1,-1))[0]
        global_verdict  = 'REAL' if pred == 1 else 'DEEPFAKE'
        global_fake_pct = float(proba[0])
    else:
        global_verdict  = 'UNKNOWN'
        global_fake_pct = 0.5

    tmp_path = 'temp_raw_output.mp4'
    banner_h = max(52, H // 10)
    hud_h    = max(80, H // 6)
    out_H    = H + banner_h + hud_h
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (W, out_H))

    prev_gray = None
    history_scores = []
    
    # Track the most suspicious frame for UI extraction
    highest_score = -1.0
    extracted_data = {
        "original_frame": "",
        "ela_map": "",
        "flow_map": "",
        "peak_score": 0.0
    }

    base_name = output_filename.replace('.mp4', '')

    for fi in tqdm(range(n_proc), desc='Processing Video'):
        ret, frame_bgr = cap.read()
        if not ret: break

        frame_rgb  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        frame_gray = cv2.cvtColor(cv2.resize(frame_bgr, (IMG_SIZE, IMG_SIZE)), cv2.COLOR_BGR2GRAY)

        score, ela_norm, flow_mag, noise_map, signals = score_frame(frame_rgb, prev_gray)
        history_scores.append(score)

        # EXTRACTION LOGIC: Save maps if this is the most suspicious frame so far
        if score > highest_score:
            highest_score = score
            extracted_data["peak_score"] = round(score * 100, 1)
            
            # 1. Save Original
            orig_path = os.path.join(output_dir, f"{base_name}_orig.jpg")
            cv2.imwrite(orig_path, frame_bgr)
            extracted_data["original_frame"] = f"/static/outputs/{base_name}_orig.jpg"
            
            # 2. Save ELA Heatmap (The Red/Orange color map)
            ela_coloured = (mplcm.hot(ela_norm)[:,:,:3] * 255).astype(np.uint8)
            ela_path = os.path.join(output_dir, f"{base_name}_ela.jpg")
            cv2.imwrite(ela_path, cv2.cvtColor(cv2.resize(ela_coloured, (W,H)), cv2.COLOR_RGB2BGR))
            extracted_data["ela_map"] = f"/static/outputs/{base_name}_ela.jpg"
            
            # 3. Save Flow Map (The Blue/Cyan color map)
            if flow_mag is not None:
                flow_n = (flow_mag - flow_mag.min()) / (np.ptp(flow_mag) + 1e-8)
                flow_col = (mplcm.cool(flow_n)[:,:,:3] * 255).astype(np.uint8)
                flow_path = os.path.join(output_dir, f"{base_name}_flow.jpg")
                cv2.imwrite(flow_path, cv2.cvtColor(cv2.resize(flow_col, (W,H)), cv2.COLOR_RGB2BGR))
                extracted_data["flow_map"] = f"/static/outputs/{base_name}_flow.jpg"

        rendered = render_overlay_frame(
            frame_bgr, score, ela_norm, flow_mag, noise_map,
            signals, global_verdict, global_fake_pct, 1-global_fake_pct,
            fi, total, fps, history_scores, mode=mode
        )

        writer.write(rendered)
        prev_gray = frame_gray

    cap.release()
    writer.release()

    # Re-encode for web playback
    try:
        subprocess.run([
            'ffmpeg', '-y', '-i', tmp_path,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.remove(tmp_path)
    except Exception:
        os.rename(tmp_path, output_path) # Fallback if ffmpeg fails

    # Return the video path and the dictionary of extracted frames
    return f"/static/outputs/{output_filename}", global_verdict, global_fake_pct, extracted_data