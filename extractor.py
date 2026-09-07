import os
import shutil
import whisper
import yt_dlp
import imageio_ffmpeg
import requests
from flask import Flask, render_template, request
from newspaper import Article, Config
from moviepy import VideoFileClip
from RedDownloader import RedDownloader

real_ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
project_dir = os.getcwd()
target_ffmpeg = os.path.join(project_dir, "ffmpeg.exe")
if not os.path.exists(target_ffmpeg):
    shutil.copy(real_ffmpeg_path, target_ffmpeg)

os.environ["PATH"] = project_dir + os.pathsep + os.environ["PATH"]
os.environ["IMAGEIO_FFMPEG_EXE"] = target_ffmpeg

DOWNLOAD_FOLDER = os.path.join('static', 'downloads')

# Load Whisper Tiny (CPU-Optimized for speed)
print("⌛ Loading TraceNet Speech Engine (Whisper Tiny)...")
speech_model = whisper.load_model("tiny")

def clear_cache():
    """Wipes the folder to ensure 100% accurate data for each new search."""
    if os.path.exists(DOWNLOAD_FOLDER):
        shutil.rmtree(DOWNLOAD_FOLDER)
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

def universal_fetcher(url):
    clear_cache()
    file_path = None
    caption = "No metadata found."

    # --- 1. SPECIAL CASE: REDDIT ---
    if "reddit.com" in url:
        try:
            RedDownloader.Download(url, output=DOWNLOAD_FOLDER)
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                caption = info.get('title', 'Reddit Post')
            files = [os.path.join(DOWNLOAD_FOLDER, f) for f in os.listdir(DOWNLOAD_FOLDER)]
            if files: file_path = files[0]
            return file_path, caption
        except Exception as e:
            print(f"Reddit Fetch Note: {e}")

    # --- 2. PLAN A: yt-dlp (Universal Video/Media) ---
    ydl_opts = {
        'outtmpl': f'{DOWNLOAD_FOLDER}/%(title).50s.%(ext)s',
        'format': 'best',
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': False, # Set to False to trigger our Plan B fallback
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info:
                if 'entries' in info: info = info['entries'][0]
                file_path = ydl.prepare_filename(info)
                caption = info.get('description') or info.get('title') or ""
                return file_path, caption
    except Exception:
        print("Plan A: No video stream found. Switching to Plan B (Image Extraction)...")

    # --- 3. PLAN B: Newspaper3k Fallback (Instagram/X Photos) ---
    try:
        config = Config()
        config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0'
        article = Article(url, config=config)
        article.download()
        article.parse()
        
        # Grab Image
        if article.top_image:
            img_data = requests.get(article.top_image).content
            file_path = os.path.join(DOWNLOAD_FOLDER, "extracted_media.jpg")
            with open(file_path, 'wb') as f:
                f.write(img_data)
        
        caption = article.text if len(article.text) > 10 else article.title
        return file_path, caption
    except Exception as e:
        print(f"Plan B Error: {e}")

    return None, "Extraction failed."

def index():
    analysis = None
    if request.method == 'POST':
        url = request.form.get('url')
        opt_ai = request.form.get('opt_ai')
        opt_misinfo = request.form.get('opt_misinfo')
        analysis = {"ai_result": "", "misinfo_text": "", "video_transcript": "", "file": ""}

        # Step 1: Execute Universal Fetcher
        file_path, caption = universal_fetcher(url)
        analysis["file"] = file_path

        # Step 2: AI Pixel Detection Logic
        if opt_ai and file_path:
            ext = os.path.splitext(file_path)[1].lower()
            analysis["ai_result"] = f"Media Type: {ext.upper()} | File saved for Pixel/Metadata analysis."

        # Step 3: Misinformation & Video-to-Text Logic
        if opt_misinfo:
            analysis["misinfo_text"] = caption
            
            # Transcription (Only if it's a video)
            if file_path and file_path.lower().endswith(('.mp4', '.mov', '.mkv', '.webm')):
                try:
                    video = VideoFileClip(file_path)
                    temp_audio = "temp_voice.mp3"
                    video.audio.write_audiofile(temp_audio, logger=None)
                    
                    out = speech_model.transcribe(temp_audio, fp16=False)
                    analysis["video_transcript"] = out["text"]
                    
                    video.close()
                    if os.path.exists(temp_audio): os.remove(temp_audio)
                except Exception as e:
                    analysis["video_transcript"] = f"Transcription skipped: {e}"
            elif file_path:
                analysis["video_transcript"] = "Note: Media is a static image. No audio detected."

    return render_template('index.html', analysis=analysis)
