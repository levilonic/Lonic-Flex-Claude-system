#!/bin/bash

# Claude Audio Notification Script
# Plays sound when Claude finishes responding
# Cross-platform support for Windows, macOS, and Linux

# Function to detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*) echo "linux" ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

# Function to play sound based on OS
play_sound() {
    local sound_type="${1:-notification}"
    local os=$(detect_os)
    local sound_dir="$(dirname "$0")/sounds"

    # Create sounds directory if it doesn't exist
    mkdir -p "$sound_dir"

    case $os in
        "macos")
            if [[ -f "$sound_dir/${sound_type}.wav" ]]; then
                afplay "$sound_dir/${sound_type}.wav" &
            elif [[ -f "$sound_dir/${sound_type}.mp3" ]]; then
                afplay "$sound_dir/${sound_type}.mp3" &
            else
                # Use system default sound
                afplay /System/Library/Sounds/Glass.aiff &
            fi
            ;;
        "linux")
            if command -v paplay >/dev/null 2>&1; then
                if [[ -f "$sound_dir/${sound_type}.wav" ]]; then
                    paplay "$sound_dir/${sound_type}.wav" &
                elif [[ -f "$sound_dir/${sound_type}.mp3" ]]; then
                    paplay "$sound_dir/${sound_type}.mp3" &
                else
                    # Use system default sound or generate beep
                    paplay /usr/share/sounds/alsa/Front_Left.wav 2>/dev/null || echo -e '\a' &
                fi
            elif command -v aplay >/dev/null 2>&1; then
                if [[ -f "$sound_dir/${sound_type}.wav" ]]; then
                    aplay "$sound_dir/${sound_type}.wav" &
                else
                    echo -e '\a' &
                fi
            else
                echo -e '\a' &
            fi
            ;;
        "windows")
            # Use PowerShell for Windows
            if [[ -f "$sound_dir/${sound_type}.wav" ]]; then
                powershell.exe -c "(New-Object Media.SoundPlayer '$sound_dir\\${sound_type}.wav').PlaySync()" &
            elif [[ -f "$sound_dir/${sound_type}.mp3" ]]; then
                powershell.exe -c "Add-Type -AssemblyName presentationCore; (New-Object Media.MediaPlayer).Open('$sound_dir\\${sound_type}.mp3'); Start-Sleep 1" &
            else
                # Use system default beep
                powershell.exe -c "[console]::beep(800,300)" &
            fi
            ;;
        *)
            echo "Unsupported operating system: $os"
            echo -e '\a' &
            ;;
    esac
}

# Main execution
main() {
    local notification_type="${1:-notification}"

    case $notification_type in
        "stop"|"complete"|"done")
            play_sound "stop"
            ;;
        "error"|"fail")
            play_sound "error"
            ;;
        "start"|"begin")
            play_sound "start"
            ;;
        *)
            play_sound "notification"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"