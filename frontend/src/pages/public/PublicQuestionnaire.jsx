import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Film, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { publicApi } from '../../utils/api';
import { LoadingSpinner, PageLoading } from '../../components/ui';

export default function PublicQuestionnaire() {
  const { token } = useParams();
  const [questionnaire, setQuestionnaire] = useState(null);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuestionnaire();
  }, [token]);

  const loadQuestionnaire = async () => {
    try {
      const response = await publicApi.getQuestionnaire(token);
      setQuestionnaire(response.data.questionnaire);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to load questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId, option, checked) => {
    setResponses(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter(v => v !== option) };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await publicApi.submitQuestionnaire(token, { responses });
      setSubmitted(true);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">Oops!</h1>
          <p className="text-dark-300">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-4">Thank You!</h1>
          <p className="text-dark-300">
            Your responses have been submitted. We appreciate you taking the time to fill this out!
          </p>
        </div>
      </div>
    );
  }

  const renderQuestion = (question) => {
    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={responses[question.id] || ''}
            onChange={(e) => handleChange(question.id, e.target.value)}
            className="w-full"
            required={question.required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleChange(question.id, e.target.value)}
            rows={4}
            className="w-full"
            required={question.required}
          />
        );

      case 'select':
        return (
          <select
            value={responses[question.id] || ''}
            onChange={(e) => handleChange(question.id, e.target.value)}
            className="w-full"
            required={question.required}
          >
            <option value="">Select an option...</option>
            {question.options?.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <label key={idx} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(responses[question.id] || []).includes(option)}
                  onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                  className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-dark-200">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'rating':
        return (
          <div className="flex gap-2">
            {[...Array(question.max || 5)].map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChange(question.id, idx + 1)}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  responses[question.id] >= idx + 1
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="border-b border-dark-800">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-white">NTS Films</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-display font-bold text-white mb-4">
            {questionnaire.title}
          </h1>
          {questionnaire.description && (
            <p className="text-lg text-dark-300">{questionnaire.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {questionnaire.questions.map((question, index) => (
            <div key={question.id} className="card p-6">
              <label className="block text-white font-medium mb-4">
                <span className="text-brand-500 mr-2">{index + 1}.</span>
                {question.question}
                {question.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {renderQuestion(question)}
            </div>
          ))}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 text-lg"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Responses
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
