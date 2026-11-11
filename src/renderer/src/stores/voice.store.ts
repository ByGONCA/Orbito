import { create } from 'zustand';

export interface VoiceSettingsState {
  selectedMicId: string;
  dictationShortcut: string; // 'auto' | 'toggle' | 'hold'
  transcribeProvider: string; // 'off' | 'webspeech' | 'whisper'
  silenceFiltering: boolean;
  removeFillerWords: boolean;
  dictionary: string[];
  sharedDictionary: string[];

  // Live state
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isTestingMic: boolean;
  testAudioUrl: string | null;
  testCountdown: number;
  availableMics: MediaDeviceInfo[];

  // Setters
  setSelectedMicId: (id: string) => void;
  setDictationShortcut: (shortcut: string) => void;
  setTranscribeProvider: (provider: string) => void;
  setSilenceFiltering: (enabled: boolean) => void;
  setRemoveFillerWords: (enabled: boolean) => void;
  addDictionaryWord: (word: string) => void;
  removeDictionaryWord: (word: string) => void;
  addSharedDictionaryWord: (word: string) => void;
  removeSharedDictionaryWord: (word: string) => void;

  refreshMicrophones: () => Promise<void>;
  startListening: (onResult?: (text: string) => void) => Promise<void>;
  stopListening: () => void;
  testMicrophone: () => Promise<void>;
  stopTestMicrophone: () => void;
}

let activeRecognition: any = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let testTimer: any = null;

export const useVoiceStore = create<VoiceSettingsState>((set, get) => ({
  selectedMicId: 'default',
  dictationShortcut: 'auto',
  transcribeProvider: 'webspeech',
  silenceFiltering: true,
  removeFillerWords: true,
  dictionary: [],
  sharedDictionary: [],

  isListening: false,
  transcript: '',
  interimTranscript: '',
  isTestingMic: false,
  testAudioUrl: null,
  testCountdown: 10,
  availableMics: [],

  setSelectedMicId: (selectedMicId) => set({ selectedMicId }),
  setDictationShortcut: (dictationShortcut) => set({ dictationShortcut }),
  setTranscribeProvider: (transcribeProvider) => set({ transcribeProvider }),
  setSilenceFiltering: (silenceFiltering) => set({ silenceFiltering }),
  setRemoveFillerWords: (removeFillerWords) => set({ removeFillerWords }),

  addDictionaryWord: (word) => {
    const clean = word.trim();
    if (!clean) return;
    set((s) => ({
      dictionary: s.dictionary.includes(clean) ? s.dictionary : [...s.dictionary, clean]
    }));
  },

  removeDictionaryWord: (word) => {
    set((s) => ({
      dictionary: s.dictionary.filter((w) => w !== word)
    }));
  },

  addSharedDictionaryWord: (word) => {
    const clean = word.trim();
    if (!clean) return;
    set((s) => ({
      sharedDictionary: s.sharedDictionary.includes(clean)
        ? s.sharedDictionary
        : [...s.sharedDictionary, clean]
    }));
  },

  removeSharedDictionaryWord: (word) => {
    set((s) => ({
      sharedDictionary: s.sharedDictionary.filter((w) => w !== word)
    }));
  },

  refreshMicrophones: async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        set({ availableMics: audioInputs });
      }
    } catch {
      // Ignore enumeration failure
    }
  },

  startListening: async (onResult) => {
    const { transcribeProvider, removeFillerWords, dictionary, sharedDictionary } = get();
    if (transcribeProvider === 'off') {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition API not supported in this environment');
      return;
    }

    try {
      if (activeRecognition) {
        activeRecognition.stop();
      }

      const recognition = new SpeechRecognition();
      activeRecognition = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        set({ isListening: true, transcript: '', interimTranscript: '' });
      };

      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (removeFillerWords) {
          finalTrans = finalTrans.replace(/\b(um|uh|er|ah|like)\b/gi, '').replace(/\s+/g, ' ');
        }

        set({ transcript: finalTrans, interimTranscript: interim });
        if (finalTrans && onResult) {
          onResult(finalTrans.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        set({ isListening: false });
      };

      recognition.onend = () => {
        set({ isListening: false });
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      set({ isListening: false });
    }
  },

  stopListening: () => {
    if (activeRecognition) {
      try {
        activeRecognition.stop();
      } catch {}
      activeRecognition = null;
    }
    set({ isListening: false });
  },

  testMicrophone: async () => {
    const { isTestingMic, selectedMicId } = get();
    if (isTestingMic) {
      get().stopTestMicrophone();
      return;
    }

    try {
      recordedChunks = [];
      const constraints: MediaStreamConstraints = {
        audio: selectedMicId === 'default' ? true : { deviceId: { exact: selectedMicId } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        set({ testAudioUrl: url, isTestingMic: false, testCountdown: 10 });
        const audio = new Audio(url);
        audio.play().catch(() => {});
      };

      mediaRecorder.start();
      set({ isTestingMic: true, testAudioUrl: null, testCountdown: 10 });

      let secondsLeft = 10;
      testTimer = setInterval(() => {
        secondsLeft -= 1;
        set({ testCountdown: secondsLeft });
        if (secondsLeft <= 0) {
          get().stopTestMicrophone();
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to record test audio:', err);
      set({ isTestingMic: false });
    }
  },

  stopTestMicrophone: () => {
    if (testTimer) {
      clearInterval(testTimer);
      testTimer = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    set({ isTestingMic: false });
  }
}));
