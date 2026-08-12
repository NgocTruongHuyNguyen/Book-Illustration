# Plan
Co-author: claude.ai

Source: Google's "Illustrate a book: The Wind in the Willows" notebook
(steps 1–5 only). Extracted by running the notebook directly.

## Context / book text handling
- Book text is downloaded (Project Gutenberg) and uploaded once via the
  Gemini File API: `client.files.upload(file="book.txt")`
- This returns a file object/reference (`book`), reused by reference in
  every subsequent step's generate_content call — NOT re-pasted as text.
- REST equivalent: Files API upload endpoint returns a `file.uri`; pass
  that uri in the `contents` of every later generateContent call.
- Backend implication: on project creation, upload book text once, store
  the returned file URI/ID against the project. Every step handler reads
  that stored reference — never re-uploads or re-sends full text.

## Step 1 — Style
- Text Model: gemini-3.6-flash
- Image Model: gemini-3.1-flash-lite-image
- Call type: generate_content, passing the uploaded book file by referenc  (plus an optional user-supplied style string)
- Input: the `book` file object from the one-time upload (see "Context /
  book text handling" above) + optional user style text
- Output shape: plain text (a style desc)