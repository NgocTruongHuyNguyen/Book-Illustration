# Plan
Co-author: claude.ai

Source: Google's "Illustrate a book: The Wind in the Willows" notebook
(steps 1–5 only). Extracted by running the notebook directly.

## Context / book text handling
- Book text uploaded once via File API: `client.files.upload(file="book.txt")`
- An initial "interaction" is created referencing that uploaded file
  (`book_interaction`)
- Every subsequent step calls `client.interactions.create(...,
  previous_interaction_id=<id of the prior step's interaction>, ...)`.
  This is the Interactions API help Gemini maintains the conversation
  server-side
- You never re-send book text or prior step outputs.
- Each step's response becomes the `previous_interaction_id` for the
  next step which is a linear chain: book → style → characters → portraits →
  chapters → illustrations.
- REST mapping: need to find the Interactions API's REST endpoint in
  ai.google.dev/gemini-api/docs
- Backend implication: on project creation, upload the book once and
  create the root interaction; store its ID. After every step, store
  the new interaction's ID as "last_interaction_id" for that project —
  this is critical resumability state, not just a nice-to-have.

## Step 1 — Style
- Text Model: gemini-3.6-flash
- Image Model: gemini-3.1-flash-lite-image
- Call type: client.interactions.create(model=..., input=<prompt>,
  previous_interaction_id=book_interaction.id, service_tier=...)`
- Input/Two branches:
  - If user leaves style blank: prompt asks Gemini to invent a style
    fitting the book, chained off book_interaction.
  - If user supplies a style: prompt tells Gemini to keep that style in
    mind for future prompts, chained off book_interaction.
- Output: plain text (`style_interaction.output_text`), then wrapped as
  `Follow this style: "{style}"` for reuse in later prompts.

## Step 2 - Character