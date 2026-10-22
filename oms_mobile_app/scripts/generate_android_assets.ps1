Add-Type -AssemblyName System.Drawing

$rootPath = Resolve-Path (Join-Path $PSScriptRoot "..")
$resPath = Join-Path $rootPath "android\app\src\main\res"
$logoPath = Resolve-Path (Join-Path $PSScriptRoot "..\..\public\images\logo-icon.png")

Write-Host "Generating Silicon Marketing Android Assets..."
Write-Host "Resource Path: $resPath"
Write-Host "Logo Source: $logoPath"

$srcLogo = [System.Drawing.Bitmap]::new($logoPath.Path)

# Source bounding box for the emblem (excluding transparent borders)
# X=94..940 (Width=846), Y=168..612 (Height=444)
$srcRect = [System.Drawing.Rectangle]::new(94, 168, 846, 444)

function Draw-RoundedRectangle([System.Drawing.Graphics]$g, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose()
}

function Generate-LauncherIcon([int]$size, [string]$outPath, [string]$type) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($type -eq "foreground") {
        # Transparent background for adaptive icon foreground
        $g.Clear([System.Drawing.Color]::Transparent)
        
        # In Android adaptive icons (108dp canvas), safe zone is center 66%
        $emblemW = [int]($size * 0.58)
        $emblemH = [int]($emblemW * (444.0 / 846.0))
        $emblemX = [int](($size - $emblemW) / 2)
        $emblemY = [int](($size - $emblemH) / 2)
        
        $destRect = [System.Drawing.Rectangle]::new($emblemX, $emblemY, $emblemW, $emblemH)
        $g.DrawImage($srcLogo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
    elseif ($type -eq "round") {
        $g.Clear([System.Drawing.Color]::Transparent)
        
        # Deep emerald gradient
        $rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
        $c1 = [System.Drawing.ColorTranslator]::FromHtml("#14463a")
        $c2 = [System.Drawing.ColorTranslator]::FromHtml("#1e6856")
        $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, 45.0)
        $g.FillEllipse($brush, 1, 1, $size - 2, $size - 2)
        $brush.Dispose()
        
        # Gold/emerald rim
        $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#34997e"), [Math]::Max(1.0, $size * 0.02))
        $g.DrawEllipse($pen, 1, 1, $size - 2, $size - 2)
        $pen.Dispose()

        # Center Emblem
        $emblemW = [int]($size * 0.62)
        $emblemH = [int]($emblemW * (444.0 / 846.0))
        $emblemX = [int](($size - $emblemW) / 2)
        $emblemY = [int](($size - $emblemH) / 2)

        $destRect = [System.Drawing.Rectangle]::new($emblemX, $emblemY, $emblemW, $emblemH)
        $g.DrawImage($srcLogo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
    else { # Standard legacy squircle
        $g.Clear([System.Drawing.Color]::Transparent)
        
        $padding = [Math]::Max(1.0, $size * 0.02)
        $boxSize = $size - ($padding * 2)
        $radius = $size * 0.22
        
        $rect = [System.Drawing.Rectangle]::new($padding, $padding, $boxSize, $boxSize)
        $c1 = [System.Drawing.ColorTranslator]::FromHtml("#14463a")
        $c2 = [System.Drawing.ColorTranslator]::FromHtml("#1e6856")
        $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, 45.0)
        
        Draw-RoundedRectangle $g $brush $padding $padding $boxSize $boxSize $radius
        $brush.Dispose()
        
        # Subtle border
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path.AddArc($padding, $padding, $d, $d, 180, 90)
        $path.AddArc($padding + $boxSize - $d, $padding, $d, $d, 270, 90)
        $path.AddArc($padding + $boxSize - $d, $padding + $boxSize - $d, $d, $d, 0, 90)
        $path.AddArc($padding, $padding + $boxSize - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        
        $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#34997e"), [Math]::Max(1.0, $size * 0.02))
        $g.DrawPath($pen, $path)
        $pen.Dispose()
        $path.Dispose()

        # Center Emblem
        $emblemW = [int]($size * 0.68)
        $emblemH = [int]($emblemW * (444.0 / 846.0))
        $emblemX = [int](($size - $emblemW) / 2)
        $emblemY = [int](($size - $emblemH) / 2)

        $destRect = [System.Drawing.Rectangle]::new($emblemX, $emblemY, $emblemW, $emblemH)
        $g.DrawImage($srcLogo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Generate-SplashScreen([int]$width, [int]$height, [string]$outPath, [bool]$isPortrait) {
    $bmp = [System.Drawing.Bitmap]::new($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Dark Theme Background (#1c1c1c)
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#1c1c1c")
    $g.Clear($bgColor)

    # Subtle radial center glow
    $glowRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse($glowRect)
    $pbr = [System.Drawing.Drawing2D.PathGradientBrush]::new($glowPath)
    $pbr.CenterColor = [System.Drawing.ColorTranslator]::FromHtml("#262626")
    $pbr.SurroundColors = @([System.Drawing.ColorTranslator]::FromHtml("#181818"))
    $g.FillRectangle($pbr, $glowRect)
    $pbr.Dispose()
    $glowPath.Dispose()

    # Calculate logo & text scale based on resolution
    $scaleRef = [Math]::Min($width, $height)
    
    if ($isPortrait) {
        $logoWidth = [int]($width * 0.48)
        if ($logoWidth -gt 420) { $logoWidth = 420 }
        if ($logoWidth -lt 140) { $logoWidth = 140 }
    } else {
        $logoWidth = [int]($height * 0.44)
        if ($logoWidth -gt 420) { $logoWidth = 420 }
        if ($logoWidth -lt 140) { $logoWidth = 140 }
    }
    
    $logoHeight = [int]($logoWidth * (444.0 / 846.0))
    $logoX = [int](($width - $logoWidth) / 2)
    
    # Vertically centered slightly above mid-point
    $centerYOffset = if ($isPortrait) { [int]($height * 0.05) } else { [int]($height * 0.04) }
    $logoY = [int](($height - $logoHeight) / 2) - $centerYOffset

    # Draw Emblem
    $destRect = [System.Drawing.Rectangle]::new($logoX, $logoY, $logoWidth, $logoHeight)
    $g.DrawImage($srcLogo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    # Typography
    $titleFontSize = [Math]::Max(8.0, ($scaleRef * 0.038))
    $subFontSize = [Math]::Max(6.5, ($scaleRef * 0.022))
    $tagFontSize = [Math]::Max(5.5, ($scaleRef * 0.016))

    $fontTitle = [System.Drawing.Font]::new("Georgia", [float]$titleFontSize, [System.Drawing.FontStyle]::Bold)
    $fontSub = [System.Drawing.Font]::new("Arial", [float]$subFontSize, [System.Drawing.FontStyle]::Bold)
    $fontTag = [System.Drawing.Font]::new("Arial", [float]$tagFontSize, [System.Drawing.FontStyle]::Regular)

    $brushCream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#e8e0d4"))
    $brushTeal = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#4ecdc4"))
    $brushMuted = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#736e65"))

    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Title: SILICON MARKETING
    $titleY = $logoY + $logoHeight + [int]($scaleRef * 0.035)
    $titleRect = [System.Drawing.RectangleF]::new(0, $titleY, $width, ($titleFontSize * 1.8))
    $g.DrawString("SILICON MARKETING", $fontTitle, $brushCream, $titleRect, $format)

    # Subtitle: ORDER MANAGEMENT SYSTEM
    $subY = $titleY + ($titleFontSize * 1.8) + [int]($scaleRef * 0.01)
    $subRect = [System.Drawing.RectangleF]::new(0, $subY, $width, ($subFontSize * 1.6))
    $g.DrawString("ORDER MANAGEMENT SYSTEM", $fontSub, $brushTeal, $subRect, $format)

    # Footer Tagline
    $tagY = [int]($height * 0.90)
    $tagRect = [System.Drawing.RectangleF]::new(0, $tagY, $width, ($tagFontSize * 2.0))
    $g.DrawString("ONE WORKSPACE  *  EVERY ORDER  *  COMPLETE VISIBILITY", $fontTag, $brushMuted, $tagRect, $format)

    $fontTitle.Dispose()
    $fontSub.Dispose()
    $fontTag.Dispose()
    $brushCream.Dispose()
    $brushTeal.Dispose()
    $brushMuted.Dispose()
    $format.Dispose()

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

# 1. Generate App Icons (Mipmaps)
$mipmapConfigs = @(
    @{ Name = "mipmap-mdpi"; Size = 48; FgSize = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; FgSize = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; FgSize = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; FgSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; FgSize = 432 }
)

foreach ($c in $mipmapConfigs) {
    $dir = Join-Path $resPath $c.Name
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    
    Write-Host "Creating icons for $($c.Name)..."
    Generate-LauncherIcon $c.Size (Join-Path $dir "ic_launcher.png") "standard"
    Generate-LauncherIcon $c.Size (Join-Path $dir "ic_launcher_round.png") "round"
    Generate-LauncherIcon $c.FgSize (Join-Path $dir "ic_launcher_foreground.png") "foreground"
}

# 2. Generate Splash Screens
$splashConfigs = @(
    @{ Dir = "drawable"; W = 480; H = 800; Portrait = $true },
    @{ Dir = "drawable-port-mdpi"; W = 320; H = 480; Portrait = $true },
    @{ Dir = "drawable-port-hdpi"; W = 480; H = 800; Portrait = $true },
    @{ Dir = "drawable-port-xhdpi"; W = 720; H = 1280; Portrait = $true },
    @{ Dir = "drawable-port-xxhdpi"; W = 1080; H = 1920; Portrait = $true },
    @{ Dir = "drawable-port-xxxhdpi"; W = 1440; H = 2560; Portrait = $true },
    @{ Dir = "drawable-land-mdpi"; W = 480; H = 320; Portrait = $false },
    @{ Dir = "drawable-land-hdpi"; W = 800; H = 480; Portrait = $false },
    @{ Dir = "drawable-land-xhdpi"; W = 1280; H = 720; Portrait = $false },
    @{ Dir = "drawable-land-xxhdpi"; W = 1920; H = 1080; Portrait = $false },
    @{ Dir = "drawable-land-xxxhdpi"; W = 2560; H = 1440; Portrait = $false }
)

foreach ($s in $splashConfigs) {
    $dir = Join-Path $resPath $s.Dir
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    
    Write-Host "Creating splash for $($s.Dir) ($($s.W)x$($s.H))..."
    Generate-SplashScreen $s.W $s.H (Join-Path $dir "splash.png") $s.Portrait
}

$srcLogo.Dispose()
Write-Host "Done! All Android app icons and startup splash screens generated successfully!"
