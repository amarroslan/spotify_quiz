# Page dependency trees

## `/` (Spotify quiz)
Entry: `frontend/src/App.jsx`
Dependencies:
- `frontend/src/api.js`
- `frontend/src/quiz.js`
- `frontend/src/styles.css`
- `frontend/src/main.jsx`
  - `frontend/src/App.jsx`

The page has landing, loading, error, question, and results states. The question state renders a progress line, question metadata, multiple-choice answer buttons, feedback, and a next-question action.
