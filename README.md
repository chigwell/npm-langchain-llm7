# langchain-llm7

[![npm version](https://badge.fury.io/js/langchain-llm7.svg)](https://badge.fury.io/js/langchain-llm7)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue)](https://www.linkedin.com/in/eugene-evstafev-716669181/)
[![Downloads](https://img.shields.io/npm/dy/langchain-llm7)](https://img.shields.io/npm/dy/langchain-llm7)

[LangChain](https://js.langchain.com/) integration for the [LLM7 Chat API](https://api.llm7.io/v1).

This package provides a `ChatLLM7` class that implements the LangChain `SimpleChatModel` interface, allowing seamless integration with the LangChain JS/TS ecosystem for both standard invocation and streaming responses.

## Installation

```bash
npm install langchain-llm7 @langchain/core
````

or

```bash
yarn add langchain-llm7 @langchain/core
```

Note: `@langchain/core` is a peer dependency.

## Usage

Here's how to use the `ChatLLM7` model:

```typescript
import { ChatLLM7 } from "langchain-llm7";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Initialize the model (defaults or provide specific options)
const chat = new ChatLLM7({
  // modelName: "gpt-4o-mini-2024-07-18", // Default
  // temperature: 0.8,
  // maxTokens: 150,
});

const messages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("What is the capital of France?"),
];

// --- Basic Invocation (Non-streaming) ---
console.log("--- Testing invoke() ---");
try {
  const response = await chat.invoke(messages);
  console.log("Response:", response.content);
  // Example Output: Response: Paris
} catch (error) {
  console.error("Invoke Error:", error);
}

// --- Streaming ---
console.log("\n--- Testing stream() ---");
try {
  const stream = await chat.stream(messages);
  let fullResponse = "";
  process.stdout.write("Streamed Response: ");
  for await (const chunk of stream) {
    process.stdout.write(chunk.text); // Use .text for string content of the chunk
    fullResponse += chunk.text;       // Accumulate the text part
  }
  process.stdout.write("\n");
  console.log("(Full streamed content length:", fullResponse.length, ")");
  // Example Output: Streamed Response: Paris
  //                 (Full streamed content length: 5)
} catch (error) {
  console.error("Stream Error:", error);
}
```

## Configuration

You can configure the `ChatLLM7` model by passing parameters to its constructor:

| Parameter    | Type         | Default                      | Description                                                                 |
|--------------|--------------|------------------------------|-----------------------------------------------------------------------------|
| `baseUrl`    | `string`     | `"https://api.llm7.io/v1"`   | Base URL for the LLM7 API.                                                  |
| `modelName`  | `string`     | `"gpt-4o-mini-2024-07-18"` | The specific LLM7 model to use.                                               |
| `temperature`| `number`     | `1.0`                        | Sampling temperature (usually between 0 and 2). Higher values mean more randomness. |
| `maxTokens`  | `number`     | `undefined`                  | Maximum number of tokens to generate in the completion.                     |
| `timeout`    | `number`     | `120`                        | Request timeout in seconds.                                                 |
| `maxRetries` | `number`     | `3`                          | Maximum number of retries for failed API requests (network errors, 5xx, 429). |
| `stop`       | `string[]`   | `undefined`                  | Optional list of sequences where the API should stop generating tokens.     |

All standard `BaseChatModelParams` like `callbacks`, `verbose`, etc., are also accepted.

## Development


1.  Clone the repository: `git clone https://github.com/chigwell/npm-langchain-llm7.git`
2.  Install dependencies: `cd npm-langchain-llm7 && npm install`
3.  Build the package: `npm run build`
4.  Run tests (using the example): `npx ts-node test.ts`

## Contributing

Contributions are welcome\! Please feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/chigwell/npm-langchain-llm7).

## License

This package is licensed under the [Apache License 2.0](https://www.google.com/search?q=LICENSE).
