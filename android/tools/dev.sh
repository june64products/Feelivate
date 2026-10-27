#!/bin/zsh
# Feelivate Android dev loop without Android Studio.
#   tools/dev.sh build            debug APK (app/build/outputs/apk/debug/app-debug.apk)
#   tools/dev.sh avd              create the "feelivate" Pixel 6 AVD (Android 14, x86_64)
#   tools/dev.sh emu              boot the emulator headless-friendly (window shown) and wait for boot
#   tools/dev.sh install          install the debug APK on the connected device/emulator and launch it
#   tools/dev.sh run              build + install + launch
#   tools/dev.sh shot [name]      screenshot to tools/shots/<name>.png
#   tools/dev.sh tap X Y | text "..." | back | log
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="$HOME/Library/Android/sdk" ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/Library/Java/*jdk*17*/Contents/Home 2>/dev/null | head -1)}"
export PATH="/usr/local/bin:/usr/bin:/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
GRADLE="${GRADLE:-$HOME/Library/gradle/gradle-8.11.1/bin/gradle}"
[ -x "$HERE/gradlew" ] && GRADLE="$HERE/gradlew"
PKG="com.june64.feelivate"
APK="$HERE/app/build/outputs/apk/debug/app-debug.apk"
cmd="${1:-run}"; shift || true
case "$cmd" in
  build)
    cd "$HERE" && "$GRADLE" assembleDebug --console=plain -q "$@" && ls -la "$APK" | awk '{print "APK", $5, "bytes"}' ;;
  avd)
    echo no | avdmanager create avd --name feelivate --package "system-images;android-34;google_apis;x86_64" --device pixel_6 --force
    CFG="$HOME/.android/avd/feelivate.avd/config.ini"
    for kv in "hw.ramSize=1536" "disk.dataPartition.size=2G" "hw.gpu.enabled=yes" "hw.gpu.mode=host" "hw.keyboard=yes" "vm.heapSize=256" "showDeviceFrame=no" "hw.lcd.density=420" "hw.lcd.width=1080" "hw.lcd.height=2400"; do
      k=${kv%%=*}; if grep -q "^$k=" "$CFG"; then sed -i '' "s|^$k=.*|$kv|" "$CFG"; else echo "$kv" >> "$CFG"; fi
    done; emulator -list-avds ;;
  emu)
    if adb -e get-state >/dev/null 2>&1; then echo "emulator already running"; exit 0; fi
    # -dns-server: the emulator's own resolver fails on this Mac (UnknownHostException in the app); pin public DNS.
    nohup emulator -avd feelivate -no-snapshot -no-boot-anim -no-audio -gpu host -memory 1536 -netdelay none -netspeed full -dns-server 8.8.8.8,1.1.1.1 > "$HERE/tools/emu.log" 2>&1 &
    for i in $(seq 1 60); do sleep 5; [ "$(adb -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && { echo "booted in $((i*5))s"; adb -e shell settings put global window_animation_scale 0.5 >/dev/null 2>&1; exit 0; }; done
    echo "emulator did not boot; see tools/emu.log"; tail -5 "$HERE/tools/emu.log"; exit 1 ;;
  install)
    adb install -r -t "$APK" | tail -1 && adb shell am start -n "$PKG/.MainActivity" >/dev/null && sleep 3 && echo "launched $PKG" ;;
  run) "$0" build && "$0" install ;;
  shot) mkdir -p "$HERE/tools/shots"; n="${1:-shot}"; adb exec-out screencap -p > "$HERE/tools/shots/$n.png" && echo "$HERE/tools/shots/$n.png" ;;
  tap) adb shell input tap "$1" "$2" ;;
  text) adb shell input text "$(printf '%s' "$1" | sed 's/ /%s/g')" ;;
  back) adb shell input keyevent 4 ;;
  log) adb logcat -d -v brief | grep -E "AndroidRuntime|$PKG|FATAL" | tail -60 ;;
  *) echo "unknown: $cmd"; exit 2 ;;
esac
