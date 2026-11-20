# Instala las tareas automaticas de Electroplus en esta PC.
# Se ejecuta con instalar.bat, con el mismo usuario de Windows que va a usar el sistema.

$ErrorActionPreference = 'Stop'

$scripts = $PSScriptRoot
$vbs = Join-Path $scripts 'oculto.vbs'
$usuario = '{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME

$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

function Registrar($nombre, $nombreScript, $disparador) {
    $ruta = Join-Path $scripts $nombreScript
    $accion = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('//B "{0}" "{1}"' -f $vbs, $ruta)
    Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Principal $principal -Settings $config -Force | Out-Null
    Write-Host ('Tarea creada: ' + $nombre)
}

# 1) Al iniciar sesion: levanta el sistema y abre la pagina
Registrar 'Electroplus - iniciar sistema' 'iniciar-electroplus.ps1' (New-ScheduledTaskTrigger -AtLogOn -User $usuario)

# 2) Cada hora: copia las copias de seguridad nuevas al pendrive (si esta puesto)
$cadaHora = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
Registrar 'Electroplus - copia a pendrive' 'copiar-a-pendrive.ps1' $cadaHora

# 3) Acceso directo en el escritorio
$escritorio = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$acceso = $shell.CreateShortcut((Join-Path $escritorio 'Electroplus.lnk'))
$acceso.TargetPath = 'wscript.exe'
$acceso.Arguments = ('//B "{0}" "{1}"' -f $vbs, (Join-Path $scripts 'iniciar-electroplus.ps1'))
$acceso.IconLocation = (Join-Path $scripts 'electroplus.ico') + ',0'
$acceso.Description = 'Abrir Electroplus'
$acceso.Save()
Write-Host 'Acceso directo creado en el escritorio'

Write-Host ''
Write-Host 'Listo.'