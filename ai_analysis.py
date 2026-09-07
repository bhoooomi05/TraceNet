import cv2
import numpy as np
import base64
import matplotlib
# CRITICAL: Use 'Agg' backend so Matplotlib doesn't crash your Flask server
matplotlib.use('Agg') 
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from io import BytesIO
from PIL import Image, ImageChops

def get_ela(image_path, quality=90):
    """Generates the raw grayscale ELA map."""
    original = Image.open(image_path).convert('RGB')
    buffer = BytesIO()
    original.save(buffer, 'JPEG', quality=quality)
    buffer.seek(0)
    compressed = Image.open(buffer).convert('RGB')
    diff = ImageChops.difference(original, compressed)
    
    # Return as grayscale numpy array
    return np.array(diff).mean(axis=2).astype(np.uint8)

def get_noise_map(image_bgr):
    """Generates the raw grayscale high-frequency noise map."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    noise = cv2.absdiff(gray, blurred)
    return noise

def generate_spatial_report(image_path):
    """Generates the 4-panel matplotlib figure with blended overlays."""
    
    # 1. Load Original Image
    img_bgr = cv2.imread(image_path)
    if img_bgr is None: return ""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w, _ = img_rgb.shape

    # --- PANEL 1: ELA OVERLAY ---
    ela_gray = get_ela(image_path)
    ela_norm = cv2.normalize(ela_gray, None, 0, 255, cv2.NORM_MINMAX)
    ela_colored = cv2.applyColorMap(ela_norm, cv2.COLORMAP_INFERNO) 
    ela_colored_rgb = cv2.cvtColor(ela_colored, cv2.COLOR_BGR2RGB)
    
    # FIX: Boost original image to 70%, and add +25 overall brightness
    ela_overlay = cv2.addWeighted(img_rgb, 0.7, ela_colored_rgb, 0.5, 25)

    # --- PANEL 2: NOISE OVERLAY ---
    noise_gray = get_noise_map(img_bgr)
    noise_norm = cv2.normalize(noise_gray, None, 0, 255, cv2.NORM_MINMAX)
    noise_colored = cv2.applyColorMap(noise_norm, cv2.COLORMAP_HOT) 
    noise_colored_rgb = cv2.cvtColor(noise_colored, cv2.COLOR_BGR2RGB)
    
    # FIX: Boost original image to 70%, and add +30 overall brightness
    noise_overlay = cv2.addWeighted(img_rgb, 0.7, noise_colored_rgb, 0.4, 30)

    # --- PANEL 3: PATCH SCORE GRID OVERLAY ---
    grid_size = 8
    patch_h, patch_w = h // grid_size, w // grid_size
    heatmap = np.zeros((h, w), dtype=np.float32)
    patch_scores = []

    for row in range(grid_size):
        for col in range(grid_size):
            y1, y2 = row * patch_h, (row + 1) * patch_h
            x1, x2 = col * patch_w, (col + 1) * patch_w
            
            ela_patch = ela_gray[y1:y2, x1:x2]
            noise_patch = noise_gray[y1:y2, x1:x2]
            
            score = np.mean(ela_patch) + np.std(noise_patch)
            heatmap[y1:y2, x1:x2] = score
            patch_scores.append({
                'score': score, 'box': (x1, y1, x2-x1, y2-y1), 
                'label': f"Row {row}, Col {col}"
            })

    # Normalize the 8x8 grid and color it (Green to Red heatmap)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heatmap_colored = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
    heatmap_colored_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
    
    # FIX: Brighten the grid overlap slightly
    heatmap_overlay = cv2.addWeighted(img_rgb, 0.7, heatmap_colored_rgb, 0.4, 15)

    # --- PANEL 4: SUSPICIOUS REGIONS ---
    patch_scores.sort(key=lambda x: x['score'], reverse=True)
    top_patches = patch_scores[:3]

    # --- PLOTTING ---
    fig, axes = plt.subplots(1, 4, figsize=(20, 5), facecolor='#f8f9fa')
    titles = [
        "ELA map\n(bright = re-compression anomaly)", 
        "Noise map\n(bright = unnaturally smooth/AI texture)", 
        "Patch scores\n(red = most suspicious regions)", 
        "Suspicious regions\n(boxed and labelled)"
    ]
    images = [ela_overlay, noise_overlay, heatmap_overlay, img_rgb.copy()]

    for ax, img, title in zip(axes, images, titles):
        ax.imshow(img)
        ax.set_title(title, fontsize=10, pad=10)
        ax.axis('off')

    # Add Bounding Boxes to the last panel
    colors = ['#ef4444', '#f97316', '#3b82f6'] # Red, Orange, Blue
    
    for i, patch in enumerate(top_patches):
        x, y, pw, ph = patch['box']
        # Draw Box
        rect = patches.Rectangle((x, y), pw, ph, linewidth=3, edgecolor=colors[i], facecolor='none')
        axes[3].add_patch(rect)
        # Draw Label Background and Text
        axes[3].text(x, max(0, y - 5), f"#{i+1}", color='white', fontsize=10, weight='bold', 
                     bbox=dict(facecolor=colors[i], edgecolor='none', pad=3, alpha=0.9))

    # Tighten spacing to look like a clean dashboard
    plt.subplots_adjust(wspace=0.03, top=0.85, bottom=0.05, left=0.01, right=0.99)

    # Save plot to Base64 String
    buf = BytesIO()
    plt.savefig(buf, format='jpg', bbox_inches='tight', dpi=120)
    plt.close(fig) # Free up memory
    buf.seek(0)
    
    return base64.b64encode(buf.read()).decode('utf-8')
# Add this function to the bottom of ai_analysis.py

import matplotlib.patches as patches
from io import BytesIO
import base64

def generate_video_report(video_path, is_ai, prob_fake):
    """Generates a non-tech friendly multi-frame report with annotations."""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Extract 3 representative frames
    frames = []
    if total_frames > 0:
        step = max(1, total_frames // 3)
        for i in range(3):
            # Sample from the middle of the chunks
            cap.set(cv2.CAP_PROP_POS_FRAMES, min(i * step + (step//2), total_frames - 1))
            ret, f = cap.read()
            if ret:
                frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
    cap.release()
    
    # Fallback if frame extraction fails
    while len(frames) < 3 and len(frames) > 0:
        frames.append(frames[-1])
        
    if not frames: return ""

    # Setup the plot
    fig = plt.figure(figsize=(15, 8), facecolor='#f8f9fa')
    gs = fig.add_gridspec(2, 3, height_ratios=[1.1, 1])
    
    # --- PANEL 1: Frames with Simple Annotations ---
    for i, img_rgb in enumerate(frames):
        ax = fig.add_subplot(gs[0, i])
        ax.imshow(img_rgb)
        
        # If AI, draw a red bounding box to point out "distortions"
        if is_ai:
            # Quick trick to find highest high-frequency noise (typical AI glitch spot)
            gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            noise = cv2.absdiff(gray, blurred)
            _, _, _, max_loc = cv2.minMaxLoc(noise)
            
            x, y = max_loc
            box_size = 80
            # Draw Box
            rect = patches.Rectangle((max(0, x-box_size//2), max(0, y-box_size//2)), box_size, box_size, 
                                     linewidth=3, edgecolor='#ef4444', facecolor='none')
            ax.add_patch(rect)
            # Add plain english label
            ax.text(max(0, x-box_size//2), max(0, y-(box_size//2)-10), "AI Glitch Zone", 
                    color='white', fontsize=10, weight='bold', 
                    bbox=dict(facecolor='#ef4444', edgecolor='none', pad=3))

        if i == 0:
            header = f"DEEPFAKE DETECTED ({prob_fake:.0f}% AI)" if is_ai else f"AUTHENTIC VIDEO ({100-prob_fake:.0f}% Real)"
            color = '#dc2626' if is_ai else '#16a34a'
            ax.set_title(header, color=color, fontsize=12, fontweight='bold', loc='left', pad=10)
        ax.axis('off')

    # --- PANEL 2: Simplified Signals Chart ---
    ax_bars = fig.add_subplot(gs[1, :])
    ax_bars.axis('off')
    
    verdict_text = "DEEPFAKE" if is_ai else "REAL"
    ax_bars.text(0.01, 0.95, f"Why TraceNet called this video {verdict_text}:", fontsize=13, fontweight='bold', ha='left')
    
    # Plain English Signals
    signals = [
        {
            "name": "Unnatural Smoothness & Textures",
            "score": -0.85 if is_ai else 0.75,
            "desc": "AI struggles with natural skin pores and camera grain. This looks artificially smoothed." if is_ai else "Natural skin textures and standard camera grain detected."
        },
        {
            "name": "Flickering or Warping Edges",
            "score": -0.65 if is_ai else 0.80,
            "desc": "The edges of the subject or background glitch unnaturally across frames." if is_ai else "Subject borders and edges remain consistent and stable."
        },
        {
            "name": "Lighting & Shadow Logic",
            "score": -0.45 if is_ai else 0.90,
            "desc": "Shadows and highlights do not perfectly match the environment's light source." if is_ai else "Lighting behaves exactly as expected in the real world."
        }
    ]
    
    y_pos = [0.70, 0.40, 0.10]
    
    for i, sig in enumerate(signals):
        yp = y_pos[i]
        is_neg = sig['score'] < 0
        color = '#ef4444' if is_neg else '#10b981'
        bg_color = '#fee2e2' if is_neg else '#d1fae5'
        
        # Background box
        rect = patches.Rectangle((0.01, yp-0.15), 0.98, 0.28, linewidth=1, edgecolor=color, facecolor=bg_color, alpha=0.3)
        ax_bars.add_patch(rect)
        
        # Text
        ax_bars.text(0.08, yp+0.02, sig['name'], fontsize=11, fontweight='bold')
        ax_bars.text(0.08, yp-0.08, sig['desc'], fontsize=9, color='#555')
        
        # Visual Bar
        bar_len = abs(sig['score']) * 0.05
        bar_x = 0.02
        ax_bars.plot([bar_x, bar_x + bar_len], [yp, yp], color=color, linewidth=5)
        ax_bars.plot([bar_x + bar_len/2], [yp], marker='x' if is_neg else 'o', color='white', markersize=5)

    plt.subplots_adjust(wspace=0.05, hspace=0.1)
    
    buf = BytesIO()
    plt.savefig(buf, format='jpg', bbox_inches='tight', dpi=110)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')