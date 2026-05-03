# BioForge

BioForge is an AI-assisted experiment design tool. A researcher types a scientific hypothesis, the app runs a literature QC pass (novelty classification against a corpus, with up to 5 grounded references), and then generates a full experiment plan—structured hypothesis, step-by-step protocol, materials list, controls, risks, timeline, and budget. Reviewer feedback is persisted and fed back as few-shot examples on future similar hypotheses, so the system improves with use.

## Agent Architecture

The plan generation backend is a three-agent [AG2](https://ag2.ai) pipeline running as a stateless Python sidecar. The **Designer** drafts the full `ExperimentPlan` from the hypothesis and QC result; the **Verifier** checks it against domain constraints (temperature ranges, timing, budget, physical plausibility) and produces typed `Violation` objects; the **Rectifier** receives both the draft and violations and emits a corrected final plan. All agents use Gemini 2.5 Flash with `response_format=PydanticModel` for structured output, and the Node API route Zod-re-parses the wire response for double validation. When `GEMINI_API_KEY` is unset, a Python stub serves the endpoint deterministically; when the sidecar is unreachable, a TypeScript stub takes over so the UI stays functional without any Python process.

## Getting Started

### Prerequisites

- Node.js
- Python 3.x

### Installation

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -e ./agents[dev]

# Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

### Running

```bash
# Start both Node and Python processes
npm run dev:full

# Or run Node only (TypeScript stub mode)
npm run dev
```

### Testing

```bash
# TypeScript tests
npm test

# Python sidecar tests
cd agents && pytest
```

Tests cover stub parity, verifier rules, and the Designer→Verifier→Rectifier FSM.
