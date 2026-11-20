# Copia las copias de seguridad nuevas al pendrive, si esta puesto.
# El pendrive se reconoce por su NOMBRE (etiqueta), no por la letra, porque la letra puede cambiar.

$etiqueta = 'ELECTROPLUS'
$maximo = 30
$origen = Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'
$log = Join-Path $PSScriptRoot 'pendrive.log'

function Anotar($texto) {
    Add-Content -Path $log -Value ('{0:yyyy-MM-dd HH:mm}  {1}' -f (Get-Date), $texto)
    $lineas = Get-Content $log -Tail 200
    Set-Content -Path $log -Value $lineas
}

if (-not (Test-Path $origen)) { exit 0 }

$volumen = Get-Volume | Where-Object { $_.FileSystemLabel -eq $etiqueta -and $_.DriveLetter } | Select-Object -First 1
if (-not $volumen) { exit 0 }   # el pendrive no esta puesto: no hace nada

try {
    $destino = '{0}:\Electroplus-backups' -f $volumen.DriveLetter
    New-Item -ItemType Directory -Force -Path $destino | Out-Null

    # Copia las que no estan, o las que estan incompletas (distinto tamano)
    $pendientes = Get-ChildItem $origen -Filter 'electroplus_*.dump' | Where-Object {
        $copia = Join-Path $destino $_.Name
        (-not (Test-Path $copia)) -or ((Get-Item $copia).Length -ne $_.Length)
    }

    foreach ($archivo in $pendientes) {
        # Se copia con nombre temporal y se renombra al final: nunca queda una copia a medias
        $temporal = Join-Path $destino ($archivo.Name + '.tmp')
        Copy-Item $archivo.FullName -Destination $temporal -Force -ErrorAction Stop
        Move-Item $temporal -Destination (Join-Path $destino $archivo.Name) -Force -ErrorAction Stop
        Anotar ('Copiada ' + $archivo.Name)
    }

    # En el pendrive tambien se guardan solo las ultimas
    Get-ChildItem $destino -Filter 'electroplus_*.dump' |
        Sort-Object Name -Descending |
        Select-Object -Skip $maximo |
        Remove-Item -Force
}
catch {
    Anotar ('ERROR: ' + $_.Exception.Message)
}