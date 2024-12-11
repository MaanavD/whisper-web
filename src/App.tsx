import { AudioManager } from "./components/AudioManager";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";
import { useEffect, useState } from "react";

// Check if WebGPU is available
const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
const OAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

function App() {
    // State management
    const [oaiResponse, setOaiResponse] = useState("No OpenAI Response yet. Transcribe something to get a response!");
    const [executionTime, setExecutionTime] = useState(0);
    const [modelTime, setModelTime] = useState(0);
    const [transcriptionTime, setTranscriptionTime] = useState(0);

    const transcriber = useTranscriber();

    // Function to fetch OpenAI API response
    const fetchOpenAI = async () => {
        const apiKey = OAI_API_KEY;
        const url = "https://api.openai.com/v1/chat/completions";

        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        };

        const body = {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: transcriber.output?.text }],
            temperature: 0.7,
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const messageContent = data.choices[0].message.content;
            console.log("OpenAI response:", messageContent);
            setOaiResponse(`Response from OpenAI: ${messageContent}`);
        } catch (error) {
            console.error("Error fetching OpenAI API:", error);
        }
    };

    // Handle transcription completion and OpenAI fetch
    useEffect(() => {
        if (!transcriber.output?.isBusy && transcriber.output?.text) {
            updateTranscriptionTimes(transcriber.output);
            const startTime = performance.now();

            fetchOpenAI().then(() => {
                const endTime = performance.now();
                setExecutionTime(endTime - startTime);
            });
        }
    }, [transcriber.output?.isBusy, transcriber.output?.text]);

    // Update times when transcription completes
    const updateTranscriptionTimes = (output) => {
        if (output.model_loading_time !== undefined) {
            console.log("Model loading time:", output.model_loading_time, "ms");
            setModelTime(output.model_loading_time);
        }

        if (output.total_transcription_time !== undefined) {
            console.log("Transcription time:", output.total_transcription_time, "ms");
            setTranscriptionTime(output.total_transcription_time);
        }
    };

    // Render the app UI based on WebGPU availability
    return IS_WEBGPU_AVAILABLE ? (
        <div className="flex justify-center items-center min-h-screen">
            <div className="container flex flex-col justify-center items-center">
                <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center">
                    Whisper WebGPU
                </h1>
                <h2 className="mt-3 mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    ML-powered speech recognition directly in your browser
                </h2>
                <AudioManager transcriber={transcriber} />
                <Transcript transcribedData={transcriber.output} />
                <p>{oaiResponse}</p>
                <br />
                {executionTime !== 0 && (
                    <p>
                        It took {Math.ceil(modelTime)}ms to load the model,{" "}
                        {Math.ceil(transcriptionTime)}ms to transcribe the
                        audio, and {Math.ceil(executionTime)}ms to fetch the
                        OpenAI response.
                    </p>
                )}
            </div>
        </div>
    ) : (
        <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
            WebGPU is not supported by this browser :&#40;
        </div>
    );
}

export default App;
