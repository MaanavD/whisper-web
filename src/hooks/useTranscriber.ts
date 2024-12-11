import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useWorker } from "./useWorker";
import Constants from "../utils/Constants";

interface ProgressItem {
    file: string;
    loaded: number;
    progress: number;
    total: number;
    name: string;
    status: string;
}

interface TranscriberUpdateData {
    data: {
        text: string;
        chunks: { text: string; timestamp: [number, number | null] }[];
        tps: number;
    };
}

export interface TranscriberData {
    isBusy: boolean;
    tps?: number;
    text: string;
    chunks: { text: string; timestamp: [number, number | null] }[];
    total_transcription_time?: number;
    model_loading_time?: number;
}

export interface Transcriber {
    onInputChange: () => void;
    isBusy: boolean;
    isModelLoading: boolean;
    progressItems: ProgressItem[];
    start: (audioData: AudioBuffer | undefined) => void;
    output?: TranscriberData;
    model: string;
    setModel: (model: string) => void;
    multilingual: boolean;
    setMultilingual: (val: boolean) => void;
    subtask: string;
    setSubtask: (val: string) => void;
    language?: string;
    setLanguage: (val: string) => void;
}
// The rest of your types and interfaces remain the same...

export function useTranscriber(): Transcriber {
    const [transcript, setTranscript] = useState<TranscriberData | undefined>(undefined);
    const [isBusy, setIsBusy] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

    // Using refs to store time values
    const modelLoadingStartTimeRef = useRef<number | null>(null);
    const modelLoadingEndTimeRef = useRef<number | null>(null);
    const transcriptionStartTimeRef = useRef<number | null>(null);

    // Update model loading time when both start and end times are set
    // useEffect(() => {
    //     if (modelLoadingStartTimeRef.current !== null && modelLoadingEndTimeRef.current !== null) {
    //         const modelLoadingTime = modelLoadingEndTimeRef.current - modelLoadingStartTimeRef.current;
    //         // // console.log("Calculated model loading time:", modelLoadingTime, "ms");
    //     }
    // }, [modelLoadingStartTimeRef.current, modelLoadingEndTimeRef.current]);

    // Update transcription time when transcription start time is set
    useEffect(() => {
        if (transcriptionStartTimeRef.current !== null) {
            const transcriptionEndTime = performance.now();
            // const totalTranscriptionTime = transcriptionEndTime - transcriptionStartTimeRef.current;
            // console.log("Calculated transcription time:", totalTranscriptionTime, "ms");
        }
    }, [transcriptionStartTimeRef.current]);

    const webWorker = useWorker((event) => {
        const message = event.data;

        switch (message.status) {
            case "initiate":
                // console.log("Model loading initiated.");
                if (modelLoadingStartTimeRef.current === null) {
                    modelLoadingStartTimeRef.current = performance.now();
                    // console.log("Model loading start time set:", modelLoadingStartTimeRef.current);
                }
                setIsModelLoading(true);
                setProgressItems((prev) => [...prev, message]);
                break;

            case "done":
                // console.log(`Model file ${message.file} done loading.`);
                setProgressItems((prev) =>
                    prev.filter((item) => item.file !== message.file),
                );
                break;

            case "ready":
                // console.log("Model is fully ready.");
                setIsModelLoading(false);
                if (modelLoadingEndTimeRef.current === null) {
                    modelLoadingEndTimeRef.current = performance.now();
                    // console.log("Model loading end time set:", modelLoadingEndTimeRef.current);
                }
                break;

            case "progress":
                setProgressItems((prev) =>
                    prev.map((item) => {
                        if (item.file === message.file) {
                            return { ...item, progress: message.progress };
                        }
                        return item;
                    }),
                );
                break;

            case "update":
                // console.log("Transcription update received. Still processing...");
                setIsBusy(true);
                break;

            case "complete":
                // console.log("Transcription completed successfully.");
                setIsBusy(false);
                const updateMessage = message as TranscriberUpdateData;

                // We calculate transcription and model loading times here
                let totalTranscriptionTime: number | undefined = undefined;
                if (transcriptionStartTimeRef.current !== null) {
                    const transcriptionEndTime = performance.now();
                    totalTranscriptionTime = transcriptionEndTime - transcriptionStartTimeRef.current;
                    // console.log("Calculated transcription time:", totalTranscriptionTime, "ms");
                }

                let modelLoadingTime: number | undefined = undefined;
                if (modelLoadingStartTimeRef.current !== null && modelLoadingEndTimeRef.current !== null) {
                    modelLoadingTime = modelLoadingEndTimeRef.current - modelLoadingStartTimeRef.current;
                    // console.log("Calculated model loading time:", modelLoadingTime, "ms");
                }

                // Setting transcript after calculation
                setTranscript({
                    isBusy: false,
                    text: updateMessage.data.text,
                    tps: updateMessage.data.tps,
                    chunks: updateMessage.data.chunks,
                    total_transcription_time: totalTranscriptionTime,
                    model_loading_time: modelLoadingTime,
                });
                break;

            case "error":
                console.error("Error received from worker:", message.data.message);
                setIsBusy(false);
                alert(
                    `An error occurred: "${message.data.message}". Please file a bug report.`,
                );
                break;

            default:
                // console.log("Unhandled message status:", message.status);
                break;
        }
    });

    const [model, setModel] = useState<string>(Constants.DEFAULT_MODEL);
    const [subtask, setSubtask] = useState<string>(Constants.DEFAULT_SUBTASK);
    const [multilingual, setMultilingual] = useState<boolean>(Constants.DEFAULT_MULTILINGUAL);
    const [language, setLanguage] = useState<string>(Constants.DEFAULT_LANGUAGE);

    const onInputChange = useCallback(() => {
        // console.log("Input changed. Clearing transcript state.");
        setTranscript(undefined);
    }, []);

    const postRequest = useCallback(
        async (audioData: AudioBuffer | undefined) => {
            if (audioData) {
                // console.log("Post request to worker started. Preparing audio...");
                setTranscript(undefined);
                setIsBusy(true);
                transcriptionStartTimeRef.current = performance.now();
                // console.log("Transcription start time set:", transcriptionStartTimeRef.current);

                let audio: Float32Array;
                if (audioData.numberOfChannels === 2) {
                    const SCALING_FACTOR = Math.sqrt(2);

                    const left = audioData.getChannelData(0);
                    const right = audioData.getChannelData(1);

                    audio = new Float32Array(left.length);
                    for (let i = 0; i < audioData.length; ++i) {
                        audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
                    }
                    // console.log("Converted stereo to mono.");
                } else {
                    audio = audioData.getChannelData(0);
                    // console.log("Audio is already mono.");
                }

                // console.log("Sending audio and parameters to worker...");
                webWorker.postMessage({
                    audio,
                    model,
                    multilingual,
                    subtask: multilingual ? subtask : null,
                    language: multilingual && language !== "auto" ? language : null,
                });
            } else {
                // console.log("No audio data provided. Cannot start transcription.");
            }
        },
        [webWorker, model, multilingual, subtask, language],
    );

    const transcriber = useMemo(() => {
        return {
            onInputChange,
            isBusy,
            isModelLoading,
            progressItems,
            start: postRequest,
            output: transcript,
            model,
            setModel,
            multilingual,
            setMultilingual,
            subtask,
            setSubtask,
            language,
            setLanguage,
        };
    }, [
        isBusy,
        isModelLoading,
        progressItems,
        postRequest,
        transcript,
        model,
        multilingual,
        subtask,
        language,
        onInputChange
    ]);

    return transcriber;
}
