# SEIZURELE

A classic, barebones Wordle clone built as a static web app.

## Features

- 6 guesses to find a 5-letter word
- Color hints for correct, present, and absent letters
- Solve timer starts on the first guess input
- Share result button copies score plus solve time
- Simple keyboard and responsive layout

## Deployment

This project is static and can be hosted easily on Vercel.

### Deploy steps

1. Push the project to a Git repository.
2. Import the repository into Vercel.
3. Configure the root folder as the deployment target.
4. Vercel will detect the static site and serve `index.html`.

## Local preview

Open `index.html` in your browser, or serve with a static file server.

## Files

- `index.html` — main page and UI layout
- `app.js` — Wordle game logic, timer, and share support
- `allowed.txt` — source list for valid guesses
- `words.js` — answer list for today’s solution
