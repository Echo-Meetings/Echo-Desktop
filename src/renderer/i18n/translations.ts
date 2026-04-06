export type UILocale = 'en' | 'ru' | 'de' | 'fr'

export const UI_LANGUAGES: { code: UILocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' }
]

export interface Translations {
  // App
  appName: string

  // Sidebar
  newTranscription: string
  active: string
  queued: string
  failed: string
  searchPlaceholder: string
  filterAll: string
  filterToday: string
  filterYesterday: string
  filter7d: string
  filter30d: string
  selected: string
  noTranscriptions: string
  dropOrClick: string
  noResults: string
  rename: string
  delete: string
  deleteTranscription: string
  deleteNTranscriptions: string
  deleteConfirmSingle: string
  deleteConfirmBatch: string
  cancel: string
  cancelTranscription: string
  cancelTranscriptionConfirm: string
  keepGoing: string

  // DropZone
  dropTitle: string
  dropSubtitle: string
  unsupportedFormat: string
  unreadable: string
  filesNotSupported: string
  filesSkipped: string

  // ProcessingView
  waitingInQueue: string
  preparing: string
  queuedStatus: string
  transcribing: string
  queuedHint: string
  transcribingHint: string

  // TranscriptView
  duration: string
  processedIn: string
  speed: string
  words: string
  characters: string
  audioError: string
  mediaNotAvailable: string
  loadingVideo: string
  cannotPlayVideo: string
  copy: string
  copied: string
  exportTxt: string
  mute: string
  unmute: string

  // ErrorView
  tryAgain: string
  chooseAnotherFile: string

  // ModelSetup
  settingUpEcho: string
  downloadingComponents: string
  ffmpegLabel: string
  whisperLabel: string
  modelLabel: string
  retry: string

  // Onboarding
  welcomeTitle: string
  welcomeSubtitle: string
  featurePrivateTitle: string
  featurePrivateDesc: string
  featureAITitle: string
  featureAIDesc: string
  featureDropTitle: string
  featureDropDesc: string
  setupTitle: string
  setupSubtitle: string
  transcriptionLanguage: string
  changeLaterHint: string
  model: string
  modelName: string
  size: string
  modelSize: string
  modelDownloadNote: string
  back: string
  next: string
  getStarted: string

  // Settings
  settingsTitle: string
  interfaceSection: string
  language: string
  interfaceLanguageDesc: string
  transcriptionSection: string
  transcriptionLanguageDesc: string
  storageSection: string
  transcriptsAndMedia: string
  revealInFinder: string
  change: string
  storageUsed: string
  privacySection: string
  privacyDesc: string
  privacyConsent: string
  accepted: string
  notAccepted: string
  viewPrivacyPolicy: string
  aboutSection: string
  version: string
  thirdPartySoftware: string
  whisperCredit: string
  ffmpegCredit: string
  showOnboarding: string

  // Model management
  modelSection: string
  modelName2: string
  modelSize2: string
  modelPath: string
  deleteModel: string
  deleteModelConfirm: string
  modelDeleting: string
  redownloadModel: string

  // Privacy Policy
  privacyPolicyTitle: string
  privacyOverviewTitle: string
  privacyOverviewText: string
  privacyDataTitle: string
  privacyDataText: string
  privacyFilesTitle: string
  privacyFilesText: string
  privacyNetworkTitle: string
  privacyNetworkText: string
  privacyThirdPartyTitle: string
  privacyThirdPartyText: string
  privacyStorageTitle: string
  privacyStorageText: string
  privacyAnalyticsTitle: string
  privacyAnalyticsText: string
  privacyChangesTitle: string
  privacyChangesText: string
  acceptAndContinue: string

  // Close warning
  closeWarningTitle: string
  closeWarningMessage: string
  closeWarningDetail: string
  quitAnyway: string
}

export const translations: Record<UILocale, Translations> = {
  en: {
    appName: 'Echo',
    newTranscription: 'New Transcription',
    active: 'ACTIVE',
    queued: 'Queued',
    failed: 'Failed',
    searchPlaceholder: 'Search...',
    filterAll: 'All',
    filterToday: 'Today',
    filterYesterday: 'Yesterday',
    filter7d: '7d',
    filter30d: '30d',
    selected: 'selected',
    noTranscriptions: 'No transcriptions yet',
    dropOrClick: 'Drop a file or click "New Transcription"',
    noResults: 'No results found',
    rename: 'Rename',
    delete: 'Delete',
    deleteTranscription: 'Delete transcription?',
    deleteNTranscriptions: 'Delete {n} transcriptions?',
    deleteConfirmSingle: '"{name}" and its media files will be permanently deleted. This action cannot be undone.',
    deleteConfirmBatch: '{n} items and their media files will be permanently deleted. This action cannot be undone.',
    cancel: 'Cancel',
    cancelTranscription: 'Cancel transcription?',
    cancelTranscriptionConfirm: '"{name}" will stop processing. Progress will be lost.',
    keepGoing: 'Keep Going',
    dropTitle: 'Drop files or click to browse',
    dropSubtitle: 'Supports MP3, WAV, M4A, MP4, MOV, WebM, OGG — multiple files at once',
    unsupportedFormat: '"{name}" — unsupported format',
    unreadable: '"{name}" — unreadable',
    filesNotSupported: '{n} files not supported. Supported: {formats}',
    filesSkipped: '{n} file(s) skipped (unsupported format)',
    waitingInQueue: 'Waiting in queue...',
    preparing: 'Preparing...',
    queuedStatus: 'Queued',
    transcribing: 'Transcribing...',
    queuedHint: 'This file will be processed after the current transcription finishes.',
    transcribingHint: 'Live transcript will appear here as Echo processes your file.',
    duration: 'Duration',
    processedIn: 'Processed in',
    speed: 'Speed',
    words: 'Words',
    characters: 'Characters',
    audioError: 'Audio playback error: {error}',
    mediaNotAvailable: 'Media file not available — playback disabled',
    loadingVideo: 'Loading video...',
    cannotPlayVideo: 'Cannot play video',
    copy: 'Copy',
    copied: 'Copied',
    exportTxt: 'Export TXT',
    mute: 'Mute',
    unmute: 'Unmute',
    tryAgain: 'Try again',
    chooseAnotherFile: 'Choose another file',
    settingUpEcho: 'Setting up Echo',
    downloadingComponents: 'Downloading required components. This only happens once.',
    ffmpegLabel: 'FFmpeg (audio processing)',
    whisperLabel: 'Whisper CLI (speech recognition)',
    modelLabel: 'Speech model (~1.5 GB)',
    retry: 'Retry',
    welcomeTitle: 'Welcome to Echo',
    welcomeSubtitle: 'Private, offline transcription for your audio and video files. Everything stays on your device.',
    featurePrivateTitle: 'Private by design',
    featurePrivateDesc: 'nothing leaves your device',
    featureAITitle: 'Powered by on-device AI',
    featureAIDesc: 'for fast transcription',
    featureDropTitle: 'Drop any audio or video file',
    featureDropDesc: 'to get started',
    setupTitle: 'Setup',
    setupSubtitle: 'Choose your transcription language and review the AI model',
    transcriptionLanguage: 'Transcription Language',
    changeLaterHint: 'You can change this later in Settings',
    model: 'Model',
    modelName: 'Whisper Large V3 Turbo',
    size: 'Size',
    modelSize: '~1.5 GB',
    modelDownloadNote: 'Will be downloaded when you tap Get Started',
    back: 'Back',
    next: 'Next',
    getStarted: 'Get Started',
    settingsTitle: 'Echo Settings',
    interfaceSection: 'INTERFACE',
    language: 'Language',
    interfaceLanguageDesc: 'Interface display language',
    transcriptionSection: 'TRANSCRIPTION',
    transcriptionLanguageDesc: 'When set to Auto-detect, Echo will automatically identify the spoken language.',
    storageSection: 'STORAGE',
    transcriptsAndMedia: 'Transcripts & media',
    revealInFinder: 'Reveal in Finder',
    change: 'Change...',
    storageUsed: 'Storage used',
    privacySection: 'PRIVACY & LEGAL',
    privacyDesc: 'All processing happens locally on your device. No data is sent to any server.',
    privacyConsent: 'Privacy consent',
    accepted: 'Accepted',
    notAccepted: 'Not accepted',
    viewPrivacyPolicy: 'View Privacy Policy',
    aboutSection: 'ABOUT',
    version: 'Version',
    thirdPartySoftware: 'Third-party software',
    whisperCredit: 'whisper.cpp (MIT) — Speech recognition',
    ffmpegCredit: 'ffmpeg 8.1 (GPL) — Video conversion',
    showOnboarding: 'Show Onboarding Again',
    modelSection: 'AI MODEL',
    modelName2: 'Model',
    modelSize2: 'Size',
    modelPath: 'Location',
    deleteModel: 'Delete Model',
    deleteModelConfirm: 'This will delete the AI model (~1.5 GB). You can re-download it anytime. Continue?',
    modelDeleting: 'Deleting...',
    redownloadModel: 'Re-download Model',
    privacyPolicyTitle: 'Privacy Policy',
    privacyOverviewTitle: '1. Overview',
    privacyOverviewText: 'Echo is a desktop application that transcribes audio and video files using on-device artificial intelligence. Privacy is a core design principle — all processing happens locally on your computer.',
    privacyDataTitle: '2. Data Collection',
    privacyDataText: 'Echo does not collect, transmit, or store any personal data on external servers. There are no accounts, no analytics, no telemetry, and no tracking of any kind.',
    privacyFilesTitle: '3. Audio & Video Files',
    privacyFilesText: 'Files you provide for transcription are processed entirely on your device. They are never uploaded anywhere. Copies of media files are stored locally in your chosen storage directory for offline playback.',
    privacyNetworkTitle: '4. Network Requests',
    privacyNetworkText: 'Echo only connects to the internet to download the AI model and required dependencies (whisper.cpp, FFmpeg) from their official open-source repositories. No other network requests are made during normal use.',
    privacyThirdPartyTitle: '5. Third-Party Software',
    privacyThirdPartyText: 'Echo uses the following open-source components: whisper.cpp (MIT License) — speech recognition engine; FFmpeg (LGPL/GPL) — audio and video format conversion. These run entirely on your device.',
    privacyStorageTitle: '6. Storage',
    privacyStorageText: 'Transcripts, media copies, and metadata are stored in a local directory you control (default: ~/Documents/EchoTranscripts). You can change this location or delete these files at any time.',
    privacyAnalyticsTitle: '7. Analytics',
    privacyAnalyticsText: 'Echo does not include any analytics, crash reporting, or usage tracking. The application operates completely offline after initial setup.',
    privacyChangesTitle: '8. Changes',
    privacyChangesText: 'If this policy is updated, changes will be included in the next app release. You can always review the current policy from the Settings screen.',
    acceptAndContinue: 'Accept & Continue',
    closeWarningTitle: 'Transcription in progress',
    closeWarningMessage: 'One or more files are still being transcribed.',
    closeWarningDetail: 'If you quit now, progress will be lost. Are you sure?',
    quitAnyway: 'Quit Anyway'
  },

  ru: {
    appName: 'Echo',
    newTranscription: 'Новая транскрипция',
    active: 'АКТИВНЫЕ',
    queued: 'В очереди',
    failed: 'Ошибка',
    searchPlaceholder: 'Поиск...',
    filterAll: 'Все',
    filterToday: 'Сегодня',
    filterYesterday: 'Вчера',
    filter7d: '7д',
    filter30d: '30д',
    selected: 'выбрано',
    noTranscriptions: 'Пока нет транскрипций',
    dropOrClick: 'Перетащите файл или нажмите "Новая транскрипция"',
    noResults: 'Ничего не найдено',
    rename: 'Переименовать',
    delete: 'Удалить',
    deleteTranscription: 'Удалить транскрипцию?',
    deleteNTranscriptions: 'Удалить {n} транскрипций?',
    deleteConfirmSingle: '"{name}" и связанные медиафайлы будут безвозвратно удалены. Это действие нельзя отменить.',
    deleteConfirmBatch: '{n} элементов и их медиафайлы будут безвозвратно удалены. Это действие нельзя отменить.',
    cancel: 'Отмена',
    cancelTranscription: 'Отменить транскрипцию?',
    cancelTranscriptionConfirm: '"{name}" прекратит обработку. Прогресс будет потерян.',
    keepGoing: 'Продолжить',
    dropTitle: 'Перетащите файлы или нажмите для выбора',
    dropSubtitle: 'Поддерживаются MP3, WAV, M4A, MP4, MOV, WebM, OGG — несколько файлов одновременно',
    unsupportedFormat: '"{name}" — неподдерживаемый формат',
    unreadable: '"{name}" — невозможно прочитать',
    filesNotSupported: '{n} файлов не поддерживается. Поддерживаемые: {formats}',
    filesSkipped: '{n} файл(ов) пропущено (неподдерживаемый формат)',
    waitingInQueue: 'Ожидание в очереди...',
    preparing: 'Подготовка...',
    queuedStatus: 'В очереди',
    transcribing: 'Транскрибирование...',
    queuedHint: 'Этот файл будет обработан после завершения текущей транскрипции.',
    transcribingHint: 'Текст появится здесь по мере обработки файла.',
    duration: 'Длительность',
    processedIn: 'Обработано за',
    speed: 'Скорость',
    words: 'Слова',
    characters: 'Символы',
    audioError: 'Ошибка воспроизведения: {error}',
    mediaNotAvailable: 'Медиафайл недоступен — воспроизведение отключено',
    loadingVideo: 'Загрузка видео...',
    cannotPlayVideo: 'Невозможно воспроизвести видео',
    copy: 'Копировать',
    copied: 'Скопировано',
    exportTxt: 'Экспорт TXT',
    mute: 'Без звука',
    unmute: 'Включить звук',
    tryAgain: 'Повторить',
    chooseAnotherFile: 'Выбрать другой файл',
    settingUpEcho: 'Настройка Echo',
    downloadingComponents: 'Загрузка необходимых компонентов. Это происходит только один раз.',
    ffmpegLabel: 'FFmpeg (обработка аудио)',
    whisperLabel: 'Whisper CLI (распознавание речи)',
    modelLabel: 'Модель речи (~1.5 ГБ)',
    retry: 'Повторить',
    welcomeTitle: 'Добро пожаловать в Echo',
    welcomeSubtitle: 'Приватная офлайн-транскрипция аудио и видео файлов. Все данные остаются на вашем устройстве.',
    featurePrivateTitle: 'Приватность по умолчанию',
    featurePrivateDesc: 'ничего не покидает ваше устройство',
    featureAITitle: 'Локальный ИИ',
    featureAIDesc: 'для быстрой транскрипции',
    featureDropTitle: 'Перетащите любой аудио или видео файл',
    featureDropDesc: 'чтобы начать',
    setupTitle: 'Настройка',
    setupSubtitle: 'Выберите язык транскрипции и ознакомьтесь с моделью ИИ',
    transcriptionLanguage: 'Язык транскрипции',
    changeLaterHint: 'Можно изменить позже в Настройках',
    model: 'Модель',
    modelName: 'Whisper Large V3 Turbo',
    size: 'Размер',
    modelSize: '~1.5 ГБ',
    modelDownloadNote: 'Будет загружена при нажатии "Начать"',
    back: 'Назад',
    next: 'Далее',
    getStarted: 'Начать',
    settingsTitle: 'Настройки Echo',
    interfaceSection: 'ИНТЕРФЕЙС',
    language: 'Язык',
    interfaceLanguageDesc: 'Язык отображения интерфейса',
    transcriptionSection: 'ТРАНСКРИПЦИЯ',
    transcriptionLanguageDesc: 'При автоопределении Echo автоматически определит язык речи.',
    storageSection: 'ХРАНИЛИЩЕ',
    transcriptsAndMedia: 'Транскрипции и медиа',
    revealInFinder: 'Показать в Finder',
    change: 'Изменить...',
    storageUsed: 'Использовано',
    privacySection: 'КОНФИДЕНЦИАЛЬНОСТЬ',
    privacyDesc: 'Вся обработка происходит локально на вашем устройстве. Никакие данные не отправляются на сервер.',
    privacyConsent: 'Согласие на конфиденциальность',
    accepted: 'Принято',
    notAccepted: 'Не принято',
    viewPrivacyPolicy: 'Политика конфиденциальности',
    aboutSection: 'О ПРИЛОЖЕНИИ',
    version: 'Версия',
    thirdPartySoftware: 'Стороннее ПО',
    whisperCredit: 'whisper.cpp (MIT) — Распознавание речи',
    ffmpegCredit: 'ffmpeg 8.1 (GPL) — Конвертация видео',
    showOnboarding: 'Показать приветствие снова',
    modelSection: 'ИИ МОДЕЛЬ',
    modelName2: 'Модель',
    modelSize2: 'Размер',
    modelPath: 'Расположение',
    deleteModel: 'Удалить модель',
    deleteModelConfirm: 'Модель ИИ (~1.5 ГБ) будет удалена. Вы сможете скачать её снова в любое время. Продолжить?',
    modelDeleting: 'Удаление...',
    redownloadModel: 'Скачать модель заново',
    privacyPolicyTitle: 'Политика конфиденциальности',
    privacyOverviewTitle: '1. Обзор',
    privacyOverviewText: 'Echo — это настольное приложение для транскрипции аудио и видео файлов с помощью локального искусственного интеллекта. Конфиденциальность является основным принципом — вся обработка происходит на вашем компьютере.',
    privacyDataTitle: '2. Сбор данных',
    privacyDataText: 'Echo не собирает, не передает и не хранит персональные данные на внешних серверах. Нет учетных записей, аналитики, телеметрии и отслеживания.',
    privacyFilesTitle: '3. Аудио и видео файлы',
    privacyFilesText: 'Файлы для транскрипции обрабатываются исключительно на вашем устройстве. Они никогда не загружаются куда-либо. Копии медиафайлов хранятся локально в выбранной вами директории.',
    privacyNetworkTitle: '4. Сетевые запросы',
    privacyNetworkText: 'Echo подключается к интернету только для загрузки ИИ-модели и зависимостей (whisper.cpp, FFmpeg) из официальных репозиториев. Других сетевых запросов не производится.',
    privacyThirdPartyTitle: '5. Стороннее ПО',
    privacyThirdPartyText: 'Echo использует следующие компоненты с открытым исходным кодом: whisper.cpp (лицензия MIT) — движок распознавания речи; FFmpeg (LGPL/GPL) — конвертация аудио и видео. Они работают исключительно на вашем устройстве.',
    privacyStorageTitle: '6. Хранение',
    privacyStorageText: 'Транскрипции, копии медиафайлов и метаданные хранятся в локальной директории (по умолчанию: ~/Documents/EchoTranscripts). Вы можете изменить расположение или удалить эти файлы в любое время.',
    privacyAnalyticsTitle: '7. Аналитика',
    privacyAnalyticsText: 'Echo не содержит аналитики, отчетов об ошибках или отслеживания использования. Приложение работает полностью офлайн после начальной настройки.',
    privacyChangesTitle: '8. Изменения',
    privacyChangesText: 'При обновлении политики изменения будут включены в следующий релиз приложения. Вы всегда можете просмотреть текущую политику в Настройках.',
    acceptAndContinue: 'Принять и продолжить',
    closeWarningTitle: 'Транскрипция в процессе',
    closeWarningMessage: 'Один или несколько файлов еще обрабатываются.',
    closeWarningDetail: 'Если вы закроете приложение, прогресс будет потерян. Вы уверены?',
    quitAnyway: 'Закрыть'
  },

  de: {
    appName: 'Echo',
    newTranscription: 'Neue Transkription',
    active: 'AKTIV',
    queued: 'Warteschlange',
    failed: 'Fehlgeschlagen',
    searchPlaceholder: 'Suchen...',
    filterAll: 'Alle',
    filterToday: 'Heute',
    filterYesterday: 'Gestern',
    filter7d: '7T',
    filter30d: '30T',
    selected: 'ausgewählt',
    noTranscriptions: 'Noch keine Transkriptionen',
    dropOrClick: 'Datei ablegen oder "Neue Transkription" klicken',
    noResults: 'Keine Ergebnisse',
    rename: 'Umbenennen',
    delete: 'Löschen',
    deleteTranscription: 'Transkription löschen?',
    deleteNTranscriptions: '{n} Transkriptionen löschen?',
    deleteConfirmSingle: '"{name}" und zugehörige Mediendateien werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteConfirmBatch: '{n} Elemente und deren Mediendateien werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    cancel: 'Abbrechen',
    cancelTranscription: 'Transkription abbrechen?',
    cancelTranscriptionConfirm: 'Die Verarbeitung von "{name}" wird gestoppt. Der Fortschritt geht verloren.',
    keepGoing: 'Fortfahren',
    dropTitle: 'Dateien ablegen oder klicken zum Durchsuchen',
    dropSubtitle: 'Unterstützt MP3, WAV, M4A, MP4, MOV, WebM, OGG — mehrere Dateien gleichzeitig',
    unsupportedFormat: '"{name}" — nicht unterstütztes Format',
    unreadable: '"{name}" — nicht lesbar',
    filesNotSupported: '{n} Dateien nicht unterstützt. Unterstützt: {formats}',
    filesSkipped: '{n} Datei(en) übersprungen (nicht unterstütztes Format)',
    waitingInQueue: 'Wartet in der Warteschlange...',
    preparing: 'Vorbereitung...',
    queuedStatus: 'Warteschlange',
    transcribing: 'Transkribierung...',
    queuedHint: 'Diese Datei wird nach der aktuellen Transkription verarbeitet.',
    transcribingHint: 'Der Text erscheint hier während Echo Ihre Datei verarbeitet.',
    duration: 'Dauer',
    processedIn: 'Verarbeitet in',
    speed: 'Geschwindigkeit',
    words: 'Wörter',
    characters: 'Zeichen',
    audioError: 'Audio-Wiedergabefehler: {error}',
    mediaNotAvailable: 'Mediendatei nicht verfügbar — Wiedergabe deaktiviert',
    loadingVideo: 'Video wird geladen...',
    cannotPlayVideo: 'Video kann nicht abgespielt werden',
    copy: 'Kopieren',
    copied: 'Kopiert',
    exportTxt: 'TXT exportieren',
    mute: 'Stummschalten',
    unmute: 'Ton an',
    tryAgain: 'Erneut versuchen',
    chooseAnotherFile: 'Andere Datei wählen',
    settingUpEcho: 'Echo wird eingerichtet',
    downloadingComponents: 'Erforderliche Komponenten werden heruntergeladen. Dies geschieht nur einmal.',
    ffmpegLabel: 'FFmpeg (Audioverarbeitung)',
    whisperLabel: 'Whisper CLI (Spracherkennung)',
    modelLabel: 'Sprachmodell (~1,5 GB)',
    retry: 'Wiederholen',
    welcomeTitle: 'Willkommen bei Echo',
    welcomeSubtitle: 'Private Offline-Transkription für Ihre Audio- und Videodateien. Alles bleibt auf Ihrem Gerät.',
    featurePrivateTitle: 'Privatsphäre zuerst',
    featurePrivateDesc: 'nichts verlässt Ihr Gerät',
    featureAITitle: 'Lokale KI',
    featureAIDesc: 'für schnelle Transkription',
    featureDropTitle: 'Beliebige Audio- oder Videodatei ablegen',
    featureDropDesc: 'um loszulegen',
    setupTitle: 'Einrichtung',
    setupSubtitle: 'Wählen Sie die Transkriptionssprache und prüfen Sie das KI-Modell',
    transcriptionLanguage: 'Transkriptionssprache',
    changeLaterHint: 'Kann später in den Einstellungen geändert werden',
    model: 'Modell',
    modelName: 'Whisper Large V3 Turbo',
    size: 'Größe',
    modelSize: '~1,5 GB',
    modelDownloadNote: 'Wird beim Klick auf "Loslegen" heruntergeladen',
    back: 'Zurück',
    next: 'Weiter',
    getStarted: 'Loslegen',
    settingsTitle: 'Echo Einstellungen',
    interfaceSection: 'OBERFLÄCHE',
    language: 'Sprache',
    interfaceLanguageDesc: 'Anzeigesprache der Benutzeroberfläche',
    transcriptionSection: 'TRANSKRIPTION',
    transcriptionLanguageDesc: 'Bei automatischer Erkennung identifiziert Echo die gesprochene Sprache automatisch.',
    storageSection: 'SPEICHER',
    transcriptsAndMedia: 'Transkripte & Medien',
    revealInFinder: 'Im Finder anzeigen',
    change: 'Ändern...',
    storageUsed: 'Speicher belegt',
    privacySection: 'DATENSCHUTZ & RECHT',
    privacyDesc: 'Die gesamte Verarbeitung erfolgt lokal auf Ihrem Gerät. Es werden keine Daten an Server gesendet.',
    privacyConsent: 'Datenschutz-Einwilligung',
    accepted: 'Akzeptiert',
    notAccepted: 'Nicht akzeptiert',
    viewPrivacyPolicy: 'Datenschutzerklärung anzeigen',
    aboutSection: 'ÜBER',
    version: 'Version',
    thirdPartySoftware: 'Drittanbieter-Software',
    whisperCredit: 'whisper.cpp (MIT) — Spracherkennung',
    ffmpegCredit: 'ffmpeg 8.1 (GPL) — Videokonvertierung',
    showOnboarding: 'Einführung erneut anzeigen',
    modelSection: 'KI-MODELL',
    modelName2: 'Modell',
    modelSize2: 'Größe',
    modelPath: 'Speicherort',
    deleteModel: 'Modell löschen',
    deleteModelConfirm: 'Das KI-Modell (~1,5 GB) wird gelöscht. Sie können es jederzeit erneut herunterladen. Fortfahren?',
    modelDeleting: 'Wird gelöscht...',
    redownloadModel: 'Modell erneut herunterladen',
    privacyPolicyTitle: 'Datenschutzerklärung',
    privacyOverviewTitle: '1. Übersicht',
    privacyOverviewText: 'Echo ist eine Desktop-Anwendung zur Transkription von Audio- und Videodateien mittels lokaler künstlicher Intelligenz. Datenschutz ist ein Grundprinzip — die gesamte Verarbeitung erfolgt lokal auf Ihrem Computer.',
    privacyDataTitle: '2. Datenerfassung',
    privacyDataText: 'Echo erfasst, überträgt oder speichert keine persönlichen Daten auf externen Servern. Es gibt keine Konten, keine Analytik, keine Telemetrie und keinerlei Tracking.',
    privacyFilesTitle: '3. Audio- & Videodateien',
    privacyFilesText: 'Dateien zur Transkription werden ausschließlich auf Ihrem Gerät verarbeitet. Sie werden niemals hochgeladen. Kopien der Mediendateien werden lokal in Ihrem gewählten Speicherverzeichnis aufbewahrt.',
    privacyNetworkTitle: '4. Netzwerkanfragen',
    privacyNetworkText: 'Echo verbindet sich nur zum Herunterladen des KI-Modells und der Abhängigkeiten (whisper.cpp, FFmpeg) aus offiziellen Open-Source-Repositories mit dem Internet.',
    privacyThirdPartyTitle: '5. Drittanbieter-Software',
    privacyThirdPartyText: 'Echo verwendet folgende Open-Source-Komponenten: whisper.cpp (MIT-Lizenz) — Spracherkennungs-Engine; FFmpeg (LGPL/GPL) — Audio- und Videoformat-Konvertierung. Diese laufen ausschließlich auf Ihrem Gerät.',
    privacyStorageTitle: '6. Speicherung',
    privacyStorageText: 'Transkripte, Medienkopien und Metadaten werden in einem lokalen Verzeichnis gespeichert (Standard: ~/Documents/EchoTranscripts). Sie können den Speicherort jederzeit ändern oder diese Dateien löschen.',
    privacyAnalyticsTitle: '7. Analytik',
    privacyAnalyticsText: 'Echo enthält keine Analytik, Absturzberichte oder Nutzungsverfolgung. Die Anwendung arbeitet nach der Ersteinrichtung vollständig offline.',
    privacyChangesTitle: '8. Änderungen',
    privacyChangesText: 'Bei Aktualisierung dieser Richtlinie werden Änderungen in die nächste App-Version aufgenommen. Die aktuelle Richtlinie können Sie jederzeit in den Einstellungen einsehen.',
    acceptAndContinue: 'Akzeptieren & Fortfahren',
    closeWarningTitle: 'Transkription läuft',
    closeWarningMessage: 'Eine oder mehrere Dateien werden noch transkribiert.',
    closeWarningDetail: 'Wenn Sie jetzt beenden, geht der Fortschritt verloren. Sind Sie sicher?',
    quitAnyway: 'Trotzdem beenden'
  },

  fr: {
    appName: 'Echo',
    newTranscription: 'Nouvelle transcription',
    active: 'ACTIF',
    queued: 'En attente',
    failed: 'Échec',
    searchPlaceholder: 'Rechercher...',
    filterAll: 'Tout',
    filterToday: "Aujourd'hui",
    filterYesterday: 'Hier',
    filter7d: '7j',
    filter30d: '30j',
    selected: 'sélectionné(s)',
    noTranscriptions: 'Aucune transcription',
    dropOrClick: 'Déposez un fichier ou cliquez sur "Nouvelle transcription"',
    noResults: 'Aucun résultat',
    rename: 'Renommer',
    delete: 'Supprimer',
    deleteTranscription: 'Supprimer la transcription ?',
    deleteNTranscriptions: 'Supprimer {n} transcriptions ?',
    deleteConfirmSingle: '"{name}" et ses fichiers médias seront définitivement supprimés. Cette action est irréversible.',
    deleteConfirmBatch: '{n} éléments et leurs fichiers médias seront définitivement supprimés. Cette action est irréversible.',
    cancel: 'Annuler',
    cancelTranscription: 'Annuler la transcription ?',
    cancelTranscriptionConfirm: 'Le traitement de "{name}" sera arrêté. La progression sera perdue.',
    keepGoing: 'Continuer',
    dropTitle: 'Déposez des fichiers ou cliquez pour parcourir',
    dropSubtitle: 'Prend en charge MP3, WAV, M4A, MP4, MOV, WebM, OGG — plusieurs fichiers à la fois',
    unsupportedFormat: '"{name}" — format non pris en charge',
    unreadable: '"{name}" — illisible',
    filesNotSupported: '{n} fichiers non pris en charge. Formats acceptés : {formats}',
    filesSkipped: '{n} fichier(s) ignoré(s) (format non pris en charge)',
    waitingInQueue: "En attente dans la file d'attente...",
    preparing: 'Préparation...',
    queuedStatus: 'En attente',
    transcribing: 'Transcription en cours...',
    queuedHint: 'Ce fichier sera traité après la transcription en cours.',
    transcribingHint: 'Le texte apparaîtra ici au fur et à mesure du traitement.',
    duration: 'Durée',
    processedIn: 'Traité en',
    speed: 'Vitesse',
    words: 'Mots',
    characters: 'Caractères',
    audioError: 'Erreur de lecture audio : {error}',
    mediaNotAvailable: 'Fichier média indisponible — lecture désactivée',
    loadingVideo: 'Chargement de la vidéo...',
    cannotPlayVideo: 'Impossible de lire la vidéo',
    copy: 'Copier',
    copied: 'Copié',
    exportTxt: 'Exporter TXT',
    mute: 'Couper le son',
    unmute: 'Activer le son',
    tryAgain: 'Réessayer',
    chooseAnotherFile: 'Choisir un autre fichier',
    settingUpEcho: "Configuration d'Echo",
    downloadingComponents: 'Téléchargement des composants requis. Cela ne se produit qu\'une seule fois.',
    ffmpegLabel: 'FFmpeg (traitement audio)',
    whisperLabel: 'Whisper CLI (reconnaissance vocale)',
    modelLabel: 'Modèle vocal (~1,5 Go)',
    retry: 'Réessayer',
    welcomeTitle: 'Bienvenue dans Echo',
    welcomeSubtitle: 'Transcription privée et hors ligne de vos fichiers audio et vidéo. Tout reste sur votre appareil.',
    featurePrivateTitle: 'Confidentialité par défaut',
    featurePrivateDesc: 'rien ne quitte votre appareil',
    featureAITitle: 'IA locale',
    featureAIDesc: 'pour une transcription rapide',
    featureDropTitle: 'Déposez un fichier audio ou vidéo',
    featureDropDesc: 'pour commencer',
    setupTitle: 'Configuration',
    setupSubtitle: 'Choisissez la langue de transcription et vérifiez le modèle IA',
    transcriptionLanguage: 'Langue de transcription',
    changeLaterHint: 'Modifiable ultérieurement dans les Paramètres',
    model: 'Modèle',
    modelName: 'Whisper Large V3 Turbo',
    size: 'Taille',
    modelSize: '~1,5 Go',
    modelDownloadNote: 'Sera téléchargé au clic sur "Commencer"',
    back: 'Retour',
    next: 'Suivant',
    getStarted: 'Commencer',
    settingsTitle: "Paramètres d'Echo",
    interfaceSection: 'INTERFACE',
    language: 'Langue',
    interfaceLanguageDesc: "Langue d'affichage de l'interface",
    transcriptionSection: 'TRANSCRIPTION',
    transcriptionLanguageDesc: "En mode auto-détection, Echo identifiera automatiquement la langue parlée.",
    storageSection: 'STOCKAGE',
    transcriptsAndMedia: 'Transcriptions & médias',
    revealInFinder: 'Afficher dans le Finder',
    change: 'Modifier...',
    storageUsed: 'Espace utilisé',
    privacySection: 'CONFIDENTIALITÉ & JURIDIQUE',
    privacyDesc: "Tout le traitement s'effectue localement sur votre appareil. Aucune donnée n'est envoyée à un serveur.",
    privacyConsent: 'Consentement de confidentialité',
    accepted: 'Accepté',
    notAccepted: 'Non accepté',
    viewPrivacyPolicy: 'Voir la politique de confidentialité',
    aboutSection: 'À PROPOS',
    version: 'Version',
    thirdPartySoftware: 'Logiciels tiers',
    whisperCredit: 'whisper.cpp (MIT) — Reconnaissance vocale',
    ffmpegCredit: 'ffmpeg 8.1 (GPL) — Conversion vidéo',
    showOnboarding: "Revoir l'introduction",
    modelSection: 'MODÈLE IA',
    modelName2: 'Modèle',
    modelSize2: 'Taille',
    modelPath: 'Emplacement',
    deleteModel: 'Supprimer le modèle',
    deleteModelConfirm: "Le modèle IA (~1,5 Go) sera supprimé. Vous pourrez le retélécharger à tout moment. Continuer ?",
    modelDeleting: 'Suppression...',
    redownloadModel: 'Retélécharger le modèle',
    privacyPolicyTitle: 'Politique de confidentialité',
    privacyOverviewTitle: '1. Aperçu',
    privacyOverviewText: "Echo est une application de bureau qui transcrit les fichiers audio et vidéo à l'aide d'une intelligence artificielle locale. La confidentialité est un principe fondamental — tout le traitement se fait localement sur votre ordinateur.",
    privacyDataTitle: '2. Collecte de données',
    privacyDataText: "Echo ne collecte, ne transmet ni ne stocke de données personnelles sur des serveurs externes. Il n'y a pas de comptes, pas d'analytique, pas de télémétrie et aucun suivi.",
    privacyFilesTitle: '3. Fichiers audio & vidéo',
    privacyFilesText: "Les fichiers de transcription sont traités entièrement sur votre appareil. Ils ne sont jamais téléchargés. Les copies des fichiers médias sont stockées localement dans le répertoire de votre choix.",
    privacyNetworkTitle: '4. Requêtes réseau',
    privacyNetworkText: "Echo ne se connecte à Internet que pour télécharger le modèle IA et les dépendances (whisper.cpp, FFmpeg) depuis leurs dépôts officiels open-source.",
    privacyThirdPartyTitle: '5. Logiciels tiers',
    privacyThirdPartyText: "Echo utilise les composants open-source suivants : whisper.cpp (licence MIT) — moteur de reconnaissance vocale ; FFmpeg (LGPL/GPL) — conversion de formats audio et vidéo. Ils fonctionnent exclusivement sur votre appareil.",
    privacyStorageTitle: '6. Stockage',
    privacyStorageText: "Les transcriptions, copies médias et métadonnées sont stockées dans un répertoire local (par défaut : ~/Documents/EchoTranscripts). Vous pouvez modifier cet emplacement ou supprimer ces fichiers à tout moment.",
    privacyAnalyticsTitle: '7. Analytique',
    privacyAnalyticsText: "Echo n'inclut aucune analytique, rapport de crash ou suivi d'utilisation. L'application fonctionne entièrement hors ligne après la configuration initiale.",
    privacyChangesTitle: '8. Modifications',
    privacyChangesText: "En cas de mise à jour de cette politique, les modifications seront incluses dans la prochaine version. Vous pouvez toujours consulter la politique actuelle dans les Paramètres.",
    acceptAndContinue: 'Accepter et continuer',
    closeWarningTitle: 'Transcription en cours',
    closeWarningMessage: 'Un ou plusieurs fichiers sont encore en cours de transcription.',
    closeWarningDetail: 'Si vous quittez maintenant, la progression sera perdue. Êtes-vous sûr ?',
    quitAnyway: 'Quitter quand même'
  }
}
