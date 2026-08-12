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
  This is the Interactions API, since Gemini maintains the conversation
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

## Architecture note: two parallel chains
Text chain: book_interaction → style → characters → chapters
Image chain: portrait_setup → portrait₁ → portrait₂ → chapter_setup → illustration₁
Backend must persist both chains' latest interaction IDs per project.

## Models
- Text steps (Style, Characters, Chapters): GEMINI_MODEL_ID = gemini-3.6-flash
- Image steps (Portraits, Illustrations): IMAGE_MODEL_ID = gemini-3.1-flash-lite-image

## Step 1 — Style
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
- Call type: `client.interactions.create(model=..., input=<prompt>,
  previous_interaction_id=style_interaction.id, response_format={...},
  service_tier=...)`
- Input: prompt asks Gemini to describe the main characters, adults only and to prepare an image-generation prompt for each, at least 50 words long
- Output: Structured JSON via response_format, schema = array of Prompt objects, each with `name` and `prompt` fields
- Cap: The notebook does not limit character count in the prompt, output can be longer than 2. The notebook's own default cap, max_character_images is 5. Our max-2 cap must be enforced server-side, not left to the prompt

## Step 3 - Portrait
- Call type: one `client.interactions.create()` per character, each
chained off the previous image interaction's id (own sequential chain,
distinct from the book/style/characters text chain) 
- Setup: A first interaction establishes style + system instructions as a plain message, not a system instruction param (this model currently ignores sys instructio)
- Input: Create an illustration for {name} following this description: \{prompt}`/ character
- Response modality: image only, aspect_ratio 9:16
- Output: image extracted by walking interaction.steps in reverse for a
model_output step with image content, come back as base64 + mime type
- Loop is sliced to `max_character_images`
- This confirms two separate interaction chains need tracking per project (a text chain and an image chain, not just one)

## Step 4 - Chapters
- Call type: client.interactions.create()`, chained off
characters_prompts_interaction.id (continues the TEXT chain, not the
image chain)
- Input: ask Gemini for one illustration prompt per chapter, a single image,  not multi-tiled, it should be very descriptive, explicity naming characters and reusing their established character prompts if they appear, plus listing which character appear in each character
- Output: structured JSON via response_format, same Prompt schema as
characters (array of { name, prompt }), where name here is the chapter
title rather than a character name.
- Result is sliced with `[:max_chapter_images]` after parsing which is same
pattern as characters, needs finding the actual value, and again this
is enforced by slicing after the fact, not by the prompt itself. The notebook's default for max_chapter_images is 3, above our rquired max of 1.

## Step 5 - Illustrations
- Call type: one `client.interactions.create()` per chapter, continuing
the IMAGE chain. Chain off `last_image_interaction`, which at this point is the final portrait interaction from Step 3.
- Setup: a transition interaction tell Gemini illustration of chapters is starting and explicity instructs it to refer back to its own previously generated character illustrations for consistency, while allowing pose/position to change
- Input: `Create an illustration for {chapter name} using
the previously generated characters following this description:
{chapter prompt}`, no image data is re-attached, consistency relies entirely on the model's memory within the chained conversation
- Output: Image extracted the same way as portraits, walk interaction.steps in reverse model_output step with image content, base64 + mime type


