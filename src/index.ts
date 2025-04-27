import {
    SimpleChatModel,
    type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type {
    BaseMessage,
    MessageContentComplex, // Import the complex type
    MessageContentText,    // Import the text part type
} from "@langchain/core/messages";
import {
    AIMessageChunk,
    HumanMessage,
    SystemMessage,
    AIMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import axios, { AxiosInstance, AxiosError } from "axios";
import axiosRetry from "axios-retry";
// import { encode } from 'gpt-3-encoder'; // Keep commented unless needed later

export interface ChatLLM7Params extends BaseChatModelParams {
    baseUrl?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    maxRetries?: number;
    stop?: string[];
}

type LLM7Message = {
    role: "user" | "assistant" | "system";
    content: string;
};

export class ChatLLM7 extends SimpleChatModel implements ChatLLM7Params {
    static lc_name() {
        return "ChatLLM7";
    }

    baseUrl: string;
    modelName: string;
    temperature: number;
    maxTokens?: number;
    timeout: number;
    maxRetries: number;
    stop?: string[];

    private client: AxiosInstance;

    constructor(fields: ChatLLM7Params = {}) {
        super(fields);
        this.baseUrl = fields.baseUrl ?? "https://api.llm7.io/v1";
        this.modelName = fields.modelName ?? "gpt-4.1-nano";
        this.temperature = fields.temperature ?? 1.0;
        this.maxTokens = fields.maxTokens;
        this.timeout = fields.timeout ?? 120;
        this.maxRetries = fields.maxRetries ?? 3;
        this.stop = fields.stop;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout * 1000,
            headers: { "Content-Type": "application/json" },
        });

        axiosRetry(this.client, {
            retries: this.maxRetries,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error: AxiosError) => {
                return (
                    axiosRetry.isNetworkError(error) ||
                    axiosRetry.isRetryableError(error) ||
                    error.response?.status === 429
                );
            },
        });
    }

    _llmType(): string {
        return "llm7-chat";
    }

    private _formatMessages(messages: BaseMessage[]): LLM7Message[] {
        return messages.map((message) => {
            let role: LLM7Message["role"];
            let content: string;

            // Determine role
            if (message._getType() === "human") {
                role = "user";
            } else if (message._getType() === "ai") {
                role = "assistant";
            } else if (message._getType() === "system") {
                role = "system";
            } else {
                throw new Error(`Unsupported message type: ${message._getType()}`);
            }

            // Handle content: string | MessageContentComplex[]
            if (typeof message.content === "string") {
                content = message.content;
            } else if (Array.isArray(message.content)) {
                 // --- Fix for Error 1 ---
                 // Filter out non-text parts and concatenate text content
                 const textParts = message.content
                    .filter((part): part is MessageContentText => part.type === "text")
                    .map(part => part.text);

                 if (textParts.length === 0) {
                     console.warn(`Message content array did not contain any text parts: ${JSON.stringify(message.content)}`);
                     content = ""; // Or throw an error if empty text messages are invalid
                 } else {
                    content = textParts.join("\n"); // Join text parts, e.g., with newline
                 }
                 // Warn if non-text parts were present and ignored
                 if (textParts.length < message.content.length) {
                    console.warn(`Ignoring non-text parts in message content for role ${role}. LLM7 only supports text.`);
                 }
            } else {
                throw new Error(
                    `Unsupported message content type: ${typeof message.content}`
                );
            }

            return { role, content };
        });
    }

    /**
     * Internal method to construct the API request payload.
     * @param messages A list of LangChain BaseMessage objects.
     * @param stream Whether the request is for streaming.
     * @param runtimeStop Optional list of stop sequences passed at runtime.
     * @returns The payload object for the LLM7 API request.
     */
    // --- Updated signature and logic for Errors 2 & 3 ---
    private _createPayload(
        messages: BaseMessage[],
        stream: boolean,
        runtimeStop?: string[]
    ): Record<string, any> { // Explicitly return Record<string, any>
        const payload: Record<string, any> = {
            model: this.modelName,
            messages: this._formatMessages(messages),
            temperature: this.temperature,
            stream: stream,
        };

        if (this.maxTokens !== undefined) {
            payload.max_tokens = this.maxTokens;
        }

        // Combine constructor stop sequences and runtime stop sequences
        const stopSequences = [...(this.stop ?? []), ...(runtimeStop ?? [])];
        if (stopSequences.length > 0) {
            // Use a Set to remove duplicates, then convert back to array
            payload.stop = Array.from(new Set(stopSequences));
        }

        return payload;
    }

    async _call(
        messages: BaseMessage[],
        options: this["ParsedCallOptions"],
        runManager?: CallbackManagerForLLMRun
    ): Promise<string> {
        // --- Updated call to _createPayload for Errors 2 & 3 ---
        const payload = this._createPayload(messages, false, options.stop);

        try {
            const response = await this.client.post(
                "/chat/completions",
                payload,
                { signal: options.signal }
            );

            if (response.status !== 200) {
                throw new Error(
                    `API request failed with status ${response.status}: ${response.statusText} - ${response.data}`
                );
            }

            const responseData = response.data;
            if (!responseData.choices?.[0]?.message) {
                throw new Error(`Invalid API response format: ${JSON.stringify(responseData)}`);
            }

            return responseData.choices[0].message.content;
        } catch (error) {
            runManager?.handleLLMError(error);
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `LLM7 API request error: ${error.message} - ${error.response?.status} ${error.response?.data}`
                );
            }
            throw error;
        }
    }

    async *_streamResponseChunks(
        messages: BaseMessage[],
        options: this["ParsedCallOptions"],
        runManager?: CallbackManagerForLLMRun
    ): AsyncGenerator<ChatGenerationChunk> {
        // --- Updated call to _createPayload for Errors 2 & 3 ---
        const payload = this._createPayload(messages, true, options.stop);

        let responseStream;
        try {
            const response = await this.client.post(
                "/chat/completions",
                payload,
                { responseType: "stream", signal: options.signal }
            );

            if (response.status !== 200) {
                let errorBody = '';
                try { for await (const chunk of response.data) { errorBody += chunk.toString(); } } catch (e) {/* Ignore */}
                throw new Error(`API request failed with status ${response.status}: ${response.statusText} - ${errorBody}`);
            }
            responseStream = response.data;
        } catch (error) {
            runManager?.handleLLMError(error);
            if (axios.isAxiosError(error)) {
                throw new Error(`LLM7 API stream request error: ${error.message} - ${error.response?.status} ${error.response?.data}`);
            }
            throw error;
        }

        let buffer = "";
        try {
            for await (const chunk of responseStream) {
                buffer += chunk.toString("utf-8");
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.substring(0, newlineIndex).trim();
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line === "" || !line.startsWith("data:")) continue;
                    const jsonData = line.substring("data: ".length);
                    if (jsonData === "[DONE]") return;

                    try {
                        const parsedChunk = JSON.parse(jsonData);
                        const delta = parsedChunk.choices?.[0]?.delta;
                        const content = delta?.content;

                        if (typeof content === "string" && content !== "") {
                            const generationChunk = new ChatGenerationChunk({
                                message: new AIMessageChunk({ content: content }),
                                text: content,
                            });
                            yield generationChunk;
                            // --- Fix for Error ---
                            // Use the simplest signature, passing only the token string.
                            await runManager?.handleLLMNewToken(content);
                        }
                    } catch (e) {
                        console.warn(`Failed to parse stream chunk JSON: ${jsonData}`, e);
                    }
                }
            }
        } catch (error) {
            runManager?.handleLLMError(error);
            throw new Error(`Error processing LLM7 stream: ${error}`);
        } finally {
            if (responseStream && typeof responseStream.destroy === 'function') {
                responseStream.destroy();
            }
        }
        if (buffer.trim() !== "") {
            console.warn("Streaming finished with unprocessed buffer content:", buffer);
        }
    }
}