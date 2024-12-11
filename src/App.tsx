import { AudioManager } from "./components/AudioManager";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";

import { useEffect, useState } from "react";

// @ts-ignore
const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
const OAIKey = import.meta.env.VITE_OPENAI_API_KEY;
function App() {
    const [oaiResponse, setOaiResponse] = useState(
        "No OpenAI Response yet. Transcribe something to get a response!",
    );
    const [executionTime, setExecutionTime] = useState(0);
    const [modelTime, setModelTime] = useState(0);
    const [transcriptionTime, setTranscriptionTime] = useState(0);
    const transcriber = useTranscriber();
    const fetchOpenAI = async () => {
        const apiKey = OAIKey;
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
                throw new Error(
                    `Error: ${response.status} - ${response.statusText}`,
                );
            }

            const data = await response.json().then((data) => {
                console.log(data.choices[0].message.content);
                setOaiResponse(
                    "Response from OpenAI: " + data.choices[0].message.content,
                );
            });
        } catch (error) {
            console.error("Error fetching OpenAI API:", error);
        }
    };
    let startTime = 0;
    let endTime = 0;
    useEffect(() => {
        if (!transcriber.output?.isBusy && transcriber.output?.text) {
            // Setting Transcription time.
            // transcriber.output?.total_transcription_time &&
            //     setTranscriptionTime(
            //         transcriber.output?.total_transcription_time,
            //     );
            // transcriber.output?.model_loading_time &&
            //     setModelTime(transcriber.output?.model_loading_time);
            // Getting and setting OAI Execution Time.
            startTime = performance.now();
            fetchOpenAI().then(() => {
                endTime = performance.now();
                setExecutionTime(endTime - startTime);
            });
        }
    }, [transcriber.output?.isBusy]);
    return IS_WEBGPU_AVAILABLE ? (
        <div className='flex justify-center items-center min-h-screen'>
            <div className='container flex flex-col justify-center items-center'>
                <h1 className='text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center'>
                    Whisper WebGPU
                </h1>
                <h2 className='mt-3 mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl'>
                    ML-powered speech recognition directly in your browser
                </h2>
                <AudioManager transcriber={transcriber} />
                <Transcript transcribedData={transcriber.output} />
                <p>{oaiResponse}</p>
                <br />
                {executionTime != 0 && (
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
        <div className='fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center'>
            WebGPU is not supported
            <br />
            by this browser :&#40;
        </div>
    );
}

export default App;
