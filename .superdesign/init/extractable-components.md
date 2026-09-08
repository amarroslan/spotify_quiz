# Extractable components

No reusable components exist yet. The next redesign may extract these patterns in code after the visual direction is approved:

## QuizHeader
- Source: `frontend/src/App.jsx`
- Category: layout
- Description: Brand label and sign-out action.
- Extractable props: none required

## AnswerOption
- Source: `frontend/src/App.jsx`
- Category: basic
- Description: Multiple-choice answer with selected, correct, and wrong states.
- Extractable props: `label`, `state`, `onSelect`
