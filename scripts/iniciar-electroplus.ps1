# Levanta Electroplus si hace falta, espera a que responda y lo abre en una ventana propia.
# Sirve tanto para el arranque automatico como para el acceso directo del escritorio.

$puerto = 3001
$url = "http://localhost:$puerto"
$proyecto = Split-Path -Parent $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell

function Responde {
    try {
        $respuesta = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return ($respuesta.StatusCode -eq 200)
    }
    catch {
        return $false
    }
}

if (-not (Responde)) {
    # 1) Docker Desktop: si no esta abierto, se abre
    if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        $docker = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path $docker) { Start-Process $docker }
    }

    # 2) Esperar a que el motor de Docker este listo (hasta 4 minutos) y levantar el sistema
    $limite = (Get-Date).AddMinutes(4)
    while ((Get-Date) -lt $limite) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 5
    }
    if ($LASTEXITCODE -eq 0) {
        Push-Location $proyecto
        docker compose up -d *> $null
        Pop-Location
    }

    # 3) Esperar a que la pagina responda (hasta 2 minutos)
    $limite = (Get-Date).AddMinutes(2)
    while (-not (Responde) -and (Get-Date) -lt $limite) {
        Start-Sleep -Seconds 3
    }
}

if (-not (Responde)) {
    $mensaje = 'Electroplus no pudo iniciar. Espera un minuto y volve a abrirlo desde el icono del escritorio. Si sigue igual, avisa a soporte.'
    $shell.Popup($mensaje, 0, 'Electroplus', 48) | Out-Null
    exit 1
}

# 4) Abrir en una ventana propia (sin barra de direcciones) si esta Chrome; si no, en el navegador por defecto
$chrome = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process $chrome -ArgumentList "--app=$url"
}
else {
    Start-Process $url
}