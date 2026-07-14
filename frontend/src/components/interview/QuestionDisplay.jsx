// src/components/interview/QuestionDisplay.jsx - Fixed TTS Multiple Plays
import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Volume2, MessageSquare, Code, Edit3 } from 'lucide-react';
import useStore from '../../store/useStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

export default function QuestionDisplay({ question, questionNumber, totalQuestions, onChatAnswerChange }) {
  const { interviewState } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [chatAnswer, setChatAnswer] = useState('');
  
  // FIXED: Use ref to prevent multiple TTS calls
  const hasInitialized = useRef(false);
  const autoPlayTimeout = useRef(null);

  const generateTTS = httpsCallable(functions, 'textToSpeech');

  useEffect(() => {
    // FIXED: Clear any existing timeout and reset states
    if (autoPlayTimeout.current) {
      clearTimeout(autoPlayTimeout.current);
    }
    
    // Reset states for new question
    setHasAutoPlayed(false);
    setChatAnswer('');
    setIsPlaying(false);
    hasInitialized.current = false;
    
    // Stop any existing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
    }

    // FIXED: Only initialize once per question
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeAudio();
    }

    // Cleanup function
    return () => {
      if (autoPlayTimeout.current) {
        clearTimeout(autoPlayTimeout.current);
      }
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [question.id]); // FIXED: Use question.id instead of entire question object

  const initializeAudio = () => {
    if (question.audioUrl) {
      console.log('Using pre-generated TTS audio for question:', question.id);
      setAudioUrl(question.audioUrl);
      // FIXED: Set timeout with cleanup
      autoPlayTimeout.current = setTimeout(() => {
        if (!hasAutoPlayed && !isPlaying) {
          autoPlayAudio(question.audioUrl);
        }
      }, 800); // Slightly longer delay to ensure component is fully mounted
    } else {
      console.log('Generating TTS audio for question:', question.id);
      generateQuestionAudio();
    }
  };

  const generateQuestionAudio = async () => {
    if (!question.question || loading) return;
    
    setLoading(true);
    try {
      const result = await generateTTS({
        text: question.question,
        questionId: question.id,
        sessionId: interviewState.sessionId
      });
      
      setAudioUrl(result.data.audioUrl);
      console.log('TTS audio generated successfully for question:', question.id);
      
      // FIXED: Auto-play after generation with cleanup check
      autoPlayTimeout.current = setTimeout(() => {
        if (!hasAutoPlayed && !isPlaying) {
          autoPlayAudio(result.data.audioUrl);
        }
      }, 500);
    } catch (error) {
      console.error('Error generating TTS:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoPlayAudio = (url) => {
    if (!url || hasAutoPlayed || isPlaying) return;
    
    console.log('Auto-playing TTS for question:', question.id);
    setHasAutoPlayed(true);
    playAudioWithUrl(url);
  };

  const playAudio = () => {
    if (!audioUrl) return;
    playAudioWithUrl(audioUrl);
  };

  const playAudioWithUrl = (url) => {
    if (!url || isPlaying) return;

    // Stop any existing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    const audio = new Audio(url);
    setAudioElement(audio);
    setIsPlaying(true);
    
    audio.onended = () => {
      setIsPlaying(false);
      setAudioElement(null);
    };
    
    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
      setAudioElement(null);
    };
    
    audio.onpause = () => {
      setIsPlaying(false);
    };
    
    audio.play().catch((error) => {
      console.error('Audio play error:', error);
      setIsPlaying(false);
      setAudioElement(null);
    });
  };

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
      setAudioElement(null);
    }
  };

  const handleChatAnswerChange = (value) => {
    setChatAnswer(value);
    if (onChatAnswerChange) {
      onChatAnswerChange(value);
    }
  };

  // Check if this question requires a chat field
  const requiresChatField = question.requiresWrittenAnswer || 
    (question.question && (
      question.question.toLowerCase().includes('code') ||
      question.question.toLowerCase().includes('algorithm') ||
      question.question.toLowerCase().includes('write') ||
      question.question.toLowerCase().includes('implement') ||
      question.question.toLowerCase().includes('function') ||
      question.question.toLowerCase().includes('sql') ||
      question.question.toLowerCase().includes('query') ||
      question.question.toLowerCase().includes('design')
    ));

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
      {/* Question Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
            {requiresChatField ? (
              <Code className="h-5 w-5 text-blue-600" />
            ) : (
              <MessageSquare className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Question {questionNumber} of {totalQuestions}
            </h3>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-500 capitalize">{question.type} Question</p>
              {requiresChatField && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Written Answer Required
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-32 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <p className="text-xl text-gray-800 leading-relaxed mb-4">
          {question.question}
        </p>
        
        {/* Audio Controls */}
        <div className="flex items-center space-x-4">
          {!isPlaying ? (
            <button
              onClick={playAudio}
              disabled={!audioUrl || loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {loading ? 'Loading...' : hasAutoPlayed ? 'Listen Again' : 'Listen to Question'}
              </span>
            </button>
          ) : (
            <button
              onClick={stopAudio}
              className="flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              <Pause className="h-4 w-4" />
              <span className="text-sm font-medium">Stop Audio</span>
            </button>
          )}
          
          <div className="flex items-center space-x-1 text-gray-500">
            <Volume2 className="h-4 w-4" />
            <span className="text-sm">
              {hasAutoPlayed ? 'Auto-played' : 'Will auto-play'} • {question.audioUrl ? 'Pre-generated' : 'AI-generated'}
            </span>
          </div>
          
          {/* Audio status indicator */}
          {isPlaying && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm">Playing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Field for Written Answers */}
      {requiresChatField && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="flex items-center space-x-2 mb-3">
            <Edit3 className="h-4 w-4 text-purple-600" />
            <h4 className="text-sm font-medium text-gray-700">Written Answer Required</h4>
          </div>
          <textarea
            value={chatAnswer}
            onChange={(e) => handleChatAnswerChange(e.target.value)}
            placeholder={
              question.question.toLowerCase().includes('code') 
                ? "Write your code here... (You can use any programming language)"
                : "Please provide your detailed written answer here..."
            }
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ 
              fontFamily: question.question.toLowerCase().includes('code') ? 'Monaco, Menlo, monospace' : 'inherit'
            }}
          />
          <div className="mt-2 flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {question.question.toLowerCase().includes('code') 
                ? "Include comments to explain your logic. This will be analyzed along with your verbal explanation."
                : "This written answer will supplement your verbal response for comprehensive evaluation."
              }
            </p>
            <span className="text-xs text-gray-400">
              {chatAnswer.length} characters
            </span>
          </div>
        </div>
      )}

      {/* Expected Points Hint */}
      {question.expectedPoints && question.expectedPoints.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Key areas to cover:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {question.expectedPoints.map((point, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Question Type Badge */}
      <div className="mt-4 flex justify-end">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          question.type === 'technical' || question.type === 'coding'
            ? 'bg-purple-100 text-purple-800'
            : question.type === 'behavioral'
            ? 'bg-green-100 text-green-800'
            : 'bg-orange-100 text-orange-800'
        }`}>
          {question.type.charAt(0).toUpperCase() + question.type.slice(1)} Question
        </span>
      </div>
    </div>
  );
}
