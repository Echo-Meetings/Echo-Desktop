# Echo

![echo_social_card_svg](https://github.com/user-attachments/assets/0f0277b0-cfa9-4c89-bb94-e8c85759793a)

**Private, offline transcription app for macOS, Windows, and Linux.**

Transcribe audio and video files entirely on your device using [whisper.cpp](https://github.com/ggerganov/whisper.cpp). No internet required, no data ever leaves your machine.

**Приватное офлайн-приложение для транскрибации на macOS, Windows и Linux.**

Транскрибируйте аудио и видео файлы полностью на вашем устройстве с помощью [whisper.cpp](https://github.com/ggerganov/whisper.cpp). Без интернета, данные никуда не отправляются.

---

## Features / Возможности

- **100% local processing** — all transcription happens on-device using whisper.cpp
- **Cross-platform** — macOS, Windows (x64, ARM64), Linux (x64, ARM64)
- **Audio & video support** — MP3, WAV, M4A, MP4, MOV, MKV, and more
- **Synchronized playback** — click any transcript line to jump to that moment
- **Transcription queue** — process multiple files concurrently
- **History & search** — sidebar with full history, search, and date filters (Today, Yesterday, 7d, 30d)
- **Multi-language UI** — English, Русский, Deutsch, Fran&ccedil;ais
- **Export** — copy to clipboard or save as .txt
- **Privacy-first** — no accounts, no cloud, no tracking, no analytics

<img width="1800" height="1132" alt="Echo dark mode" src="https://github.com/user-attachments/assets/810f398f-7a4a-4b2b-bd54-8eca2d82abda" />

---

- **100% локальная обработка** — вся транскрибация на устройстве через whisper.cpp
- **Кроссплатформенность** — macOS, Windows (x64, ARM64), Linux (x64, ARM64)
- **Аудио и видео** — MP3, WAV, M4A, MP4, MOV, MKV и другие форматы
- **Синхронное воспроизведение** — клик по строке транскрипта перематывает к нужному моменту
- **Очередь транскрибации** — обработка нескольких файлов одновременно
- **История и поиск** — боковая панель с историей, поиском и фильтрами (Сегодня, Вчера, 7д, 30д)
- **Мультиязычный интерфейс** — English, Русский, Deutsch, Fran&ccedil;ais
- **Экспорт** — копирование в буфер обмена или сохранение как .txt
- **Приватность** — без аккаунтов, без облака, без трекинга, без аналитики

<img width="1800" height="1122" alt="Echo light mode" src="https://github.com/user-attachments/assets/7d123f70-85f9-437f-b46a-f9c77538b2c2" />

## Installation / Установка

### macOS

1. Download `Echo-x.x.x-arm64.dmg` (Apple Silicon) or `Echo-x.x.x-x64.dmg` (Intel) from [Releases](../../releases/latest)
2. Open the DMG and drag Echo to Applications
3. Launch Echo — the AI model downloads automatically on first run (~1.5 GB, one time only)

### Windows

1. Download `Echo-x.x.x-x64.zip` or `Echo-x.x.x-arm64.zip` from [Releases](../../releases/latest)
2. Extract and run `Echo.exe`

### Linux

1. Download `.AppImage` or `.deb` from [Releases](../../releases/latest)
2. For AppImage: `chmod +x Echo-*.AppImage && ./Echo-*.AppImage`
3. For deb: `sudo dpkg -i echo-desktop_*.deb`

<img width="668" height="414" alt="Model setup" src="https://github.com/user-attachments/assets/16798909-a17b-4ef9-b348-84e1551388ed" />

---

### macOS

1. Скачайте `Echo-x.x.x-arm64.dmg` (Apple Silicon) или `Echo-x.x.x-x64.dmg` (Intel) из [Releases](../../releases/latest)
2. Откройте DMG и перетащите Echo в Applications
3. Запустите Echo — ИИ-модель скачается автоматически при первом запуске (~1.5 ГБ, один раз)

### Windows

1. Скачайте `Echo-x.x.x-x64.zip` или `Echo-x.x.x-arm64.zip` из [Releases](../../releases/latest)
2. Распакуйте и запустите `Echo.exe`

### Linux

1. Скачайте `.AppImage` или `.deb` из [Releases](../../releases/latest)
2. Для AppImage: `chmod +x Echo-*.AppImage && ./Echo-*.AppImage`
3. Для deb: `sudo dpkg -i echo-desktop_*.deb`

## Requirements / Требования

- **macOS** 14 (Sonoma) or later, Apple Silicon or Intel
- **Windows** 10/11, x64 or ARM64
- **Linux** Ubuntu 22.04+, Fedora 38+, or equivalent

## Third-party software / Стороннее ПО

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — on-device speech recognition (MIT License)
- [ffmpeg](https://ffmpeg.org/) — media format conversion (LGPL / GPL)
- [Electron](https://www.electronjs.org/) — cross-platform desktop framework (MIT License)

## License / Лицензия

[MIT](LICENSE)
