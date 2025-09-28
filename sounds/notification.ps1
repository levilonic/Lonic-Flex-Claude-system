# Simple Windows notification sound generator
# Creates a pleasant notification beep

param(
    [int]$Frequency = 800,
    [int]$Duration = 200
)

try {
    [console]::beep($Frequency, $Duration)
} catch {
    # Fallback - try system default sound
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SystemSounds]::Asterisk.Play()
    } catch {
        Write-Host "Audio notification failed"
    }
}