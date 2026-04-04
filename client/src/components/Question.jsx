import { getCategoryColor, getCategoryName } from '../boardConfig';

export default function Question({ question, options, category, onAnswer, canAnswer, answerResult }) {
  const color = getCategoryColor(category);
  const name = getCategoryName(category);

  return (
    <div className="modal-overlay">
      <div className="question-modal">
        <div className="question-category" style={{ backgroundColor: color }}>
          {name}
        </div>
        <p className="question-text">{question}</p>
        <div className="question-options">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => canAnswer && !answerResult && onAnswer(i)}
              className={`option-btn ${
                answerResult
                  ? i === answerResult.correctIndex
                    ? 'correct'
                    : answerResult.selectedIndex === i
                    ? 'wrong'
                    : ''
                  : ''
              }`}
              disabled={!canAnswer || !!answerResult}
            >
              {opt}
            </button>
          ))}
        </div>
        {answerResult && (
          <div className={`answer-feedback ${answerResult.correct ? 'correct' : 'wrong'}`}>
            {answerResult.correct ? 'Correct!' : `Wrong! The answer was: ${answerResult.correctAnswer}`}
          </div>
        )}
      </div>
    </div>
  );
}
