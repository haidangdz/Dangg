from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "avatar-yinyang-dragon-16.png"
OUTPUT = ROOT / "public" / "avatar-yinyang-dragon-64.png"
POSTER = ROOT / "public" / "avatar-yinyang-dragon-poster.png"

GRID_COLUMNS = 4
GRID_ROWS = 4
FRAME_SIZE = 224
TWEENS_PER_FRAME = 4
FRAME_DURATION_MS = 78


def extract_frames(sheet: Image.Image) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            left = round(column * sheet.width / GRID_COLUMNS)
            top = round(row * sheet.height / GRID_ROWS)
            right = round((column + 1) * sheet.width / GRID_COLUMNS)
            bottom = round((row + 1) * sheet.height / GRID_ROWS)
            frame = sheet.crop((left, top, right, bottom))
            frames.append(
                frame.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
            )
    return frames


def tween_frames(frames: list[Image.Image]) -> list[Image.Image]:
    animation: list[Image.Image] = []
    for index, current in enumerate(frames):
        following = frames[(index + 1) % len(frames)]
        for tween in range(TWEENS_PER_FRAME):
            amount = tween / TWEENS_PER_FRAME
            animation.append(Image.blend(current, following, amount))
    return animation


def main() -> None:
    with Image.open(SOURCE) as source:
        base_frames = extract_frames(source.convert("RGBA"))

    base_frames[0].save(POSTER, optimize=True)
    animation = tween_frames(base_frames)
    strip = Image.new(
        "RGBA",
        (FRAME_SIZE * len(animation), FRAME_SIZE),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(animation):
        strip.paste(frame, (index * FRAME_SIZE, 0))
    strip.save(OUTPUT, optimize=True, compress_level=9)
    print(
        f"Wrote {OUTPUT.name}: {len(animation)} frames, "
        f"{FRAME_DURATION_MS}ms/frame, {OUTPUT.stat().st_size} bytes"
    )


if __name__ == "__main__":
    main()
