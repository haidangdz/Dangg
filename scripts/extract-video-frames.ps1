param(
  [Parameter(Mandatory = $true)]
  [string]$VideoPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [int]$FrameCount = 6
)

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$resolvedVideo = (Resolve-Path -LiteralPath $VideoPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

$player = [System.Windows.Media.MediaPlayer]::new()
$player.ScrubbingEnabled = $true
$player.Open([Uri]::new($resolvedVideo))
$player.Play()

$deadline = [DateTime]::UtcNow.AddSeconds(12)
while (
  (!$player.NaturalDuration.HasTimeSpan -or $player.NaturalVideoWidth -le 0) -and
  [DateTime]::UtcNow -lt $deadline
) {
  Start-Sleep -Milliseconds 100
  [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke(
    [System.Windows.Threading.DispatcherPriority]::Background,
    [Action] {}
  )
}

if (!$player.NaturalDuration.HasTimeSpan -or $player.NaturalVideoWidth -le 0) {
  $player.Close()
  throw "Windows could not decode the supplied video."
}

$duration = $player.NaturalDuration.TimeSpan.TotalSeconds
$width = $player.NaturalVideoWidth
$height = $player.NaturalVideoHeight

for ($index = 0; $index -lt $FrameCount; $index++) {
  $time = (($index + 0.5) / $FrameCount) * $duration
  $player.Position = [TimeSpan]::FromSeconds($time)
  $player.Play()
  Start-Sleep -Milliseconds 220
  $player.Pause()

  $visual = [System.Windows.Media.DrawingVisual]::new()
  $context = $visual.RenderOpen()
  $context.DrawVideo(
    $player,
    [System.Windows.Rect]::new(0, 0, $width, $height)
  )
  $context.Close()

  $bitmap = [System.Windows.Media.Imaging.RenderTargetBitmap]::new(
    $width,
    $height,
    96,
    96,
    [System.Windows.Media.PixelFormats]::Pbgra32
  )
  $bitmap.Render($visual)

  $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
  $encoder.Frames.Add(
    [System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap)
  )
  $framePath = Join-Path $resolvedOutput ("frame-{0:D2}.png" -f ($index + 1))
  $stream = [System.IO.File]::Open(
    $framePath,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write
  )
  try {
    $encoder.Save($stream)
  } finally {
    $stream.Dispose()
  }
}

$player.Close()
Write-Output (
  "duration={0:N2}s size={1}x{2} frames={3}" -f
  $duration,
  $width,
  $height,
  $FrameCount
)
