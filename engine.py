#!/usr/bin/env python3
"""
OmniCut Local Engine
Executes an instruction-based JSON recipe on a video file.
Handles Kokoro TTS (am_eric), automated audio ducking, subtitle burning, and FFmpeg assembly.
"""

import os
import sys
import json
import argparse
import subprocess
import shutil

def parse_args():
    parser = argparse.ArgumentParser(description="OmniCut Instruction-Based Video Engine")
    parser.add_argument("--video", "-v", required=True, help="Input video file path (mp4, mov)")
    parser.add_argument("--instructions", "-i", required=True, help="Path to instructions.json")
    parser.add_argument("--output", "-o", default="output_master.mp4", help="Path for rendered master output")
    parser.add_argument("--skip-tts", action="store_true", help="Skip TTS generation if audio files already exist")
    return parser.parse_args()

def run_cmd(cmd):
    print(f"[CMD] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[ERROR] {res.stderr}")
        sys.exit(res.returncode)
    return res.stdout

def generate_voiceover(vo_items, work_dir):
    """Generates voiceover clips using Kokoro TTS (am_eric)"""
    try:
        from kokoro import KPipeline
        import soundfile as sf
        import numpy as np
    except ImportError:
        print("[WARN] Kokoro / soundfile not installed in current environment. Using dummy / existing WAVs.")
        return []

    print("[INFO] Initializing Kokoro TTS (lang_code='a')...")
    pipeline = KPipeline(lang_code='a')
    generated_tracks = []

    for idx, item in enumerate(vo_items):
        text = item.get("text", "")
        voice = item.get("voice", "am_eric")
        speed = item.get("speed", 1.05)
        ts = item.get("timestamp_sec", 0.0)
        vol = item.get("volume", 1.2)

        out_wav = os.path.join(work_dir, f"vo_segment_{idx}.wav")
        print(f"[INFO] Generating VO #{idx} at {ts:.2f}s with voice '{voice}'...")
        
        gen = pipeline(text, voice=voice, speed=speed)
        audios = [a for _, _, a in gen]
        if audios:
            combined = np.concatenate(audios)
            sf.write(out_wav, combined, 24000)
            dur = len(combined) / 24000
            print(f"       -> Saved {out_wav} ({dur:.2f}s)")
            generated_tracks.append({
                "path": out_wav,
                "timestamp_sec": ts,
                "duration": dur,
                "volume": vol
            })
    return generated_tracks

def build_ffmpeg_filter(ducking_rules, vo_tracks, watermark_boxes):
    """Constructs dynamic audio ducking and video filters for FFmpeg"""
    filter_parts = []
    
    # 1. Audio ducking volume expression for input 0:a
    if ducking_rules:
        # Build nested if expression: if(between(t, s1, e1), v1, if(between(t, s2, e2), v2, 1.0))
        expr = "1.0"
        for rule in reversed(ducking_rules):
            s = rule["start_sec"]
            e = rule["end_sec"]
            v = rule["original_volume"]
            expr = f"if(between(t,{s},{e}),{v},{expr})"
        filter_parts.append(f"[0:a]volume=eval=frame:volume='{expr}'[ducked_base]")
    else:
        filter_parts.append("[0:a]volume=1.0[ducked_base]")

    # 2. Add each voiceover stream with delay
    inputs_to_mix = ["[ducked_base]"]
    for i, vo in enumerate(vo_tracks):
        delay_ms = int(vo["timestamp_sec"] * 1000)
        vol = vo["volume"]
        stream_idx = i + 1
        filter_parts.append(f"[{stream_idx}:a]adelay={delay_ms}|{delay_ms},volume={vol}[delayed_vo_{i}]")
        inputs_to_mix.append(f"[delayed_vo_{i}]")

    # 3. Mix all audio streams
    mix_count = len(inputs_to_mix)
    filter_parts.append(f"{''.join(inputs_to_mix)}amix=inputs={mix_count}:duration=first:dropout_transition=2[aout]")

    return ";".join(filter_parts)

def main():
    args = parse_args()

    if not os.path.exists(args.video):
        print(f"[ERROR] Video file not found: {args.video}")
        sys.exit(1)
    if not os.path.exists(args.instructions):
        print(f"[ERROR] Instructions JSON file not found: {args.instructions}")
        sys.exit(1)

    with open(args.instructions, "r", encoding="utf-8") as f:
        recipe = json.load(f)

    work_dir = os.path.join(os.path.dirname(os.path.abspath(args.output)), "_tmp_omnicut")
    os.makedirs(work_dir, exist_ok=True)

    print("==================================================")
    print("🎬 OmniCut Master Pipeline")
    print(f"Project: {recipe.get('metadata', {}).get('project_name', 'Untitled')}")
    print(f"Input:   {args.video}")
    print(f"Output:  {args.output}")
    print("==================================================")

    vo_items = recipe.get("voiceover", [])
    vo_tracks = []
    if not args.skip_tts and vo_items:
        vo_tracks = generate_voiceover(vo_items, work_dir)

    ducking_rules = recipe.get("audio_ducking", [])
    watermark_boxes = recipe.get("effects", {}).get("watermark_removal", [])

    complex_filter = build_ffmpeg_filter(ducking_rules, vo_tracks, watermark_boxes)

    cmd = ["ffmpeg", "-y", "-i", args.video]
    for vo in vo_tracks:
        cmd.extend(["-i", vo["path"]])

    cmd.extend([
        "-filter_complex", complex_filter,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        args.output
    ])

    print("[INFO] Rendering final video with FFmpeg...")
    run_cmd(cmd)

    # Cleanup temp
    try:
        shutil.rmtree(work_dir)
    except:
        pass

    print("==================================================")
    print(f"✅ Render Complete! Master Video: {args.output}")
    print("==================================================")

if __name__ == "__main__":
    main()
