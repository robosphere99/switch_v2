$pio = "C:\Users\robos\.platformio\penv\Scripts\pio.exe"

Write-Host "Building model-2ch..."
& $pio run -e model-2ch
Copy-Item -Path ".pio\build\model-2ch\firmware.bin" -Destination "..\firmware\firmware-2ch.bin" -Force

Write-Host "Building model-4ch..."
& $pio run -e model-4ch
Copy-Item -Path ".pio\build\model-4ch\firmware.bin" -Destination "..\firmware\firmware-4ch.bin" -Force
Copy-Item -Path ".pio\build\model-4ch\firmware.bin" -Destination "..\firmware\firmware.bin" -Force

Write-Host "Building model-8ch..."
& $pio run -e model-8ch
Copy-Item -Path ".pio\build\model-8ch\firmware.bin" -Destination "..\firmware\firmware-8ch.bin" -Force

Write-Host "Building model-dim3..."
& $pio run -e model-dim3
Copy-Item -Path ".pio\build\model-dim3\firmware.bin" -Destination "..\firmware\firmware-dim-3s.bin" -Force

Write-Host "Building model-dim4..."
& $pio run -e model-dim4
Copy-Item -Path ".pio\build\model-dim4\firmware.bin" -Destination "..\firmware\firmware-dim-4s.bin" -Force

Write-Host "All builds completed."
